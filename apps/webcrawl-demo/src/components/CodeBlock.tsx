import { useState } from "react";
import { CheckCircle, Copy } from "lucide-react";

export function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content) return <div className="text-center py-10 text-slate-400 text-sm">暂无内容</div>;

  return (
    <div className="relative group rounded-xl border border-slate-200 bg-slate-900 text-slate-50">
       <button
         onClick={handleCopy}
         className="absolute right-3 top-3 rounded-lg bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
         title="复制内容"
       >
         {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
       </button>
      <div className="absolute left-4 top-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
        {language}
      </div>
      <pre className="max-h-[500px] overflow-auto p-4 pt-10 text-xs font-mono leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
        {content}
      </pre>
    </div>
  );
}
