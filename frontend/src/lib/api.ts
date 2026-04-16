export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export type ChatSource = {
  title: string;
  source_type: string;
  source_path: string;
  score: number;
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
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
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
