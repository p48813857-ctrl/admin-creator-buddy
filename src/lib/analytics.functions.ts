import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsData = {
  funnel: { status: string; count: number }[];
  perAgent: { agentId: string; name: string; total: number; won: number; lost: number; contacted: number }[];
  trend: { date: string; created: number; won: number }[];
  sources: { source: string; count: number }[];
  totals: { totalLeads: number; assigned: number; unassigned: number; wonRate: number };
};

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsData> => {
    const { supabase } = context;

    const [{ data: leads }, { data: profiles }] = await Promise.all([
      supabase.from("leads").select("id, status, source, assigned_to, created_at"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

    const l = leads ?? [];
    const nameOf = new Map<string, string>();
    for (const p of profiles ?? []) nameOf.set(p.id, p.full_name ?? p.email ?? "Agent");

    // Funnel
    const funnelMap = new Map<string, number>();
    for (const r of l) funnelMap.set(r.status, (funnelMap.get(r.status) ?? 0) + 1);
    const funnel = Array.from(funnelMap, ([status, count]) => ({ status, count }));

    // Per-agent
    const agentAgg = new Map<string, { total: number; won: number; lost: number; contacted: number }>();
    for (const r of l) {
      if (!r.assigned_to) continue;
      const a = agentAgg.get(r.assigned_to) ?? { total: 0, won: 0, lost: 0, contacted: 0 };
      a.total++;
      if (r.status === "won") a.won++;
      else if (r.status === "lost") a.lost++;
      else if (r.status === "contacted") a.contacted++;
      agentAgg.set(r.assigned_to, a);
    }
    const perAgent = Array.from(agentAgg, ([agentId, v]) => ({
      agentId,
      name: nameOf.get(agentId) ?? "Agent",
      ...v,
    })).sort((a, b) => b.total - a.total);

    // Trend over last 30 days
    const now = new Date();
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const trendMap = new Map<string, { created: number; won: number }>();
    days.forEach((d) => trendMap.set(d, { created: 0, won: 0 }));
    for (const r of l) {
      const d = (r.created_at ?? "").slice(0, 10);
      const e = trendMap.get(d);
      if (!e) continue;
      e.created++;
      if (r.status === "won") e.won++;
    }
    const trend = days.map((d) => ({ date: d, ...(trendMap.get(d) ?? { created: 0, won: 0 }) }));

    // Sources
    const srcMap = new Map<string, number>();
    for (const r of l) {
      const s = (r.source && r.source.trim()) || "Unknown";
      srcMap.set(s, (srcMap.get(s) ?? 0) + 1);
    }
    const sources = Array.from(srcMap, ([source, count]) => ({ source, count })).sort(
      (a, b) => b.count - a.count,
    );

    const totalLeads = l.length;
    const assigned = l.filter((r) => r.assigned_to).length;
    const wonCount = l.filter((r) => r.status === "won").length;
    const wonRate = totalLeads ? Math.round((wonCount / totalLeads) * 100) : 0;

    return {
      funnel,
      perAgent,
      trend,
      sources,
      totals: { totalLeads, assigned, unassigned: totalLeads - assigned, wonRate },
    };
  });
