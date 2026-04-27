const explicitApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const serviceApiBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
const defaultApiBase = process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "/api";

export const API_BASE_URL = explicitApiBase || serviceApiBase || defaultApiBase;

export type CaseStatus = "draft" | "in_progress" | "monitoring" | "send_repair" | "closed";
export type CarePlanStatus = "pending" | "completed" | "skipped";

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
    vision_analysis?: {
      materials: string[];
      damage_types: string[];
      affected_parts: string[];
      photo_quality: string;
      risk_level: string;
      missing_views: string[];
      summary: string;
    };
  };
};

export type CaseImage = {
  id: string;
  case_id: string;
  file_path: string;
  url_path: string;
  mime_type: string;
  original_name: string;
  created_at: string;
};

export type VisionAnalysis = {
  id: string;
  case_id: string;
  materials: string[];
  damage_types: string[];
  affected_parts: string[];
  photo_quality: "good" | "usable" | "insufficient";
  risk_level: "low" | "medium" | "high";
  missing_views: string[];
  summary: string;
  created_at: string;
};

export type CaseMessage = {
  id: string;
  case_id: string;
  role: "user" | "assistant";
  content: string;
  answer: string;
  sections: Record<string, string>;
  sources: ChatSource[];
  retrieval_trace: ChatResponse["retrieval_trace"];
  created_at: string;
};

export type CarePlanItem = {
  id: string;
  case_id: string;
  step_type: string;
  title: string;
  instruction: string;
  caution: string;
  status: CarePlanStatus;
  sort_order: number;
};

export type CaseFeedback = {
  id: string;
  case_id: string;
  message_id: string;
  helpful: boolean;
  resolved: boolean;
  needs_repair: boolean;
  unclear_step: string;
  note: string;
  created_at: string;
};

export type CaseFeedbackSummary = {
  count: number;
  helpful_count: number;
  resolved_count: number;
  needs_repair_count: number;
  latest_note: string;
};

export type CaseSummary = {
  id: string;
  title: string;
  status: CaseStatus;
  description: string;
  cover_image_path: string;
  cover_image_url: string;
  risk_level: "low" | "medium" | "high";
  source_mode: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  completed_plan_count: number;
  total_plan_count: number;
  latest_message_at: string;
  latest_user_message: string;
};

export type CaseDetail = {
  id: string;
  title: string;
  status: CaseStatus;
  description: string;
  cover_image_path: string;
  cover_image_url: string;
  risk_level: "low" | "medium" | "high";
  source_mode: string;
  created_at: string;
  updated_at: string;
  images: CaseImage[];
  vision_analysis: VisionAnalysis | null;
  messages: CaseMessage[];
  care_plan: CarePlanItem[];
  feedback: CaseFeedback[];
  feedback_summary: CaseFeedbackSummary;
};

export type CasesResponse = {
  cases: CaseSummary[];
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
  vision_model_configured?: boolean;
  case_workflow_enabled?: boolean;
  case_workflow_reason?: string;
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
  runtime_stats: {
    total_case_count: number;
    high_risk_case_count: number;
    no_source_answer_count: number;
    insufficient_photo_case_count: number;
    insufficient_photo_ratio: number;
    top_damage_types: Array<{ name: string; count: number }>;
    top_repair_triggers: Array<{ name: string; count: number }>;
  };
};

export type EvalCaseResult = {
  suite: "text" | "vision";
  case_id: string;
  question: string;
  title: string;
  expected_keywords: string[];
  latency_ms: number | null;
  rewritten_query: string;
  score: Record<string, number> | null;
  sources: ChatSource[];
  status: "completed" | "preview";
  vision_analysis?: VisionAnalysis | null;
};

export type EvalSuiteReport = {
  suite: "text" | "vision";
  label: string;
  case_count: number;
  average_score: number | null;
  note: string;
  cases: EvalCaseResult[];
};

export type EvalReport = {
  generated_at: string;
  selected_suite: "text" | "vision" | "all";
  case_count: number;
  average_score: number | null;
  mode: "live" | "preview";
  live_run_enabled: boolean;
  note: string;
  cases: EvalCaseResult[];
  suites: EvalSuiteReport[];
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
  vision_model_configured: boolean;
  case_workflow_enabled: boolean;
  case_workflow_reason: string;
  vision_model_name?: string;
};

export function buildApiUrl(path: string) {
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
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

export function listCases(params?: { status?: string; riskLevel?: string }) {
  const query = new URLSearchParams();
  if (params?.status) {
    query.set("status", params.status);
  }
  if (params?.riskLevel) {
    query.set("risk_level", params.riskLevel);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<CasesResponse>(`/api/cases${suffix}`);
}

export function createCase(payload: { description: string; title?: string; images: File[] }) {
  const formData = new FormData();
  formData.append("description", payload.description);
  if (payload.title?.trim()) {
    formData.append("title", payload.title.trim());
  }
  for (const file of payload.images) {
    formData.append("images", file);
  }
  return requestJson<CaseDetail>("/api/cases", {
    method: "POST",
    body: formData,
  });
}

export function getCaseDetail(caseId: string) {
  return requestJson<CaseDetail>(`/api/cases/${caseId}`);
}

export function sendCaseMessage(caseId: string, content: string) {
  return requestJson<CaseDetail>(`/api/cases/${caseId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function updateCase(caseId: string, payload: { title?: string; status?: CaseStatus }) {
  return requestJson<CaseDetail>(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateCarePlanItem(caseId: string, itemId: string, status: CarePlanStatus) {
  return requestJson<CaseDetail>(`/api/cases/${caseId}/plan-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function submitCaseFeedback(
  caseId: string,
  payload: {
    message_id: string;
    helpful: boolean;
    resolved: boolean;
    needs_repair: boolean;
    unclear_step?: string;
    note?: string;
  },
) {
  return requestJson<CaseDetail>(`/api/cases/${caseId}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runEval(suite: "text" | "vision" | "all" = "all") {
  return requestJson<EvalReport>("/api/eval/run", {
    method: "POST",
    body: JSON.stringify({ suite }),
  });
}
