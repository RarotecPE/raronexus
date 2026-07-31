"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api/client-fetch";
import { formatCpf } from "@/lib/formatters";
import type { UserResponseDTO } from "@/lib/api/types";

type ResetPasswordFormProps = {
  submitLabel?: string;
  successMessage?: string;
  completeRegistration?: boolean;
};

export function ResetPasswordForm({
  submitLabel = "Atualizar senha",
  successMessage = "Senha atualizada com sucesso.",
  completeRegistration = false,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
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

    if (completeRegistration && (!nome.trim() || cpf.length !== 14)) {
      setMessage("Informe nome e CPF para concluir o cadastro.");
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

    if (completeRegistration) {
      try {
        await apiFetch<UserResponseDTO>("/api/v1/users/me/complete-registration", {
          method: "PUT",
          body: JSON.stringify({ nome: nome.trim(), cpf }),
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erro ao completar cadastro.");
        setLoading(false);
        return;
      }
    }

    setMessage(successMessage);
    setLoading(false);
    router.replace("/login");
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {completeRegistration ? (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              className="field"
              type="text"
              autoComplete="name"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              minLength={2}
              maxLength={150}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="cpf">
              CPF
            </label>
            <input
              id="cpf"
              className="field"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              required
              maxLength={14}
            />
          </div>
        </>
      ) : null}
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
