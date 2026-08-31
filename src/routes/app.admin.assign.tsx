import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense } from "react";
import { listAllLeads, assignLead, deleteLead, autoAssignUnassigned, clearLeads } from "@/lib/leads.functions";
import { useState } from "react";
import { listAgents } from "@/lib/admin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Download, Wand2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_EXCEL_FILLS,
  STATUS_EXCEL_FONT_COLORS,
} from "@/lib/lead-outcomes";
import * as XLSX from "xlsx-js-style";

export const Route = createFileRoute("/app/admin/assign")({
  component: () => (
    <Suspense fallback={<div className="p-2 text-slate-500">Loading…</div>}>
      <AssignPage />
    </Suspense>
  ),
});

function AssignPage() {
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listAllLeads);
  const fetchAgents = useServerFn(listAgents);
  const doAssign = useServerFn(assignLead);
  const doDelete = useServerFn(deleteLead);
  const doAutoAssign = useServerFn(autoAssignUnassigned);
  const doClear = useServerFn(clearLeads);
  const [autoAgent, setAutoAgent] = useState<string>("");


  const { data: leads } = useSuspenseQuery({ queryKey: ["leads", "all"], queryFn: () => fetchLeads() });
  const { data: agents } = useSuspenseQuery({ queryKey: ["agents"], queryFn: () => fetchAgents() });

  const assignMut = useMutation({
    mutationFn: (v: { leadId: string; agentId: string | null }) => doAssign({ data: v }),
    onSuccess: () => {
      toast.success("Lead assigned");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (leadId: string) => doDelete({ data: { leadId } }),
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoAssignMut = useMutation({
    mutationFn: (agentId: string) => doAutoAssign({ data: { agentId } }),
    onSuccess: (r: { count: number }) => {
      toast.success(`Assigned ${r.count} lead${r.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: (scope: "all" | "unassigned") => doClear({ data: { scope } }),
    onSuccess: (r: { count: number }) => {
      toast.success(`Deleted ${r.count} lead${r.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agentName = (id: string | null) =>
    id ? agents.find((a) => a.id === id)?.full_name ?? "Unknown" : "Unassigned";

  const unassigned = leads.filter((l) => !l.assigned_to).length;

  const handleExport = () => {
    if (leads.length === 0) {
      toast.info("No leads to export");
      return;
    }
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Source",
      "Latest call outcome",
      "Assigned agent",
      "Agent email",
      "Notes",
      "Created at",
      "Updated at",
    ];
    const rows = leads.map((l) => {
      const agent = l.assigned_to ? agents.find((a) => a.id === l.assigned_to) : null;
      return [
        l.name ?? "",
        l.phone ?? "",
        l.email ?? "",
        l.source ?? "",
        STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status ?? "",
        agent ? agent.full_name ?? agent.email ?? "Unknown" : "Unassigned",
        agent?.email ?? "",
        l.notes ?? "",
        l.created_at ? new Date(l.created_at).toISOString() : "",
        l.updated_at ? new Date(l.updated_at).toISOString() : "",
      ];
    });

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "FF334155" } },
      alignment: { vertical: "center", horizontal: "left" },
    };
    const borderThin = { style: "thin", color: { rgb: "FFE2E8F0" } };
    const border = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

    const aoa: (string | number)[][] = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 14 },
      { wch: 20 }, { wch: 22 }, { wch: 26 }, { wch: 40 },
      { wch: 22 }, { wch: 22 },
    ];

    // Header styles
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = { ...headerStyle, border };
    }

    // Row styles by outcome status
    leads.forEach((l, i) => {
      const fill = STATUS_EXCEL_FILLS[l.status] ?? "FFFFFFFF";
      const font = STATUS_EXCEL_FONT_COLORS[l.status] ?? "FF111827";
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: i + 1, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          fill: { patternType: "solid", fgColor: { rgb: fill } },
          font: { color: { rgb: font } },
          alignment: { vertical: "center", wrapText: c === 7 },
          border,
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `leads-${stamp}.xlsx`);
    toast.success(`Exported ${leads.length} leads`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Leads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign leads to agents and export the full list with call outcomes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={autoAgent} onValueChange={setAutoAgent}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name ?? a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => {
              if (!autoAgent) return toast.info("Pick an agent first");
              if (unassigned === 0) return toast.info("No unassigned leads");
              autoAssignMut.mutate(autoAgent);
            }}
            disabled={autoAssignMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            {autoAssignMut.isPending ? "Assigning…" : `Auto assign (${unassigned})`}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
            disabled={leads.length === 0}
          >
            <Download className="h-4 w-4" />
            Download Excel
          </button>
          <button
            onClick={() => {
              if (unassigned === 0) return toast.info("No unassigned leads");
              if (confirm(`Delete all ${unassigned} unassigned leads? This cannot be undone.`))
                clearMut.mutate("unassigned");
            }}
            disabled={clearMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Eraser className="h-4 w-4" />
            Clear unassigned
          </button>
          <button
            onClick={() => {
              if (leads.length === 0) return toast.info("No leads to delete");
              if (
                confirm(
                  `Delete ALL ${leads.length} leads? They will disappear from every agent panel too. This cannot be undone.`,
                )
              )
                clearMut.mutate("all");
            }}
            disabled={clearMut.isPending || leads.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {clearMut.isPending ? "Deleting…" : "Clear all leads"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Leads", value: leads.length, accent: "from-indigo-500 to-violet-600" },
          { label: "Unassigned", value: unassigned, accent: "from-amber-500 to-orange-600" },
          { label: "Assigned", value: leads.length - unassigned, accent: "from-emerald-500 to-teal-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {s.label}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
              <span className={cn("h-2 w-12 rounded-full bg-gradient-to-r", s.accent)} />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Phone</th>
                <th className="p-3 text-left font-semibold">Email</th>
                <th className="p-3 text-left font-semibold">Source</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Assigned to</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    No leads yet. Upload some first.
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                >
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{l.name}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{l.phone}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{l.email}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{l.source}</td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_COLORS[l.status] ?? "bg-slate-100 text-slate-700",
                      )}
                    >
                      {STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status}
                    </span>
                  </td>
                  <td className="min-w-[200px] p-3">
                    <Select
                      value={l.assigned_to ?? "none"}
                      onValueChange={(v) =>
                        assignMut.mutate({ leadId: l.id, agentId: v === "none" ? null : v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue>{agentName(l.assigned_to)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.full_name ?? a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => {
                        if (confirm(`Delete lead "${l.name}"?`)) deleteMut.mutate(l.id);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
