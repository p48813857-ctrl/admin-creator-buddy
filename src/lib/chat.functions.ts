import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
  sender_name: string;
};

export type ChatUser = {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "agent" | null;
};

// List other users available to chat with
export const listChatUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatUser[]> => {
    const { supabase, userId } = context;
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, "admin" | "agent">();
    for (const r of roles ?? []) {
      const current = roleMap.get(r.user_id);
      if (!current || r.role === "admin") roleMap.set(r.user_id, r.role as "admin" | "agent");
    }
    return (profiles ?? [])
      .filter((p) => p.id !== userId)
      .map((p) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "User",
        email: p.email,
        role: roleMap.get(p.id) ?? null,
      }));
  });

// Get messages: either team room (partner = null) or DM with a specific user
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ partnerId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .order("created_at", { ascending: true })
      .limit(500);
    if (data.partnerId === null) {
      q = q.is("recipient_id", null);
    } else {
      q = q
        .not("recipient_id", "is", null)
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${data.partnerId}),and(sender_id.eq.${data.partnerId},recipient_id.eq.${userId})`,
        );
    }
    const { data: msgs, error } = await q;
    if (error) throw new Error(error.message);

    const senderIds = Array.from(new Set((msgs ?? []).map((m) => m.sender_id)));
    let nameOf = new Map<string, string>();
    if (senderIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);
      for (const p of profiles ?? []) {
        nameOf.set(p.id, p.full_name ?? p.email ?? "User");
      }
    }
    return (msgs ?? []).map((m) => ({
      ...m,
      sender_name: nameOf.get(m.sender_id) ?? "User",
    }));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        body: z.string().trim().min(1).max(4000),
        recipientId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: data.recipientId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("messages").delete().eq("id", data.messageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
