mod config;
mod clipboard;
mod llm;
mod agent;
mod types;

use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, shortcut, event| {
            if event.state == ShortcutState::Pressed  {
                if shortcut.matches(Modifiers::CONTROL | Modifiers::ALT, Code::Space) {
                     if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        }).build())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                app.global_shortcut().register(tauri_plugin_global_shortcut::Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space)).expect("Failed to register global shortcut");
            }
            // System Tray
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};


            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
            let show_i = MenuItem::with_id(app, "show", "Show Sidekick", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                     match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                             if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                         let app = tray.app_handle();
                         if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app);

            // Initialize Clipboard Sentinel
            clipboard::init(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            // clipboard::get_selected_text,
            clipboard::apply_text,
            llm::llm_text_action,
            llm::agent_intent,
            llm::get_ollama_models,
            agent::execute_agent,
            set_window_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn set_window_mode(app: tauri::AppHandle, mini: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if mini {
            // Unlock first
            let _ = window.set_resizable(true);
            // Clear constraints
            let _ = window.set_min_size(None::<tauri::Size>);
            let _ = window.set_max_size(None::<tauri::Size>);
            // Resize (Height 90 gives room for shadow)
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 600.0, height: 70.0 }));
            // Lock
            let _ = window.set_resizable(false);
        } else {
            // Unlock
            let _ = window.set_resizable(true);
            // Clear constraints
            let _ = window.set_min_size(None::<tauri::Size>);
            let _ = window.set_max_size(None::<tauri::Size>);
             // Resize
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 600.0, height: 400.0 }));
            // Set min size for normal usage
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 400.0, height: 200.0 })));
        }
    }
}
