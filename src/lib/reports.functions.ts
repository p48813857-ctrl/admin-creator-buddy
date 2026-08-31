import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Filters = z
  .object({
    from: z.string().optional().nullable(),
    to: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    agentId: z.string().uuid().optional().nullable(),
    source: z.string().optional().nullable(),
  })
  .partial();

export type ReportRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listReportLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Filters.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ReportRow[]> => {
    const { supabase } = context;
    let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.status) q = q.eq("status", data.status);
    if (data.agentId) q = q.eq("assigned_to", data.agentId);
    if (data.source) q = q.ilike("source", `%${data.source}%`);
    const { data: leads, error } = await q;
    if (error) throw new Error(error.message);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    const nameOf = new Map<string, string>();
    for (const p of profiles ?? []) nameOf.set(p.id, p.full_name ?? p.email ?? "Agent");
    return (leads ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      source: l.source,
      status: l.status,
      assigned_to: l.assigned_to,
      assigned_name: l.assigned_to ? nameOf.get(l.assigned_to) ?? null : null,
      notes: l.notes,
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
  });

export type AgentSummaryRow = {
  agentId: string;
  name: string;
  email: string | null;
  total: number;
  new: number;
  contacted: number;
  visiting: number;
  won: number;
  lost: number;
  conversionRate: number;
};

export const getAgentSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentSummaryRow[]> => {
    const { supabase } = context;
    const [{ data: leads }, { data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("leads").select("assigned_to, status"),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("user_roles").select("user_id, role").eq("role", "agent"),
    ]);
    const agentIds = new Set((roles ?? []).map((r) => r.user_id));
    const rows = new Map<string, AgentSummaryRow>();
    for (const p of profiles ?? []) {
      if (!agentIds.has(p.id)) continue;
      rows.set(p.id, {
        agentId: p.id,
        name: p.full_name ?? p.email ?? "Agent",
        email: p.email,
        total: 0,
        new: 0,
        contacted: 0,
        visiting: 0,
        won: 0,
        lost: 0,
        conversionRate: 0,
      });
    }
    for (const l of leads ?? []) {
      if (!l.assigned_to) continue;
      const row = rows.get(l.assigned_to);
      if (!row) continue;
      row.total++;
      if (l.status === "new") row.new++;
      else if (l.status === "contacted") row.contacted++;
      else if (l.status === "visiting") row.visiting++;
      else if (l.status === "won") row.won++;
      else if (l.status === "lost") row.lost++;
    }
    for (const r of rows.values()) {
      r.conversionRate = r.total ? Math.round((r.won / r.total) * 100) : 0;
    }
    return Array.from(rows.values()).sort((a, b) => b.won - a.won || b.total - a.total);
  });
