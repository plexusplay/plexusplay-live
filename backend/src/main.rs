use std::{
    collections::HashMap,
    env,
    io::Error as IoError,
    net::SocketAddr,
    sync::{Arc, Mutex, RwLock},
};

use backend::{ClientMessage, ServerMessage, ServerSetBallotData};

use log::{debug, error, info, log_enabled, Level};

use futures_channel::mpsc::{unbounded, UnboundedSender};
use futures_util::{future, stream::TryStreamExt, StreamExt};

use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::protocol::Message;

type Tx = UnboundedSender<Message>;
type PeerMap = Arc<Mutex<HashMap<SocketAddr, Tx>>>;
type VoteMap = Arc<Mutex<HashMap<SocketAddr, usize>>>;
type Ballot = Arc<Mutex<ServerSetBallotData>>;

const VOTE_SIZE: usize = 4;

async fn handle_connection(
    peer_map: PeerMap,
    vote_map: VoteMap,
    ballot: Ballot,
    raw_stream: TcpStream,
    addr: SocketAddr,
) {
    info!("Incoming TCP connection from: {}", addr);

    let ws_stream = tokio_tungstenite::accept_async(raw_stream)
        .await
        .expect("Error during the websocket handshake occurred");
    info!("WebSocket connection established: {}", addr);

    // Insert the write part of this peer to the peer map.
    let (tx, rx) = unbounded();
    peer_map.lock().unwrap().insert(addr, tx.clone());

    let (outgoing, incoming) = ws_stream.split();

    let process_incoming = incoming.try_for_each(|ws_msg| {
        debug!(
            "Received a message from {}: {}",
            addr,
            ws_msg.to_text().unwrap()
        );

        // // We want to broadcast the message to everyone except ourselves.
        // let broadcast_recipients =
        //     peers.iter().filter(|(peer_addr, _)| peer_addr != &&addr).map(|(_, ws_sink)| ws_sink);

        let parsed = match ws_msg {
            Message::Text(str) => ClientMessage::parse(&str),
            _ => return future::ok(()),
        };

        let msg = match parsed {
            Ok(msg) => msg,
            Err(e) => {
                debug!("{}", e);
                return future::ok(());
            }
        };


        match msg {
            ClientMessage::ClientSetBallot { data } => todo!(),
            ClientMessage::ClientVote { vote } => {
                if vote >= VOTE_SIZE {
                    debug!("user {} sent vote index >= than VOTE_SIZE: {}", addr, vote);
                    return future::ok(());
                }
                vote_map.lock().unwrap().insert(addr, vote);
                send_votes_to_all(peer_map.clone(), vote_map.clone());
            }
        }
        future::ok(())
    });

    let receive_from_others = rx.map(Ok).forward(outgoing);

    // Send ballot data to client
    let msg = serde_json::to_string(&*ballot.lock().unwrap()).unwrap();
    tx.unbounded_send(Message::Text(serde_json::to_string(&msg).unwrap())).expect("Failed to send ballot data");

    future::select(process_incoming, receive_from_others).await;

    info!("{} disconnected", &addr);
    peer_map.lock().unwrap().remove(&addr);
    vote_map.lock().unwrap().remove(&addr);
    send_votes_to_all(peer_map.clone(), vote_map.clone());
}

fn send_votes_to_all(peer_map: PeerMap, vote_map: VoteMap) -> () {
    let msg = serde_json::to_string(&ServerMessage::ServerSetVotes {data: transform_votes(vote_map.clone())}).unwrap();
    send_to_all(peer_map.clone(), msg);
}

fn send_to_all(peer_map: PeerMap, msg: String) -> () {
    let msg = Message::Text(msg);
    for recp in peer_map.lock().unwrap().iter().map(|(_, sink)| sink) {
        recp.unbounded_send(msg.clone()).unwrap();
    }
}

fn transform_votes(vote_map: VoteMap) -> Vec<u32> {
    let vote_map = vote_map.lock().unwrap();
    let mut ret = vec![0; VOTE_SIZE];
    for (_addr, &vote) in vote_map.iter() {
        if vote >= VOTE_SIZE {
            continue;
        }
        ret[vote] += 1;
    }
    ret
}

#[tokio::main]
async fn main() -> Result<(), IoError> {
    env_logger::init();

    let addr = env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:8080".to_string());

    let peer_map = PeerMap::new(Mutex::new(HashMap::new()));
    let vote_map = VoteMap::new(Mutex::new(HashMap::new()));
    let ballot_data = ServerSetBallotData {
        choices: vec![String::from("Init choice"); VOTE_SIZE],
        question: String::from("Question from server"),
        duration: time::Duration::new(0, 0),
        expires: time::OffsetDateTime::now_utc(),
    };
    let ballot: Ballot = Ballot::new(Mutex::new(ballot_data));

    // Create the event loop and TCP listener we'll accept connections on.
    let try_socket = TcpListener::bind(&addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", addr);

    // Let's spawn the handling of each connection in a separate task.


    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(
            peer_map.clone(),
            vote_map.clone(),
            ballot.clone(),
            stream,
            addr,
        ));
    }

    Ok(())
}
