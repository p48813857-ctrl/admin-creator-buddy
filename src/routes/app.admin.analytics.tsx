import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics.functions";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/lead-outcomes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Users, Target, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin/analytics")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading analytics…</div>}>
      <AnalyticsPage />
    </Suspense>
  ),
});

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#f43f5e", "#84cc16"];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accent)}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function AnalyticsPage() {
  const fetchAnalytics = useServerFn(getAnalytics);
  const { data } = useSuspenseQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchAnalytics(),
  });

  const funnelData = data.funnel.map((f) => ({
    ...f,
    label: STATUS_LABELS[f.status as keyof typeof STATUS_LABELS] ?? f.status,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Leads"
          value={data.totals.totalLeads}
          accent="bg-gradient-to-br from-indigo-500 to-violet-600"
        />
        <StatCard
          icon={Target}
          label="Assigned"
          value={data.totals.assigned}
          accent="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <StatCard
          icon={PhoneOff}
          label="Unassigned"
          value={data.totals.unassigned}
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Win Rate"
          value={`${data.totals.wonRate}%`}
          accent="bg-gradient-to-br from-rose-500 to-pink-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Lead Funnel by Status
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {funnelData.map((f) => (
              <span
                key={f.status}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  STATUS_COLORS[f.status] ?? "bg-slate-100 text-slate-700",
                )}
              >
                {f.label}: {f.count}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Source Breakdown
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.sources}
                  dataKey="count"
                  nameKey="source"
                  outerRadius={90}
                  label={(props: { name?: string; value?: number }) =>
                    `${props.name ?? ""} (${props.value ?? 0})`
                  }
                >
                  {data.sources.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Trend — Last 30 Days
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#6366f1" name="Leads created" strokeWidth={2} />
              <Line type="monotone" dataKey="won" stroke="#10b981" name="Won" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Per-Agent Performance
        </h3>
        {data.perAgent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No assigned leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="p-3 text-left font-semibold">Agent</th>
                  <th className="p-3 text-right font-semibold">Total</th>
                  <th className="p-3 text-right font-semibold">Contacted</th>
                  <th className="p-3 text-right font-semibold">Won</th>
                  <th className="p-3 text-right font-semibold">Lost</th>
                  <th className="p-3 text-right font-semibold">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.perAgent.map((a) => {
                  const rate = a.total ? Math.round((a.won / a.total) * 100) : 0;
                  return (
                    <tr
                      key={a.agentId}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                        {a.name}
                      </td>
                      <td className="p-3 text-right">{a.total}</td>
                      <td className="p-3 text-right">{a.contacted}</td>
                      <td className="p-3 text-right text-emerald-600">{a.won}</td>
                      <td className="p-3 text-right text-rose-600">{a.lost}</td>
                      <td className="p-3 text-right font-semibold">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
