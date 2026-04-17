"use client";

import { startTransition, useEffect, useState } from "react";

import { getHealth, getSources, type HealthResponse, type SourceSummary } from "@/lib/api";

export function KnowledgeDashboard() {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [summaryResult, healthResult] = await Promise.all([getSources(), getHealth()]);
      startTransition(() => {
        setSummary(summaryResult);
        setHealth(healthResult);
        setError("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法连接后端，请检查 Vercel API 服务。");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const appConfigured = summary?.app_configured ?? health?.bailian_app_configured ?? false;
  const workspaceConfigured = summary?.workspace_configured ?? false;

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">
            Bailian Cloud Status
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            线上来源已经切到
            <br />
            百炼真实命中
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
            当前运行模式不再依赖本地 manifests。问答来源抽屉展示的是百炼应用返回的
            `doc_references` 与召回切片。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
            >
              刷新云端状态
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            云端应用信息
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["运行模式", summary?.report?.mode_label || health?.retrieval_mode || "bailian_app"],
              ["App ID", summary?.bailian_app_id || health?.bailian_app_id || "未配置"],
              ["文档知识库", summary?.target_docs_kb_id || health?.target_docs_kb_id || "未配置"],
              ["来源后端", summary?.source_backend || health?.source_backend || "bailian"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-3xl text-[color:var(--ink-strong)] break-all">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            当前可用性
          </h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">百炼应用配置</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                {appConfigured
                  ? "DASHSCOPE_API_KEY 与 BAILIAN_APP_ID 已配置，当前可以直接请求百炼应用。"
                  : "当前尚未完整配置 BAILIAN_APP_ID 或 API Key，聊天接口将返回明确错误提示。"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">工作区 / 运行环境</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                workspace {workspaceConfigured ? "已配置" : "未配置"} · deployment{" "}
                {health?.deployment_target || summary?.deployment_target || "unknown"} · runtime{" "}
                {health?.read_only_runtime ?? summary?.read_only_runtime ? "只读" : "可写"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">Runtime Notes</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                云端来源说明
              </h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {summary?.retrieval_mode || health?.retrieval_mode || "bailian_app"}
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              {summary?.report?.summary || "当前知识页已切换为百炼应用状态视图。"}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              source backend · {summary?.report?.source_backend || summary?.source_backend || "bailian"}
            </p>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            同步与限制
          </h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">最近同步状态</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                {summary?.report?.sync_detail || "当前未读取到自动同步记录，知识库内容以百炼应用绑定结果为准。"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                sync status · {summary?.report?.last_sync_status || "idle"}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">停用接口</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                `/api/ingest/run` 与 `/api/ingest/status` 已从线上运行链路中停用。本地 `ingest.sh`
                仍保留为资料准备脚本，但不再驱动线上来源抽屉。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            离线资料准备
          </h2>
          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              如果你仍需要补充论文材料或重新整理文档，可以继续在本地执行 `./scripts/ingest.sh`
              与百炼控制台上传流程；但线上问答的真实来源，以百炼应用当次返回为唯一真相。
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
