use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Serialize, Deserialize)]
pub struct Message {
    pub code: String,
    pub data: serde_json::Value,
}

impl Message {
    pub fn parse(json_str: &str) -> Result<Message, Box<dyn Error>> {
        let message: Message = serde_json::from_str(json_str)?;
        Ok(message)
    }
}