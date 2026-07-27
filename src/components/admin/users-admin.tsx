"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Power, RefreshCw, Search, Save, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { uploadAvatar } from "@/lib/avatar-upload";
import { apiFetch } from "@/lib/api/client-fetch";
import { formatCpf, formatPhone } from "@/lib/formatters";
import type { UserResponseDTO } from "@/lib/api/types";

type DraftUser = {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  avatar_url: string;
  ativo: boolean;
  is_admin: boolean;
};

const emptyDraft: DraftUser = {
  nome: "",
  email: "",
  cpf: "",
  telefone: "",
  avatar_url: "",
  ativo: true,
  is_admin: false,
};

export function UsersAdmin() {
  const [users, setUsers] = useState<UserResponseDTO[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftUser>(emptyDraft);
  const [editing, setEditing] = useState<UserResponseDTO | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const activeCount = useMemo(() => users.filter((user) => user.ativo).length, [users]);

  const loadUsers = useCallback(async (query = search) => {
    setLoading(true);
    setMessage("");
    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
      setUsers(await apiFetch<UserResponseDTO[]>(`/api/v1/users${suffix}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers("");
    });
  }, [loadUsers]);

  function startEdit(user: UserResponseDTO) {
    setEditing(user);
    setDraft({
      nome: user.nome,
      email: user.email,
      cpf: user.cpf ?? "",
      telefone: user.telefone ?? "",
      avatar_url: user.avatar_url ?? "",
      ativo: user.ativo,
      is_admin: user.is_admin ?? false,
    });
  }

  function resetDraft() {
    setEditing(null);
    setDraft(emptyDraft);
    setAvatarFile(null);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (!editing && !draft.cpf) {
        throw new Error("Informe o CPF para cadastrar o usuario.");
      }

      if (editing) {
        const avatarUrl = avatarFile
          ? await uploadAvatar(avatarFile, editing.id)
          : draft.avatar_url;

        await apiFetch<UserResponseDTO>(`/api/v1/users/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            nome: draft.nome,
            cpf: draft.cpf,
            telefone: draft.telefone,
            avatar_url: avatarUrl,
            ativo: draft.ativo,
            is_admin: draft.is_admin,
          }),
        });
        setMessage("Usuario atualizado.");
      } else {
        const created = await apiFetch<UserResponseDTO>("/api/v1/users", {
          method: "POST",
          body: JSON.stringify(draft),
        });

        if (avatarFile) {
          const avatarUrl = await uploadAvatar(avatarFile, created.id);
          await apiFetch<UserResponseDTO>(`/api/v1/users/${created.id}`, {
            method: "PUT",
            body: JSON.stringify({ avatar_url: avatarUrl }),
          });
        }

        setMessage("Usuario criado. Enviamos um e-mail para completar o cadastro.");
      }
      resetDraft();
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUser(user: UserResponseDTO) {
    setMessage("");
    try {
      await apiFetch<UserResponseDTO>(`/api/v1/users/${user.id}`, { method: "DELETE" });
      setMessage("Usuario desativado.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao desativar usuario.");
    }
  }

  return (
    <AppShell title="Administracao de usuarios">
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 p-5">
            <div>
              <h1 className="text-2xl font-semibold text-white">Usuarios</h1>
              <p className="text-sm text-slate-400">
                {activeCount} ativos de {users.length} cadastrados
              </p>
            </div>
            <form
              className="flex w-full gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                loadUsers(search);
              }}
            >
              <input
                className="field min-w-0 sm:w-72"
                placeholder="Pesquisar por nome ou e-mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="btn-secondary px-3" type="submit" title="Pesquisar">
                <Search size={17} aria-hidden="true" />
              </button>
              <button className="btn-secondary px-3" type="button" onClick={() => loadUsers()} title="Recarregar">
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </form>
          </div>

          {message ? (
            <p className="mx-5 mt-5 rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
              {message}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">E-mail</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td className="px-5 py-6 text-slate-300" colSpan={5}>
                      Carregando usuarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-slate-300" colSpan={5}>
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-900/70">
                      <td className="px-5 py-4 font-medium text-white">{user.nome}</td>
                      <td className="px-5 py-4 text-slate-300">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={user.ativo ? "text-emerald-300" : "text-rose-300"}>
                          {user.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{user.is_admin ? "Sim" : "Nao"}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button className="btn-secondary min-h-9 px-3 py-1" type="button" onClick={() => startEdit(user)}>
                            Editar
                          </button>
                          <button className="btn-secondary min-h-9 px-3 py-1" type="button" onClick={() => deactivateUser(user)}>
                            <Power size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="panel h-fit p-5" onSubmit={saveUser}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200">
              {editing ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editing ? "Editar usuario" : "Criar usuario"}
              </h2>
              <p className="text-sm text-slate-400">
                {editing ? "Auth + registro complementar." : "O usuario define a senha por e-mail."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <input className="field" placeholder="Nome" value={draft.nome} onChange={(event) => setDraft({ ...draft, nome: event.target.value })} required />
            <input className="field" placeholder="E-mail" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required disabled={Boolean(editing)} />
            <input
              className="field"
              placeholder="CPF"
              value={draft.cpf}
              onChange={(event) => setDraft({ ...draft, cpf: formatCpf(event.target.value) })}
              required
              inputMode="numeric"
              maxLength={14}
            />
            <input
              className="field"
              placeholder="Telefone"
              value={draft.telefone}
              onChange={(event) => setDraft({ ...draft, telefone: formatPhone(event.target.value) })}
              inputMode="tel"
              maxLength={15}
            />
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Avatar
              <span className="flex items-center gap-2">
                <input
                  className="field"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </span>
              {draft.avatar_url || avatarFile ? (
                <span className="flex items-center gap-2 text-xs font-normal text-cyan-200">
                  <Upload size={14} aria-hidden="true" />
                  {avatarFile?.name ?? "Avatar atual mantido"}
                </span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={draft.ativo} onChange={(event) => setDraft({ ...draft, ativo: event.target.checked })} />
              Usuario ativo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={draft.is_admin} onChange={(event) => setDraft({ ...draft, is_admin: event.target.checked })} />
              <ShieldCheck size={16} aria-hidden="true" />
              Administrador RaroNexus
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </button>
            {editing ? (
              <button className="btn-secondary" type="button" onClick={resetDraft}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </AppShell>
  );
}
