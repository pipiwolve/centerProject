"use client";

import { startTransition, useEffect, useState } from "react";

import { getHealth, getSources, runIngest, type HealthResponse, type SourceSummary } from "@/lib/api";

export function KnowledgeDashboard() {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [result, healthResult] = await Promise.all([getSources(), getHealth()]);
      startTransition(() => {
        setSummary(result);
        setHealth(healthResult);
        setError("");
      });
    } catch {
      setError("无法连接后端，请先启动本地 Flask 或检查 Vercel API 服务。");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleIngest() {
    if (health && !health.ingest_enabled) {
      setError("当前部署运行在 Vercel 只读环境，请先在本地执行 ./scripts/ingest.sh 后再重新部署。");
      return;
    }
    setBusy(true);
    try {
      await runIngest(false);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "重新 ingest 失败，请检查后端日志。");
    } finally {
      setBusy(false);
    }
  }

  const report = summary?.report;
  const manualImport = report?.manual_import;
  const ingestEnabled = health?.ingest_enabled ?? true;

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">
            Knowledge Flow
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            自动补全 RAG
            <br />
            知识库流水线
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
            原始资料会被自动清洗、切分、标签化、扩写 FAQ，再导出为本地问答资产、答辩评测样本和百炼手动导入清单。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleIngest()}
              disabled={busy || !ingestEnabled}
              className="cursor-pointer rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!ingestEnabled ? "Vercel 运行时只读" : busy ? "正在重建..." : "重新运行 ingest"}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-full border border-[color:var(--border-soft)] px-5 py-3 text-sm transition-colors duration-200 hover:border-[color:var(--accent)]"
            >
              刷新状态
            </button>
          </div>
          {!ingestEnabled ? (
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              当前服务运行在 Vercel，只读模式下不会重写知识库产物。请先在本地执行
              <span className="mx-1 font-semibold text-[color:var(--ink-strong)]">./scripts/ingest.sh</span>
              ，再把
              <span className="mx-1 font-semibold text-[color:var(--ink-strong)]">
                knowledge/generated/manifests
              </span>
              推送到仓库后重新部署。
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            当前产物规模
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["原始资料", report?.source_count || 0],
              ["文档切片", summary?.chunk_count || 0],
              ["FAQ 资产", summary?.faq_count || 0],
              ["评测案例", report?.eval_count || 0],
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
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            百炼归档目标
          </h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">目标知识库 ID</p>
              <p className="mt-2 font-serif text-3xl text-[color:var(--ink-strong)]">
                {manualImport?.target_docs_kb_id || health?.target_docs_kb_id || "未配置"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                v1 只做云端知识库归档展示，在线问答仍使用本地 LangChain 检索。
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">上传规则</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                上传 {(manualImport?.recommended_file_count || 0).toString()} 个独立 Markdown 文件，
                不上传 {manualImport?.avoid_bundle_path || "docs_kb_bundle.md"} 合并包。
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                retrieval mode · {manualImport?.runtime_retrieval_mode || health?.retrieval_mode || "local_langchain"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">
                Latest Run
              </p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                同步与导出状态
              </h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {report?.generated_at ? new Date(report.generated_at).toLocaleString() : "尚未生成"}
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              {report?.sync?.detail || "当前还没有 ingest 记录。"}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              sync status · {report?.sync?.status || "idle"}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              runtime · {health?.deployment_target || "local"} · artifacts ·{" "}
              {health?.ingest_artifacts_ready ? "ready" : "missing"}
            </p>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            手动导入百炼清单
          </h2>
          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              导入清单已生成到 {manualImport?.checklist_path || "knowledge/generated/manifests/bailian-import-checklist.md"}。
              在百炼控制台中逐个上传下方资料，完成后确认云端文档数为{" "}
              {manualImport?.recommended_file_count || 0}。
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              strategy · {manualImport?.strategy || "manual_upload"}
            </p>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            已登记资料
          </h2>
          <div className="mt-5 space-y-3">
            {(report?.sources || []).length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--ink-soft)]">
                暂无资料，请先运行 ingest。
              </div>
            ) : (
              report?.sources?.map((source) => (
                <article
                  key={source.source_id}
                  className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{source.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{source.source_path}</p>
                    </div>
                    <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                      {(source.metadata?.materials || []).join(" / ") || "未标注材质"}
                    </span>
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
