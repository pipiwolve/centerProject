"use client";

import { startTransition, useEffect, useState } from "react";

import { getHealth, runEval, type EvalReport, type HealthResponse } from "@/lib/api";

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }
  return value;
}

function formatRuntimeLabel(readOnlyRuntime: boolean) {
  return readOnlyRuntime ? "云端环境" : "本地环境";
}

function formatStatusBadge(status: string, overall?: number) {
  if (status === "completed" && typeof overall === "number") {
    return `总分 ${overall}`;
  }
  return "预览模式";
}

function formatScoreLabel(label: string) {
  const mappings: Record<string, string> = {
    relevance: "相关性",
    completeness: "完整性",
    sources: "来源可用性",
    safety: "风险提示",
    operability: "可操作性",
    overall: "综合得分",
  };

  return mappings[label] || label;
}

export function EvalDashboard() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleRun() {
    setBusy(true);
    try {
      const result = await runEval();
      startTransition(() => {
        setReport(result);
        setError("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "评测运行失败，请确认知识库产物已生成。");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const healthResult = await getHealth();
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setHealth(healthResult);
        });

        if (!healthResult.read_only_runtime) {
          return;
        }

        setBusy(true);
        try {
          const previewResult = await runEval();
          if (cancelled) {
            return;
          }
          startTransition(() => {
            setReport(previewResult);
            setError("");
          });
        } catch (caughtError) {
          if (cancelled) {
            return;
          }
          setError(caughtError instanceof Error ? caughtError.message : "评测样例加载失败。");
        } finally {
          if (!cancelled) {
            setBusy(false);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "无法读取评测运行状态。");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const readOnlyRuntime = health?.read_only_runtime ?? false;
  const actionLabel = busy ? (readOnlyRuntime ? "加载评测样例..." : "评测中...") : readOnlyRuntime ? "刷新评测样例" : "运行一次评测";

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">评测工作台</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            案例评估现在区分
            <br />
            云端展示与本地跑批
          </h1>
          <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)]">
            {readOnlyRuntime
              ? "当前是云端只读运行时，页面会优先展示离线评测集或最近一次评测快照，避免在线批量调用失效。"
              : "本地模式下会逐题调用当前问答服务，并按相关性、结构完整性、安全提示等维度实时打分。"}
          </p>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={busy}
            className="mt-6 cursor-pointer rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLabel}
          </button>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">评测摘要</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["模式", report?.mode === "live" ? "实时评测" : readOnlyRuntime ? "云端预览" : "待运行"],
              ["案例数量", report?.case_count ?? 0],
              ["平均得分", formatNumber(report?.average_score)],
              ["运行环境", formatRuntimeLabel(readOnlyRuntime)],
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
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">说明</h2>
          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              {report?.note ||
                "点击上方按钮后，这里会显示当前评测模式说明。云端会优先展示可复用结果，本地则可直接发起实时跑批。"}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
        <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">测试结果清单</h2>
        <div className="mt-5 space-y-4">
          {!report || report.cases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              还没有评测结果。云端环境会自动展示评测样例，本地环境可点击按钮触发实时评测。
            </div>
          ) : (
            report.cases.map((item) => (
              <article
                key={item.case_id}
                className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.question}</p>
                    <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                      {item.status === "completed" ? `改写查询：${item.rewritten_query}` : "当前为云端预览，仅展示评测样例。"}
                    </p>
                  </div>
                  <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    {formatStatusBadge(item.status, item.score?.overall)}
                  </div>
                </div>

                {item.score ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(item.score).map(([label, value]) => (
                      <div key={label} className="rounded-[1.25rem] bg-[color:var(--surface-elevated)] px-3 py-2">
                        <p className="text-xs tracking-[0.2em] text-[color:var(--ink-soft)]">{formatScoreLabel(label)}</p>
                        <p className="mt-1 text-sm font-medium text-[color:var(--ink-strong)]">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.25rem] bg-[color:var(--surface-elevated)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                    预览模式下不实时打分，主要展示已准备的评测题目与关键词，避免云端批量调用失效。
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.expected_keywords.map((keyword) => (
                    <span
                      key={`${item.case_id}-${keyword}`}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
