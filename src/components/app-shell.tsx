import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/leads.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Headphones,
  Upload,
  Users,
  UserCog,
  PhoneCall,
  LogOut,
  Sparkles,
  Menu,
  X,
  Bell,
  Search,
  Wifi,
  BarChart3,
  FileText,
  MessageSquare,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/app/ceo": { title: "CEO Dashboard", subtitle: "Company-wide performance across every team" },
  "/app/ceo/people": { title: "People", subtitle: "Create team leaders and agents, manage roles and teams" },
  "/app/admin/upload": { title: "Excel Upload", subtitle: "Import customer leads from spreadsheets" },
  "/app/admin/assign": { title: "Lead Management", subtitle: "View, assign, edit, and track customer leads" },
  "/app/admin/agents": { title: "Agent Management", subtitle: "Manage call agents and their roles" },
  "/app/admin/analytics": { title: "Business Analytics", subtitle: "Funnel, sources, trends and per-agent performance" },
  "/app/admin/reports": { title: "Reports", subtitle: "Filter, export and print lead data" },
  "/app/agent": { title: "Agent Dashboard", subtitle: "Your assigned leads and call performance" },
  "/app/chat": { title: "Team Chat", subtitle: "Real-time team messaging and DMs" },
};

function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const { data: me } = useSuspenseQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCeo = me.role === "ceo";
  const isLeader = me.role === "team_leader";
  const meta = PAGE_META[pathname] ?? { title: "CallCRM Pro", subtitle: "Call Center Management" };

  const ceoNav = [
    { to: "/app/ceo", label: "Company Overview", icon: Building2 },
    { to: "/app/ceo/people", label: "People & Roles", icon: UserCog },
    { to: "/app/admin/analytics", label: "Business Analytics", icon: BarChart3 },
    { to: "/app/admin/reports", label: "Reports", icon: FileText },
    { to: "/app/chat", label: "Team Chat", icon: MessageSquare },
  ];
  const leaderNav = [
    { to: "/app/admin/upload", label: "Excel Upload", icon: Upload },
    { to: "/app/admin/assign", label: "Lead Management", icon: Users },
    { to: "/app/admin/agents", label: "Agent Management", icon: UserCog },
    { to: "/app/admin/analytics", label: "Business Analytics", icon: BarChart3 },
    { to: "/app/admin/reports", label: "Reports", icon: FileText },
    { to: "/app/chat", label: "Team Chat", icon: MessageSquare },
  ];
  const agentNav = [
    { to: "/app/agent", label: "My Leads", icon: PhoneCall },
    { to: "/app/chat", label: "Team Chat", icon: MessageSquare },
  ];
  const nav = isCeo ? ceoNav : isLeader ? leaderNav : agentNav;

  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/login" });
  }

  const name = me.profile?.full_name ?? me.profile?.email ?? "User";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          "dark:border-slate-800 dark:bg-slate-900",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/40">
              <Headphones className="h-5 w-5 text-white" strokeWidth={2.4} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                The manager
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Call Center Suite</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white shadow-sm">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    isCeo ? "bg-amber-500" : isLeader ? "bg-violet-500" : "bg-emerald-500",
                  )}
                />
                {isCeo ? "CEO" : isLeader ? "Team Leader" : me.role === "agent" ? "Call Agent" : "No role"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Main Menu
          </p>
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "transition-colors",
                    active
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 dark:border-indigo-900/40 dark:from-indigo-500/5 dark:to-violet-500/5">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Realtime Sync</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Live updates enabled. Dashboards refresh instantly.
            </p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            <LogOut size={18} className="text-slate-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
                {meta.subtitle}
              </p>
            )}
          </div>
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Quick search..."
              className="w-56 rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:bg-slate-900"
            />
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex dark:bg-emerald-500/10 dark:text-emerald-300">
            <Wifi size={12} />
            <span className="relative flex h-2 w-2">
              <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Live
          </div>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Bell size={18} />
          </button>
          <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white sm:flex">
            {initials(name)}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-grid-light">
          <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
