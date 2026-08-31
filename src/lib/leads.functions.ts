import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEAD_STATUSES } from "@/lib/lead-outcomes";

// Get current user's profile + role
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleSet = new Set((roles ?? []).map((r) => r.role as string));
    const role = roleSet.has("ceo")
      ? "ceo"
      : roleSet.has("team_leader") || roleSet.has("admin")
        ? "team_leader"
        : roleSet.has("agent")
          ? "agent"
          : null;
    return {
      profile,
      role: role as "ceo" | "team_leader" | "agent" | null,
      teamId: ((profile as { team_id?: string | null } | null)?.team_id ?? null) as string | null,
    };
  });

// List all leads (admin)
export const listAllLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// List leads visible to current agent: assigned to them + unassigned pool
export const listMyLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or(`assigned_to.eq.${userId},assigned_to.is.null`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });


const LeadInput = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Bulk insert leads (admin)
export const bulkInsertLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ leads: z.array(LeadInput).min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.leads.map((l) => ({ ...l, created_by: userId }));
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { count: inserted?.length ?? 0 };
  });

// Assign / reassign / unassign lead (admin)
export const assignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      leadId: z.string().uuid(),
      agentId: z.string().uuid().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: data.agentId })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-assign all unassigned leads to one agent (admin)
export const autoAssignUnassigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ agentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: updated, error } = await supabase
      .from("leads")
      .update({ assigned_to: data.agentId })
      .is("assigned_to", null)
      .select("id");
    if (error) throw new Error(error.message);
    return { count: updated?.length ?? 0 };
  });

// Update lead status (agent for own, or admin)
export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      leadId: z.string().uuid(),
      status: z.enum(LEAD_STATUSES),

      notes: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("leads")
      .select("assigned_to")
      .eq("id", data.leadId)
      .maybeSingle();

    const patch: { status: string; notes?: string; assigned_to?: string } = {
      status: data.status,
    };
    if (data.notes !== undefined) patch.notes = data.notes;
    // Working an unassigned (freshly uploaded) lead claims it for this user
    if (existing && existing.assigned_to === null) patch.assigned_to = userId;

    const { error } = await supabase.from("leads").update(patch).eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// Log a call: claims unassigned lead for this agent and appends a timestamped note
export const logLeadCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("leads")
      .select("assigned_to, notes")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!existing) throw new Error("Lead not found");

    const stamp = new Date().toLocaleString();
    const entry = `[Call ${stamp}]`;
    const patch: { notes: string; assigned_to?: string } = {
      notes: existing.notes ? `${existing.notes}\n${entry}` : entry,
    };
    if (existing.assigned_to === null) patch.assigned_to = userId;

    const { error } = await supabase.from("leads").update(patch).eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Clear leads (admin only — enforced by RLS). scope: "all" | "unassigned"
export const clearLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scope: z.enum(["all", "unassigned"]).default("all") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("leads").delete();
    if (data.scope === "unassigned") q = q.is("assigned_to", null);
    else q = q.not("id", "is", null);
    const { data: removed, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { count: removed?.length ?? 0 };
  });

// Delete lead (admin only — enforced by RLS)
export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("leads").delete().eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
