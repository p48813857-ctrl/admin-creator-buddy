import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getCompanyOverview } from "@/lib/ceo.functions";

export const Route = createFileRoute("/app/ceo/")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <CeoOverview />
    </Suspense>
  ),
  errorComponent: ({ error }) => <div className="text-destructive">Error: {error.message}</div>,
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}

function CeoOverview() {
  const fetchOverview = useServerFn(getCompanyOverview);
  const { data } = useSuspenseQuery({
    queryKey: ["company-overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Teams" value={data.totals.teams} />
        <Stat label="People" value={data.totals.people} />
        <Stat label="Agents" value={data.totals.agents} />
        <Stat label="Leads" value={data.totals.leads} />
        <Stat label="Won" value={data.totals.won} />
        <Stat label="Unassigned" value={data.totals.unassigned} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="p-3 text-left font-semibold">Team</th>
              <th className="p-3 text-right font-semibold">Members</th>
              <th className="p-3 text-right font-semibold">Leads</th>
              <th className="p-3 text-right font-semibold">Won</th>
            </tr>
          </thead>
          <tbody>
            {data.byTeam.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  No teams yet — create one under Teams.
                </td>
              </tr>
            )}
            {data.byTeam.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                <td className="p-3 text-right">{t.members}</td>
                <td className="p-3 text-right">{t.leads}</td>
                <td className="p-3 text-right">{t.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
