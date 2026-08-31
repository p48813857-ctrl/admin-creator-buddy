import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMyLeads, updateLeadStatus, logLeadCall } from "@/lib/leads.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, Mail, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agent")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <AgentLeadsPage />
    </Suspense>
  ),
});

import { LEAD_STATUSES as STATUSES, STATUS_COLORS, STATUS_LABELS } from "@/lib/lead-outcomes";


function AgentLeadsPage() {
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listMyLeads);
  const doUpdate = useServerFn(updateLeadStatus);
  const doLogCall = useServerFn(logLeadCall);
  const { data: leads } = useSuspenseQuery({ queryKey: ["leads", "mine"], queryFn: () => fetchLeads() });

  const mut = useMutation({
    mutationFn: (v: { leadId: string; status: (typeof STATUSES)[number] }) =>
      doUpdate({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = STATUSES.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.status}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {STATUS_LABELS[s.status]}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{s.count}</p>
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <Inbox className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">No leads yet</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Leads uploaded or assigned by an admin will appear here.

          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {leads.map((l) => (
            <div
              key={l.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{l.name}</h3>
                    {l.assigned_to === null && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        Unassigned
                      </span>
                    )}
                    {l.source && (
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {l.source}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_COLORS[l.status] ?? "bg-slate-100 text-slate-700",
                      )}
                    >
                      {STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    {l.phone && (
                      <a
                        href={`tel:${l.phone.replace(/[^+\d]/g, "")}`}
                        aria-label={`Call ${l.name} at ${l.phone}`}
                        onClick={() => {
                          doLogCall({ data: { leadId: l.id } })
                            .then(() => qc.invalidateQueries({ queryKey: ["leads"] }))
                            .catch(() => {});
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95 hover:shadow-lg hover:brightness-110"
                      >
                        <Phone className="h-4 w-4" /> Call {l.phone}
                      </a>
                    )}
                    {l.email && (
                      <a
                        href={`mailto:${l.email}`}
                        aria-label={`Email ${l.name}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
                      >
                        <Mail className="h-4 w-4" /> Email
                      </a>
                    )}
                  </div>
                  {l.notes && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{l.notes}</p>
                  )}
                </div>
                <Select
                  value={l.status}
                  onValueChange={(v) =>
                    mut.mutate({ leadId: l.id, status: v as (typeof STATUSES)[number] })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
