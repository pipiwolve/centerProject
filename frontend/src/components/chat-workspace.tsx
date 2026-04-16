"use client";

import { startTransition, useState } from "react";

import { sendChat, type ChatResponse } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  response?: ChatResponse;
};

const examples = [
  "植鞣革手柄发黑了怎么清理？",
  "翻毛皮蹭到油渍还能自己处理吗？",
  "包包发霉后应该先除味还是先清洁？",
  "边油开裂和肩带结构开裂怎么区分？",
];

const sectionOrder = ["适用判断", "所需工具", "操作步骤", "注意事项", "何时送修", "参考来源"];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState(createId());
  const [activeSources, setActiveSources] = useState<ChatResponse["sources"]>([]);
  const [trace, setTrace] = useState<ChatResponse["retrieval_trace"] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPrompt(nextPrompt: string) {
    const trimmed = nextPrompt.trim();
    if (!trimmed || busy) {
      return;
    }

    const userId = createId();
    const assistantId = createId();

    setBusy(true);
    setError("");
    setPrompt("");
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "正在检索知识库并整理回答...", pending: true },
    ]);

    try {
      const response = await sendChat(trimmed, sessionId, true);
      startTransition(() => {
        setSessionId(response.session_id);
        setActiveSources(response.sources);
        setTrace(response.retrieval_trace);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  id: assistantId,
                  role: "assistant",
                  content: response.answer,
                  response,
                }
              : message,
          ),
        );
      });
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error ? caughtError.message : "请求失败，请确认本地后端已启动。";
      startTransition(() => {
        setError("本地后端暂时不可达，请先运行 Flask 服务后再试。");
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  id: assistantId,
                  role: "assistant",
                  content: `请求失败：${errorMessage}`,
                }
              : message,
          ),
        );
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[1.45fr_0.8fr]">
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-7 shadow-[0_30px_70px_rgba(17,37,78,0.08)]">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--accent)]">
            Craft-informed RAG Workspace
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-serif text-5xl leading-none tracking-[-0.06em] text-[color:var(--ink-strong)] sm:text-6xl lg:text-7xl">
                让皮具养护建议
                <br />
                变成可执行的步骤。
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
                这套界面按 UI/UX Pro Max 的“大留白 + 高对比 + 奢感编辑式”路线实现，
                将检索过程、来源片段和风险判断一起放进答辩演示流。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                  Retrieval
                </p>
                <p className="mt-2 font-serif text-3xl text-[color:var(--ink-strong)]">Dual</p>
                <p className="text-sm text-[color:var(--ink-soft)]">FAQ + 文档切片</p>
              </div>
              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                  Output
                </p>
                <p className="mt-2 font-serif text-3xl text-[color:var(--ink-strong)]">6 段</p>
                <p className="text-sm text-[color:var(--ink-soft)]">固定答复结构</p>
              </div>
              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                  Demo
                </p>
                <p className="mt-2 font-serif text-3xl text-[color:var(--ink-strong)]">Local</p>
                <p className="text-sm text-[color:var(--ink-soft)]">前端 Vercel / 后端本机</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                示例问题
              </p>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                点击即可填入输入框，适合答辩时快速切换典型案例。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setPrompt("");
                setError("");
                setTrace(null);
                setActiveSources([]);
                setSessionId(createId());
              }}
              className="cursor-pointer rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              新建会话
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="cursor-pointer rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border-soft)] pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Dialogue
              </p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                问答主视图
              </h2>
            </div>
            <p className="text-sm text-[color:var(--ink-soft)]">
              当前会话 ID：<span className="font-medium text-[color:var(--ink-strong)]">{sessionId}</span>
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {messages.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-8 text-[color:var(--ink-soft)]">
                还没有对话记录。先从上面的示例问题开始，或者直接输入一个皮具养护场景。
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-[1.75rem] border p-5 shadow-[0_18px_40px_rgba(17,37,78,0.04)] ${
                    message.role === "user"
                      ? "border-[color:var(--border-soft)] bg-[color:var(--ink-strong)] text-white"
                      : "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] opacity-70">
                      {message.role === "user" ? "User Prompt" : "Assistant Output"}
                    </p>
                    {message.response ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSources(message.response?.sources ?? []);
                          setTrace(message.response?.retrieval_trace ?? null);
                        }}
                        className="cursor-pointer rounded-full border border-current/15 px-3 py-1 text-xs transition-opacity duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                      >
                        查看来源
                      </button>
                    ) : null}
                  </div>

                  {message.role === "user" ? (
                    <p className="mt-3 text-lg leading-8">{message.content}</p>
                  ) : message.pending ? (
                    <div className="mt-4 flex items-center gap-3 text-sm text-[color:var(--ink-soft)]">
                      <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
                      正在重写查询、命中文档并生成结构化回答...
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {sectionOrder.map((section) => {
                        const content = message.response?.sections?.[section];
                        if (!content) {
                          return null;
                        }
                        return (
                          <div
                            key={section}
                            className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">
                              {section}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink-soft)]">
                              {content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>

          <form
            className="mt-6 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPrompt(prompt);
            }}
          >
            <label className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-soft)]" htmlFor="chat-prompt">
              提问输入
            </label>
            <textarea
              id="chat-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              placeholder="例如：植鞣革手柄发黑已经一个月了，还适合自己清洁吗？"
              className="mt-3 w-full resize-none rounded-[1.25rem] border border-[color:var(--border-soft)] bg-transparent px-4 py-3 text-base text-[color:var(--ink-strong)] outline-none transition-colors duration-200 placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)]"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--ink-soft)]">
                输出将固定为 6 段结构，并展示改写查询、风险等级和来源片段。
              </p>
              <button
                type="submit"
                disabled={busy}
                className="cursor-pointer rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busy ? "正在生成..." : "发送问题"}
              </button>
            </div>
            {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
          </form>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
            Retrieval Trace
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            检索过程面板
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-[color:var(--ink-soft)]">
            <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">改写分析</p>
              <p className="mt-2 whitespace-pre-wrap">{trace?.analysis.notes || "发送问题后会显示问题标准化和风险判断。"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">风险等级</p>
              <p className="mt-2 text-lg font-medium text-[color:var(--ink-strong)]">{trace?.analysis.risk_level || "待生成"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">识别标签</p>
              <p className="mt-2">
                材质：{trace?.analysis.materials?.join(" / ") || "待识别"}
                <br />
                问题：{trace?.analysis.damage_types?.join(" / ") || "待识别"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Source Drawer
              </p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                来源抽屉
              </h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {activeSources.length} 条命中
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {activeSources.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm leading-7 text-[color:var(--ink-soft)]">
                当前还没有可展示的来源。完成一次问答后，这里会显示 FAQ 与文档切片的命中片段。
              </div>
            ) : (
              activeSources.map((source) => (
                <article
                  key={`${source.source_path}-${source.score}`}
                  className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{source.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                        {source.source_type} · score {source.score.toFixed(2)}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color:var(--border-soft)] px-2 py-1 text-xs text-[color:var(--ink-soft)]">
                      {(source.materials || []).join(" / ") || "未标注"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{source.excerpt}</p>
                  <p className="mt-3 text-xs text-[color:var(--ink-soft)]">{source.source_path}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}
