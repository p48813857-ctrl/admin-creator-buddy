import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin/agents")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <AgentsPage />
    </Suspense>
  ),
});

function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function AgentsPage() {
  const fetchUsers = useServerFn(listUsers);
  const { data: users } = useSuspenseQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="p-3 text-left font-semibold">User</th>
            <th className="p-3 text-left font-semibold">Email</th>
            <th className="p-3 text-left font-semibold">Roles</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const isAgent = u.roles.includes("agent");
            return (
              <tr
                key={u.id}
                className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
                      {initials(u.full_name ?? u.email ?? "?")}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {u.full_name ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                <td className="space-x-1 p-3">
                  {isAdmin && (
                    <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      Admin
                    </span>
                  )}
                  {isAgent && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Agent
                    </span>
                  )}
                  {!isAdmin && !isAgent && (
                    <span className="text-xs text-slate-400">No roles</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
