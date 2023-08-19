use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use futures::join;
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::debug;
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use backend::{ServerSetBallotData, ClientMessage};

// The number of questions on the ballot.
const BALLOT_SIZE: usize = 4;

/// Our global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

struct User {
    admin: bool,
    channel: mpsc::UnboundedSender<Message>,
}
type Users = RwLock<HashMap<usize, User>>;
type VoteMap = RwLock<HashMap<usize, usize>>;
type Ballot = RwLock<ServerSetBallotData>;

type State = Arc<StateData>;
struct StateData{
    users: Users,
    votes: VoteMap,
    ballot: Ballot,
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let ballot_data = ServerSetBallotData {
        choices: vec![String::from("Init choice"); BALLOT_SIZE],
        question: String::from("Question from server"),
        duration: time::Duration::new(0, 0),
        expires: time::OffsetDateTime::now_utc(),
    };
    let state = State::new(StateData {
        users: Users::default(),
        votes: VoteMap::default(),
        ballot: RwLock::new(ballot_data),
    });
    // Turn our "state" into a new Filter...
    let state_ref = state.clone();
    let state_ref2 = state.clone();
    let state_filter = warp::any().map(move || state_ref.clone());
    let state_filter_admin = warp::any().map(move || state_ref2.clone());

    let ws_endpoint = warp::path::end()
        // The `ws()` filter will prepare Websocket handshake...
        .and(warp::ws())
        .and(state_filter)
        .map(|ws: warp::ws::Ws, users| {
            // This will call our function if the handshake succeeds.
            ws.on_upgrade(move |socket| user_connected(socket, users, false))
        });

    let admin_endpoint = warp::path("admin")
        // The `ws()` filter will prepare Websocket handshake...
        .and(warp::ws())
        .and(state_filter_admin)
        .map(|ws: warp::ws::Ws, users| {
            // This will call our function if the handshake succeeds.
            ws.on_upgrade(move |socket| user_connected(socket, users, true))
        });

    let state = state.clone();

    let polling_data_task = tokio::task::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(300));

        loop {
            interval.tick().await;
            send_polling_data(state.clone()).await;
        }
    });

    let addr = env::args()
    .nth(1)
    .unwrap_or_else(|| "127.0.0.1:8080".to_string());

    let addr: SocketAddr = addr
        .parse()
        .expect("Unable to parse socket address");

    println!("running on {}", addr);
    let routes = ws_endpoint.or(admin_endpoint);
    let _ = join!(warp::serve(routes).run(addr), polling_data_task);
}

async fn user_connected(ws: WebSocket, state: State, admin: bool) {
    // Use a counter to assign a new unique ID for this user.
    let my_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);

    debug!("new user: {}", my_id);

    // Split the socket into a sender and receive of messages.
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    // Use an unbounded channel to handle buffering and flushing of messages
    // to the websocket...
    let (tx, rx) = mpsc::unbounded_channel();
    let mut rx = UnboundedReceiverStream::new(rx);
    let user = User {
        admin: admin,
        channel: tx.clone(),
    };

    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            user_ws_tx
                .send(message)
                .unwrap_or_else(|e| {
                    debug!("websocket send error: {}", e);
                })
                .await;
        }
    });


    // Save the sender in our list of connected users.
    state.users.write().await.insert(my_id, user);
    // Send the user the current ballot.
    let ballot = state.ballot.read().await.serialize();
    if let Err(_err) = tx.send(Message::text(ballot)) {
        eprint!("couldn't send ballot to {}", my_id);
    }


    // Return a `Future` that is basically a state machine managing
    // this specific user's connection.

    // Every time the user sends a message, broadcast it to
    // all other users...
    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                debug!("websocket error(uid={}): {}", my_id, e);
                break;
            }
        };
        user_message(my_id, msg, &state).await;
    }

    // user_ws_rx stream will keep processing as long as the user stays
    // connected. Once they disconnect, then...
    user_disconnected(my_id, &state).await;
}

async fn user_message(my_id: usize, msg: Message, state: &State) {
    // Skip any non-Text messages...
    let msg = if let Ok(s) = msg.to_str() {
        s
    } else {
        return;
    };

    let msg = match ClientMessage::parse(msg) {
        Ok(msg) => msg,
        Err(e) => {
            debug!("error during parsing: {}", e);
            return;
        }
    };
    match msg {
        ClientMessage::ClientSetBallot(ballot_data) => {
            { // ballot_guard drops outside this closure.
                let mut ballot_guard = state.ballot.write().await;
                ballot_guard.choices = ballot_data.choices;
                ballot_guard.question = ballot_data.question;
                ballot_guard.duration = ballot_data.duration;
                ballot_guard.expires = time::OffsetDateTime::now_utc() + ballot_guard.duration;
            }
            send_to_all(state.ballot.read().await.serialize(), state.clone()).await;
            state.votes.write().await.clear();
        }
        ClientMessage::ClientVote(vote) => {
            if vote >= BALLOT_SIZE {
                debug!("user {} sent vote index >= than VOTE_SIZE: {}", my_id, vote);
                return ();
            }
            state.votes.write().await.insert(my_id, vote);
        }
    }

    // New message from this user, send it to everyone else (except same uid)...
}

async fn send_polling_data(state: State) {
    let votes = collate_votes(state.clone()).await;
    send_to_all(votes.to_string(), state.clone()).await;
    let metadata = metadata(state.clone()).await;
    send_to_admins(metadata.to_string(), state.clone()).await;
}

async fn send_to_admins(msg: String, state: State) {
    _send_to_all(msg, state.clone(), true).await;
}

async fn send_to_all(msg: String, state: State) {
    _send_to_all(msg, state.clone(), false).await;
}

async fn _send_to_all(msg: String, state: State, admin_only: bool) {
    for (_, user) in state.users.read().await.iter() {
        if admin_only && (!user.admin) {
            return;
        }
        if let Err(_disconnected) = user.channel.send(Message::text(&msg)) {
            // The tx is disconnected, our `user_disconnected` code
            // should be happening in another task, nothing more to
            // do here.
        }
    }
}

async fn metadata(state: State) -> serde_json::Value {
    let users = state.users.read().await.len();
    return serde_json::json!({
        "code": "metadata",
        "data": {
            "users": users,
        },
    });
}

async fn collate_votes(state: State) -> serde_json::Value {
    let mut ret = vec![0; BALLOT_SIZE];
    let vote_map = state.votes.read().await;
    vote_map.iter().for_each(|(_addr, vote_index)| {
        let vote_index = *vote_index;
        if vote_index < BALLOT_SIZE {
            ret[vote_index] += 1;
        }
    });
    return serde_json::json!({
            "code": "setVotes",
            "data": ret,
        });
}

async fn user_disconnected(my_id: usize, state: &State) {
    debug!("good bye user: {}", my_id);

    // Stream closed up, so remove from the user list
    state.users.write().await.remove(&my_id);
    state.votes.write().await.remove(&my_id);
}