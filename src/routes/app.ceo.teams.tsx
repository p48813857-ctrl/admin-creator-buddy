import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTeams, createTeam, updateTeam, deleteTeam, listPeople } from "@/lib/ceo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ceo/teams")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <TeamsPage />
    </Suspense>
  ),
  errorComponent: ({ error }) => <div className="text-destructive">Error: {error.message}</div>,
});

function TeamsPage() {
  const qc = useQueryClient();
  const fetchTeams = useServerFn(listTeams);
  const fetchPeople = useServerFn(listPeople);
  const doCreate = useServerFn(createTeam);
  const doUpdate = useServerFn(updateTeam);
  const doDelete = useServerFn(deleteTeam);

  const { data: teams } = useSuspenseQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const { data: people } = useSuspenseQuery({ queryKey: ["people"], queryFn: () => fetchPeople() });

  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["company-overview"] });
  };

  const create = useMutation({
    mutationFn: () => doCreate({ data: { name, leaderId: leaderId || null } }),
    onSuccess: () => {
      toast.success("Team created");
      setName("");
      setLeaderId("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setLeader = useMutation({
    mutationFn: (v: { teamId: string; leaderId: string | null }) => doUpdate({ data: v }),
    onSuccess: () => {
      toast.success("Team updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (teamId: string) => doDelete({ data: { teamId } }),
    onSuccess: () => {
      toast.success("Team deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = people.filter((p) => p.role !== "ceo");

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("Team name is required");
          create.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Team name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Inbound Sales"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Team leader (optional)</label>
          <select
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">— none —</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName ?? p.email}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create team"}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="p-3 text-left font-semibold">Team</th>
              <th className="p-3 text-left font-semibold">Leader</th>
              <th className="p-3 text-right font-semibold">Members</th>
              <th className="p-3 text-right font-semibold">Leads</th>
              <th className="p-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No teams yet.
                </td>
              </tr>
            )}
            {teams.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                <td className="p-3">
                  <select
                    value={t.leaderId ?? ""}
                    onChange={(e) =>
                      setLeader.mutate({ teamId: t.id, leaderId: e.target.value || null })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">— none —</option>
                    {candidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName ?? p.email}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-right">{t.memberCount}</td>
                <td className="p-3 text-right">{t.leadCount}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete team "${t.name}"?`)) remove.mutate(t.id);
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
