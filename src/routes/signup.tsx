import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Headphones, UserPlus } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Signing you in…");
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      toast.info("Check your email to confirm, then sign in.");
      navigate({ to: "/login" });
    } else {
      navigate({ to: "/app" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 bg-grid-light px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/40">
            <Headphones className="h-7 w-7 text-white" strokeWidth={2.4} />
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            CallCRM <span className="text-indigo-600 dark:text-indigo-400">Pro</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Call Center Management Suite</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Create account</h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            First user becomes admin; others join as agents.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/60 transition hover:shadow-lg disabled:opacity-60 dark:shadow-indigo-900/40"
            >
              <UserPlus size={16} />
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
