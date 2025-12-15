import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, RefreshCw, CheckCircle2, AlertCircle, Cpu, Shield, Key } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Config Interface matching Rust struct
interface Config {
    openai_api_key: string;
    gemini_api_key: string;
    deepseek_api_key: string;
    llm_provider: string; // "ollama" | "openai" | "gemini" | "deepseek"
    ollama_model: string;
    ollama_base_url: string;
    theme: string;
    hotkey: string;
    permissions: {
        open_files: boolean;
        open_folders: boolean;
        web_search: boolean;
    };
    search_roots: string[];
    clipboard_sentinel: boolean;
}

const DEFAULT_CONFIG: Config = {
    openai_api_key: "",
    gemini_api_key: "",
    deepseek_api_key: "",
    llm_provider: "ollama",
    ollama_model: "llama3.1",
    ollama_base_url: "http://localhost:11434",
    theme: "dark",
    hotkey: "Ctrl+Alt+Space",
    permissions: { open_files: true, open_folders: true, web_search: true },
    search_roots: [],
    clipboard_sentinel: true
};

export default function Settings({ onConfigUpdate }: { onConfigUpdate?: (cfg: Config) => void }) {
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Helper to check if we are in ANY cloud mode
    const isCloud = ["openai", "gemini", "deepseek"].includes(config.llm_provider);

    // Load Config
    useEffect(() => {
        invoke<Config>("get_config")
            .then(c => {
                setConfig(c);
                if (onConfigUpdate) onConfigUpdate(c);
            })
            .catch(err => console.error("Failed to load config:", err))
            .finally(() => setLoading(false));
    }, []);

    // Fetch Ollama Models
    const fetchOllamaModels = async () => {
        try {
            const models = await invoke<string[]>("get_ollama_models");
            setOllamaModels(models);
            return models;
        } catch (e) {
            console.error("Failed to fetch Ollama models:", e);
            setOllamaModels([]);
        }
        return [];
    };

    // Auto-fetch models when choosing Ollama
    useEffect(() => {
        if (config.llm_provider === "ollama") {
            fetchOllamaModels();
        }
    }, [config.llm_provider, config.ollama_base_url]);

    const handleSave = async () => {
        setSaving(true);
        setStatusMsg(null);
        try {
            await invoke("save_config", { updates: config });
            setStatusMsg({ type: 'success', text: "Settings saved successfully!" });
            if (onConfigUpdate) onConfigUpdate(config);

            // Clear message after 3s
            setTimeout(() => setStatusMsg(null), 3000);
        } catch (e: any) {
            console.error(e);
            setStatusMsg({ type: 'error', text: "Failed to save settings." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4 text-center text-zinc-500">Loading configuration...</div>;

    return (
        <div className="flex flex-col h-full animate-fade-in p-2 overflow-y-auto pr-1">
            <h2 className="text-sm font-semibold text-white mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> System Settings</span>
            </h2>

            <div className="space-y-6 pb-20">

                {/* --- Section: General --- */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Core Features
                    </label>

                    {/* Clipboard Sentinel */}
                    <div className="p-3 bg-surface border border-border rounded-lg flex justify-between items-center group hover:border-zinc-700 transition-colors">
                        <div className="flex flex-col">
                            <span className="text-sm text-zinc-200 font-medium">Smart Clipboard Sentinel</span>
                            <span className="text-[10px] text-zinc-500">Auto-detect content copied in other apps</span>
                        </div>
                        <button
                            onClick={() => setConfig({ ...config, clipboard_sentinel: !config.clipboard_sentinel })}
                            className={cn(
                                "w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50",
                                config.clipboard_sentinel ? "bg-primary" : "bg-zinc-700"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-sm",
                                config.clipboard_sentinel ? "translate-x-5" : "translate-x-0"
                            )} />
                        </button>
                    </div>
                </div>

                <div className="w-full h-px bg-white/5" />

                {/* --- Section: Intelligence --- */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-3 h-3" /> Intelligence Provider
                    </label>

                    <div className="space-y-3">
                        {/* Option 1: Local (Ollama) */}
                        <div
                            className={cn(
                                "rounded-xl border p-3 transition-all cursor-pointer relative overflow-hidden",
                                config.llm_provider === "ollama"
                                    ? "bg-surface border-primary/50 shadow-md shadow-black/20"
                                    : "bg-surface/30 border-border hover:bg-surface/50 opacity-80 hover:opacity-100"
                            )}
                            onClick={() => setConfig({ ...config, llm_provider: "ollama" })}
                        >
                            <div className="flex items-center gap-3 mb-1">
                                <div className={cn(
                                    "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                                    config.llm_provider === "ollama" ? "border-primary bg-primary/20" : "border-zinc-600"
                                )}>
                                    {config.llm_provider === "ollama" && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-sm font-medium transition-colors", config.llm_provider === "ollama" ? "text-white" : "text-zinc-400")}>
                                        Local Neural Engine (Ollama)
                                    </span>
                                </div>
                            </div>

                            {config.llm_provider === "ollama" && (
                                <div className="mt-3 pl-7 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <div className="space-y-2">
                                        <div className="relative group">
                                            <select
                                                value={config.ollama_model}
                                                onChange={(e) => setConfig({ ...config, ollama_model: e.target.value })}
                                                className="w-full appearance-none bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-primary focus:outline-none pr-8 cursor-pointer hover:bg-black/40 transition-colors font-mono"
                                            >
                                                <option value={config.ollama_model} className="bg-zinc-900 text-white">{config.ollama_model} (Active)</option>
                                                {ollamaModels.filter(m => m !== config.ollama_model).map(m => (
                                                    <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                ))}
                                            </select>
                                            <RefreshCw
                                                onClick={fetchOllamaModels}
                                                className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500 hover:text-primary cursor-pointer active:rotate-180 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Option 2: Cloud Intelligence */}
                        <div
                            className={cn(
                                "rounded-xl border p-3 transition-all cursor-pointer relative overflow-hidden",
                                isCloud
                                    ? "bg-surface border-primary/50 shadow-md shadow-black/20"
                                    : "bg-surface/30 border-border hover:bg-surface/50 opacity-80 hover:opacity-100"
                            )}
                            onClick={() => {
                                if (!isCloud) setConfig({ ...config, llm_provider: "openai" }); // Default to openai
                            }}
                        >
                            <div className="flex items-center gap-3 mb-1">
                                <div className={cn(
                                    "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                                    isCloud ? "border-primary bg-primary/20" : "border-zinc-600"
                                )}>
                                    {isCloud && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-sm font-medium transition-colors", isCloud ? "text-white" : "text-zinc-400")}>
                                        Cloud Intelligence
                                    </span>
                                </div>
                            </div>

                            {isCloud && (
                                <div className="mt-3 pl-7 animate-fade-in space-y-3" onClick={(e) => e.stopPropagation()}>

                                    {/* Provider Dropdown */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Provider</label>
                                        <select
                                            value={config.llm_provider}
                                            onChange={(e) => setConfig({ ...config, llm_provider: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-primary focus:outline-none cursor-pointer"
                                        >
                                            <option value="openai" className="bg-zinc-900 text-white">OpenAI (ChatGPT)</option>
                                            <option value="gemini" className="bg-zinc-900 text-white">Google Gemini</option>
                                            <option value="deepseek" className="bg-zinc-900 text-white">DeepSeek AI</option>
                                        </select>
                                    </div>

                                    {/* Dynamic API Key Input */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                                            {config.llm_provider === 'openai' ? "OpenAI API Key" :
                                                config.llm_provider === 'gemini' ? "Gemini API Key" :
                                                    "DeepSeek API Key"}
                                        </label>
                                        <div className="relative">
                                            <Key className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                            <input
                                                type="password"
                                                value={
                                                    config.llm_provider === 'openai' ? config.openai_api_key :
                                                        config.llm_provider === 'gemini' ? config.gemini_api_key :
                                                            config.deepseek_api_key
                                                }
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (config.llm_provider === 'openai') setConfig({ ...config, openai_api_key: val });
                                                    else if (config.llm_provider === 'gemini') setConfig({ ...config, gemini_api_key: val });
                                                    else if (config.llm_provider === 'deepseek') setConfig({ ...config, deepseek_api_key: val });
                                                }}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 pl-8 text-xs text-white focus:border-primary focus:outline-none placeholder:text-zinc-700 font-mono transition-colors focus:bg-black/40"
                                                placeholder={
                                                    config.llm_provider === 'openai' ? "sk-..." :
                                                        config.llm_provider === 'gemini' ? "AIza..." :
                                                            "ds-..."
                                                }
                                            />
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0a0a0a]/95 border-t border-white/5 backdrop-blur-md flex items-center justify-between z-10">
                <div className="text-xs">
                    {statusMsg && (
                        <span className={cn("flex items-center gap-1.5 font-medium animate-fade-in",
                            statusMsg.type === 'success' ? "text-green-500" : "text-red-500"
                        )}>
                            {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {statusMsg.text}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                </button>
            </div>
        </div>
    );
}
