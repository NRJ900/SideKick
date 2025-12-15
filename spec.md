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

## 🛠️ MVP Features (Phase 1 - 1 week build)

### 1. Core Shell
- [ ] Global hotkey `Ctrl+Alt+Space` → frameless, always-on-top palette (400x500px, centered)
- [ ] System tray icon with "Open Settings", "Quit"
- [ ] Dark/light theme toggle
- [ ] ESC closes palette

### 2. Clipboard Integration
```
get_selected_text() → simulates Ctrl+C → reads clipboard → returns text
apply_text(result, mode="copy|replace") → copies → optional Ctrl+V
```

### 3. Text Actions (OpenAI)
```
Buttons: Beautify | Summarize | Expand | Fix Grammar
Flow: Load selection → pick action → show result → Copy/Replace buttons
```

### 4. Agent Mode (Files + Web)
```
Input: "open folder invoices" → LLM → {action: "open_folder", target: "invoices"}
Search: Documents/Desktop/Downloads + user roots → show candidates → confirm → explorer.exe
Web: "search React hooks" → https://google.com/search?q=React+hooks → default browser
```

### 5. Settings
```
- OpenAI API key (encrypted save)
- Theme (dark/light/system)
- Hotkey (Ctrl+Alt+Space, configurable)
- Agent permissions (files/folders/web)
```

## 🔧 Exact Rust Commands (Tauri::invoke_handler)

```rust
#[tauri::command]
fn get_selected_text() -> Result<String, String>

#[tauri::command]
fn apply_text(text: String, mode: String) -> Result<(), String>

#[tauri::command]
fn llm_text_action(
    operation: String,  // "beautify|summarize|expand|fix_grammar"
    input: String,
    api_key: String
) -> Result<String, String>

#[tauri::command]
fn agent_intent(
    input: String,
    api_key: String
) -> Result<AgentPlan, String>

#[tauri::command]
fn execute_agent(plan_id: String, choice_idx: Option<usize>) -> Result<String, String>

#[tauri::command]
fn get_config() -> Result<Config, String>
#[tauri::command]
fn save_config(updates: serde_json::Value) -> Result<(), String>
```

## 📋 Core Data Structures

### Rust (`src-tauri/src/types.rs`)
```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub enum AgentAction {
    OpenFolder { name: String },
    OpenFile { name: String },
    WebSearch { query: String },
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AgentPlan {
    pub id: String,
    pub action: AgentAction,
    pub candidates: Vec<Candidate>,  // for ambiguous searches
    pub confidence: f32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Candidate {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,  // future
}
```

### TS (`src/types.ts`) - Exact match
```typescript
export interface AgentAction {
  type: "open_folder" | "open_file" | "web_search";
  target: string;
}

export interface AgentPlan {
  id: string;
  action: AgentAction;
  candidates: Candidate[];
  confidence: number;
}
```

## 🤖 Exact LLM System Prompts

### Text Actions (`llm.rs`)
```
You are a text editing assistant. Return ONLY the improved text.

For "beautify": Make professional, well-formatted prose
For "summarize": 3-sentence summary
For "expand": Add details while keeping original meaning
For "fix_grammar": Correct grammar/spelling only
```

### Agent Intent (`agent.rs`)
```
You are a Windows desktop agent. Respond ONLY with valid JSON:

{
  "action": "open_folder|open_file|web_search",
  "target": "exact folder/file name or search query",
  "confidence": 0.0-1.0
}

Examples:
"open folder invoices" → {"action": "open_folder", "target": "invoices", "confidence": 0.95}
"search React hooks" → {"action": "web_search", "target": "React hooks", "confidence": 0.98}
```

## 🎨 UI Layout (Command Palette)

```
┌─[Sidekick]─────────────────────────────┐  ← Draggable titlebar
│ 📄 Selected: "lorem ipsum..."          │
│                                        │
│ [🔄 Beautify] [📝 Summarize]           │  ← Quick actions
│ [➕ Expand]   [✏️ Fix Grammar]         │
│                                        │
│ 💬 Agent: "open folder invoices"       │  ← Text input
│ [Send ➤]                              │
│                                        │
│ 📁 Candidates:                         │  ← Agent results
│ • C:\Users\...\Documents\invoices [OK] │
│                                        │
│ [📋 Copy] [🔄 Replace] [❌ Cancel]      │  ← Action buttons
└────────────────────────────────────────┘
```

**Tabs**: Actions | Agent | History | Settings

## 💾 Config Schema (`C:\ProgramData\Sidekick\config.json`)

```json
{
  "api_key": "encrypted_base64",
  "theme": "dark",
  "hotkey": "Ctrl+Alt+Space",
  "permissions": {
    "open_files": true,
    "open_folders": true,
    "web_search": true
  },
  "search_roots": ["~/Documents", "~/Desktop", "~/Downloads"]
}
```

## 🏗️ Exact Dependencies

### `src-tauri/Cargo.toml`
```toml
[dependencies]
tauri = { version = "2", features = ["...", "protocol-asset"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-opener = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
aes-gcm = "0.10"  # Encryption
clipboard-win = "5"  # Clipboard
windows = { version = "0.58", features = ["Win32_System_Threading"] }
```

### `package.json`
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "react": "^18",
    "react-dom": "^18",
    "tailwindcss": "^3"
  },
  "devDependencies": {
    "vite": "^5",
    "@tauri-apps/cli": "^2"
  }
}
```

## 🚀 Build & Distribution

### GitHub Actions (`.github/workflows/release.yml`)
```
on: push: tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
    - uses: tauri-apps/action@v0
      with: args: tauri build --target universal-apple-darwin,x86_64-pc-windows-msvc
```

### `tauri.conf.json` updater
```json
{
  "updater": {
    "active": true,
    "endpoints": ["https://api.github.com/repos/YOUR_USERNAME/sidekick/releases/latest"],
    "pubkey": "..."  // Generate later
  }
}
```

## ✅ Success Criteria
- [ ] Hotkey opens palette instantly (<100ms)
- [ ] Selected text loads automatically
- [ ] Text actions work with any OpenAI key
- [ ] "open folder X" → searches → confirms → opens Explorer
- [ ] Settings persist encrypted
- [ ] App <50MB RAM idle, ~20MB installer
- [ ] Auto-updates from GitHub tags

## 🎯 AI Generation Prompt
```
"Generate Desktop Sidekick EXACTLY per SPEC.md. Create ALL files with full working code. MVP only. Follow exact file structure, Rust commands, schemas, and prompts. No extras. Testable end-to-end."
```

##
A solid plan is to build Sidekick in stages: foundation → LLM core → agent capabilities → automation → backups/local LLMs, with a clear module layout from day one

***

## 1. Project foundation

- **Stack & repo setup**  
  - Tauri v2 + React/TypeScript + Rust backend (monorepo).[6][1]
  - Configure Tauri capabilities: file system, global shortcut, clipboard, opener, custom commands (Rust).[7][8][9][10]
  - CI: GitHub Actions building Windows artifacts on tag push.

- **Core window + hotkey**  
  - Implement the always‑running tray app with:
    - Global hotkey (Ctrl+Alt+Space) via Tauri global‑shortcut plugin.[11][12][7]
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
    - Save clipboard → send Ctrl+C → small delay → read text → restore if needed, using system clipboard APIs.[8][13]
  - Rust command `apply_text(text, mode)` for:
    - Copy to clipboard.  
    - Replace selection (set clipboard + Ctrl+V).  

- **LLM abstraction layer**  
  - Rust `LlmProvider` trait with implementations:
    - OpenAI, Claude, Gemini, DeepSeek (HTTP clients).[2][14]
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
  - LLM system prompt enforces strict JSON output; parse with `serde_json` and validate enums/constraints.[14][15][2]

- **File system agent**  
  - Rust module:
    - Search allowed roots (Documents/Desktop/Downloads/custom paths) for folders/files.[16][8]
    - Return candidates with metadata; require UI confirmation when ambiguous.  
    - Open via Tauri opener (Explorer / default app).[9][10][17][18]

- **Web search agent**  
  - For `web_search` action:
    - Build URL `https://<engine>/search?q=...` and call opener to launch default browser.[10][17][19][9]
    - Optional quick confirm toast in UI.

- **Permissions & safety**  
  - Config flags: allow_open_files, allow_open_folders, allow_web, allow_automation, offline_only.[20][21][22][23]
  - Backend enforces these before executing a plan; UI shows why an action is blocked.

***

## 4. Desktop UI automation (Comet‑for‑Windows layer)

- **UI Automation integration**  
  - Add Rust module using Windows UI Automation via `uiautomation` crate or `windows` bindings.[4][24][25][26][27][28]
  - Capabilities:
    - Enumerate top‑level windows, filter by title/process.[25][28]
    - Find controls by name/control type/AutomationId.[26][27][29]
    - Invoke controls (Invoke, Toggle, Value patterns).[28][29]

- **Mouse/keyboard automation**  
  - Integrate `rustautogui` / `rsautogui`:
    - Move mouse, click, scroll, type text as fallback.[5][30][31][32]

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
  - Embed SQLite in Tauri via Rust or SQL plugin; DB file under `C:\ProgramData\Sidekick\db\sidekick.sqlite`.[3][33][34][35][36][37][38]
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
  - Rust creates encrypted backup bundles (zip of SQLite + config minus secrets).[39][40][41][42]
  - Store in a temp folder before upload.

- **Provider integration**  
  - OAuth flow via Tauri (custom URI scheme) for Google Drive / other providers.[43][44]
  - Use provider APIs to upload to app‑specific folder.  

- **Scheduling & control**  
  - Settings:
    - Provider choice, frequency, “backup now”, retention settings.[40][41][42][39]
  - Logs for backup success/failure.

***

## 7. Local LLM support and routing

- **Local provider (Ollama or similar)**  
  - Add `LocalLlmProvider` that talks to `http://localhost:11434` (Ollama) or a configurable endpoint.[45][46][47][48]
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
  - Structured logs in `C:\ProgramData\Sidekick\logs`.[49][50][51]
  - Log:
    - LLM calls (metadata), agent plans, executed actions, errors, updates.  
  - In‑app log viewer with filters.

- **Auto‑update integration**  
  - Wire Tauri’s updater to GitHub Releases with a `latest.json` or update server.[52][53][54][55]
  - On startup and periodically, check for updates and prompt or auto‑install.

- **UX & accessibility**  
  - Keyboard‑first design, focus management, proper roles/labels.[56][57][58]
  - Profiles/modes, shortcuts for common agent actions, clear error toasts.

***

## 9. Suggested development order (milestones)

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

Following this plan gives you a fast, small, and extensible Windows “Sidekick” that can act on text, files, web, and desktop UIs, with local history, optional cloud backup, and local/private LLMs, all behind a safe, schema‑driven Rust agent core.



## Desc

Desktop Sidekick is a fast, memory-efficient Windows desktop agent built with Tauri, React/TypeScript, and Rust.

It activates via global hotkey (Ctrl+Alt+Space) over any app, grabs selected text, and offers AI-powered text editing (beautify, summarize, expand, fix grammar) plus agentic commands like opening folders/files, web searches, and desktop UI automation (clicking buttons, navigating apps).

Features persistent chat history in local SQLite, optional cloud backups (Google Drive/etc.), local LLM support (Ollama), auto-updates from GitHub, strict safety permissions, and structured logging—all in a sleek, always-on-top command palette with dark/light themes.