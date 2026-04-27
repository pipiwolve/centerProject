"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import {
  buildApiUrl,
  getCaseDetail,
  getHealth,
  sendCaseMessage,
  submitCaseFeedback,
  updateCarePlanItem,
  updateCase,
  type CaseDetail,
  type CarePlanItem,
  type CaseStatus,
  type HealthResponse,
} from "@/lib/api";

import {
  CarePlanChecklist,
  FeedbackSummaryCard,
  MessageTimeline,
  SourcePanel,
  VisionAnalysisCard,
  formatRiskLabel,
  formatStatusLabel,
  formatTimestamp,
  getRiskToneClasses,
  getStatusToneClasses,
} from "./care-display";

const STATUS_OPTIONS: Array<{ value: CaseStatus; label: string }> = [
  { value: "in_progress", label: "处理中" },
  { value: "monitoring", label: "观察中" },
  { value: "send_repair", label: "建议送修" },
  { value: "closed", label: "已完成" },
];

export function CaseDetailPage({ caseId }: { caseId: string }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [healthResult, detailResult] = await Promise.all([getHealth(), getCaseDetail(caseId)]);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setHealth(healthResult);
          setDetail(detailResult);
          setError("");
        });
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "无法读取案例详情。");
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const latestAssistantMessage = [...(detail?.messages || [])].reverse().find((message) => message.role === "assistant");

  async function handleSendFollowUp() {
    if (!detail || !followUp.trim() || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendCaseMessage(detail.id, followUp.trim());
      startTransition(() => {
        setDetail(result);
        setFollowUp("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "追加追问失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanToggle(item: CarePlanItem, status: CarePlanItem["status"]) {
    if (!detail) {
      return;
    }
    setBusyPlanId(item.id);
    setError("");
    try {
      const result = await updateCarePlanItem(detail.id, item.id, status);
      startTransition(() => {
        setDetail(result);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "护理计划更新失败。");
    } finally {
      setBusyPlanId("");
    }
  }

  async function handleStatusChange(status: CaseStatus) {
    if (!detail || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await updateCase(detail.id, { status });
      startTransition(() => {
        setDetail(result);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "案例状态更新失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickFeedback(kind: "helpful" | "resolved" | "needs_repair") {
    if (!detail || !latestAssistantMessage || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await submitCaseFeedback(detail.id, {
        message_id: latestAssistantMessage.id,
        helpful: kind === "helpful",
        resolved: kind === "resolved",
        needs_repair: kind === "needs_repair",
        note: feedbackNote,
      });
      startTransition(() => {
        setDetail(result);
        setFeedbackNote("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "反馈提交失败。");
    } finally {
      setBusy(false);
    }
  }

  if (health && !health.case_workflow_enabled) {
    return (
      <section className="mx-auto w-[min(96%,1280px)] rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
        <p className="text-sm leading-7 text-[color:var(--ink-soft)]">{health.case_workflow_reason}</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="mx-auto w-[min(96%,1280px)] rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
        <p className="text-sm leading-7 text-[color:var(--ink-soft)]">{error || "正在读取案例详情..."}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-[min(96%,1440px)] gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="space-y-6">
        <section className="rounded-[2.3rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">个案详情</p>
              <h1 className="mt-4 font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)]">
                {detail.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)]">{detail.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getStatusToneClasses(detail.status)}`}>
                {formatStatusLabel(detail.status)}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getRiskToneClasses(detail.risk_level)}`}>
                {formatRiskLabel(detail.risk_level)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {detail.images.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={buildApiUrl(image.url_path)} alt={image.original_name} className="h-44 w-full object-cover" />
                <p className="truncate px-3 py-2 text-xs text-[color:var(--ink-soft)]">{image.original_name}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[color:var(--ink-soft)]">
            <span>创建于 {formatTimestamp(detail.created_at)}</span>
            <span>最近更新 {formatTimestamp(detail.updated_at)}</span>
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">会话记录</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">诊断时间线</h2>
            </div>
            <Link
              href="/cases"
              className="rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
            >
              返回档案列表
            </Link>
          </div>
          <div className="mt-5">
            <MessageTimeline messages={detail.messages} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">继续追问</p>
          <textarea
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm leading-7 text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
            placeholder="例如：如果边油已经起壳，是不是应该直接送修？"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void handleStatusChange(option.value)}
                  disabled={busy}
                  className={`rounded-full border px-3 py-2 text-sm transition-colors duration-200 ${
                    detail.status === option.value
                      ? "border-[color:var(--accent)] bg-[rgba(181,122,51,0.12)] text-[color:var(--ink-strong)]"
                      : "border-[color:var(--border-soft)] text-[color:var(--ink-soft)] hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
                  } disabled:opacity-60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleSendFollowUp()}
              disabled={busy || !followUp.trim()}
              className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "发送中..." : "发送追问"}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">图像初判</p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">风险与补拍建议</h2>
          <div className="mt-5">
            <VisionAnalysisCard analysis={detail.vision_analysis} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">护理计划</p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">执行状态</h2>
          <div className="mt-5">
            <CarePlanChecklist items={detail.care_plan} onToggle={handlePlanToggle} busyId={busyPlanId} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">来源依据</p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">最近一轮命中</h2>
          <div className="mt-5">
            <SourcePanel sources={latestAssistantMessage?.sources || []} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">结果反馈</p>
          <div className="mt-5 space-y-4">
            <FeedbackSummaryCard summary={detail.feedback_summary} />
            {latestAssistantMessage ? (
              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <textarea
                  value={feedbackNote}
                  onChange={(event) => setFeedbackNote(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-[1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
                  placeholder="补充这轮处理后的结果观察。"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("helpful")}
                    disabled={busy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    建议有帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("resolved")}
                    disabled={busy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    问题已解决
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("needs_repair")}
                    disabled={busy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    最终送修
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </aside>
    </section>
  );
}
