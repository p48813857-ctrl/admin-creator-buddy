import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getRoleRedirect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((data ?? []).map((r) => r.role));
    if (roles.has("ceo")) return "ceo";
    if (roles.has("team_leader") || roles.has("admin")) return "team_leader";
    return "agent";
  });

export const Route = createFileRoute("/app/")({
  loader: async () => {
    const role = await getRoleRedirect();
    throw redirect({
      to: role === "ceo" ? "/app/ceo" : role === "team_leader" ? "/app/admin/upload" : "/app/agent",
    });
  },
});
