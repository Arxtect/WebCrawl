import { cn } from "../lib/cn";

function StatusDot({ status }: { status: number }) {
  if (status >= 200 && status < 300) return <div className="h-2 w-2 rounded-full bg-emerald-500" />;
  if (status >= 400) return <div className="h-2 w-2 rounded-full bg-rose-500" />;
  return <div className="h-2 w-2 rounded-full bg-amber-500" />;
}

export function SummaryItem({
  label,
  value,
  className,
  statusCode,
}: {
  label: string;
  value?: string | number;
  className?: string;
  statusCode?: number;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3", className)}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
         {typeof statusCode === "number" ? <StatusDot status={statusCode} /> : null}
         <span className="truncate" title={String(value)}>{value ?? "--"}</span>
      </div>
    </div>
  );
}
