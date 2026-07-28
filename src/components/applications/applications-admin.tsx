"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/api/client-fetch";
import type {
  ApplicationAssignmentDTO,
  ApplicationResponseDTO,
  ApplicationRoleDTO,
  UserResponseDTO,
} from "@/lib/api/types";

type DraftRole = {
  id?: string;
  nome: string;
  chave: string;
  descricao: string;
  ativo: boolean;
};

type DraftApplication = {
  nome: string;
  descricao: string;
  client_id: string;
  homepage_url: string;
  redirect_uris: string;
  allowed_origins: string;
  ativo: boolean;
  roles: DraftRole[];
};

const emptyDraft: DraftApplication = {
  nome: "",
  descricao: "",
  client_id: "",
  homepage_url: "",
  redirect_uris: "",
  allowed_origins: "",
  ativo: true,
  roles: [],
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function linesToArray(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value?: string[]) {
  return value?.join("\n") ?? "";
}

function editableRoles(roles?: ApplicationRoleDTO[]) {
  return roles?.filter((role) => role.chave !== "nao_autorizado") ?? [];
}

export function ApplicationsAdmin() {
  const [me, setMe] = useState<UserResponseDTO | null>(null);
  const [applications, setApplications] = useState<ApplicationResponseDTO[]>([]);
  const [selected, setSelected] = useState<ApplicationResponseDTO | null>(null);
  const [draft, setDraft] = useState<DraftApplication>(emptyDraft);
  const [assignments, setAssignments] = useState<ApplicationAssignmentDTO[]>([]);
  const [assignmentDraft, setAssignmentDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const isAdmin = Boolean(me?.is_admin);
  const activeCount = useMemo(
    () => applications.filter((application) => application.ativo).length,
    [applications],
  );

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [profile, apps] = await Promise.all([
        apiFetch<UserResponseDTO>("/api/v1/users/me"),
        apiFetch<ApplicationResponseDTO[]>("/api/v1/applications"),
      ]);
      setMe(profile);
      setApplications(apps);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar plataformas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadApplications();
    });
  }, [loadApplications]);

  function resetDraft() {
    setSelected(null);
    setDraft(emptyDraft);
    setAssignments([]);
    setAssignmentDraft({});
  }

  async function selectApplication(application: ApplicationResponseDTO) {
    setSelected(application);
    setDraft({
      nome: application.nome,
      descricao: application.descricao ?? "",
      client_id: application.client_id,
      homepage_url: application.homepage_url ?? "",
      redirect_uris: arrayToLines(application.redirect_uris),
      allowed_origins: arrayToLines(application.allowed_origins),
      ativo: application.ativo,
      roles: editableRoles(application.roles).map((role) => ({
        id: role.id,
        nome: role.nome,
        chave: role.chave,
        descricao: role.descricao ?? "",
        ativo: role.ativo,
      })),
    });

    if (isAdmin) {
      try {
        const data = await apiFetch<ApplicationAssignmentDTO[]>(
          `/api/v1/applications/${application.id}/assignments`,
        );
        setAssignments(data);
        setAssignmentDraft(Object.fromEntries(data.map((item) => [item.user_id, item.role_id ?? ""])));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar acessos.");
      }
    }
  }

  function updateDraftName(nome: string) {
    setDraft((current) => ({
      ...current,
      nome,
      client_id: selected || current.client_id ? current.client_id : slugify(nome),
    }));
  }

  function updateRole(index: number, input: Partial<DraftRole>) {
    setDraft((current) => ({
      ...current,
      roles: current.roles.map((role, roleIndex) => (
        roleIndex === index ? { ...role, ...input } : role
      )),
    }));
  }

  function addRole() {
    setDraft((current) => ({
      ...current,
      roles: [...current.roles, { nome: "", chave: "", descricao: "", ativo: true }],
    }));
  }

  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        nome: draft.nome,
        descricao: draft.descricao,
        client_id: draft.client_id,
        homepage_url: draft.homepage_url,
        redirect_uris: linesToArray(draft.redirect_uris),
        allowed_origins: linesToArray(draft.allowed_origins),
        ativo: draft.ativo,
        roles: draft.roles.filter((role) => role.nome && role.chave).map((role) => ({
          ...role,
          descricao: role.descricao || null,
        })),
      };

      const saved = selected
        ? await apiFetch<ApplicationResponseDTO>(`/api/v1/applications/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        : await apiFetch<ApplicationResponseDTO>("/api/v1/applications", {
          method: "POST",
          body: JSON.stringify(payload),
        });

      setMessage(selected ? "Plataforma atualizada." : "Plataforma cadastrada.");
      await loadApplications();
      await selectApplication(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar plataforma.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignments() {
    if (!selected) return;
    setSavingAssignments(true);
    setMessage("");
    try {
      const updated = await apiFetch<ApplicationAssignmentDTO[]>(
        `/api/v1/applications/${selected.id}/assignments`,
        {
          method: "PUT",
          body: JSON.stringify({
            assignments: assignments.map((assignment) => ({
              user_id: assignment.user_id,
              role_id: assignmentDraft[assignment.user_id] || null,
            })),
          }),
        },
      );
      setAssignments(updated);
      setMessage("Acessos atualizados.");
      await loadApplications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar acessos.");
    } finally {
      setSavingAssignments(false);
    }
  }

  return (
    <AppShell title="Plataformas">
      <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 p-5">
            <div>
              <h1 className="text-2xl font-semibold text-white">Plataformas</h1>
              <p className="text-sm text-slate-400">
                {isAdmin ? `${activeCount} ativas de ${applications.length} cadastradas` : `${applications.length} liberadas para sua conta`}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary px-3" type="button" onClick={loadApplications} title="Recarregar">
                <RefreshCw size={17} aria-hidden="true" />
              </button>
              {isAdmin ? (
                <button className="btn-primary" type="button" onClick={resetDraft}>
                  <Plus size={17} aria-hidden="true" />
                  Nova
                </button>
              ) : null}
            </div>
          </div>

          {message ? (
            <p className="mx-5 mt-5 rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
              {message}
            </p>
          ) : null}

          <div className="grid gap-3 p-5">
            {loading ? (
              <p className="text-sm text-slate-300">Carregando plataformas...</p>
            ) : applications.length === 0 ? (
              <p className="text-sm text-slate-300">
                {isAdmin ? "Nenhuma plataforma cadastrada." : "Nenhuma plataforma liberada para sua conta."}
              </p>
            ) : (
              applications.map((application) => (
                <button
                  key={application.id}
                  className={`rounded-lg border p-4 text-left transition ${selected?.id === application.id ? "border-cyan-300/70 bg-cyan-950/35" : "border-slate-700/70 bg-slate-950/45 hover:border-cyan-400/45 hover:bg-slate-900/70"}`}
                  type="button"
                  onClick={() => selectApplication(application)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AppWindow size={18} className="text-cyan-200" aria-hidden="true" />
                        <h2 className="font-semibold text-white">{application.nome}</h2>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{application.descricao || application.client_id}</p>
                    </div>
                    <span className={application.ativo ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
                      {application.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                    {application.user_role ? (
                      <span className="rounded-md border border-cyan-400/25 bg-cyan-950/35 px-2 py-1 text-cyan-100">
                        {application.user_role.nome}
                      </span>
                    ) : null}
                    {isAdmin ? (
                      <>
                        <span className="rounded-md border border-slate-700 px-2 py-1">
                          {application.client_id}
                        </span>
                        <span className="rounded-md border border-slate-700 px-2 py-1">
                          {editableRoles(application.roles).length} roles
                        </span>
                      </>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {isAdmin ? (
          <aside className="grid h-fit gap-5">
            <form className="panel p-5" onSubmit={saveApplication}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200">
                  {selected ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selected ? "Editar plataforma" : "Cadastrar plataforma"}
                  </h2>
                  <p className="text-sm text-slate-400">Identidade, callbacks e roles nominais.</p>
                </div>
              </div>

              <div className="space-y-3">
                <input className="field" placeholder="Nome" value={draft.nome} onChange={(event) => updateDraftName(event.target.value)} required />
                <input className="field" placeholder="client_id" value={draft.client_id} onChange={(event) => setDraft({ ...draft, client_id: slugify(event.target.value) })} required />
                <textarea className="field min-h-24" placeholder="Descricao" value={draft.descricao} onChange={(event) => setDraft({ ...draft, descricao: event.target.value })} />
                <input className="field" placeholder="URL inicial da plataforma" type="url" value={draft.homepage_url} onChange={(event) => setDraft({ ...draft, homepage_url: event.target.value })} />
                <textarea className="field min-h-24" placeholder="Redirect URIs permitidas, uma por linha" value={draft.redirect_uris} onChange={(event) => setDraft({ ...draft, redirect_uris: event.target.value })} required />
                <textarea className="field min-h-24" placeholder="Origens permitidas, uma por linha" value={draft.allowed_origins} onChange={(event) => setDraft({ ...draft, allowed_origins: event.target.value })} />
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={draft.ativo} onChange={(event) => setDraft({ ...draft, ativo: event.target.checked })} />
                  Plataforma ativa
                </label>
              </div>

              {selected?.client_secret ? (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <KeyRound size={15} aria-hidden="true" />
                    Client secret
                  </p>
                  <code className="block break-all text-xs text-slate-300">{selected.client_secret}</code>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Roles
                  </h3>
                  <button className="btn-secondary min-h-9 px-3 py-1" type="button" onClick={addRole}>
                    <Plus size={15} aria-hidden="true" />
                    Role
                  </button>
                </div>
                <div className="space-y-3">
                  {draft.roles.map((role, index) => (
                    <div key={role.id ?? index} className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="field" placeholder="Nome da role" value={role.nome} onChange={(event) => updateRole(index, { nome: event.target.value })} />
                        <input className="field" placeholder="chave" value={role.chave} onChange={(event) => updateRole(index, { chave: slugify(event.target.value) })} />
                      </div>
                      <input className="field mt-2" placeholder="Descricao" value={role.descricao} onChange={(event) => updateRole(index, { descricao: event.target.value })} />
                      <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                        <input type="checkbox" checked={role.ativo} onChange={(event) => updateRole(index, { ativo: event.target.checked })} />
                        Role ativa
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn-primary" disabled={saving} type="submit">
                  <Save size={17} aria-hidden="true" />
                  {saving ? "Salvando..." : selected ? "Salvar" : "Cadastrar"}
                </button>
                {selected ? (
                  <button className="btn-secondary" type="button" onClick={resetDraft}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>

            {selected ? (
              <section className="panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                      <UsersRound size={18} aria-hidden="true" />
                      Usuarios
                    </h2>
                    <p className="text-sm text-slate-400">Nao autorizado e a opcao padrao.</p>
                  </div>
                  <button className="btn-primary min-h-9 px-3 py-1" type="button" onClick={saveAssignments} disabled={savingAssignments}>
                    {savingAssignments ? "Salvando..." : "Salvar"}
                  </button>
                </div>
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {assignments.map((assignment) => (
                    <div key={assignment.user_id} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{assignment.nome}</p>
                        <p className="truncate text-xs text-slate-400">{assignment.email}</p>
                      </div>
                      <select
                        className="field"
                        value={assignmentDraft[assignment.user_id] ?? ""}
                        onChange={(event) => setAssignmentDraft({
                          ...assignmentDraft,
                          [assignment.user_id]: event.target.value,
                        })}
                      >
                        <option value="">Nao autorizado</option>
                        {editableRoles(selected.roles).filter((role) => role.ativo).map((role) => (
                          <option key={role.id} value={role.id}>{role.nome}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        ) : selected?.homepage_url ? (
          <aside className="panel h-fit p-5">
            <h2 className="text-lg font-semibold text-white">{selected.nome}</h2>
            <p className="mt-2 text-sm text-slate-400">{selected.descricao}</p>
            <a className="btn-primary mt-5" href={selected.homepage_url} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden="true" />
              Abrir plataforma
            </a>
          </aside>
        ) : null}
      </section>
    </AppShell>
  );
}
