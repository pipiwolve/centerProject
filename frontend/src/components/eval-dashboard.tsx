"use client";

import { startTransition, useState } from "react";

import { runEval, type EvalReport } from "@/lib/api";

export function EvalDashboard() {
  const [report, setReport] = useState<EvalReport | null>(null);
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

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">
            Evaluation Studio
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            论文截图、测试表与
            <br />
            典型案例都在这里。
          </h1>
          <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)]">
            后端会读取自动生成的测试集，批量跑问答，并按来源相关性、结构完整性、安全提示等维度打分。
          </p>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={busy}
            className="mt-6 cursor-pointer rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "评测中..." : "运行一次评测"}
          </button>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            评测摘要
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["案例数量", report?.case_count || 0],
              ["平均得分", report?.average_score || 0],
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
      </div>

      <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
        <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
          测试结果清单
        </h2>
        <div className="mt-5 space-y-4">
          {!report || report.cases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              还没有评测结果。运行一次评测后，这里会列出每道题的改写查询、得分和来源片段。
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
                      改写查询：{item.rewritten_query}
                    </p>
                  </div>
                  <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    overall {item.score.overall}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(item.score).map(([label, value]) => (
                    <div key={label} className="rounded-[1.25rem] bg-[color:var(--surface-elevated)] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">{label}</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--ink-strong)]">{value}</p>
                    </div>
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
