import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "ceo" | "team_leader" | "agent";

async function assertCeo(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "ceo")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: CEO role required");
}

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: teams, error }, { data: profiles }, { data: leads }] = await Promise.all([
      supabase.from("teams").select("id, name, leader_id, created_at").order("created_at"),
      supabase.from("profiles").select("id, full_name, email, team_id"),
      supabase.from("leads").select("id, team_id"),
    ]);
    if (error) throw new Error(error.message);
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (teams ?? []).map((t: any) => {
      const leader = t.leader_id ? profileById.get(t.leader_id) : null;
      return {
        id: t.id as string,
        name: t.name as string,
        leaderId: (t.leader_id as string | null) ?? null,
        leaderName: leader ? (leader.full_name ?? leader.email ?? "—") : null,
        memberCount: (profiles ?? []).filter((p: any) => p.team_id === t.id).length,
        leadCount: (leads ?? []).filter((l: any) => l.team_id === t.id).length,
      };
    });
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(80),
        leaderId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name: data.name, leader_id: data.leaderId ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.leaderId) {
      await supabase.from("profiles").update({ team_id: team.id }).eq("id", data.leaderId);
    }
    return { id: team.id as string };
  });

export const updateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        teamId: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        leaderId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const patch: { name?: string; leader_id?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.leaderId !== undefined) patch.leader_id = data.leaderId;
    const { error } = await supabase.from("teams").update(patch).eq("id", data.teamId);
    if (error) throw new Error(error.message);
    if (data.leaderId) {
      await supabase.from("profiles").update({ team_id: data.teamId }).eq("id", data.leaderId);
      await supabase
        .from("user_roles")
        .insert({ user_id: data.leaderId, role: "team_leader" })
        .select("id");
    }
    return { ok: true };
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ teamId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const { error } = await supabase.from("teams").delete().eq("id", data.teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const [{ data: profiles, error }, { data: roles }, { data: teams }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, team_id, created_at").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("teams").select("id, name"),
    ]);
    if (error) throw new Error(error.message);
    const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.name as string]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get((r as any).user_id) ?? [];
      arr.push((r as any).role);
      rolesByUser.set((r as any).user_id, arr);
    }
    return (profiles ?? []).map((p: any) => {
      const rs = rolesByUser.get(p.id) ?? [];
      const role: AppRole | null = rs.includes("ceo")
        ? "ceo"
        : rs.includes("team_leader") || rs.includes("admin")
          ? "team_leader"
          : rs.includes("agent")
            ? "agent"
            : null;
      return {
        id: p.id as string,
        fullName: (p.full_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        teamId: (p.team_id as string | null) ?? null,
        teamName: p.team_id ? (teamName.get(p.team_id) ?? null) : null,
        role,
        isSelf: p.id === userId,
      };
    });
  });

export const createPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(8).max(72),
        fullName: z.string().min(1).max(120),
        role: z.enum(["team_leader", "agent"]),
        teamId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");
    const newId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, team_id: data.teamId ?? null })
      .eq("id", newId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });

    if (data.role === "team_leader" && data.teamId) {
      await supabaseAdmin.from("teams").update({ leader_id: newId }).eq("id", data.teamId);
    }
    return { id: newId };
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        role: z.enum(["ceo", "team_leader", "agent"]).optional(),
        teamId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    if (data.teamId !== undefined) {
      const { error } = await supabase
        .from("profiles")
        .update({ team_id: data.teamId })
        .eq("id", data.targetUserId);
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      if (data.targetUserId === userId && data.role !== "ceo") {
        throw new Error("You cannot remove your own CEO role");
      }
      await supabase.from("user_roles").delete().eq("user_id", data.targetUserId);
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    if (data.targetUserId === userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCompanyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCeo(supabase, userId);
    const [{ data: teams }, { data: profiles }, { data: roles }, { data: leads }] = await Promise.all([
      supabase.from("teams").select("id, name"),
      supabase.from("profiles").select("id, team_id"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("leads").select("id, team_id, status, assigned_to"),
    ]);
    const agentIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "agent").map((r: any) => r.user_id),
    );
    const l = leads ?? [];
    const won = l.filter((x: any) => x.status === "won").length;
    return {
      totals: {
        teams: (teams ?? []).length,
        people: (profiles ?? []).length,
        agents: agentIds.size,
        leads: l.length,
        won,
        unassigned: l.filter((x: any) => !x.assigned_to).length,
      },
      byTeam: (teams ?? []).map((t: any) => ({
        id: t.id as string,
        name: t.name as string,
        members: (profiles ?? []).filter((p: any) => p.team_id === t.id).length,
        leads: l.filter((x: any) => x.team_id === t.id).length,
        won: l.filter((x: any) => x.team_id === t.id && x.status === "won").length,
      })),
    };
  });
