import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Manager = { role: "ceo" | "team_leader"; teamId: string | null };

async function assertManager(supabase: any, userId: string): Promise<Manager> {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle(),
  ]);
  const set = new Set((roles ?? []).map((r: any) => r.role as string));
  const teamId = (profile?.team_id as string | null) ?? null;
  if (set.has("ceo")) return { role: "ceo", teamId };
  if (set.has("team_leader") || set.has("admin")) return { role: "team_leader", teamId };
  throw new Error("Forbidden: manager role required");
}

// List all users with their roles
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const manager = await assertManager(supabase, userId);
    let profileQuery = supabase
      .from("profiles")
      .select("id, full_name, email, team_id, created_at")
      .order("created_at");
    if (manager.role === "team_leader") {
      if (!manager.teamId) return [];
      profileQuery = profileQuery.eq("team_id", manager.teamId);
    }
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      profileQuery,
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      byUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: byUser.get(p.id) ?? [],
    }));
  });

// List only agents (for assignment dropdown)
export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: roleRows, error }, { data: mine }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "agent"),
      supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    let q = supabase.from("profiles").select("id, full_name, email, team_id").in("id", ids);
    const myTeam = (mine?.team_id as string | null) ?? null;
    if (myTeam) q = q.eq("team_id", myTeam);
    const { data: profiles, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);
    return profiles ?? [];
  });

// Set role (add or remove)
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      targetUserId: z.string().uuid(),
      role: z.enum(["team_leader", "agent"]),
      action: z.enum(["add", "remove"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const manager = await assertManager(supabase, userId);
    if (manager.role === "team_leader") {
      if (data.role !== "agent") throw new Error("Only the CEO can manage team leaders");
      const { data: target } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", data.targetUserId)
        .maybeSingle();
      if (!manager.teamId || target?.team_id !== manager.teamId)
        throw new Error("You can only manage members of your own team");
    }
    if (data.action === "add") {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
