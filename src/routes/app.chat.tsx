import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { listChatUsers, listMessages, sendMessage, deleteMessage } from "@/lib/chat.functions";
import { getMe } from "@/lib/leads.functions";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, Hash, Trash2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/chat")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading chat…</div>}>
      <ChatPage />
    </Suspense>
  ),
});

function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ChatPage() {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fetchUsers = useServerFn(listChatUsers);
  const fetchMessages = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const removeMsg = useServerFn(deleteMessage);

  const { data: me } = useSuspenseQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { data: users = [] } = useSuspenseQuery({
    queryKey: ["chat-users"],
    queryFn: () => fetchUsers(),
  });

  // null = team room, else user id
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const myId = me.profile?.id ?? "";

  const msgKey = ["chat-messages", partnerId] as const;
  const { data: messages = [] } = useQuery({
    queryKey: msgKey,
    queryFn: () => fetchMessages({ data: { partnerId } }),
  });

  // Realtime — refetch on any change relevant to this thread
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${partnerId ?? "team"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const row =
            (payload.new as { sender_id?: string; recipient_id?: string | null } | null) ??
            (payload.old as { sender_id?: string; recipient_id?: string | null } | null);
          if (!row) return;
          const isTeam = row.recipient_id == null;
          const isThisDm =
            row.recipient_id != null &&
            ((row.sender_id === myId && row.recipient_id === partnerId) ||
              (row.sender_id === partnerId && row.recipient_id === myId));
          if ((partnerId === null && isTeam) || (partnerId !== null && isThisDm)) {
            qc.invalidateQueries({ queryKey: msgKey });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, myId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await send({ data: { body: text, recipientId: partnerId } });
      qc.invalidateQueries({ queryKey: msgKey });
    } catch (err) {
      toast.error((err as Error).message);
      setInput(text);
    }
  }

  async function onDelete(id: string) {
    try {
      await removeMsg({ data: { messageId: id } });
      qc.invalidateQueries({ queryKey: msgKey });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const partner = users.find((u) => u.id === partnerId);

  return (
    <div className="grid h-[calc(100vh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Channels
          </p>
        </div>
        <button
          onClick={() => setPartnerId(null)}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 text-left text-sm transition",
            partnerId === null
              ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
          )}
        >
          <Hash size={16} />
          Team Room
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
            <Circle size={6} fill="currentColor" />
            live
          </span>
        </button>

        <div className="border-b border-t border-slate-100 p-3 dark:border-slate-800">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Users size={12} /> Direct Messages
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 && (
            <p className="p-4 text-xs text-slate-400">No teammates yet.</p>
          )}
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setPartnerId(u.id)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition",
                partnerId === u.id
                  ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
              )}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-semibold text-white">
                {initials(u.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.role && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                    u.role === "admin"
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                  )}
                >
                  {u.role}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          {partnerId === null ? (
            <>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Hash size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Team Room
                </p>
                <p className="text-xs text-slate-500">Everyone signed in</p>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                {initials(partner?.name ?? "?")}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {partner?.name ?? "Direct message"}
                </p>
                <p className="text-xs text-slate-500">{partner?.email ?? ""}</p>
              </div>
            </>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <p className="pt-12 text-center text-sm text-slate-400">
              No messages yet. Say hi 👋
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div key={m.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <div className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {initials(m.sender_name)}
                  </div>
                )}
                <div
                  className={cn(
                    "group max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                    mine
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                      {m.sender_name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {mine && (
                      <button
                        onClick={() => onDelete(m.id)}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Delete message"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              partnerId === null
                ? "Message the team…"
                : `Message ${partner?.name ?? "user"}…`
            }
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}
