"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { getHealth, runEval, type EvalCaseResult, type EvalReport, type HealthResponse } from "@/lib/api";

import { RichText, VisionAnalysisCard } from "./care-display";

const SUITES: Array<{ value: "all" | "text" | "vision"; label: string }> = [
  { value: "all", label: "全部评测" },
  { value: "text", label: "文本问答" },
  { value: "vision", label: "图像诊断" },
];

export function EvalLab() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [suite, setSuite] = useState<"all" | "text" | "vision">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh(nextSuite: "all" | "text" | "vision" = suite) {
    setBusy(true);
    try {
      const [healthResult, reportResult] = await Promise.all([getHealth(), runEval(nextSuite)]);
      startTransition(() => {
        setHealth(healthResult);
        setReport(reportResult);
        setError("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "评测结果读取失败。");
    } finally {
      setBusy(false);
    }
  }

  const refreshOnMount = useEffectEvent(() => {
    void refresh("all");
  });

  useEffect(() => {
    refreshOnMount();
  }, []);

  return (
    <section className="mx-auto grid w-[min(96%,1440px)] gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">评测实验台</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            文本问答与图像诊断
            <br />
            现在分套评测
          </h1>
          <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)]">
            本地模式下可以分别跑文本和视觉评测；云端只读环境会优先展示评测集或最近一次快照，避免批量调用失效。
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {SUITES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSuite(option.value);
                  void refresh(option.value);
                }}
                className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                  suite === option.value
                    ? "border-[color:var(--accent)] bg-[rgba(181,122,51,0.12)] text-[color:var(--ink-strong)]"
                    : "border-[color:var(--border-soft)] text-[color:var(--ink-soft)] hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            className="mt-6 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "刷新中..." : "刷新当前套件"}
          </button>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">评测摘要</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["当前套件", report?.selected_suite || suite],
              ["案例数量", report?.case_count ?? 0],
              ["平均得分", report?.average_score ?? "--"],
              ["运行环境", health?.read_only_runtime ? "云端只读" : "本地环境"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-4xl text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
            {report?.note || "选择评测套件后，这里会展示当前模式说明。"}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">套件说明</h2>
          <div className="mt-5 space-y-3">
            {(report?.suites || []).map((item) => (
              <div key={item.suite} className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.label}</p>
                  <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    {item.case_count} 条
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{item.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">评测结果</p>
            <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">案例明细</h2>
          </div>
          <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
            {report?.cases.length ?? 0} 条
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!report || report.cases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              还没有评测结果。点击左侧按钮后，这里会展示当前套件的评测明细。
            </div>
          ) : (
            report.cases.map((item) => <EvalResultCard key={`${item.suite}-${item.case_id}`} item={item} />)
          )}
        </div>
      </section>
    </section>
  );
}

function EvalResultCard({ item }: { item: EvalCaseResult }) {
  return (
    <article className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.title || item.question}</p>
            <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {item.suite === "vision" ? "图像诊断" : "文本问答"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-[color:var(--ink-soft)]">{item.question}</p>
        </div>
        <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
          {item.status === "completed" ? `综合 ${item.score?.overall ?? "--"}` : "预览模式"}
        </span>
      </div>

      {item.score ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(item.score).map(([label, value]) => (
            <div key={label} className="rounded-[1.1rem] bg-[color:var(--surface-elevated)] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">{label}</p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--ink-strong)]">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.2rem] bg-[color:var(--surface-elevated)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
          当前为预览模式，暂不实时打分。
        </div>
      )}

      <div className="mt-4 rounded-[1.2rem] bg-[color:var(--surface-elevated)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
        <RichText content={item.rewritten_query || "当前没有额外说明。"} />
      </div>

      {item.vision_analysis ? (
        <div className="mt-4">
          <VisionAnalysisCard analysis={item.vision_analysis} />
        </div>
      ) : null}
    </article>
  );
}
