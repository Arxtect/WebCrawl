import type { ReactNode } from "react";

export function FormSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
      <span className="h-px flex-1 bg-slate-100"></span>
      {children}
      <span className="h-px flex-1 bg-slate-100"></span>
    </div>
  );
}
