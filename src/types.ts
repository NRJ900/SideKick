export interface AgentAction {
    type: "open_folder" | "open_file" | "web_search";
    target: string;
}

export interface Candidate {
    name: string;
    path: string;
    icon?: string;
}

export interface AgentPlan {
    id: string;
    action: AgentAction;
    candidates: Candidate[];
    confidence: number;
}
