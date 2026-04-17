"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "护理问答" },
  { href: "/knowledge", label: "护理资料" },
  { href: "/eval", label: "案例评估" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-40 mx-auto mt-4 w-[min(96%,1280px)] rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/92 px-4 py-3 shadow-[0_18px_55px_rgba(18,38,78,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--surface)] text-[color:var(--accent)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 5.25c-2.76 0-5 2.24-5 5 0 1.94 1.11 3.62 2.74 4.45l.26.13v2.17h4v-2.17l.26-.13A4.98 4.98 0 0 0 17 10.25c0-2.76-2.24-5-5-5Z" />
              <path d="M9.25 18.75h5.5" />
              <path d="M10.25 21h3.5" />
            </svg>
          </div>
          <div>
            <p className="font-serif text-xl tracking-[-0.04em] text-[color:var(--ink-strong)]">
              皮具护理助手
            </p>
            <p className="text-sm text-[color:var(--ink-soft)]">
              把皮具问题整理成更清晰的护理建议
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                  isActive
                    ? "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink-strong)] shadow-[0_10px_24px_rgba(18,38,78,0.06)]"
                    : "border-transparent text-[color:var(--ink-soft)] hover:border-[color:var(--border-soft)] hover:text-[color:var(--ink-strong)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
