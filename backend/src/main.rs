use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::{debug, error, log_enabled, info, Level};
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use warp::hyper::Client;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use backend::{ServerSetBallotData, ClientMessage};

// The number of questions on the ballot.
const BALLOT_SIZE: usize = 4;

/// Our global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

/// Our state of currently connected users.
///
/// - Key is their id
/// - Value is a sender of `warp::ws::Message`


type Users = RwLock<HashMap<usize, mpsc::UnboundedSender<Message>>>;
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

    // Keep track of all connected users, key is usize, value
    // is a websocket sender.
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
    });    // Turn our "state" into a new Filter...
    let users = warp::any().map(move || state.clone());

    let ws_endpoint = warp::path::end()
        // The `ws()` filter will prepare Websocket handshake...
        .and(warp::ws())
        .and(users)
        .map(|ws: warp::ws::Ws, users| {
            // This will call our function if the handshake succeeds.
            ws.on_upgrade(move |socket| user_connected(socket, users))
        });

    let addr = env::args()
    .nth(1)
    .unwrap_or_else(|| "127.0.0.1:8080".to_string());

    let addr: SocketAddr = addr
        .parse()
        .expect("Unable to parse socket address");

    warp::serve(ws_endpoint).run(addr).await;
}

async fn user_connected(ws: WebSocket, state: State) {
    // Use a counter to assign a new unique ID for this user.
    let my_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);

    eprintln!("new user: {}", my_id);

    // Split the socket into a sender and receive of messages.
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    // Use an unbounded channel to handle buffering and flushing of messages
    // to the websocket...
    let (tx, rx) = mpsc::unbounded_channel();
    let mut rx = UnboundedReceiverStream::new(rx);

    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            user_ws_tx
                .send(message)
                .unwrap_or_else(|e| {
                    eprintln!("websocket send error: {}", e);
                })
                .await;
        }
    });

    // Save the sender in our list of connected users.
    state.users.write().await.insert(my_id, tx.clone());

    // Send the user the current ballot.
    tx.send(Message::text(state.ballot.read().await.serialize())).unwrap();

    // Return a `Future` that is basically a state machine managing
    // this specific user's connection.

    // Every time the user sends a message, broadcast it to
    // all other users...
    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("websocket error(uid={}): {}", my_id, e);
                break;
            }
        };
        user_message(my_id, msg, &state).await;
    }

    // user_ws_rx stream will keep processing as long as the user stays
    // connected. Once they disconnect, then...
    user_disconnected(my_id, &state.users).await;
}

async fn user_message(my_id: usize, msg: Message, state: &State) {
    // Skip any non-Text messages...
    let msg = if let Ok(s) = msg.to_str() {
        s
    } else {
        return;
    };

    let msg = ClientMessage::parse(msg).unwrap();
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
            send_votes_to_all(state.clone()).await;
        }
        ClientMessage::ClientVote(vote) => {
            if vote >= BALLOT_SIZE {
                debug!("user {} sent vote index >= than VOTE_SIZE: {}", my_id, vote);
                return ();
            }
            state.votes.write().await.insert(my_id, vote);
            send_votes_to_all(state.clone()).await;
        }
    }

    // New message from this user, send it to everyone else (except same uid)...
}

async fn send_votes_to_all(state: State) {
    let votes = collate_votes(state.clone()).await;
    let msg = serde_json::json!({
        "code": "setVotes",
        "data": votes,
    }).to_string();
    send_to_all(msg, state).await;
}

async fn send_to_all(msg: String, state: State) {
    for (_, tx) in state.users.read().await.iter() {
        if let Err(_disconnected) = tx.send(Message::text(&msg)) {
            // The tx is disconnected, our `user_disconnected` code
            // should be happening in another task, nothing more to
            // do here.
        }
    }
}

async fn collate_votes(state: State) -> Vec<u32> {
    let mut ret = vec![0; BALLOT_SIZE];
    let vote_map = state.votes.read().await;
    vote_map.iter().for_each(|(_addr, vote_index)| {
        let vote_index = *vote_index;
        if vote_index < BALLOT_SIZE {
            ret[vote_index] += 1;
        }
    });
    ret
}

async fn user_disconnected(my_id: usize, users: &Users) {
    eprintln!("good bye user: {}", my_id);

    // Stream closed up, so remove from the user list
    users.write().await.remove(&my_id);
}