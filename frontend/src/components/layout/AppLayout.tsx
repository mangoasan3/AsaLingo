import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";

export default function AppLayout() {
  return (
    <div className="app-shell flex min-h-dvh overflow-x-clip bg-surface-50 dark:bg-slate-950">
      <SideNav />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:ml-60 xl:ml-64">
        <main className="flex-1 overflow-x-clip overflow-y-auto pb-24 lg:pb-8">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
