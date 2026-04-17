const explicitApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const serviceApiBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
const defaultApiBase = process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "/api";

export const API_BASE_URL = explicitApiBase || serviceApiBase || defaultApiBase;

export type ChatSource = {
  title: string;
  source_type: string;
  source_path: string;
  score: number;
  preview: string;
  content: string;
  excerpt: string;
  reference_id?: string;
  citation_label?: string;
  source_uri?: string;
  hit_type?: "reference" | "chunk";
  snippet?: string;
  doc_id?: string;
  doc_name?: string;
  page_numbers?: number[];
  retrieval_chunks?: string[];
  materials?: string[];
  damage_types?: string[];
};

export type ChatResponse = {
  session_id: string;
  rewritten_query: string;
  risk_level: string;
  answer: string;
  sections: Record<string, string>;
  sources: ChatSource[];
  latency_ms: number;
  retrieval_trace: {
    analysis: {
      materials: string[];
      damage_types: string[];
      risk_level: string;
      notes: string;
    };
    source_count: number;
    raw_doc_reference_count?: number;
    raw_thought_count?: number;
    workflow_message_present?: boolean;
    source_status?: string;
    source_hint?: string;
  };
};

export type SourceSummary = {
  retrieval_mode: string;
  source_backend: string;
  bailian_app_id?: string;
  target_docs_kb_id?: string;
  target_faq_kb_id?: string;
  deployment_target?: string;
  read_only_runtime?: boolean;
  app_configured?: boolean;
  workspace_configured?: boolean;
  cloud_model_enabled?: boolean;
  cloud_sync_enabled?: boolean;
  report?: {
    summary?: string;
    mode_label?: string;
    source_backend?: string;
    last_sync_status?: string;
    sync_detail?: string;
    disabled_operations?: string[];
  };
};

export type RagKnowledgeSummary = {
  generated_at?: string;
  source_count: number;
  chunk_count: number;
  faq_count: number;
  eval_count: number;
  material_count: number;
  damage_type_count: number;
  high_risk_count: number;
  top_materials: Array<{
    name: string;
    count: number;
  }>;
  top_damage_types: Array<{
    name: string;
    count: number;
  }>;
  documents: Array<{
    source_id: string;
    title: string;
    source_path: string;
    materials: string[];
    damage_types: string[];
    risk_level: string;
    excerpt: string;
  }>;
  faq_examples: Array<{
    faq_id: string;
    question: string;
    title: string;
    materials: string[];
    damage_types: string[];
  }>;
  eval_cases: Array<{
    case_id: string;
    question: string;
    title: string;
    expected_keywords: string[];
  }>;
};

export type EvalReport = {
  generated_at: string;
  case_count: number;
  average_score: number | null;
  mode: "live" | "preview";
  live_run_enabled: boolean;
  note: string;
  cases: Array<{
    case_id: string;
    question: string;
    title: string;
    expected_keywords: string[];
    latency_ms: number | null;
    rewritten_query: string;
    score: Record<string, number> | null;
    sources: ChatSource[];
    status: "completed" | "preview";
  }>;
};

export type HealthResponse = {
  status: string;
  backend: string;
  host: string;
  port: number;
  cloud_model_enabled: boolean;
  cloud_sync_enabled: boolean;
  retrieval_mode: string;
  source_backend: string;
  bailian_app_id?: string;
  target_docs_kb_id?: string;
  target_faq_kb_id?: string;
  deployment_target: string;
  read_only_runtime: boolean;
  ingest_enabled: boolean;
  ingest_artifacts_ready: boolean;
  bailian_app_configured: boolean;
};

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  if (API_BASE_URL.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${API_BASE_URL}${normalizedPath.slice(4)}`;
  }
  if (API_BASE_URL.endsWith("/api") && normalizedPath === "/api") {
    return API_BASE_URL;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed: ${response.status}`;

    try {
      const payload = JSON.parse(text) as { error?: string; detail?: string };
      message = payload.error || payload.detail || message;
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getHealth() {
  return requestJson<HealthResponse>("/api/health");
}

export function getSources() {
  return requestJson<SourceSummary>("/api/sources");
}

export function getKnowledgeSummary() {
  return requestJson<RagKnowledgeSummary>("/api/knowledge/summary");
}

export function runIngest(syncCloud = false) {
  return requestJson<SourceSummary["report"]>("/api/ingest/run", {
    method: "POST",
    body: JSON.stringify({ sync_cloud: syncCloud }),
  });
}

export function sendChat(query: string, sessionId: string, debug = true) {
  return requestJson<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      query,
      session_id: sessionId,
      debug,
    }),
  });
}

export function runEval() {
  return requestJson<EvalReport>("/api/eval/run", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
