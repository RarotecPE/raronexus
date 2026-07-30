"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  Edit3,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { apiFetch } from "@/lib/api/client-fetch";
import type {
  ApplicationAssignmentDTO,
  ApplicationResponseDTO,
  ApplicationRoleDTO,
  UserResponseDTO,
} from "@/lib/api/types";

type DraftProfile = {
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
};

type ModalMode = "edit" | "profiles" | "users" | null;
type AlertState = { message: string; type: SystemAlertType } | null;

const emptyApplicationDraft: DraftApplication = {
  nome: "",
  descricao: "",
  client_id: "",
  homepage_url: "",
  redirect_uris: "",
  allowed_origins: "",
  ativo: true,
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

function editableProfiles(profiles?: ApplicationRoleDTO[]) {
  return profiles?.filter((profile) => profile.chave !== "nao_autorizado") ?? [];
}

function profilesToDraft(profiles?: ApplicationRoleDTO[]): DraftProfile[] {
  return editableProfiles(profiles).map((profile) => ({
    id: profile.id,
    nome: profile.nome,
    chave: profile.chave,
    descricao: profile.descricao ?? "",
    ativo: profile.ativo,
  }));
}

function applicationToDraft(application: ApplicationResponseDTO): DraftApplication {
  return {
    nome: application.nome,
    descricao: application.descricao ?? "",
    client_id: application.client_id,
    homepage_url: application.homepage_url ?? "",
    redirect_uris: arrayToLines(application.redirect_uris),
    allowed_origins: arrayToLines(application.allowed_origins),
    ativo: application.ativo,
  };
}

function Modal({
  title,
  description,
  icon,
  children,
  onClose,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section className={`panel max-h-[90vh] w-full ${maxWidth} overflow-y-auto p-5 shadow-2xl shadow-cyan-950/40`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {description ? <p className="text-sm text-slate-400">{description}</p> : null}
            </div>
          </div>
          <button className="btn-secondary min-h-9 px-3 py-2" type="button" onClick={onClose} title="Fechar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-200">
      <span>{label}</span>
      {description ? (
        <span className="text-xs font-normal leading-relaxed text-slate-400">
          {description}
        </span>
      ) : null}
      {children}
    </label>
  );
}

export function ApplicationsAdmin() {
  const [me, setMe] = useState<UserResponseDTO | null>(null);
  const [applications, setApplications] = useState<ApplicationResponseDTO[]>([]);
  const [activeApplication, setActiveApplication] = useState<ApplicationResponseDTO | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [applicationDraft, setApplicationDraft] = useState<DraftApplication>(emptyApplicationDraft);
  const [profileDrafts, setProfileDrafts] = useState<DraftProfile[]>([]);
  const [assignments, setAssignments] = useState<ApplicationAssignmentDTO[]>([]);
  const [assignmentDraft, setAssignmentDraft] = useState<Record<string, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [bulkProfileId, setBulkProfileId] = useState("");
  const [alert, setAlert] = useState<AlertState>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const isAdmin = Boolean(me?.is_admin);
  const activeCount = useMemo(
    () => applications.filter((application) => application.ativo).length,
    [applications],
  );

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, apps] = await Promise.all([
        apiFetch<UserResponseDTO>("/api/v1/users/me"),
        apiFetch<ApplicationResponseDTO[]>("/api/v1/applications"),
      ]);
      setMe(profile);
      setApplications(apps);
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao carregar plataformas.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadApplications();
    });
  }, [loadApplications]);

  function closeModal() {
    setModalMode(null);
    setActiveApplication(null);
    setApplicationDraft(emptyApplicationDraft);
    setProfileDrafts([]);
    setAssignments([]);
    setAssignmentDraft({});
    setSelectedUsers(new Set());
    setUserSearch("");
    setBulkProfileId("");
    setSaving(false);
  }

  function openCreateModal() {
    setActiveApplication(null);
    setApplicationDraft(emptyApplicationDraft);
    setModalMode("edit");
  }

  function openEditModal(application: ApplicationResponseDTO) {
    setActiveApplication(application);
    setApplicationDraft(applicationToDraft(application));
    setModalMode("edit");
  }

  function openProfilesModal(application: ApplicationResponseDTO) {
    setActiveApplication(application);
    setApplicationDraft(applicationToDraft(application));
    setProfileDrafts(profilesToDraft(application.roles));
    setModalMode("profiles");
  }

  async function openUsersModal(application: ApplicationResponseDTO) {
    setActiveApplication(application);
    setAssignments([]);
    setAssignmentDraft({});
    setSelectedUsers(new Set());
    setUserSearch("");
    setBulkProfileId("");
    setModalMode("users");
    setLoadingAssignments(true);
    setAlert(null);
    try {
      const data = await apiFetch<ApplicationAssignmentDTO[]>(
        `/api/v1/applications/${application.id}/assignments`,
      );
      setAssignments(data);
      setAssignmentDraft(Object.fromEntries(data.map((item) => [item.user_id, item.role_id ?? ""])));
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao carregar usuarios.",
        type: "error",
      });
    } finally {
      setLoadingAssignments(false);
    }
  }

  function updateDraftName(nome: string) {
    setApplicationDraft((current) => ({
      ...current,
      nome,
      client_id: activeApplication || current.client_id ? current.client_id : slugify(nome),
    }));
  }

  function updateProfile(index: number, input: Partial<DraftProfile>) {
    setProfileDrafts((current) => current.map((profile, profileIndex) => (
      profileIndex === index ? { ...profile, ...input } : profile
    )));
  }

  function addProfile() {
    setProfileDrafts((current) => [
      ...current,
      { nome: "", chave: "", descricao: "", ativo: true },
    ]);
  }

  function buildApplicationPayload(profiles: DraftProfile[] = profilesToDraft(activeApplication?.roles)) {
    return {
      nome: applicationDraft.nome,
      descricao: applicationDraft.descricao,
      client_id: applicationDraft.client_id,
      homepage_url: applicationDraft.homepage_url,
      redirect_uris: linesToArray(applicationDraft.redirect_uris),
      allowed_origins: linesToArray(applicationDraft.allowed_origins),
      ativo: applicationDraft.ativo,
      roles: profiles.filter((profile) => profile.nome && profile.chave).map((profile) => ({
        ...profile,
        descricao: profile.descricao || null,
      })),
    };
  }

  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const payload = buildApplicationPayload();
      const saved = activeApplication
        ? await apiFetch<ApplicationResponseDTO>(`/api/v1/applications/${activeApplication.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        : await apiFetch<ApplicationResponseDTO>("/api/v1/applications", {
          method: "POST",
          body: JSON.stringify(payload),
        });

      setAlert({
        message: activeApplication ? "Plataforma atualizada." : "Plataforma cadastrada.",
        type: "success",
      });
      await loadApplications();
      closeModal();
      setActiveApplication(saved);
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao salvar plataforma.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveProfiles(event: FormEvent) {
    event.preventDefault();
    if (!activeApplication) return;
    setSaving(true);
    setAlert(null);
    try {
      const saved = await apiFetch<ApplicationResponseDTO>(`/api/v1/applications/${activeApplication.id}`, {
        method: "PUT",
        body: JSON.stringify(buildApplicationPayload(profileDrafts)),
      });
      setAlert({ message: "Perfis de usuarios atualizados.", type: "success" });
      await loadApplications();
      closeModal();
      setActiveApplication(saved);
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao salvar perfis de usuarios.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignments() {
    if (!activeApplication) return;
    setSaving(true);
    setAlert(null);
    try {
      const updated = await apiFetch<ApplicationAssignmentDTO[]>(
        `/api/v1/applications/${activeApplication.id}/assignments`,
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
      setAlert({ message: "Acessos atualizados.", type: "success" });
      await loadApplications();
      closeModal();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao salvar acessos.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function toggleFilteredUsersSelection(userIds: string[], checked: boolean) {
    setSelectedUsers((current) => {
      const next = new Set(current);
      for (const userId of userIds) {
        if (checked) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
      }
      return next;
    });
  }

  function applyBulkProfile() {
    setAssignmentDraft((current) => {
      const next = { ...current };
      for (const userId of selectedUsers) {
        next[userId] = bulkProfileId;
      }
      return next;
    });
  }

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = userSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!normalizedSearch) return assignments;

    return assignments.filter((assignment) => {
      const haystack = `${assignment.nome} ${assignment.email}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [assignments, userSearch]);

  const filteredUserIds = useMemo(
    () => filteredAssignments.map((assignment) => assignment.user_id),
    [filteredAssignments],
  );
  const allFilteredUsersSelected = filteredUserIds.length > 0
    && filteredUserIds.every((userId) => selectedUsers.has(userId));

  return (
    <AppShell title="Plataformas">
      {alert ? (
        <SystemAlert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="panel overflow-hidden">
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
              <button className="btn-primary" type="button" onClick={openCreateModal}>
                <Plus size={17} aria-hidden="true" />
                Nova
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-5">
          {loading ? (
            <p className="text-sm text-slate-300">Carregando plataformas...</p>
          ) : applications.length === 0 ? (
            <p className="text-sm text-slate-300">
              {isAdmin ? "Nenhuma plataforma cadastrada." : "Nenhuma plataforma liberada para sua conta."}
            </p>
          ) : (
            applications.map((application) => (
              <article
                key={application.id}
                className="rounded-lg border border-slate-700/70 bg-slate-950/45 p-4 transition hover:border-cyan-400/45 hover:bg-slate-900/70"
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
                        {editableProfiles(application.roles).length} perfis de usuarios
                      </span>
                      <span className="rounded-md border border-emerald-400/25 bg-emerald-950/25 px-2 py-1 text-emerald-100">
                        {application.access_summary?.authorized_total ?? 0} usuarios ativos
                      </span>
                    </>
                  ) : null}
                </div>

                {isAdmin ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    {application.access_summary?.by_profile.length ? (
                      application.access_summary.by_profile.map((profile) => (
                        <span key={profile.role_id} className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1">
                          {profile.role_nome}: {profile.total}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">Nenhum usuario autorizado.</span>
                    )}
                  </div>
                ) : null}

                {isAdmin ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => openEditModal(application)}>
                      <Edit3 size={15} aria-hidden="true" />
                      Editar
                    </button>
                    <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => openProfilesModal(application)}>
                      <ShieldCheck size={15} aria-hidden="true" />
                      Perfis de Usuarios
                    </button>
                    <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => void openUsersModal(application)}>
                      <UsersRound size={15} aria-hidden="true" />
                      Usuarios
                    </button>
                  </div>
                ) : application.homepage_url ? (
                  <a className="btn-primary mt-4 w-fit" href={application.homepage_url} target="_blank" rel="noreferrer">
                    <ExternalLink size={17} aria-hidden="true" />
                    Abrir plataforma
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      {modalMode === "edit" ? (
        <Modal
          title={activeApplication ? "Editar plataforma" : "Cadastrar plataforma"}
          description="Identidade, URLs permitidas e status da plataforma."
          icon={activeApplication ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
          onClose={closeModal}
        >
          <form onSubmit={saveApplication} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FieldGroup label="Nome">
                <input className="field" placeholder="RaroStock" value={applicationDraft.nome} onChange={(event) => updateDraftName(event.target.value)} required />
              </FieldGroup>
              <FieldGroup label="Identificador" description="Usado pela plataforma no login SSO.">
                <input className="field" placeholder="rarostock" value={applicationDraft.client_id} onChange={(event) => setApplicationDraft({ ...applicationDraft, client_id: slugify(event.target.value) })} required />
              </FieldGroup>
            </div>
            <FieldGroup label="Descricao">
              <textarea className="field min-h-24" placeholder="Controle interno de estoque" value={applicationDraft.descricao} onChange={(event) => setApplicationDraft({ ...applicationDraft, descricao: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="URL inicial" description="Endereco do botao Abrir plataforma.">
              <input className="field" placeholder="https://rarostock.rarotec.com" type="url" value={applicationDraft.homepage_url} onChange={(event) => setApplicationDraft({ ...applicationDraft, homepage_url: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="Redirecionamentos" description="Callbacks permitidos apos o login. Um por linha.">
              <textarea className="field min-h-24" placeholder="https://rarostock.rarotec.com/api/auth/raronexus/callback" value={applicationDraft.redirect_uris} onChange={(event) => setApplicationDraft({ ...applicationDraft, redirect_uris: event.target.value })} required />
            </FieldGroup>
            <FieldGroup label="Origens" description="Dominios permitidos. Um por linha.">
              <textarea className="field min-h-24" placeholder="https://rarostock.rarotec.com" value={applicationDraft.allowed_origins} onChange={(event) => setApplicationDraft({ ...applicationDraft, allowed_origins: event.target.value })} />
            </FieldGroup>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={applicationDraft.ativo} onChange={(event) => setApplicationDraft({ ...applicationDraft, ativo: event.target.checked })} />
              Plataforma ativa
            </label>

            {activeApplication?.client_secret ? (
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <KeyRound size={15} aria-hidden="true" />
                  Client secret
                </p>
                <code className="block break-all text-xs text-slate-300">{activeApplication.client_secret}</code>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving} type="submit">
                <Save size={17} aria-hidden="true" />
                {saving ? "Salvando..." : activeApplication ? "Salvar" : "Cadastrar"}
              </button>
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modalMode === "profiles" && activeApplication ? (
        <Modal
          title="Perfis de Usuarios"
          description={`Configure os perfis da plataforma ${activeApplication.nome}.`}
          icon={<ShieldCheck size={19} aria-hidden="true" />}
          onClose={closeModal}
        >
          <form onSubmit={saveProfiles} className="space-y-4">
            <div className="flex justify-end">
              <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={addProfile}>
                <Plus size={15} aria-hidden="true" />
                Perfil de Usuario
              </button>
            </div>
            {profileDrafts.length === 0 ? (
              <p className="rounded-lg border border-slate-700 bg-slate-950/45 p-4 text-sm text-slate-300">
                Nenhum perfil de usuario cadastrado alem de Nao autorizado.
              </p>
            ) : (
              <div className="space-y-3">
                {profileDrafts.map((profile, index) => (
                  <div key={profile.id ?? index} className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <FieldGroup label="Nome">
                        <input className="field" placeholder="Gestor" value={profile.nome} onChange={(event) => updateProfile(index, { nome: event.target.value })} />
                      </FieldGroup>
                      <FieldGroup label="Chave" description="Valor enviado para a plataforma.">
                        <input className="field" placeholder="gestor" value={profile.chave} onChange={(event) => updateProfile(index, { chave: slugify(event.target.value) })} />
                      </FieldGroup>
                    </div>
                    <div className="mt-2">
                      <FieldGroup label="Descricao">
                        <input className="field" placeholder="Pode cadastrar e visualizar registros" value={profile.descricao} onChange={(event) => updateProfile(index, { descricao: event.target.value })} />
                      </FieldGroup>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={profile.ativo} onChange={(event) => updateProfile(index, { ativo: event.target.checked })} />
                      Perfil ativo
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving} type="submit">
                <Save size={17} aria-hidden="true" />
                {saving ? "Salvando..." : "Salvar perfis"}
              </button>
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modalMode === "users" && activeApplication ? (
        <Modal
          title="Usuarios"
          description={`Atribua perfis de usuarios para ${activeApplication.nome}.`}
          icon={<UsersRound size={19} aria-hidden="true" />}
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <FieldGroup label="Filtro">
                <input className="field" placeholder="Maria Souza" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Perfil" description="Aplicado aos selecionados.">
                <select className="field min-w-56" value={bulkProfileId} onChange={(event) => setBulkProfileId(event.target.value)}>
                  <option value="">Nao autorizado</option>
                  {editableProfiles(activeApplication.roles).filter((profile) => profile.ativo).map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.nome}</option>
                  ))}
                </select>
              </FieldGroup>
              <button className="btn-secondary" type="button" onClick={applyBulkProfile} disabled={selectedUsers.size === 0}>
                Aplicar aos selecionados
              </button>
            </div>

            <label className="flex w-fit items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allFilteredUsersSelected}
                onChange={(event) => toggleFilteredUsersSelection(filteredUserIds, event.target.checked)}
                disabled={filteredUserIds.length === 0}
              />
              Selecionar todos
            </label>

            {loadingAssignments ? (
              <p className="text-sm text-slate-300">Carregando usuarios...</p>
            ) : (
              <div className="max-h-[560px] overflow-y-auto rounded-lg border border-slate-700">
                {filteredAssignments.map((assignment) => (
                  <div key={assignment.user_id} className="grid gap-3 border-b border-slate-700 bg-slate-950/45 p-3 last:border-b-0 md:grid-cols-[auto_1fr_260px] md:items-center">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(assignment.user_id)}
                      onChange={() => toggleUserSelection(assignment.user_id)}
                      aria-label={`Selecionar ${assignment.nome}`}
                    />
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
                      {editableProfiles(activeApplication.roles).filter((profile) => profile.ativo).map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.nome}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {filteredAssignments.length === 0 ? (
                  <p className="p-4 text-sm text-slate-300">Nenhum usuario encontrado.</p>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving || loadingAssignments} type="button" onClick={saveAssignments}>
                <Save size={17} aria-hidden="true" />
                {saving ? "Salvando..." : "Salvar acessos"}
              </button>
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
