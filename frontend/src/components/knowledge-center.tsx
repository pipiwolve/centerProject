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

import { formatRiskLabel, formatTimestamp } from "./care-display";

export function KnowledgeCenter() {
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
      setError(caughtError instanceof Error ? caughtError.message : "无法读取知识与来源中心。");
    }
  }

  const refreshOnMount = useEffectEvent(() => {
    void refresh();
  });

  useEffect(() => {
    refreshOnMount();
  }, []);

  return (
    <section className="mx-auto grid w-[min(96%,1440px)] gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">知识与来源中心</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            知识覆盖、来源健康
            <br />
            与案例反馈并列查看
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
            页面同时保留离线知识规模、FAQ 与评测概览，并补上运行时案例统计，便于展示问答系统从数据到闭环的完整链路。
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-6 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
          >
            刷新中心数据
          </button>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">运行状态</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">问答与诊断能力</h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {health?.read_only_runtime ? "云端只读" : "本地完整模式"}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["百炼应用", health?.bailian_app_configured ? "已配置" : "未配置"],
              ["视觉模型", health?.vision_model_configured ? "已配置" : "未配置"],
              ["案例闭环", health?.case_workflow_enabled ? "已启用" : "未启用"],
              ["知识产物", health?.ingest_artifacts_ready ? "已准备" : "未准备"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
          {summary?.case_workflow_reason ? (
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{summary.case_workflow_reason}</p>
          ) : null}
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">离线知识规模</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">知识资产快照</h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              更新时间 {formatTimestamp(knowledge?.generated_at)}
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
              <div key={label} className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-4xl text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">运行时统计</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">案例与反馈监控</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["案例总数", knowledge?.runtime_stats.total_case_count ?? 0],
              ["高风险案例", knowledge?.runtime_stats.high_risk_case_count ?? 0],
              ["无来源回答", knowledge?.runtime_stats.no_source_answer_count ?? 0],
              ["图片不足案例", knowledge?.runtime_stats.insufficient_photo_case_count ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
                <p className="mt-2 font-serif text-4xl text-[color:var(--ink-strong)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
            图片不足占比：{Math.round((knowledge?.runtime_stats.insufficient_photo_ratio ?? 0) * 100)}%
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">标签与触发原因</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TagCard title="高频问题类型" items={knowledge?.runtime_stats.top_damage_types || []} />
            <TagCard title="高频送修触发" items={knowledge?.runtime_stats.top_repair_triggers || []} />
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">资料与 FAQ 预览</h2>
          <div className="mt-5 space-y-4">
            {(knowledge?.documents || []).slice(0, 3).map((item) => (
              <article
                key={item.source_id}
                className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.title}</p>
                  <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                    {formatRiskLabel(item.risk_level)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{item.excerpt}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function TagCard({ title, items }: { title: string; items: Array<{ name: string; count: number }> }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span
              key={item.name}
              className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
            >
              {item.name} · {item.count}
            </span>
          ))
        ) : (
          <span className="text-sm text-[color:var(--ink-soft)]">暂未产生数据。</span>
        )}
      </div>
    </div>
  );
}
