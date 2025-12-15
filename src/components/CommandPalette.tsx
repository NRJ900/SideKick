import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
    MessageSquare,
    FileText,
    Settings as SettingsIcon,
    Clipboard,
    Wand2,
    AlignLeft,
    CheckCheck,
    Sparkles,
    SendHorizontal,
    X,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_NAME } from "../constants";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import Settings from "./Settings";

// Config Type (Simplified)
interface Config {
    clipboard_sentinel: boolean;
    // ... other fields if needed globally
}

export default function CommandPalette() {
    const [activeTab, setActiveTab] = useState<"text" | "agent" | "settings">("text");
    const [selectedText, setSelectedText] = useState("");
    const [agentInput, setAgentInput] = useState("");
    const [isMiniMode, setIsMiniMode] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastAction, setLastAction] = useState<string | null>(null);

    const [resultText, setResultText] = useState<string | null>(null);

    // Global Config State (Loaded on mount)
    const [config, setConfig] = useState<Config>({ clipboard_sentinel: true });
    const configRef = useRef<Config>(config); // Ref to access latest config in listener

    // Update ref when config changes
    useEffect(() => {
        configRef.current = config;
    }, [config]);

    // Drag Guard Ref
    // Windows treats starting a drag as a "blur" event sometimes. 
    // We use this to prevent shrinking when the user is just trying to move the window.
    const isDraggingRef = useRef(false);

    // Initialize
    useEffect(() => {
        // Load initial config
        invoke<Config>("get_config").then(setConfig).catch(console.error);

        // Delay initial grab to ensure window is fully ready and avoid startup crashes
        setTimeout(() => {
            invoke<string>("get_selected_text")
                .then(text => { if (text) setSelectedText(text); })
                .catch(console.error);
        }, 500);

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsMiniMode(false);
            }
        };

        // Clipboard Monitor
        let unlistenClipboard: () => void;

        const setupClipboardListener = async () => {
            // Dynamic import to avoid SSR issues if we were using Next.js, but fine here
            const { listen } = await import('@tauri-apps/api/event');
            unlistenClipboard = await listen<string>('clipboard-monitor/update', (event) => {
                // Check if sentinel is enabled in config
                if (!configRef.current.clipboard_sentinel) return;

                const newText = event.payload;
                // Only update if different and not empty
                if (newText && newText !== selectedText) {
                    setSelectedText(newText);
                    // Visual cue
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 300);
                }
            });
        };
        setupClipboardListener();

        // Mini Mode Logic
        let blurTimeout: NodeJS.Timeout;

        const handleResize = () => {
            // If a resize event happens, we assume the user is interacting
            // Clear any pending blur to prevent shrinking
            clearTimeout(blurTimeout);
        };

        const handleBlur = () => {
            // If we are dragging, DO NOT shrink.
            if (isDraggingRef.current) {
                // Reset flag after a short delay
                setTimeout(() => { isDraggingRef.current = false; }, 200);
                return;
            }

            // Delay blur to see if it was just a transient event (like clicking a resize handle)
            // If a 'resize' event fires in this window, we cancel this.
            blurTimeout = setTimeout(() => {
                setIsMiniMode(true);
            }, 300);
        };

        window.addEventListener("keydown", handleKey);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("keydown", handleKey);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("resize", handleResize);
            clearTimeout(blurTimeout);
            if (unlistenClipboard) unlistenClipboard();
        };
    }, []);

    // Manual Drag Handler
    const startDrag = async (e: React.MouseEvent) => {
        // Prevent default to avoid standard text selection behavior interfering
        e.preventDefault();
        isDraggingRef.current = true;
        try {
            await getCurrentWindow().startDragging();
        } catch (err) {
            console.error("Failed to start dragging:", err);
            isDraggingRef.current = false;
        }
        // Note: We don't immediately set isDraggingRef to false here, 
        // because the 'blur' event fires asynchronously after this.
        // We let handleBlur or a timeout reset it.
        setTimeout(() => { isDraggingRef.current = false; }, 500);
    };

    // Window Resizing Effect
    useEffect(() => {
        // Delegate resizing to Rust backend for stability
        invoke("set_window_mode", { mini: isMiniMode }).catch(console.error);
    }, [isMiniMode]);

    const handleAction = async (op: string) => {
        if (!selectedText) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 400); // Reset after animation
            return;
        }

        setIsLoading(true);
        try {
            const res = await invoke<string>("llm_text_action", { operation: op, input: selectedText, apiKey: "test" });

            setResultText(res);

            // Map operation to readable text
            const labels: Record<string, string> = {
                "summarize": "Summary",
                "fix_grammar": "Grammar Fixed",
                "beautify": "Polished",
                "expand": "Expanded"
            };
            setLastAction(labels[op] || "Result");

        } catch (e: any) {
            console.error(`[Frontend] LLM Error:`, e);
            // Optionally set error state here
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to strip basic markdown for pasting
    const stripMarkdown = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1')     // Italic
            .replace(/__(.*?)__/g, '$1')     // Underline
            .replace(/`([^`]+)`/g, '$1')     // Inline Code
            .replace(/^#+\s+/gm, '')         // Headers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
            .replace(/^\s*-\s+/gm, '• ')     // List items
            .replace(/^\s*\d+\.\s+/gm, '$&'); // Preserve numbered lists
    };

    const handleReplace = async () => {
        if (!resultText) return;
        try {
            const plainText = stripMarkdown(resultText);
            await writeText(plainText);

            await invoke("apply_text", { text: "unused", mode: "replace" });
            setIsMiniMode(true);

        } catch (e: any) {
            console.error("Failed to replace:", e);
        }
    };

    const discardResult = () => {
        setResultText(null);
        setLastAction(null);
    };

    const currentTabContent = () => {
        switch (activeTab) {
            case "text":
                return (
                    <div className="flex flex-col h-full animate-fade-in relative">
                        {/* Header Info */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                                    {resultText ? (lastAction || "Result") : "Selection"}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 bg-surface px-2 py-0.5 rounded border border-border">
                                {(resultText || selectedText).length} chars
                            </span>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 relative group mb-4 overflow-hidden flex flex-col">
                            {resultText ? (
                                // --- Markdown Output View ---
                                <div className="w-full h-full bg-surface border border-primary/20 rounded-lg p-4 text-sm text-zinc-300 overflow-y-auto prose prose-invert prose-sm max-w-none animate-slide-up bg-gradient-to-br from-primary/5 to-transparent">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {resultText}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                // --- Original Input View ---
                                <div className="w-full h-full relative">
                                    <textarea
                                        className="w-full h-full bg-surface border border-border rounded-lg p-3 text-sm font-mono text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-zinc-600 disabled:opacity-50"
                                        value={selectedText}
                                        onChange={(e) => setSelectedText(e.target.value)}
                                        placeholder="Select text in any app to see it here..."
                                        spellCheck={false}
                                        disabled={isLoading}
                                    />
                                    {isLoading && (
                                        <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 cursor-wait">
                                            <div className="flex space-x-1.5">
                                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"></div>
                                            </div>
                                        </div>
                                    )}
                                    {!isLoading && selectedText && (
                                        <button
                                            onClick={() => setSelectedText("")}
                                            className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-300 bg-black/20 rounded hover:bg-black/40 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions Toolbar */}
                        {resultText ? (
                            // --- Result Actions ---
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={discardResult}
                                    className="px-4 py-2 rounded-lg bg-surface border border-border text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all text-xs font-medium"
                                >
                                    Discard / Back
                                </button>
                                <button
                                    onClick={handleReplace}
                                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95 text-xs font-medium flex items-center justify-center gap-2"
                                >
                                    <CheckCheck className="w-4 h-4" /> Replace in App
                                </button>
                            </div>
                        ) : (
                            // --- Input Actions ---
                            <>
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    <ActionBtn label="Beautify" icon={<Wand2 className="w-3.5 h-3.5" />} onClick={() => handleAction("beautify")} />
                                    <ActionBtn label="Summarize" icon={<AlignLeft className="w-3.5 h-3.5" />} onClick={() => handleAction("summarize")} />
                                    <ActionBtn label="Fix Grammar" icon={<CheckCheck className="w-3.5 h-3.5" />} onClick={() => handleAction("fix_grammar")} />
                                    <ActionBtn label="Expand" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => handleAction("expand")} />
                                </div>

                                <div className="border-t border-border pt-3 flex justify-end gap-2">
                                    <button
                                        onClick={async () => {
                                            if (selectedText) await writeText(selectedText);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface border border-border text-zinc-300 hover:bg-zinc-800 transition-colors"
                                    >
                                        <Clipboard className="w-3 h-3" /> Copy
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (selectedText) {
                                                await writeText(selectedText);
                                                await invoke("apply_text", { text: "unused", mode: "replace" });
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-primary hover:bg-primary-hover text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                                    >
                                        <CheckCheck className="w-3 h-3" /> Replace
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                );
            case "agent":
                return (
                    <div className="flex flex-col h-full animate-slide-up justify-center items-center p-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
                            <Sparkles className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">Agent Mode</h3>
                        <p className="text-sm text-text-muted mb-8 max-w-[200px]">
                            "Open Downloads folder" or "Search for React hooks"
                        </p>

                        <div className="w-full relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative flex items-center bg-surface border border-border rounded-lg px-3 py-2.5">
                                <input
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-600"
                                    placeholder="Type a command..."
                                    value={agentInput}
                                    onChange={(e) => setAgentInput(e.target.value)}
                                    autoFocus
                                />
                                <button className="p-1.5 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
                                    <SendHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case "settings":
                return <Settings onConfigUpdate={(c) => { setConfig(c); }} />;
        }
    };

    // --- Render ---

    return (
        <div
            className={cn(
                "relative w-full h-full overflow-hidden font-sans",
                isShaking && "animate-shake"
            )}
        >

            {/* Background (Full Mode Only) */}
            <div
                className={cn(
                    "absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    isMiniMode ? "opacity-0 -translate-y-12" : "opacity-100 translate-y-0"
                )}
            />

            {/* --- Mini Mode View --- */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out",
                    isMiniMode ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-4"
                )}
            >
                <div
                    className="w-full h-full group select-none flex items-center justify-center p-3"
                    onDoubleClick={() => setIsMiniMode(false)}
                    onMouseDown={startDrag}
                >
                    <div
                        className="relative w-full h-full flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 transition-all ring-1 ring-white/5 cursor-move"
                    >
                        <Sparkles className="w-5 h-5 text-primary/80 mr-3 pointer-events-none" />
                        <input
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-500 cursor-text"
                            placeholder={`Ask ${APP_NAME}... (Double-click to Expand)`}
                            value={agentInput}
                            onChange={(e) => setAgentInput(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    // TODO: Submit action
                                }
                                if (e.key === "Escape") {
                                    setIsMiniMode(false);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* --- Full Mode View --- */}
            <div
                className={cn(
                    "absolute inset-0 flex w-full h-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    !isMiniMode ? "opacity-100 translate-y-0 delay-75" : "opacity-0 pointer-events-none -translate-y-8"
                )}
            >
                {/* Sidebar */}
                <div className="w-[60px] bg-black/40 border-r border-white/5 flex flex-col items-center py-5 gap-4 shrink-0 transition-opacity duration-300 rounded-l-xl">
                    <TabButton active={activeTab === "text"} onClick={() => setActiveTab("text")} icon={<FileText className="w-5 h-5" />} />
                    <TabButton active={activeTab === "agent"} onClick={() => setActiveTab("agent")} icon={<MessageSquare className="w-5 h-5" />} />
                    <div className="flex-1" />
                    <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<SettingsIcon className="w-5 h-5" />} />
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                    {/* Titlebar */}
                    <div
                        className="h-9 flex items-center justify-between px-4 select-none cursor-move"
                        onMouseDown={startDrag}
                    >
                        <span className="text-xs font-medium text-zinc-500">{APP_NAME}</span>
                    </div>

                    <div className="flex-1 p-5 pt-0 overflow-y-auto min-h-0">
                        {currentTabContent()}
                    </div>
                </div>
            </div>

        </div>
    );
}

// --- Components ---

function TabButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group",
                active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            )}
        >
            {icon}
            {active && <div className="absolute left-0 w-0.5 h-4 bg-primary rounded-r-full" />}
        </button>
    );
}

function ActionBtn({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-2 p-2 rounded-lg bg-surface border border-border hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
        >
            <div className="p-1.5 rounded-full bg-black/20 text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">{label}</span>
        </button>
    );
}
