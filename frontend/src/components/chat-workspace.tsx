"use client";

import { startTransition, useState } from "react";

import { sendChat, type ChatResponse, type ChatSource } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  response?: ChatResponse;
};

type RichNode =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

const examples = [
  "植鞣革手柄发黑了怎么清理？",
  "翻毛皮蹭到油渍还能自己处理吗？",
  "包包发霉后应该先除味还是先清洁？",
  "边油开裂和肩带结构开裂怎么区分？",
];

const sectionOrder = ["适用判断", "所需工具", "操作步骤", "注意事项", "何时送修", "参考来源"];

const careHighlights = [
  {
    title: "先判断能否自行处理",
    description: "优先分清日常清洁、保养护理，以及已经需要送修的情况。",
  },
  {
    title: "把步骤说得更具体",
    description: "整理出所需工具、处理顺序和停手节点，减少过度处理风险。",
  },
  {
    title: "每条建议都能追溯",
    description: "问答完成后可查看判断依据，帮助你理解建议为什么这样给出。",
  },
];

const promptChecklist = ["材质", "具体部位", "污渍或损伤情况", "持续时间", "是否尝试处理过"];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSourceType(sourceType: string) {
  const normalized = sourceType.toLowerCase();

  if (normalized.includes("bailian_reference")) {
    return "百炼引用";
  }

  if (normalized.includes("bailian_chunk")) {
    return "召回切片";
  }

  if (normalized.includes("faq")) {
    return "常见问题";
  }

  if (normalized.includes("chunk") || normalized.includes("doc")) {
    return "护理资料";
  }

  return "参考资料";
}

function getRiskToneClasses(riskLevel: string) {
  const normalized = riskLevel.toLowerCase();

  if (/高|严重|high|stop|送修/.test(normalized)) {
    return "border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]";
  }

  if (/中|moderate|medium|谨慎/.test(normalized)) {
    return "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]";
  }

  if (/低|轻|low/.test(normalized)) {
    return "border-[#bae6fd] bg-[#f0f9ff] text-[#0c4a6e]";
  }

  return "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink-soft)]";
}

function renderTags(tags: string[] | undefined, fallback: string) {
  const values = tags && tags.length > 0 ? tags : [fallback];

  return values.map((tag) => (
    <span
      key={tag}
      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
    >
      {tag}
    </span>
  ));
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeInlineText(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function parseRichText(content: string): RichNode[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const nodes: RichNode[] = [];
  let paragraphBuffer: string[] = [];
  let listType: "ordered" | "unordered" | null = null;
  let listItems: string[] = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) {
      return;
    }

    nodes.push({
      type: "paragraph",
      text: sanitizeInlineText(paragraphBuffer.join(" ")),
    });
    paragraphBuffer = [];
  }

  function flushList() {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }

    nodes.push({
      type: listType,
      items: listItems.map((item) => sanitizeInlineText(item)),
    });
    listType = null;
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      nodes.push({
        type: "heading",
        level: headingMatch[1].length,
        text: sanitizeInlineText(headingMatch[2]),
      });
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ordered") {
        flushList();
      }
      listType = "ordered";
      listItems.push(orderedMatch[1]);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "unordered") {
        flushList();
      }
      listType = "unordered";
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  return nodes;
}

function extractOrderedItems(content: string) {
  const nodes = parseRichText(content);
  return nodes.length === 1 && nodes[0].type === "ordered" ? nodes[0].items : [];
}

function RichText({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  const nodes = parseRichText(content);

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        if (node.type === "heading") {
          return (
            <p
              key={`heading-${index}`}
              className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--ink-strong)]"
            >
              {node.text}
            </p>
          );
        }

        if (node.type === "ordered") {
          return (
            <ol key={`ordered-${index}`} className="space-y-3">
              {node.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(181,122,51,0.12)] text-xs font-semibold text-[color:var(--accent)]">
                    {itemIndex + 1}
                  </span>
                  <span className={`text-[color:var(--ink-soft)] ${compact ? "text-sm leading-7" : "text-base leading-8"}`}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        if (node.type === "unordered") {
          return (
            <ul key={`unordered-${index}`} className="space-y-2">
              {node.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="flex gap-3">
                  <span className="mt-2 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
                  <span className={`text-[color:var(--ink-soft)] ${compact ? "text-sm leading-7" : "text-base leading-8"}`}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`paragraph-${index}`}
            className={`whitespace-pre-wrap text-[color:var(--ink-soft)] ${compact ? "text-sm leading-7" : "text-base leading-8"}`}
          >
            {node.text}
          </p>
        );
      })}
    </div>
  );
}

function SourceCard({
  source,
  sourceKey,
  expanded,
  onToggle,
}: {
  source: ChatSource;
  sourceKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  const preview = source.preview || source.excerpt;
  const content = source.content || preview;
  const retrievalChunks = (source.retrieval_chunks || []).filter(Boolean);
  const hasExpandableContent =
    retrievalChunks.length > 0 ||
    (content.length > preview.length + 24 && normalizeComparableText(content) !== normalizeComparableText(preview));
  const panelId = `source-panel-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <article className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 shadow-[0_14px_30px_rgba(17,37,78,0.04)] transition-shadow duration-200 hover:shadow-[0_18px_36px_rgba(17,37,78,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{source.title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            {(source.citation_label ? `${source.citation_label} · ` : "") + formatSourceType(source.source_type)}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--border-soft)] px-2 py-1 text-xs text-[color:var(--ink-soft)]">
          {source.hit_type === "chunk" ? "真实切片" : source.doc_name || source.materials?.[0] || "护理依据"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{preview}</p>

      {source.source_uri ? (
        <p className="mt-3 break-all text-xs leading-6 text-[color:var(--ink-soft)]">
          来源标识 · {source.source_uri}
        </p>
      ) : null}

      {source.page_numbers?.length ? (
        <p className="mt-2 text-xs leading-6 text-[color:var(--ink-soft)]">
          页码 · {source.page_numbers.join(", ")}
        </p>
      ) : null}

      {source.damage_types?.length || source.materials?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {source.materials?.map((item) => (
            <span
              key={`material-${item}`}
              className="rounded-full bg-[rgba(181,122,51,0.12)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
            >
              材质 · {item}
            </span>
          ))}
          {source.damage_types?.map((item) => (
            <span
              key={`damage-${item}`}
              className="rounded-full bg-[rgba(3,105,161,0.10)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
            >
              问题 · {item}
            </span>
          ))}
        </div>
      ) : null}

      {hasExpandableContent ? (
        <div className="mt-4 border-t border-[color:var(--border-soft)] pt-4">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => onToggle(sourceKey)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm font-medium text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
          >
            <span>{expanded ? "收起" : "展开内容"}</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>

          <div
            id={panelId}
            className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ${expanded ? "mt-4 max-h-[28rem] opacity-100" : "mt-0 max-h-0 opacity-0"}`}
          >
            <div className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-white/65 p-4">
              <div className="max-h-[22rem] overflow-y-auto pr-2">
                {retrievalChunks.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">
                      百炼召回切片
                    </p>
                    {retrievalChunks.map((chunk, index) => (
                      <div
                        key={`${sourceKey}-chunk-${index}`}
                        className="rounded-[1rem] border border-[color:var(--border-soft)] bg-white/70 p-3"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                          切片 {index + 1}
                        </p>
                        <div className="mt-2">
                          <RichText content={chunk} compact />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <RichText content={content} compact />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [activeSources, setActiveSources] = useState<ChatResponse["sources"]>([]);
  const [trace, setTrace] = useState<ChatResponse["retrieval_trace"] | null>(null);
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const riskLevel = trace?.analysis.risk_level || "待判断";

  function resetConversation() {
    setMessages([]);
    setPrompt("");
    setError("");
    setTrace(null);
    setActiveSources([]);
    setExpandedSourceKey(null);
    setSessionId("");
  }

  async function submitPrompt(nextPrompt: string) {
    const trimmed = nextPrompt.trim();
    if (!trimmed || busy) {
      return;
    }

    const userId = createId();
    const assistantId = createId();
    const nextSessionId = sessionId || createId();

    setBusy(true);
    setError("");
    setPrompt("");
    setExpandedSourceKey(null);
    if (!sessionId) {
      setSessionId(nextSessionId);
    }
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "正在整理问题并生成护理建议...", pending: true },
    ]);

    try {
      const response = await sendChat(trimmed, nextSessionId, true);
      startTransition(() => {
        setSessionId(response.session_id);
        setActiveSources(response.sources);
        setTrace(response.retrieval_trace);
        setExpandedSourceKey(null);
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
      const requestFailedMessage =
        caughtError instanceof Error ? caughtError.message : "暂时无法连接护理服务，请稍后再试。";
      startTransition(() => {
        setError(requestFailedMessage);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  id: assistantId,
                  role: "assistant",
                  content: requestFailedMessage,
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
    <section className="mx-auto grid w-[min(96%,1280px)] gap-6 lg:grid-cols-[1.34fr_0.82fr]">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_30px_70px_rgba(17,37,78,0.08)] sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(181,122,51,0.10),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(3,105,161,0.10),_transparent_28%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
                皮具护理助手
              </p>

              <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.06em] text-[color:var(--ink-strong)] sm:text-6xl">
                先描述皮具状况，
                <br />
                护理建议会更清楚。
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)]">
                输入材质、部位、污渍或损伤情况，我们会把建议整理成更容易执行的步骤，并补充注意事项与送修提醒。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {examples.slice(0, 3).map((example) => (
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
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {careHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.6rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.title}</p>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">护理对话</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                护理对话
              </h2>
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                尽量补充材质、部位和时间信息，建议会更贴近你的实际场景。
              </p>
            </div>

            <button
              type="button"
              onClick={resetConversation}
              className="cursor-pointer rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              新建对话
            </button>
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-[color:var(--ink-strong)]">提问时尽量包含这些信息</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                  如果是同一件皮具的连续追问，可以继续补充细节，不用重复完整描述。
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-[26rem]">
                {promptChecklist.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="cursor-pointer rounded-full border border-[color:var(--border-soft)] bg-white/70 px-4 py-2 text-sm text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {messages.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-8">
                <p className="text-lg font-medium text-[color:var(--ink-strong)]">还没有护理记录</p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">
                  可以先从上面的常见场景开始，或者直接描述你遇到的发黑、油渍、发霉、开裂、掉色等问题。
                </p>
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
                      {message.role === "user" ? "你的描述" : "护理建议"}
                    </p>
                    {message.response ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSources(message.response?.sources ?? []);
                          setTrace(message.response?.retrieval_trace ?? null);
                          setExpandedSourceKey(null);
                        }}
                        className="cursor-pointer rounded-full border border-current/15 px-3 py-1 text-xs transition-opacity duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                      >
                        查看依据
                      </button>
                    ) : null}
                  </div>

                  {message.role === "user" ? (
                    <p className="mt-3 text-lg leading-8">{message.content}</p>
                  ) : message.pending ? (
                    <div className="mt-4 flex items-center gap-3 text-sm text-[color:var(--ink-soft)]">
                      <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
                      正在整理问题并生成护理建议...
                    </div>
                  ) : message.response ? (
                    <div className="mt-4 grid gap-3">
                      {sectionOrder.map((section) => {
                        const content = message.response?.sections?.[section];
                        if (!content) {
                          return null;
                        }

                        const orderedItems = section === "操作步骤" ? extractOrderedItems(content) : [];

                        return (
                          <div
                            key={section}
                            className={`rounded-[1.4rem] border border-[color:var(--border-soft)] p-4 ${
                              section === "操作步骤"
                                ? "bg-[linear-gradient(180deg,rgba(181,122,51,0.08),rgba(255,255,255,0.92))]"
                                : "bg-[color:var(--surface-elevated)]"
                            }`}
                          >
                            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">
                              {section}
                            </p>
                            <div className="mt-3">
                              {section === "操作步骤" && orderedItems.length > 0 ? (
                                <ol className="space-y-3">
                                  {orderedItems.map((item, index) => (
                                    <li key={`${item}-${index}`} className="flex gap-3 rounded-[1.1rem] bg-white/70 p-3">
                                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(181,122,51,0.16)] text-xs font-semibold text-[color:var(--accent)]">
                                        {index + 1}
                                      </span>
                                      <span className="text-sm leading-7 text-[color:var(--ink-soft)]">{item}</span>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <RichText content={content} compact />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">{message.content}</p>
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
              描述你的情况
            </label>
            <textarea
              id="chat-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder="例如：植鞣革手柄发黑已经一个月，之前用湿巾擦过一次，现在担心越擦越花。还适合继续自己处理吗？"
              className="mt-3 w-full resize-none rounded-[1.25rem] border border-[color:var(--border-soft)] bg-transparent px-4 py-3 text-base text-[color:var(--ink-strong)] outline-none transition-colors duration-200 placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)]"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--ink-soft)]">
                我们会整理成适用判断、所需工具、操作步骤、注意事项和送修提醒。
              </p>
              <button
                type="submit"
                disabled={busy}
                className="cursor-pointer rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busy ? "正在整理建议..." : "获取护理建议"}
              </button>
            </div>
            {error ? <p className="mt-4 text-sm text-[#9c2a1e]">{error}</p> : null}
          </form>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">问题摘要</p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
            当前问题摘要
          </h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
            提交问题后，这里会显示系统对材质、问题和处理风险的理解，方便你快速判断是否适合自行处理。
          </p>

          <div className="mt-5 space-y-3 text-sm leading-7 text-[color:var(--ink-soft)]">
            <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">问题理解</p>
              <p className="mt-2 whitespace-pre-wrap">
                {trace?.analysis.notes || "发送问题后，这里会显示对场景的整理和护理难点提示。"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">处理风险</p>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getRiskToneClasses(riskLevel)}`}
                  >
                    {riskLevel}
                  </span>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">识别重点</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {renderTags(trace?.analysis.damage_types, "待识别")}
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">涉及材质</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {renderTags(trace?.analysis.materials, "待识别")}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[rgba(181,122,51,0.18)] bg-[rgba(181,122,51,0.08)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              如果已经出现大面积掉色、硬化、结构开线、五金松动，建议暂停自行处理并优先考虑送修。
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_25px_60px_rgba(17,37,78,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">参考依据</p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.05em] text-[color:var(--ink-strong)]">
                百炼命中来源
              </h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {activeSources.length} 条命中
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {activeSources.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm leading-7 text-[color:var(--ink-soft)]">
                本次回答还没有返回可展示的百炼引用或召回切片。完成一次问答后，这里会展示百炼应用真实命中的引用与片段。
              </div>
            ) : (
              activeSources.map((source, index) => {
                const sourceKey = `${source.source_path || source.title}-${index}`;
                return (
                  <SourceCard
                    key={sourceKey}
                    source={source}
                    sourceKey={sourceKey}
                    expanded={expandedSourceKey === sourceKey}
                    onToggle={(key) => setExpandedSourceKey((current) => (current === key ? null : key))}
                  />
                );
              })
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}
