use clipboard_win::formats;
use std::{thread, time::Duration};
use tauri::Manager;
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VK_CONTROL, VK_C, VK_V};

#[tauri::command]
pub async fn get_selected_text() -> Result<String, String> {
    // Simulate Ctrl+C
    unsafe {
        keybd_event(VK_CONTROL.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(VK_C.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        thread::sleep(Duration::from_millis(50));
        keybd_event(VK_C.0 as u8, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_CONTROL.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    
    thread::sleep(Duration::from_millis(100));

    // Read clipboard
    // Simple implementation
    match clipboard_win::get_clipboard(formats::Unicode) {
        Ok(text) => Ok(text),
        Err(_) => Ok("".to_string()),
    }
}

#[tauri::command]
pub async fn apply_text(app: tauri::AppHandle, _text: String, mode: String) -> Result<(), String> {
    // Note: 'text' argument is kept for API compatibility but unused here.
    // The Frontend writes to clipboard using the plugin BEFORE calling this.
    
    if mode == "replace" {
         // We need to hide window first to focus the previous app
         if let Some(window) = app.get_webview_window("main") {
             let _ = window.hide();
         }
         // Wait for window to hide and focus to switch (reduced to 150ms for speed)
         thread::sleep(Duration::from_millis(150));

         // Simulate Ctrl+V using SendInput (More robust)
         unsafe {
             use windows::Win32::UI::Input::KeyboardAndMouse::{
                 INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput, 
                 VIRTUAL_KEY, VK_CONTROL, VK_V, KEYBD_EVENT_FLAGS
             };

             fn create_input(vk: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
                 INPUT {
                     r#type: INPUT_KEYBOARD,
                     Anonymous: INPUT_0 {
                         ki: KEYBDINPUT {
                             wVk: vk,
                             wScan: 0,
                             dwFlags: flags,
                             time: 0,
                             dwExtraInfo: 0,
                         },
                     },
                 }
             }

             // Ctrl Down, V Down, V Up, Ctrl Up
             let inputs = [
                 create_input(VK_CONTROL, KEYBD_EVENT_FLAGS(0)),
                 create_input(VK_V, KEYBD_EVENT_FLAGS(0)),
                 create_input(VK_V, KEYEVENTF_KEYUP),
                 create_input(VK_CONTROL, KEYEVENTF_KEYUP),
             ];

             SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
         }
         
         // Wait for paste to register
         thread::sleep(Duration::from_millis(100));
         
         // Bring window back
         if let Some(window) = app.get_webview_window("main") {
             // Force focus back
             let _ = window.show();
             let _ = window.set_focus();
         }
    }
    Ok(())
}

use tauri::{AppHandle, Emitter};
use clipboard_win::raw::seq_num;

pub fn init(app: AppHandle) {
    thread::spawn(move || {
        let mut last_seq = seq_num().map(|n| n.get()).unwrap_or(0);
        loop {
            thread::sleep(Duration::from_millis(1000));
            if let Some(seq_nonzero) = seq_num() {
                let seq = seq_nonzero.get();
                if seq != last_seq {
                    last_seq = seq;
                    // Check if content is text
                    if let Ok(text) = clipboard_win::get_clipboard::<String, _>(formats::Unicode) {
                        if !text.trim().is_empty() {
                            // Emit event to frontend
                            let _ = app.emit("clipboard-monitor/update", text);
                        }
                    }
                }
            }
        }
    });
}
