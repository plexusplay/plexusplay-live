use std::error::Error;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "code")]
pub enum ClientMessage {
    #[serde(rename = "setBallot")]
    ClientSetBallot {
        #[serde(rename = "data")]
        ballot_data: ClientSetBallotData,
    },
    #[serde(rename = "vote")]
    ClientVote {
        #[serde(rename = "data")]
        vote: usize,
    },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClientSetBallotData {
    pub choices: Vec<String>,
    pub question: String,
    pub duration_seconds: i64,
}

impl ClientMessage {
    pub fn parse(json_str: &str) -> Result<ClientMessage, Box<dyn Error>> {
        let message: ClientMessage = serde_json::from_str(json_str)?;
        Ok(message)
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "code")]
pub enum ServerMessage {
    #[serde(rename = "setBallot")]
    ServerSetBallot {
        data: ServerSetBallotData,
    },
    #[serde(rename = "setVotes")]
    ServerSetVotes {
        data: Vec<u32>,
    },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ServerSetBallotData {
    pub choices: Vec<String>,
    pub question: String,
    pub duration: time::Duration,
    pub expires: time::OffsetDateTime,
}