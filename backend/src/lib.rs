use std::error::Error;

use serde::{Deserialize, Serialize};
use serde::ser::{Serializer, SerializeStruct};
use serde::de::Deserializer;

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
    #[serde(deserialize_with = "deserialize_duration")]
    pub duration: time::Duration,
}

fn deserialize_duration<'de, D>(deserializer: D) -> Result<time::Duration, D::Error>
where
    D: Deserializer<'de>,
{
    let timestamp: i64 = Deserialize::deserialize(deserializer)?;

    let duration = time::Duration::seconds(timestamp);

    Ok(duration)
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

#[derive(Deserialize, Debug)]
pub struct ServerSetBallotData {
    pub choices: Vec<String>,
    pub question: String,
    pub duration: time::Duration,
    pub expires: time::OffsetDateTime,
}

impl Serialize for ServerSetBallotData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
        {
            // 4 is the number of fields in the struct.
            let mut state = serializer.serialize_struct("ServerSetBallotData", 4)?;
            state.serialize_field("choices", &self.choices)?;
            state.serialize_field("question", &self.question)?;
            state.serialize_field("duration", &self.duration.whole_seconds())?;
            state.serialize_field("expires", &self.expires.unix_timestamp())?;
            state.end()
        }
}