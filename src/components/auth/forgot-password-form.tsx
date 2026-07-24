"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMessage(
      error
        ? error.message
        : "Se o e-mail existir, enviaremos um link de recuperacao em instantes.",
    );
    setLoading(false);
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      {message ? (
        <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
          {message}
        </p>
      ) : null}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        <Mail size={17} aria-hidden="true" />
        {loading ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}
