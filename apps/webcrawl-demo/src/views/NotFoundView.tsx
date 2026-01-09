import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export function NotFoundView() {
  return (
    <main className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-4 px-6 text-center">
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">页面不存在</h2>
        <p className="mt-2 text-sm text-slate-500">请检查地址，或返回控制台继续操作。</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
      </div>
    </main>
  );
}
