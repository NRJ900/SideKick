use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentAction {
    #[serde(rename = "open_folder")]
    OpenFolder { #[serde(rename = "target")] name: String },
    #[serde(rename = "open_file")]
    OpenFile { #[serde(rename = "target")] name: String },
    #[serde(rename = "web_search")]
    WebSearch { #[serde(rename = "target")] query: String },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Candidate {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentPlan {
    pub id: String,
    pub action: AgentAction,
    pub candidates: Vec<Candidate>,
    pub confidence: f32,
}
