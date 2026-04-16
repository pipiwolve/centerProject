"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL, getHealth, type HealthResponse } from "@/lib/api";

export function LocalModeBanner() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((result) => {
        if (!cancelled) {
          setHealth(result);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("本地 Flask 后端尚未启动，当前页面仍可浏览但无法对话。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto flex w-[min(96%,1280px)] flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-5 py-4 shadow-[0_18px_50px_rgba(16,35,70,0.06)]">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
          Local Demo Mode
        </p>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
          前端已按 Vercel 部署形态构建，聊天请求默认直连本机后端
          <span className="mx-1 font-semibold text-[color:var(--ink-strong)]">
            {API_BASE_URL}
          </span>
        </p>
      </div>

      <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--ink-soft)]">
        {error ||
          (health
            ? `后端在线 · 检索 ${health.retrieval_mode === "local_langchain" ? "本地 LangChain" : health.retrieval_mode} · 模型 ${
                health.cloud_model_enabled ? "百炼可用" : "本地回退"
              } · 百炼知识库 ${health.target_docs_kb_id || "未配置"}`
            : "正在检测本地后端状态...")}
      </div>
    </section>
  );
}
