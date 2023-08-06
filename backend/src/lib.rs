use std::error::Error;

use serde::de::Deserializer;
use serde::ser::{SerializeStruct, Serializer};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "code", content = "data")]
pub enum ClientMessage {
    #[serde(rename = "setBallot")]
    ClientSetBallot(ClientSetBallotData),
    #[serde(rename = "vote")]
    #[serde(deserialize_with = "deserialize_vote")]
    ClientVote(usize),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClientSetBallotData {
    pub choices: Vec<String>,
    pub question: String,
    #[serde(deserialize_with = "deserialize_duration")]
    pub duration: time::Duration,
}

fn deserialize_vote<'de, D>(deserializer: D) -> Result<usize, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = JsonValue::deserialize(deserializer)?;
    match value {
        JsonValue::Number(num) => {
            if let Some(vote) = num.as_u64() {
                Ok(vote as usize)
            } else {
                Err(serde::de::Error::custom("Vote value is out of range for usize"))
            }
        }
        JsonValue::String(s) => s.parse().map_err(serde::de::Error::custom),
        _ => Err(serde::de::Error::custom("Invalid vote type")),
    }
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

#[derive(Deserialize, Debug)]
pub struct ServerSetBallotData {
    pub choices: Vec<String>,
    pub question: String,
    pub duration: time::Duration,
    pub expires: time::OffsetDateTime,
}

impl ServerSetBallotData {
    pub fn serialize(self: &Self) -> String {
        let ret = serde_json::json!({
            "code": "setBallot",
            "data": self,
        });
        return serde_json::to_string(&ret).unwrap();
    }
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
