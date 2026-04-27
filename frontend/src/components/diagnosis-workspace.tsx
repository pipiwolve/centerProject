"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import {
  buildApiUrl,
  createCase,
  sendCaseMessage,
  submitCaseFeedback,
  updateCarePlanItem,
  type CaseDetail,
  type CarePlanItem,
  type HealthResponse,
} from "@/lib/api";

import {
  CarePlanChecklist,
  FeedbackSummaryCard,
  MessageTimeline,
  SourcePanel,
  VisionAnalysisCard,
  formatRiskLabel,
  formatTimestamp,
  getRiskToneClasses,
  getStatusToneClasses,
  formatStatusLabel,
} from "./care-display";

const examples = [
  "植鞣革手柄发黑已经一个月，之前只用干布擦过。",
  "翻毛皮鞋头蹭到油渍，担心越擦越花。",
  "包包边油有细裂纹，想先判断是否还能自己处理。",
];

export function DiagnosisWorkspace({ health }: { health: HealthResponse }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Array<{ file: File; url: string }>>([]);
  const [activeCase, setActiveCase] = useState<CaseDetail | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [error, setError] = useState("");

  const latestAssistantMessage = [...(activeCase?.messages || [])].reverse().find((message) => message.role === "assistant");
  const planCompleted = (activeCase?.care_plan || []).filter((item) => item.status === "completed").length;

  useEffect(() => {
    const nextPreviewUrls = images.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviewUrls(nextPreviewUrls);
    return () => {
      for (const item of nextPreviewUrls) {
        URL.revokeObjectURL(item.url);
      }
    };
  }, [images]);

  async function handleCreateCase() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await createCase({
        title,
        description,
        images,
      });
      startTransition(() => {
        setActiveCase(result);
        setTitle("");
        setDescription("");
        setImages([]);
        setFollowUp("");
        setFeedbackNote("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "案例创建失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendFollowUp() {
    if (!activeCase || !followUp.trim() || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendCaseMessage(activeCase.id, followUp.trim());
      startTransition(() => {
        setActiveCase(result);
        setFollowUp("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "追问发送失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanToggle(item: CarePlanItem, status: CarePlanItem["status"]) {
    if (!activeCase) {
      return;
    }
    setBusyPlanId(item.id);
    setError("");
    try {
      const result = await updateCarePlanItem(activeCase.id, item.id, status);
      startTransition(() => {
        setActiveCase(result);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "护理计划更新失败。");
    } finally {
      setBusyPlanId("");
    }
  }

  async function handleQuickFeedback(kind: "helpful" | "resolved" | "needs_repair") {
    if (!activeCase || !latestAssistantMessage || feedbackBusy) {
      return;
    }

    setFeedbackBusy(true);
    setError("");
    try {
      const result = await submitCaseFeedback(activeCase.id, {
        message_id: latestAssistantMessage.id,
        helpful: kind === "helpful",
        resolved: kind === "resolved",
        needs_repair: kind === "needs_repair",
        note: feedbackNote,
      });
      startTransition(() => {
        setActiveCase(result);
        setFeedbackNote("");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "反馈提交失败。");
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <section className="mx-auto grid w-[min(96%,1440px)] gap-6 xl:grid-cols-[0.92fr_1.1fr_0.88fr]">
      <div className="space-y-6">
        <section className="rounded-[2.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_30px_70px_rgba(17,37,78,0.08)] sm:p-8">
          <p className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
            皮具诊断工作台
          </p>
          <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.06em] text-[color:var(--ink-strong)] sm:text-6xl">
            先上传案例，
            <br />
            再进入护理闭环。
          </h1>
          <p className="mt-5 text-base leading-8 text-[color:var(--ink-soft)]">
            本地模式下会把图片初判、结构化建议、护理计划和案例档案串成一个连续流程，更适合演示真实护理决策。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setDescription(example)}
                className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">案例录入</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">新建护理案例</h2>
            </div>
            <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {health.vision_model_name || "视觉模型已启用"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]" htmlFor="case-title">
                案例标题（可选）
              </label>
              <input
                id="case-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
                placeholder="例如：植鞣革手柄发黑护理"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]" htmlFor="case-description">
                文字描述
              </label>
              <textarea
                id="case-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                className="mt-2 w-full resize-none rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm leading-7 text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
                placeholder="描述材质、部位、持续时间、是否处理过，以及你最担心的问题。"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]" htmlFor="case-images">
                图片上传（1-3 张）
              </label>
              <div className="mt-2 rounded-[1.4rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <input
                  id="case-images"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 3))}
                  className="block w-full text-sm text-[color:var(--ink-soft)] file:mr-4 file:rounded-full file:border-0 file:bg-[rgba(181,122,51,0.14)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[color:var(--ink-strong)]"
                />
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  建议至少包含整体图、问题部位近景、边缘或转折处细节。前端仅做本地预览，不会压缩图片。
                </p>
                {previewUrls.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {previewUrls.map(({ file, url }) => (
                      <div key={file.name} className="overflow-hidden rounded-[1rem] border border-[color:var(--border-soft)] bg-white/70">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={file.name} className="h-36 w-full object-cover" />
                        <p className="truncate px-3 py-2 text-xs text-[color:var(--ink-soft)]">{file.name}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
                创建案例后，会自动生成图像初判、首轮问答与护理计划。
              </p>
              <button
                type="button"
                onClick={() => void handleCreateCase()}
                disabled={busy}
                className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "正在生成案例..." : "开始诊断"}
              </button>
            </div>

            {error ? <p className="text-sm text-[#9c2a1e]">{error}</p> : null}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">案例会话</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">当前诊断时间线</h2>
            </div>
            {activeCase ? (
              <Link
                href={`/cases/${activeCase.id}`}
                className="rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
              >
                打开详情页
              </Link>
            ) : (
              <Link
                href="/cases"
                className="rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)]"
              >
                查看护理档案
              </Link>
            )}
          </div>

          <div className="mt-5">
            {activeCase ? (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{activeCase.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                        创建于 {formatTimestamp(activeCase.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getStatusToneClasses(activeCase.status)}`}>
                        {formatStatusLabel(activeCase.status)}
                      </span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${getRiskToneClasses(activeCase.risk_level)}`}>
                        {formatRiskLabel(activeCase.risk_level)}
                      </span>
                    </div>
                  </div>
                  {activeCase.images.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {activeCase.images.map((image) => (
                        <div key={image.id} className="overflow-hidden rounded-[1rem] border border-[color:var(--border-soft)] bg-white/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={buildApiUrl(image.url_path)}
                            alt={image.original_name}
                            className="h-36 w-full object-cover"
                          />
                          <p className="truncate px-3 py-2 text-xs text-[color:var(--ink-soft)]">{image.original_name}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <MessageTimeline messages={activeCase.messages} />
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm leading-7 text-[color:var(--ink-soft)]">
                还没有案例记录。上传图片并补充文字描述后，这里会展示完整的诊断时间线与六段式建议。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">追加追问</p>
          <div className="mt-3 flex flex-col gap-3">
            <textarea
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              rows={4}
              disabled={!activeCase}
              className="w-full resize-none rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm leading-7 text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={activeCase ? "例如：如果已经试过湿巾，还能继续处理吗？" : "先创建案例，再继续追问。"}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
                追问会复用当前案例的图片初判与历史上下文。
              </p>
              <button
                type="button"
                onClick={() => void handleSendFollowUp()}
                disabled={!activeCase || busy || !followUp.trim()}
                className="rounded-full bg-[color:var(--ink-strong)] px-5 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busy ? "发送中..." : "继续追问"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">图像初判</p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">当前风险摘要</h2>
          <div className="mt-5">
            <VisionAnalysisCard analysis={activeCase?.vision_analysis || null} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">护理计划</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">执行清单</h2>
            </div>
            {activeCase ? (
              <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
                {planCompleted}/{activeCase.care_plan.length} 已完成
              </span>
            ) : null}
          </div>
          <div className="mt-5">
            <CarePlanChecklist items={activeCase?.care_plan || []} onToggle={handlePlanToggle} busyId={busyPlanId} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">命中来源</p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">本次参考依据</h2>
          <div className="mt-5">
            <SourcePanel sources={latestAssistantMessage?.sources || []} />
          </div>
        </section>

        <section className="rounded-[2.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_24px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">结果反馈</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">快速闭环</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <FeedbackSummaryCard
              summary={
                activeCase?.feedback_summary || {
                  count: 0,
                  helpful_count: 0,
                  resolved_count: 0,
                  needs_repair_count: 0,
                  latest_note: "",
                }
              }
            />
            {activeCase && latestAssistantMessage ? (
              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-sm text-[color:var(--ink-soft)]">为刚才这轮建议补一个结果反馈：</p>
                <textarea
                  value={feedbackNote}
                  onChange={(event) => setFeedbackNote(event.target.value)}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-[1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm text-[color:var(--ink-strong)] outline-none transition-colors duration-200 focus:border-[color:var(--accent)]"
                  placeholder="例如：局部测试后没有继续扩散。"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("helpful")}
                    disabled={feedbackBusy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    这次建议有帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("resolved")}
                    disabled={feedbackBusy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    问题已解决
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickFeedback("needs_repair")}
                    disabled={feedbackBusy}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] disabled:opacity-60"
                  >
                    最终转为送修
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                创建案例后，这里可以把“有帮助 / 已解决 / 转为送修”的结果回流到案例档案里。
              </div>
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}
