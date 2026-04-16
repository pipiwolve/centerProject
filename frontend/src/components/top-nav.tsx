import Link from "next/link";

const navItems = [
  { href: "/", label: "对话工作台" },
  { href: "/knowledge", label: "知识库流程" },
  { href: "/eval", label: "测试评估" },
];

export function TopNav() {
  return (
    <header className="sticky top-4 z-40 mx-auto mt-4 w-[min(96%,1280px)] rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/90 px-4 py-3 shadow-[0_18px_55px_rgba(18,38,78,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--surface)] text-[color:var(--accent)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M7 20h10" />
              <path d="M12 4c4 0 7 2.8 7 6.2 0 2.7-1.8 5-4.5 5.9v1.9H9.5v-1.9C6.8 15.2 5 12.9 5 10.2 5 6.8 8 4 12 4Z" />
            </svg>
          </div>
          <div>
            <p className="font-serif text-xl tracking-[-0.04em] text-[color:var(--ink-strong)]">
              Leather Care RAG Assistant
            </p>
            <p className="text-sm text-[color:var(--ink-soft)]">
              UI/UX Pro Max 风格约束 + Vercel 前端 + Flask 本地后端
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer rounded-full border border-transparent px-4 py-2 text-sm font-medium text-[color:var(--ink-soft)] transition-colors duration-200 hover:border-[color:var(--border-soft)] hover:text-[color:var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
