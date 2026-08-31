import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { bulkInsertLeads } from "@/lib/leads.functions";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/upload")({ component: UploadPage });

type ParsedLead = {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  const nk = keys.map(norm);
  for (const k of nk) {
    for (const rk of Object.keys(row)) {
      if (norm(rk) === k) {
        const v = row[rk];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return null;
}

// Merged header cells in the sample sheet produce "Unnamed: N" columns that
// still carry values (e.g. the course next to the college name).
function unnamedValues(row: Record<string, unknown>): string[] {
  return Object.keys(row)
    .filter((k) => /^unnamed/i.test(k.trim()))
    .map((k) => (row[k] == null ? "" : String(row[k]).trim()))
    .filter((v) => v !== "");
}

function UploadPage() {
  const [rows, setRows] = useState<ParsedLead[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const insert = useServerFn(bulkInsertLeads);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (leads: ParsedLead[]) => insert({ data: { leads } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.count} leads`);
      setRows([]);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // Find the header row (files sometimes start with a title row)
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    let headerRow = 0;
    for (let i = 0; i < Math.min(grid.length, 15); i++) {
      const cells = (grid[i] ?? []).map((c) => norm(String(c ?? "")));
      if (cells.some((c) => c.includes("name")) && cells.some((c) => c.includes("mobile") || c.includes("phone") || c.includes("email"))) {
        headerRow = i;
        break;
      }
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      range: headerRow,
    });
    const parsed: ParsedLead[] = [];
    for (const r of json) {
      const name = pick(r, ["student name", "students name", "name", "full name", "customer", "lead"]);
      if (!name) continue;

      const college = pick(r, ["collage name", "college name", "college", "institution", "source", "channel"]);
      const place = pick(r, ["place", "city", "location", "district"]);
      const prev = pick(r, ["privous coures", "previous course", "previous coures", "prev course", "qualification"]);
      const extras = unnamedValues(r);
      const course = pick(r, ["course", "degree", "stream"]) ?? extras[0] ?? null;
      const sl = pick(r, ["sl.no", "slno", "sl no", "s.no", "sno"]);
      const existingNotes = pick(r, ["notes", "comments", "remarks"]);

      const noteParts = [
        sl ? `SL No: ${sl}` : null,
        college ? `College: ${college}` : null,
        course ? `Course: ${course}` : null,
        place ? `Place: ${place}` : null,
        prev ? `Previous course: ${prev}` : null,
        existingNotes,
      ].filter(Boolean) as string[];

      parsed.push({
        name,
        phone: pick(r, ["mobile number", "mobile no", "mobile", "phone number", "phone", "contact number", "contact", "number"]),
        email: pick(r, ["email", "email id", "e-mail", "mail"]),
        source: college,
        notes: noteParts.length ? noteParts.join(" | ") : null,
      });
    }
    setRows(parsed);
    if (parsed.length === 0) toast.warning("No valid rows found. Need a 'student name' column.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Upload an Excel or CSV file in the standard format — columns:{" "}
          <span className="font-medium text-slate-800 dark:text-slate-200">
            SL.no, Collage name, Course, student name, place, mobile number, privous coures, email
          </span>
          .
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Student name and mobile number are used as the lead's name and phone; college becomes the source, and course /
          place / previous course are saved into the lead notes.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-12 transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <Upload className="h-6 w-6" />
          </div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">Click to choose file</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">.xlsx, .xls, .csv</div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </div>

      {fileName && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span className="truncate font-medium text-slate-900 dark:text-slate-100">{fileName}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">— {rows.length} valid rows</span>
            </div>
            <button
              onClick={() => mut.mutate(rows)}
              disabled={rows.length === 0 || mut.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {mut.isPending ? "Importing…" : `Import ${rows.length}`}
            </button>
          </div>
          {rows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3 text-left font-semibold">Student name</th>
                    <th className="p-3 text-left font-semibold">Mobile</th>
                    <th className="p-3 text-left font-semibold">Email</th>
                    <th className="p-3 text-left font-semibold">College</th>
                    <th className="p-3 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{r.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{r.phone}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{r.email}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{r.source}</td>
                      <td className="max-w-xs truncate p-3 text-xs text-slate-500 dark:text-slate-400">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div className="p-2 text-center text-xs text-slate-500">
                  Showing first 100 of {rows.length}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
