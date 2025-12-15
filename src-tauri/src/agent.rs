// use crate::types::AgentAction;

#[tauri::command]
pub async fn execute_agent(_plan_id: String, _choice_idx: Option<usize>) -> Result<String, String> {
    // TODO: Execute action
    Ok("Executed".to_string())
}
