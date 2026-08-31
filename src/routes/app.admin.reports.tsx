import { createFileRoute } from "@tanstack/react-router";
import { Fragment, Suspense, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";
import { Download, Filter, Printer, FileSpreadsheet } from "lucide-react";
import { listReportLeads, getAgentSummary } from "@/lib/reports.functions";
import { listAgents } from "@/lib/admin.functions";
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_EXCEL_FILLS,
  STATUS_EXCEL_FONT_COLORS,
} from "@/lib/lead-outcomes";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/lead-outcomes";
import type { ReportRow } from "@/lib/reports.functions";

export const Route = createFileRoute("/app/admin/reports")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading reports…</div>}>
      <ReportsPage />
    </Suspense>
  ),
});

function ReportsPage() {
  const fetchLeads = useServerFn(listReportLeads);
  const fetchAgents = useServerFn(listAgents);
  const fetchAgentSummary = useServerFn(getAgentSummary);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");
  const [source, setSource] = useState("");

  const filters = useMemo(
    () => ({
      from: from || null,
      to: to ? new Date(to + "T23:59:59").toISOString() : null,
      status: status || null,
      agentId: agentId || null,
      source: source.trim() || null,
    }),
    [from, to, status, agentId, source],
  );

  const { data: leads } = useSuspenseQuery({
    queryKey: ["report-leads", filters],
    queryFn: () => fetchLeads({ data: filters }),
  });
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-list"],
    queryFn: () => fetchAgents(),
  });

  const statusOrder = useMemo<LeadStatus[]>(
    () => ["vv", "48", "will", "sd", "parents", "lc", "nr", "ni", "new"],
    [],
  );

  const groupedLeads = useMemo(() => {
    const map = new Map<LeadStatus, ReportRow[]>();
    for (const s of statusOrder) map.set(s, []);
    for (const l of leads ?? []) {
      const key = (l.status as LeadStatus) ?? "new";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return statusOrder.map((status) => ({ status, items: map.get(status)! }));
  }, [leads, statusOrder]);

  function exportLeadsExcel() {
    if (!leads.length) return toast.error("No rows to export");
    const statusRank: Record<LeadStatus, number> = {
      vv: 0,
      "48": 1,
      will: 2,
      sd: 3,
      parents: 4,
      lc: 5,
      nr: 6,
      ni: 7,
      new: 8,
    };
    const sorted = [...leads].sort(
      (a, b) =>
        (statusRank[(a.status as LeadStatus) ?? "new"] ?? 99) -
        (statusRank[(b.status as LeadStatus) ?? "new"] ?? 99),
    );
    const rows = sorted.map((l) => ({
      Name: l.name,
      Phone: l.phone ?? "",
      Email: l.email ?? "",
      Source: l.source ?? "",
      Outcome:
        STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status,
      "Assigned Agent": l.assigned_name ?? "Unassigned",
      Notes: l.notes ?? "",
      Created: new Date(l.created_at).toLocaleString(),
      Updated: new Date(l.updated_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Color rows by outcome
    sorted.forEach((l, idx) => {
      const fill = STATUS_EXCEL_FILLS[l.status];
      if (!fill) return;
      const font = STATUS_EXCEL_FONT_COLORS[l.status] ?? "FF111827";
      const rowNum = idx + 2;
      for (let c = 0; c < Object.keys(rows[0]).length; c++) {
        const ref = XLSX.utils.encode_cell({ r: rowNum - 1, c });
        const cell = ws[ref];
        if (!cell) continue;
        cell.s = {
          fill: { patternType: "solid", fgColor: { rgb: fill.slice(2) } },
          font: { color: { rgb: font.slice(2) } },
        };
      }
    });
    ws["!cols"] = [
      { wch: 24 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 18 },
      { wch: 22 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${sorted.length} rows`);
  }

  async function exportAgentSummary() {
    const summary = await fetchAgentSummary();
    if (!summary.length) return toast.error("No agents to summarize");
    const rows = summary.map((s) => ({
      Agent: s.name,
      Email: s.email ?? "",
      "Total Leads": s.total,
      New: s.new,
      Contacted: s.contacted,
      Visiting: s.visiting,
      Won: s.won,
      Lost: s.lost,
      "Conversion %": s.conversionRate,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 24 }, { wch: 26 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Per-Agent Summary");
    XLSX.writeFile(wb, `agent-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${summary.length} agents`);
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={16} className="text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            placeholder="From"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            placeholder="To"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All outcomes</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name ?? a.email}</option>
            ))}
          </select>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source contains…"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={exportLeadsExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow"
          >
            <Download size={16} />
            Export Excel ({leads.length})
          </button>
          <button
            onClick={exportAgentSummary}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow"
          >
            <FileSpreadsheet size={16} />
            Per-Agent Summary
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-0 print:shadow-none">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
          {leads.length} lead{leads.length === 1 ? "" : "s"} match your filters
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Outcome</th>
                <th className="p-3 text-left">Agent</th>
                <th className="p-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {groupedLeads.map((group) =>
                group.items.length === 0 ? null : (
                  <Fragment key={group.status}>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td colSpan={7} className="p-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-bold",
                            STATUS_COLORS[group.status] ?? "bg-slate-100 text-slate-700",
                          )}
                        >
                          {STATUS_LABELS[group.status]} ({group.items.length})
                        </span>
                      </td>
                    </tr>
                    {group.items.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{l.name}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{l.phone ?? "—"}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{l.email ?? "—"}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{l.source ?? "—"}</td>
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
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {l.assigned_name ?? <span className="text-slate-400">Unassigned</span>}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(l.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ),
              )}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                    No leads match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
