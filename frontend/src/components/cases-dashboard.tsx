"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { getHealth, listCases, type CaseStatus, type CaseSummary, type HealthResponse } from "@/lib/api";

import {
  formatRiskLabel,
  formatStatusLabel,
  formatTimestamp,
  getRiskToneClasses,
  getStatusToneClasses,
} from "./care-display";

const STATUS_OPTIONS: Array<{ value: "" | CaseStatus; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "in_progress", label: "处理中" },
  { value: "monitoring", label: "观察中" },
  { value: "send_repair", label: "建议送修" },
  { value: "closed", label: "已完成" },
];

const RISK_OPTIONS = [
  { value: "", label: "全部风险" },
  { value: "low", label: "低风险" },
  { value: "medium", label: "中风险" },
  { value: "high", label: "高风险" },
];

export function CasesDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [error, setError] = useState("");

  async function refresh(nextStatus = status, nextRiskLevel = riskLevel) {
    try {
      const [healthResult, casesResult] = await Promise.all([
        getHealth(),
        listCases({ status: nextStatus, riskLevel: nextRiskLevel }),
      ]);
      startTransition(() => {
        setHealth(healthResult);
        setCases(casesResult.cases);
        setError("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法读取护理档案。");
    }
  }

  const refreshOnMount = useEffectEvent(() => {
    void refresh();
  });

  useEffect(() => {
    refreshOnMount();
  }, []);

  if (health && !health.case_workflow_enabled) {
    return (
      <section className="mx-auto w-[min(96%,1280px)] rounded-[2.3rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">护理档案</p>
        <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">当前仅支持本地案例闭环</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)]">{health.case_workflow_reason}</p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
          >
            返回诊断首页
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[0.84fr_1.16fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--accent)]">护理档案</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
            让每个皮具问题
            <br />
            都有连续记录
          </h1>
          <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)]">
            这里按案例保存图片、初判、护理计划和反馈，便于展示完整的护理决策链路。
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
            >
              新建诊断案例
            </Link>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <h2 className="font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">筛选</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]" htmlFor="cases-status">
                案例状态
              </label>
              <select
                id="cases-status"
                value={status}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setStatus(nextValue);
                  void refresh(nextValue, riskLevel);
                }}
                className="mt-2 w-full rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]" htmlFor="cases-risk">
                风险等级
              </label>
              <select
                id="cases-risk"
                value={riskLevel}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setRiskLevel(nextValue);
                  void refresh(status, nextValue);
                }}
                className="mt-2 w-full rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
              >
                {RISK_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>
      </div>

      <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">案例列表</p>
            <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">已保存案例</h2>
          </div>
          <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
            {cases.length} 条记录
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {cases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm leading-7 text-[color:var(--ink-soft)]">
              当前筛选条件下还没有案例。可以先从首页创建一个新的图像诊断案例。
            </div>
          ) : (
            cases.map((item) => (
              <Link
                key={item.id}
                href={`/cases/${item.id}`}
                className="block rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 transition-colors duration-200 hover:border-[color:var(--accent)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[color:var(--ink-strong)]">{item.title}</p>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getStatusToneClasses(item.status)}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getRiskToneClasses(item.risk_level)}`}>
                        {formatRiskLabel(item.risk_level)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-7 text-[color:var(--ink-soft)]">{item.description}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--ink-soft)]">
                      <span>更新时间 {formatTimestamp(item.updated_at)}</span>
                      <span>图片 {item.image_count} 张</span>
                      <span>
                        计划 {item.completed_plan_count}/{item.total_plan_count}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
