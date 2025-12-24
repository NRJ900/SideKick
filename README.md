# Desktop Sidekick - Complete MVP Specification

## 🎯 Project Overview
**Fast, memory-efficient Windows desktop agent** that activates via global hotkey (Ctrl+Alt+Space), grabs selected text, and provides AI text editing + agentic desktop control (open files/folders, web search) via a sleek command palette.

**Stack**: Tauri v2 + React/TypeScript + Rust  
**Target**: Windows 10/11, single installer (~20MB), <50MB RAM idle

## 📁 Exact File Structure (Generate ALL these files)

```
sidekick/
├── README.md                    # This spec
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs             # Tauri setup + command registration
│   │   ├── lib.rs
│   │   ├── config.rs           # Encrypted config manager
│   │   ├── clipboard.rs        # get_selected_text(), apply_text()
│   │   ├── llm.rs              # OpenAI provider + text actions
│   │   ├── agent.rs            # AgentAction enum + FS search/execute
│   │   └── types.rs            # Shared Rust/TS types (AgentPlan, etc.)
│   └── build.rs                # Capabilities
├── src/                        # React/TS frontend
│   ├── index.html
│   ├── vite.config.ts
│   ├── main.tsx
│   ├── App.tsx                 # Main palette window
│   ├── components/
│   │   ├── CommandPalette.tsx  # Input + action buttons
│   │   ├── TextActions.tsx     # Beautify/Summarize/etc
│   │   ├── AgentPanel.tsx      # Agent mode + confirmation
│   │   └── Settings.tsx        # API key, theme, hotkey
│   ├── hooks/
│   │   ├── useAgent.ts         # Core agent state/logic
│   │   └── useClipboard.ts
│   ├── types.ts                # TS types matching Rust
│   └── styles/
│       ├── globals.css
│       └── palette.module.css
├── package.json
├── tsconfig.json
└── tailwind.config.js
```


## Work Flow

A solid plan is to build Sidekick in stages: foundation → LLM core → agent capabilities → automation → backups/local LLMs, with a clear module layout from day one.

***

## 1. Project foundation

- **Stack & repo setup**  
  - Tauri v2 + React/TypeScript + Rust backend (monorepo).
  - Configure Tauri capabilities: file system, global shortcut, clipboard, opener, custom commands (Rust).
  - CI: GitHub Actions building Windows artifacts on tag push.

- **Core window + hotkey**  
  - Implement the always‑running tray app with:
    - Global hotkey (Ctrl+Alt+Space) via Tauri global‑shortcut plugin.
    - A frameless, always‑on‑top window that acts as the command palette.  
  - Basic React UI: input box, selected‑text preview area, tabs for “Actions” and “Agent”.

- **Config + secure storage**  
  - Rust config manager:
    - Config file: `C:\ProgramData\Sidekick\config.json` (create directory if missing; handle permissions).  
    - Encrypt API keys and sensitive fields (Rust crypto; Fernet‑equivalent AEAD).  
  - React settings UI:
    - Theme (dark/light), hotkey, API keys, allowed actions, model selection.

***

## 2. Clipboard + text tools + LLM core

- **Clipboard and selection**  
  - Rust command `get_selected_text()`:
    - Save clipboard → send Ctrl+C → small delay → read text → restore if needed, using system clipboard APIs.
  - Rust command `apply_text(text, mode)` for:
    - Copy to clipboard.  
    - Replace selection (set clipboard + Ctrl+V).  

- **LLM abstraction layer**  
  - Rust `LlmProvider` trait with implementations:
    - OpenAI, Claude, Gemini, DeepSeek (HTTP clients).
  - Expose commands:
    - `llm_text_action(operation, text, options)` for Beautify / Expand / Summarize / Fix grammar.  
    - `llm_agent_intent(input_text, context)` for structured agent plans (returns JSON).  

- **Frontend text actions**  
  - React UI:
    - Buttons for core actions; panel showing input and output.  
    - Flow: hotkey → load selection → choose action → show result → “Copy / Replace / Insert”.

***

## 3. Agent core (intent → plan → safe execution)

- **Intent schema & validation**  
  - Define Rust structs for agent actions, e.g.:
    - `WebSearch { query }`  
    - `OpenFolder { name }`  
    - `OpenFile { name }`  
    - `DesktopAutomation { app, steps: [Step] }`  
  - LLM system prompt enforces strict JSON output; parse with `serde_json` and validate enums/constraints.

- **File system agent**  
  - Rust module:
    - Search allowed roots (Documents/Desktop/Downloads/custom paths) for folders/files.
    - Return candidates with metadata; require UI confirmation when ambiguous.  
    - Open via Tauri opener (Explorer / default app).

- **Web search agent**  
  - For `web_search` action:
    - Build URL `https://<engine>/search?q=...` and call opener to launch default browser.
    - Optional quick confirm toast in UI.

- **Permissions & safety**  
  - Config flags: allow_open_files, allow_open_folders, allow_web, allow_automation, offline_only.
  - Backend enforces these before executing a plan; UI shows why an action is blocked.

***

## 4. Desktop UI automation (Comet‑for‑Windows layer)

- **UI Automation integration**  
  - Add Rust module using Windows UI Automation via `uiautomation` crate or `windows` bindings.
  - Capabilities:
    - Enumerate top‑level windows, filter by title/process.
    - Find controls by name/control type/AutomationId.
    - Invoke controls (Invoke, Toggle, Value patterns).

- **Mouse/keyboard automation**  
  - Integrate `rustautogui` / `rsautogui`:
    - Move mouse, click, scroll, type text as fallback.

- **Automation plan format**  
  - Extend agent schema to support:
    - `FocusApp { name | process }`  
    - `ClickElement { selector }`  
    - `SetText { selector, value }`  
    - `KeySequence { keys }`  
  - LLM outputs multi‑step plans; Rust executes step‑by‑step with:
    - Dry‑run preview in UI for “risky” flows.  
    - Early abort and error feedback on failure.

***

## 5. Chat history, local DB, and search

- **SQLite integration**  
  - Embed SQLite in Tauri via Rust or SQL plugin; DB file under `C:\ProgramData\Sidekick\db\sidekick.sqlite`.
  - Tables:
    - `conversations` (id, title, created_at, profile, tags).  
    - `messages` (id, conversation_id, role, content, metadata).  

- **History UI**  
  - React:
    - “History” view: list and search.  
    - Open a conversation to continue it; bound context window for LLM.  
    - Pin/favorite important threads.

- **Privacy options**  
  - Toggle: “Store history” on/off.  
  - “Forget last N conversations” and “Clear all history”.

***

## 6. Cloud backup & sync (optional but planned)

- **Backup format**  
  - Rust creates encrypted backup bundles (zip of SQLite + config minus secrets).
  - Store in a temp folder before upload.

- **Provider integration**  
  - OAuth flow via Tauri (custom URI scheme) for Google Drive / other providers.
  - Use provider APIs to upload to app‑specific folder.  

- **Scheduling & control**  
  - Settings:
    - Provider choice, frequency, “backup now”, retention settings.
  - Logs for backup success/failure.

***

## 7. Local LLM support and routing

- **Local provider (Ollama or similar)**  
  - Add `LocalLlmProvider` that talks to `http://localhost:11434` (Ollama) or a configurable endpoint.
  - Settings:
    - Endpoint URL, available local models, test connection button.

- **Routing rules**  
  - Per‑action configuration:
    - Text editing → local or cloud based on user choice.  
    - “Needs web knowledge” → cloud only.  
  - “Offline mode” toggle:
    - Only local provider allowed; show warnings if a task requires web.

- **Same safety pipeline**  
  - Local LLM outputs still go through JSON schema validation and safety checks before any agent action.

***

## 8. Logging, diagnostics, and polish

- **Logging**  
  - Structured logs in `C:\ProgramData\Sidekick\logs`.
  - Log:
    - LLM calls (metadata), agent plans, executed actions, errors, updates.  
  - In‑app log viewer with filters.

- **Auto‑update integration**  
  - On startup and periodically, check for updates and prompt or auto‑install.

- **UX & accessibility**  
  - Keyboard‑first design, focus management, proper roles/labels.
  - Profiles/modes, shortcuts for common agent actions, clear error toasts.

***

## 9. development order 

1. **M1 – Shell & basics**  
   - Tauri app, tray, hotkey, palette, clipboard read/write, simple text‑to‑LLM (Beautify).  
2. **M2 – Full text tools + config**  
   - All text actions, settings for models/keys/themes, encrypted config.  
3. **M3 – Agent (files, web search)**  
   - Intent → JSON → `open_folder`, `open_file`, `web_search` executed safely.  
4. **M4 – Desktop automation**  
   - UIAutomation & autogui, simple scripted flows with preview.  
5. **M5 – History & local DB**  
   - SQLite history, search, pinned threads.  
6. **M6 – Local LLM + offline mode**  
   - Local provider support and routing logic.  
7. **M7 – Backup + updater + polish**  
   - Cloud backup, auto‑updates, logging UI, permissions refinements.




## Description
Desktop Sidekick is a fast, memory-efficient Windows desktop agent built with Tauri, React/TypeScript, and Rust.

It activates via global hotkey (Ctrl+Alt+Space) over any app, grabs selected text, and offers AI-powered text editing (beautify, summarize, expand, fix grammar) plus agentic commands like opening folders/files, web searches, and desktop UI automation (clicking buttons, navigating apps).

Features persistent chat history in local SQLite, optional cloud backups (Google Drive/etc.), local LLM support (Ollama), auto-updates from GitHub, strict safety permissions, and structured logging—all in a sleek, always-on-top command palette with dark/light themes.

