"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { KeyRound, Save, Upload, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { uploadAvatar } from "@/lib/avatar-upload";
import { apiFetch } from "@/lib/api/client-fetch";
import { formatPhone } from "@/lib/formatters";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { UserResponseDTO } from "@/lib/api/types";

export function ProfileForm() {
  const [user, setUser] = useState<UserResponseDTO | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    apiFetch<UserResponseDTO>("/api/v1/users/me")
      .then((data) => {
        setUser(data);
        setNome(data.nome);
        setTelefone(data.telefone ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const nextAvatarUrl = avatarFile && user
        ? await uploadAvatar(avatarFile, user.id)
        : avatarUrl;

      const updated = await apiFetch<UserResponseDTO>("/api/v1/users/me", {
        method: "PUT",
        body: JSON.stringify({ nome, telefone, avatar_url: nextAvatarUrl }),
      });
      setUser(updated);
      setAvatarUrl(updated.avatar_url ?? "");
      setAvatarFile(null);
      setMessage("Perfil atualizado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage("");

    if (password !== passwordConfirm) {
      setPasswordMessage("As senhas nao conferem.");
      return;
    }

    setSavingPassword(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage(error.message);
      return;
    }

    setPassword("");
    setPasswordConfirm("");
    setPasswordMessage("Senha atualizada com sucesso.");
  }

  return (
    <AppShell title="Perfil">
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <form className="panel p-5" onSubmit={onSubmit}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200">
                <UserRound size={20} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Meu perfil</h1>
                <p className="text-sm text-slate-400">Dados globais da identidade corporativa.</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-300">Carregando perfil...</p>
            ) : (
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="nome">
                    Nome
                  </label>
                  <input id="nome" className="field" value={nome} onChange={(event) => setNome(event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="telefone">
                    Telefone
                  </label>
                  <input
                    id="telefone"
                    className="field"
                    value={telefone}
                    onChange={(event) => setTelefone(formatPhone(event.target.value))}
                    inputMode="tel"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="avatar">
                    Foto
                  </label>
                  <input
                    id="avatar"
                    className="field"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                  />
                  {avatarFile ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-cyan-200">
                      <Upload size={15} aria-hidden="true" />
                      {avatarFile.name}
                    </p>
                  ) : null}
                </div>
                {message ? (
                  <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
                    {message}
                  </p>
                ) : null}
                <button className="btn-primary w-fit" type="submit" disabled={saving}>
                  <Save size={17} aria-hidden="true" />
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            )}
          </form>

          <form className="panel p-5" onSubmit={onPasswordSubmit}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200">
                <KeyRound size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Alterar senha</h2>
                <p className="text-sm text-slate-400">Defina uma nova senha para sua conta.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="profile-password">
                  Nova senha
                </label>
                <input
                  id="profile-password"
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
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="profile-password-confirm">
                  Confirmar nova senha
                </label>
                <input
                  id="profile-password-confirm"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {passwordMessage ? (
                <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
                  {passwordMessage}
                </p>
              ) : null}
              <button className="btn-primary w-fit" type="submit" disabled={savingPassword}>
                <KeyRound size={17} aria-hidden="true" />
                {savingPassword ? "Salvando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </div>

        <aside className="panel h-fit p-5">
          {avatarUrl ? (
            <div className="mb-5 overflow-hidden rounded-lg border border-cyan-400/20 bg-slate-950">
              <Image
                src={avatarUrl}
                alt={`Foto de ${user?.nome ?? "usuario"}`}
                width={320}
                height={320}
                className="aspect-square w-full object-cover"
              />
            </div>
          ) : null}
          <h2 className="text-lg font-semibold text-white">Conta</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">E-mail</dt>
              <dd className="text-slate-100">{user?.email ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className={user?.ativo ? "text-emerald-300" : "text-rose-300"}>
                {user?.ativo ? "Ativo" : "Inativo"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Administrador</dt>
              <dd className="text-slate-100">{user?.is_admin ? "Sim" : "Nao"}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </AppShell>
  );
}
