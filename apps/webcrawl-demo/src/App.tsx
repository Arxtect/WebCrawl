import { AppHeader } from "./components/AppHeader";
import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <AppHeader />
      <Outlet />
    </div>
  );
}
