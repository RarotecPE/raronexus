"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();

    if (!payload.success) {
      setMessage(payload.message ?? "Nao foi possivel entrar.");
      setLoading(false);
      return;
    }

    const { createBrowserSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.setSession({
      access_token: payload.data.access_token,
      refresh_token: payload.data.refresh_token,
    });

    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/applications");
    router.refresh();
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
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {message ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {message}
        </p>
      ) : null}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        <LogIn size={17} aria-hidden="true" />
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <Link className="block text-center text-sm font-medium text-cyan-300 hover:text-cyan-200" href="/forgot-password">
        Esqueci minha senha
      </Link>
    </form>
  );
}
