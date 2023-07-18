use std::{
    collections::HashMap,
    env,
    io::Error as IoError,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use backend::ClientMessage;
use log::{debug, error, log_enabled, info, Level};

use futures_channel::mpsc::{unbounded, UnboundedSender};
use futures_util::{future, pin_mut, stream::TryStreamExt, StreamExt};

use tokio::{net::{TcpListener, TcpStream}, spawn};
use tokio_tungstenite::tungstenite::protocol::Message;

type Tx = UnboundedSender<Message>;
type PeerMap = Arc<Mutex<HashMap<SocketAddr, Tx>>>;
type Votes = Arc<Mutex<Vec<i32>>>;

const VOTE_SIZE: usize = 4;

async fn handle_connection(peer_map: PeerMap, raw_stream: TcpStream, addr: SocketAddr, votes: Votes) {
    info!("Incoming TCP connection from: {}", addr);

    let ws_stream = tokio_tungstenite::accept_async(raw_stream)
        .await
        .expect("Error during the websocket handshake occurred");
    info!("WebSocket connection established: {}", addr);

    // Insert the write part of this peer to the peer map.
    let (tx, rx) = unbounded();
    peer_map.lock().unwrap().insert(addr, tx);

    let (outgoing, incoming) = ws_stream.split();

    let process_incoming = incoming.try_for_each(|ws_msg| {
        debug!("Received a message from {}: {}", addr, ws_msg.to_text().unwrap());
        // let peers = peer_map.lock().unwrap();

        // // We want to broadcast the message to everyone except ourselves.
        // let broadcast_recipients =
        //     peers.iter().filter(|(peer_addr, _)| peer_addr != &&addr).map(|(_, ws_sink)| ws_sink);

        // for recp in broadcast_recipients {
        //     recp.unbounded_send(msg.clone()).unwrap();
        // }

        let parsed = match ws_msg {
            Message::Text(str) => ClientMessage::parse(&str),
            _ => return future::ok(()),
        };

        let msg = match parsed {
            Ok(msg) => msg,
            Err(e) => {
                debug!("{}", e);
                return future::ok(());
            },
        };

        match msg {
            ClientMessage::ClientSetBallot { user_id, data } => todo!(),
            ClientMessage::ClientVote { user_id, data } => {
                if (data >= VOTE_SIZE) {
                    debug!("vote index >= than VOTE_SIZE: {}", data);
                    return future::ok(());
                }
                votes.lock().unwrap()[data] += 1;
                println!("{:?}", votes.lock().unwrap());
            }
        }


        future::ok(())
    });

    process_incoming.await;


    info!("{} disconnected", &addr);
    peer_map.lock().unwrap().remove(&addr);
}

#[tokio::main]
async fn main() -> Result<(), IoError> {

    env_logger::init();

    let addr = env::args().nth(1).unwrap_or_else(|| "127.0.0.1:8080".to_string());

    let state = PeerMap::new(Mutex::new(HashMap::new()));
    let votes = vec![0; VOTE_SIZE];
    let votes = Arc::new(Mutex::new(votes));

    // Create the event loop and TCP listener we'll accept connections on.
    let try_socket = TcpListener::bind(&addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", addr);

    // Let's spawn the handling of each connection in a separate task.
    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(state.clone(), stream, addr, votes.clone()));
    }

    Ok(())
}