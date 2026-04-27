"use client";

import type { CaseFeedbackSummary, CaseMessage, CarePlanItem, ChatSource, VisionAnalysis } from "@/lib/api";

type RichNode =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

const SOURCE_LABELS: Record<string, string> = {
  bailian_reference: "百炼引用",
  bailian_chunk: "召回切片",
};

export function formatTimestamp(value?: string) {
  if (!value) {
    return "暂未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRiskLabel(riskLevel?: string) {
  const normalized = (riskLevel || "").toLowerCase();
  if (/high|高/.test(normalized)) {
    return "高风险";
  }
  if (/medium|中/.test(normalized)) {
    return "中风险";
  }
  if (/low|低/.test(normalized)) {
    return "低风险";
  }
  return "待评估";
}

export function getRiskToneClasses(riskLevel?: string) {
  const normalized = (riskLevel || "").toLowerCase();
  if (/high|高/.test(normalized)) {
    return "border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]";
  }
  if (/medium|中/.test(normalized)) {
    return "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]";
  }
  return "border-[#bae6fd] bg-[#f0f9ff] text-[#0c4a6e]";
}

export function formatStatusLabel(status: string) {
  const mappings: Record<string, string> = {
    draft: "待完善",
    in_progress: "处理中",
    monitoring: "观察中",
    send_repair: "建议送修",
    closed: "已完成",
  };
  return mappings[status] || status;
}

export function getStatusToneClasses(status: string) {
  const mappings: Record<string, string> = {
    draft: "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink-soft)]",
    in_progress: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    monitoring: "border-[#fde68a] bg-[#fffbeb] text-[#a16207]",
    send_repair: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    closed: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  };
  return mappings[status] || mappings.draft;
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
    nodes.push({ type: "paragraph", text: sanitizeInlineText(paragraphBuffer.join(" ")) });
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
      nodes.push({ type: "heading", level: headingMatch[1].length, text: sanitizeInlineText(headingMatch[2]) });
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

export function RichText({ content }: { content: string }) {
  const nodes = parseRichText(content);

  return (
    <div className="space-y-3 text-sm leading-7 text-[color:var(--ink-soft)]">
      {nodes.map((node, index) => {
        if (node.type === "heading") {
          return (
            <p key={`heading-${index}`} className="text-sm font-semibold text-[color:var(--ink-strong)]">
              {node.text}
            </p>
          );
        }
        if (node.type === "paragraph") {
          return (
            <p key={`paragraph-${index}`} className="break-words [overflow-wrap:anywhere]">
              {node.text}
            </p>
          );
        }
        const ListTag = node.type === "ordered" ? "ol" : "ul";
        return (
          <ListTag
            key={`list-${index}`}
            className={`space-y-2 pl-5 ${node.type === "ordered" ? "list-decimal" : "list-disc"}`}
          >
            {node.items.map((item) => (
              <li key={item} className="break-words [overflow-wrap:anywhere]">
                {item}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

export function MessageTimeline({ messages }: { messages: CaseMessage[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`rounded-[1.6rem] border p-4 shadow-[0_18px_40px_rgba(17,37,78,0.04)] ${
            message.role === "user"
              ? "border-[color:var(--ink-strong)]/12 bg-[color:var(--ink-strong)] text-white"
              : "border-[color:var(--border-soft)] bg-[color:var(--surface)]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] opacity-70">
              {message.role === "user" ? "你的描述" : "护理建议"}
            </p>
            <p className="text-xs opacity-70">{formatTimestamp(message.created_at)}</p>
          </div>
          {message.role === "user" ? (
            <p className="mt-3 text-base leading-7">{message.content}</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {Object.entries(message.sections || {}).map(([section, content]) =>
                content ? (
                  <div key={section} className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">{section}</p>
                    <div className="mt-3">
                      <RichText content={content} />
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function VisionAnalysisCard({ analysis }: { analysis: VisionAnalysis | null }) {
  if (!analysis) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
        提交案例后，这里会展示图片初判、受损部位和补拍建议。
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">图像初判</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">{analysis.summary}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getRiskToneClasses(analysis.risk_level)}`}>
          {formatRiskLabel(analysis.risk_level)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetadataGroup label="识别材质" values={analysis.materials} fallback="待识别" />
        <MetadataGroup label="问题类型" values={analysis.damage_types} fallback="待识别" />
        <MetadataGroup label="受影响部位" values={analysis.affected_parts} fallback="待识别" />
        <MetadataGroup label="缺失视角" values={analysis.missing_views} fallback="当前视角可用" />
      </div>
    </div>
  );
}

function MetadataGroup({ label, values, fallback }: { label: string; values: string[]; fallback: string }) {
  const displayValues = values.length > 0 ? values : [fallback];
  return (
    <div className="rounded-[1.2rem] bg-[color:var(--surface-elevated)] p-3">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {displayValues.map((value) => (
          <span
            key={`${label}-${value}`}
            className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--ink-soft)]"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CarePlanChecklist({
  items,
  onToggle,
  busyId,
}: {
  items: CarePlanItem[];
  onToggle?: (item: CarePlanItem, status: CarePlanItem["status"]) => void;
  busyId?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
        生成建议后，这里会同步给出护理计划清单。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">{item.instruction}</p>
              {item.caution ? (
                <p className="mt-2 text-xs leading-6 text-[color:var(--ink-soft)]">注意：{item.caution}</p>
              ) : null}
            </div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                item.status === "completed"
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
                  : item.status === "skipped"
                    ? "border-[#e5e7eb] bg-[#f8fafc] text-[#64748b]"
                    : "border-[#fde68a] bg-[#fffbeb] text-[#a16207]"
              }`}
            >
              {item.status === "completed" ? "已完成" : item.status === "skipped" ? "已跳过" : "待执行"}
            </span>
          </div>
          {onToggle ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["pending", "completed", "skipped"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => onToggle(item, status)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${
                    item.status === status
                      ? "border-[color:var(--accent)] bg-[rgba(181,122,51,0.12)] text-[color:var(--ink-strong)]"
                      : "border-[color:var(--border-soft)] text-[color:var(--ink-soft)] hover:border-[color:var(--accent)]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {status === "pending" ? "待执行" : status === "completed" ? "标记完成" : "跳过"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SourcePanel({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm leading-7 text-[color:var(--ink-soft)]">
        当前回答没有返回可展示的来源或召回切片。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <article
          key={`${source.reference_id || source.source_path}-${index}`}
          className="rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink-strong)]">{source.title || "未命名资料"}</p>
              <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                {SOURCE_LABELS[source.source_type] || source.source_type}
                {source.citation_label ? ` · ${source.citation_label}` : ""}
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--ink-soft)]">
              {source.hit_type === "chunk" ? "召回片段" : "引用依据"}
            </span>
          </div>
          <div className="mt-3">
            <RichText content={source.content || source.preview || source.excerpt} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function FeedbackSummaryCard({ summary }: { summary: CaseFeedbackSummary }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent)]">反馈摘要</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["反馈条数", summary.count],
          ["有帮助", summary.helpful_count],
          ["已解决", summary.resolved_count],
          ["需要送修", summary.needs_repair_count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.1rem] bg-[color:var(--surface-elevated)] p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--ink-strong)]">{value}</p>
          </div>
        ))}
      </div>
      {summary.latest_note ? (
        <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">最近备注：{summary.latest_note}</p>
      ) : null}
    </div>
  );
}
