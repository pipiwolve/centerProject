"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  getHealth,
  getKnowledgeSummary,
  getSources,
  type HealthResponse,
  type RagKnowledgeSummary,
  type SourceSummary,
} from "@/lib/api";

function formatTimestamp(value?: string) {
  if (!value) {
    return "暂未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderTagList(tags: string[], fallback: string) {
  const values = tags.length > 0 ? tags : [fallback];

  return values.map((tag) => (
    <span
      key={tag}
      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
    >
      {tag}
    </span>
  ));
}

function getRiskToneClasses(riskLevel: string) {
  const normalized = riskLevel.toLowerCase();

  if (/high|高/.test(normalized)) {
    return "border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]";
  }

  if (/medium|中/.test(normalized)) {
    return "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]";
  }

  if (/low|低/.test(normalized)) {
    return "border-[#bae6fd] bg-[#f0f9ff] text-[#0c4a6e]";
  }

  return "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink-soft)]";
}

export function KnowledgeDashboard() {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [knowledge, setKnowledge] = useState<RagKnowledgeSummary | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [summaryResult, healthResult, knowledgeResult] = await Promise.all([
        getSources(),
        getHealth(),
        getKnowledgeSummary(),
      ]);
      startTransition(() => {
        setSummary(summaryResult);
        setHealth(healthResult);
        setKnowledge(knowledgeResult);
        setError("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法连接后端，请检查 Vercel API 服务。");
    }
  }

  const refreshOnMount = useEffectEvent(() => {
    void refresh();
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshOnMount();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const appConfigured = summary?.app_configured ?? health?.bailian_app_configured ?? false;
  const workspaceConfigured = summary?.workspace_configured ?? false;

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">RAG Knowledge Base</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            护理资料页现在直接展示
            <br />
            RAG 知识库内容
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
            这里会同时展示离线整理出的资料规模、标签分布、FAQ 与评测样例，以及当前云端应用的运行状态。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
            >
              刷新知识库信息
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">Knowledge Snapshot</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                知识库规模
              </h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              更新时间 · {formatTimestamp(knowledge?.generated_at)}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["资料篇数", knowledge?.source_count ?? 0],
              ["切片数量", knowledge?.chunk_count ?? 0],
              ["FAQ 数量", knowledge?.faq_count ?? 0],
              ["评测样例", knowledge?.eval_count ?? 0],
              ["材质标签", knowledge?.material_count ?? 0],
              ["高风险资料", knowledge?.high_risk_count ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-4xl text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">标签分布</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">高频材质</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(knowledge?.top_materials || []).length > 0 ? (
                  knowledge?.top_materials.map((item) => (
                    <span
                      key={item.name}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                    >
                      {item.name} · {item.count}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--ink-soft)]">暂未读取到材质标签。</span>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">高频问题类型</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(knowledge?.top_damage_types || []).length > 0 ? (
                  knowledge?.top_damage_types.map((item) => (
                    <span
                      key={item.name}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                    >
                      {item.name} · {item.count}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--ink-soft)]">暂未读取到问题标签。</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">当前云端状态</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["运行模式", summary?.report?.mode_label || health?.retrieval_mode || "bailian_app"],
              ["App ID", summary?.bailian_app_id || health?.bailian_app_id || "未配置"],
              ["文档知识库", summary?.target_docs_kb_id || health?.target_docs_kb_id || "未配置"],
              ["只读运行时", health?.read_only_runtime ?? summary?.read_only_runtime ? "是" : "否"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-3xl break-all text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">百炼应用配置</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                {appConfigured
                  ? "DASHSCOPE_API_KEY 与 BAILIAN_APP_ID 已配置，当前可以请求百炼应用。"
                  : "当前尚未完整配置 BAILIAN_APP_ID 或 API Key，聊天接口将返回明确错误提示。"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">工作区 / 部署环境</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                workspace {workspaceConfigured ? "已配置" : "未配置"} · deployment{" "}
                {health?.deployment_target || summary?.deployment_target || "unknown"} · source backend{" "}
                {summary?.source_backend || health?.source_backend || "bailian"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">核心资料样本</h2>
          <div className="mt-5 space-y-4">
            {(knowledge?.documents || []).length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                还没有读取到知识库资料。
              </div>
            ) : (
              knowledge?.documents.map((item) => (
                <article
                  key={item.source_id || item.title}
                  className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.title}</p>
                      <p className="mt-1 break-all text-xs text-[color:var(--ink-soft)]">{item.source_path}</p>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs ${getRiskToneClasses(item.risk_level)}`}
                    >
                      风险 {item.risk_level || "unknown"}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{item.excerpt}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{renderTagList(item.materials, "未标注材质")}</div>
                  <div className="mt-3 flex flex-wrap gap-2">{renderTagList(item.damage_types, "未标注问题")}</div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">FAQ 样本</h2>
          <div className="mt-5 space-y-3">
            {(knowledge?.faq_examples || []).length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                还没有 FAQ 示例。
              </div>
            ) : (
              knowledge?.faq_examples.map((item) => (
                <article
                  key={item.faq_id}
                  className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.question}</p>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{item.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{renderTagList(item.materials, "通用材质")}</div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">评测样例</h2>
          <div className="mt-5 space-y-3">
            {(knowledge?.eval_cases || []).length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                还没有评测样例。
              </div>
            ) : (
              knowledge?.eval_cases.map((item) => (
                <article
                  key={item.case_id}
                  className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.question}</p>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{item.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {renderTagList(item.expected_keywords, "待补充关键词")}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
