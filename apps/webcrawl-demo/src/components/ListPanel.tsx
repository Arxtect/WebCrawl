import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";

export function ListPanel({ items, emptyLabel }: { items?: string[]; emptyLabel: string }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-slate-400">
        <div className="mb-2 opacity-50">
          {emptyLabel === "图片" ? <ImageIcon className="h-5 w-5" /> : <LinkIcon className="h-5 w-5" />}
        </div>
        <div className="text-sm">暂无 {emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
      {items.map((item, i) => (
        <a
          key={i}
          href={item}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          <div className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-400">
            {emptyLabel === "图片" ? <ImageIcon className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
          </div>
          <span className="truncate font-mono">{item}</span>
        </a>
      ))}
    </div>
  );
}
