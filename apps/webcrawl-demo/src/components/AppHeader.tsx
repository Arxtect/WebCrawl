import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Globe, Cpu } from "lucide-react";
import { cn } from "../lib/cn";

const navItems: { path: string; label: string; description: string; icon: ReactNode }[] = [
  { path: "/", label: "WebCrawl API", description: "抓取与结构化", icon: <Globe className="h-4 w-4" /> },
  { path: "/lightpanda", label: "Lightpanda Lab", description: "对比与验证", icon: <Cpu className="h-4 w-4" /> },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 shadow-lg shadow-teal-600/20">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">WebCrawl</h1>
            <p className="text-xs font-medium text-slate-500">API 测试控制台</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600 sm:block">
            端口: 3002 (API) / 8790 (Lightpanda) / 5174 (Dev)
          </div>
          <a
            href="https://github.com/Arxtect/WebCrawl"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-900 p-2 text-white transition hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 pb-4">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "group flex flex-1 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-semibold transition-all",
                isActive
                  ? "border-teal-400 bg-teal-50 text-teal-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full p-2", isActive ? "bg-white text-teal-600" : "bg-slate-100 text-slate-400")}>
                    {item.icon}
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">{item.label}</div>
                    <div className="text-[10px] text-slate-400">{item.description}</div>
                  </div>
                </div>
                <span className={cn("text-[10px] font-bold", isActive ? "text-teal-600" : "text-slate-300")}>
                  {isActive ? "当前" : "切换"}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
