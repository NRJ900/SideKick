use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Config {
    pub openai_api_key: String,
    pub gemini_api_key: String,
    pub deepseek_api_key: String,
    pub llm_provider: String, // "ollama", "openai", "gemini", "deepseek"
    pub ollama_model: String,
    pub ollama_base_url: String,
    pub theme: String,
    pub hotkey: String,
    pub permissions: Permissions,
    pub search_roots: Vec<String>,
    pub clipboard_sentinel: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Permissions {
    pub open_files: bool,
    pub open_folders: bool,
    pub web_search: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            openai_api_key: "".to_string(),
            gemini_api_key: "".to_string(),
            deepseek_api_key: "".to_string(),
            llm_provider: "ollama".to_string(), // Default to local for privacy
            ollama_model: "llama3.1".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            theme: "dark".to_string(),
            hotkey: "Ctrl+Alt+Space".to_string(),
            permissions: Permissions {
                open_files: true,
                open_folders: true,
                web_search: true,
            },
            search_roots: vec![],
            clipboard_sentinel: true,
        }
    }
}

#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Result<Config, String> {
    let config_path = app.path().app_config_dir().unwrap().join("settings.json");
    
    if config_path.exists() {
        let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        let config: Config = serde_json::from_str(&content).unwrap_or_default();
        Ok(config)
    } else {
        Ok(Config::default())
    }
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, updates: Config) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().unwrap();
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    
    let config_path = config_dir.join("settings.json");
    let json = serde_json::to_string_pretty(&updates).map_err(|e| e.to_string())?;
    
    fs::write(config_path, json).map_err(|e| e.to_string())?;
    Ok(())
}
