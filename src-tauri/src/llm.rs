use serde_json::json;
use crate::config::Config;

#[tauri::command]
pub async fn llm_text_action(
    app: tauri::AppHandle,
    operation: String,
    input: String,
    _api_key: String // Changed back from_api_key so Tauri can map it correctly
) -> Result<String, String> {
    
    let config = crate::config::get_config(app.clone()).map_err(|e| e.to_string())?;

    // 2. Get System Prompt (File-based)
    let prompt_name = format!("{}.txt", operation);
    let default_prompt = match operation.as_str() {
        "summarize" => "You are a precise summarizer. Summarize the following text concisely.",
        "fix_grammar" => "You are a copy editor. Fix the grammar and spelling of the following text. Output ONLY the fixed text.",
        "beautify" => "You are a text polisher. Improve the flow and tone of the text to be more professional and engaging. Output ONLY the improved text.",
        "expand" => "You are a helpful assistant. Complete the user's thought or define the term provided in the input(Include the input in the output). Provide relevant details, context, and elaboration that directly follows the input. Do not start a new story; continue or explain the existing text.",
        _ => "You are a helpful assistant."
    };

    let system_prompt = get_or_create_prompt(&app, &prompt_name, default_prompt).unwrap_or_else(|_| default_prompt.to_string());
    
    // 3. Call Provider
    match config.llm_provider.as_str() {
        "ollama" => call_ollama(&config, &system_prompt, &input).await,
        "openai" => call_openai(&config, &system_prompt, &input).await,
        _ => Err("Unknown LLM provider".to_string())
    }
}

fn get_or_create_prompt(app: &tauri::AppHandle, filename: &str, default_content: &str) -> Result<String, std::io::Error> {
    use tauri::Manager;
    use std::fs;
    
    let config_dir = app.path().app_config_dir().unwrap();
    let prompts_dir = config_dir.join("prompts");
    
    if !prompts_dir.exists() {
        fs::create_dir_all(&prompts_dir)?;
    }

    let file_path = prompts_dir.join(filename);
    
    if file_path.exists() {
        fs::read_to_string(file_path)
    } else {
        fs::write(&file_path, default_content)?;
        Ok(default_content.to_string())
    }
}

async fn call_ollama(config: &Config, system: &str, user_input: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/generate", config.ollama_base_url);
    
    let prompt = format!("{}\n\nInput:\n{}", system, user_input);

    let res = client.post(&url)
        .json(&json!({
            "model": config.ollama_model,
            "prompt": prompt,
            "stream": false
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama error: {}", res.status()));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    
    let response_text = body["response"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid response format".to_string())?;

    // Post-processing: Strip chatty prefixes common in Llama 3
    // Examples: "Here is the fixed text:", "Sure, here is...", "Output:"
    let cleaned_text = response_text
        .lines()
        .skip_while(|line| {
            let l = line.trim().to_lowercase();
            l.is_empty() 
            || l.starts_with("here is") 
            || l.starts_with("sure") 
            || l.starts_with("output")
            || l.eq("fixed text:")
        })
        .collect::<Vec<&str>>()
        .join("\n");

    let final_text = if cleaned_text.trim().is_empty() {
        // Fallback: If we stripped everything, return raw.
        // This happens if the model puts the answer on the same line as the prefix.
        response_text 
    } else {
        cleaned_text
    };

    Ok(final_text.trim().to_string())
}

async fn call_openai(_config: &Config, _system: &str, _user_input: &str) -> Result<String, String> {
    // Stub for now, can implement if user switches back to cloud
    Err("OpenAI support not yet verified. Please switch to Ollama.".to_string())
}

#[tauri::command]
pub async fn agent_intent(
    input: String,
    _api_key: String
) -> Result<crate::types::AgentPlan, String> {
    // Stub
    use crate::types::{AgentPlan, AgentAction};
    
    let action = if input.contains("folder") {
        AgentAction::OpenFolder { name: "Downloads".to_string() } // Temporary logic
    } else {
        AgentAction::WebSearch { query: input.clone() }
    };

    Ok(AgentPlan {
        id: "plan_1".to_string(),
        action,
        candidates: vec![],
        confidence: 0.9,
    })
}
#[derive(serde::Deserialize)]
struct OllamaModelResponse {
    models: Vec<OllamaModel>,
}

#[derive(serde::Deserialize)]
struct OllamaModel {
    name: String,
}

#[tauri::command]
pub async fn get_ollama_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let config = crate::config::get_config(app).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", config.ollama_base_url);

    let res = client.get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map_err(|_| "Failed to connect to Ollama".to_string())?;

    if !res.status().is_success() {
        return Err(format!("Ollama API returned {}", res.status()));
    }

    let body: OllamaModelResponse = res.json().await.map_err(|e| e.to_string())?;
    
    let names = body.models.into_iter().map(|m| m.name).collect();
    Ok(names)
}
