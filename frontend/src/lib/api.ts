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
  };
};

export type SourceSummary = {
  report?: {
    generated_at?: string;
    source_count?: number;
    chunk_count?: number;
    faq_count?: number;
    eval_count?: number;
    sources?: Array<{
      source_id: string;
      source_path: string;
      title: string;
      metadata: {
        materials?: string[];
        damage_types?: string[];
        risk_level?: string;
      };
    }>;
    sync?: {
      status?: string;
      detail?: string;
    };
    manual_import?: {
      strategy?: string;
      target_docs_kb_id?: string;
      recommended_file_count?: number;
      recommended_files?: string[];
      checklist_path?: string;
      avoid_bundle_path?: string;
      runtime_retrieval_mode?: string;
    };
  };
  faq_count: number;
  chunk_count: number;
  source_count: number;
};

export type EvalReport = {
  generated_at: string;
  case_count: number;
  average_score: number;
  cases: Array<{
    case_id: string;
    question: string;
    title: string;
    expected_keywords: string[];
    latency_ms: number;
    rewritten_query: string;
    score: Record<string, number>;
    sources: ChatSource[];
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
  target_docs_kb_id?: string;
  target_faq_kb_id?: string;
  deployment_target: string;
  read_only_runtime: boolean;
  ingest_enabled: boolean;
  ingest_artifacts_ready: boolean;
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
