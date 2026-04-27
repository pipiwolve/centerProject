"use client";

import { startTransition, useEffect, useState } from "react";

import { getHealth, type HealthResponse } from "@/lib/api";

import { ChatWorkspace } from "./chat-workspace";
import { DiagnosisWorkspace } from "./diagnosis-workspace";

export function HomeShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const result = await getHealth();
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setHealth(result);
        });
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "无法读取系统状态。");
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health || !health.case_workflow_enabled) {
    return (
      <div className="space-y-6">
        {health ? (
          <section className="mx-auto w-[min(96%,1280px)] rounded-[2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-5 text-sm leading-7 text-[color:var(--ink-soft)] shadow-[0_20px_60px_rgba(17,37,78,0.06)]">
            {health.case_workflow_reason}
          </section>
        ) : error ? (
          <section className="mx-auto w-[min(96%,1280px)] rounded-[2rem] border border-[#fecaca] bg-[#fff7ed] p-5 text-sm leading-7 text-[#9a3412] shadow-[0_20px_60px_rgba(17,37,78,0.06)]">
            {error}
          </section>
        ) : null}
        <ChatWorkspace />
      </div>
    );
  }

  return <DiagnosisWorkspace health={health} />;
}
