"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ResetPasswordFormProps = {
  submitLabel?: string;
  successMessage?: string;
};

export function ResetPasswordForm({
  submitLabel = "Atualizar senha",
  successMessage = "Senha atualizada com sucesso.",
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.getSession();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setMessage("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(successMessage);
    setLoading(false);
    router.replace("/login");
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="confirm">
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          className="field"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          minLength={6}
        />
      </div>
      {message ? (
        <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
          {message}
        </p>
      ) : null}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        <KeyRound size={17} aria-hidden="true" />
        {loading ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
