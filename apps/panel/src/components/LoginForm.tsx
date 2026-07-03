import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3">
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        data-testid="email-input"
        className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
        required
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-testid="password-input"
        className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
        required
      />
      <button
        type="submit"
        data-testid="login-button"
        disabled={submitting}
        className="rounded bg-slate-100 px-3 py-2 font-medium text-slate-950 disabled:opacity-50"
      >
        Entrar
      </button>
      {error && (
        <p role="alert" data-testid="login-error" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
