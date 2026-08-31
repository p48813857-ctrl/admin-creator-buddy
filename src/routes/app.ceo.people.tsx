import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPeople,
  createPerson,
  updatePerson,
  deletePerson,
  listTeams,
} from "@/lib/ceo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ceo/people")({
  component: () => (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <PeoplePage />
    </Suspense>
  ),
  errorComponent: ({ error }) => <div className="text-destructive">Error: {error.message}</div>,
});

function PeoplePage() {
  const qc = useQueryClient();
  const fetchPeople = useServerFn(listPeople);
  const fetchTeams = useServerFn(listTeams);
  const doCreate = useServerFn(createPerson);
  const doUpdate = useServerFn(updatePerson);
  const doDelete = useServerFn(deletePerson);

  const { data: people } = useSuspenseQuery({ queryKey: ["people"], queryFn: () => fetchPeople() });
  const { data: teams } = useSuspenseQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "agent" as "agent" | "team_leader",
    teamId: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["company-overview"] });
  };

  const create = useMutation({
    mutationFn: () =>
      doCreate({
        data: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          teamId: form.teamId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Account created");
      setForm({ fullName: "", email: "", password: "", role: "agent", teamId: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (v: {
      targetUserId: string;
      role?: "ceo" | "team_leader" | "agent";
      teamId?: string | null;
    }) => doUpdate({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (targetUserId: string) => doDelete({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success("Account deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const input =
    "rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800";

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.fullName || !form.email || form.password.length < 8)
            return toast.error("Name, email and a password of 8+ characters are required");
          create.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          className={input}
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <input
          className={input}
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className={input}
          placeholder="Temp password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select
          className={input}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as "agent" | "team_leader" })}
        >
          <option value="agent">Call agent</option>
          <option value="team_leader">Team leader</option>
        </select>
        <select
          className={input}
          value={form.teamId}
          onChange={(e) => setForm({ ...form, teamId: e.target.value })}
        >
          <option value="">— no team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Add person"}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="p-3 text-left font-semibold">Person</th>
              <th className="p-3 text-left font-semibold">Email</th>
              <th className="p-3 text-left font-semibold">Role</th>
              <th className="p-3 text-left font-semibold">Team</th>
              <th className="p-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                  {p.fullName ?? "—"}
                  {p.isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </td>
                <td className="p-3 text-slate-500">{p.email}</td>
                <td className="p-3">
                  <select
                    value={p.role ?? "agent"}
                    disabled={p.isSelf}
                    onChange={(e) =>
                      update.mutate({
                        targetUserId: p.id,
                        role: e.target.value as "ceo" | "team_leader" | "agent",
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ceo">CEO</option>
                    <option value="team_leader">Team leader</option>
                    <option value="agent">Call agent</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={p.teamId ?? ""}
                    onChange={(e) =>
                      update.mutate({ targetUserId: p.id, teamId: e.target.value || null })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">— no team —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-right">
                  <button
                    disabled={p.isSelf}
                    onClick={() => {
                      if (confirm(`Delete ${p.fullName ?? p.email}?`)) remove.mutate(p.id);
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950"
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
