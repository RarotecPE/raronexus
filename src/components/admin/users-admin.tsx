"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  Edit3,
  MailPlus,
  Plus,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ApplicationLogo } from "@/components/applications/application-logo";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { UserAvatar } from "@/components/ui/user-avatar";
import { uploadAvatar } from "@/lib/avatar-upload";
import { apiFetch } from "@/lib/api/client-fetch";
import { formatCpf, formatPhone } from "@/lib/formatters";
import type { UserApplicationAccessDTO, UserResponseDTO } from "@/lib/api/types";

type DraftUser = {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  avatar_url: string;
  ativo: boolean;
  is_admin: boolean;
};

type ModalMode = "edit" | "platforms" | null;
type AlertState = { message: string; type: SystemAlertType } | null;

const emptyDraft: DraftUser = {
  nome: "",
  email: "",
  cpf: "",
  telefone: "",
  avatar_url: "",
  ativo: true,
  is_admin: false,
};

function editableProfiles(platform: UserApplicationAccessDTO) {
  return platform.roles.filter((profile) => profile.chave !== "nao_autorizado" && profile.ativo);
}

function getUserStatus(user: UserResponseDTO) {
  return user.cadastro_status ?? (user.ativo ? "ativo" : "inativo");
}

function getStatusLabel(user: UserResponseDTO) {
  const status = getUserStatus(user);
  if (status === "pendente") return "Pendente";
  return status === "ativo" ? "Ativo" : "Inativo";
}

function getUserDisplayName(user: UserResponseDTO) {
  return user.nome || "Cadastro pendente";
}

function getStatusClassName(user: UserResponseDTO) {
  const status = getUserStatus(user);
  if (status === "pendente") return "text-amber-300";
  return status === "ativo" ? "text-emerald-300" : "text-rose-300";
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

export function UsersAdmin() {
  const router = useRouter();
  const [me, setMe] = useState<UserResponseDTO | null>(null);
  const [users, setUsers] = useState<UserResponseDTO[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftUser>(emptyDraft);
  const [editing, setEditing] = useState<UserResponseDTO | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const avatarPreviewRef = useRef("");
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<UserApplicationAccessDTO[]>([]);
  const [platformDraft, setPlatformDraft] = useState<Record<string, string>>({});
  const [platformSearch, setPlatformSearch] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [bulkProfileKey, setBulkProfileKey] = useState("nao_autorizado");
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const didRunInitialSearch = useRef(false);

  const isAdmin = Boolean(me?.is_admin);
  const activeCount = useMemo(
    () => users.filter((user) => getUserStatus(user) === "ativo").length,
    [users],
  );

  const loadUsers = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
      const profile = await apiFetch<UserResponseDTO>("/api/v1/users/me");
      setMe(profile);

      if (!profile.is_admin) {
        router.replace("/applications");
        return;
      }

      const loadedUsers = await apiFetch<UserResponseDTO[]>(`/api/v1/users${suffix}`);
      setUsers(loadedUsers);
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao carregar usuarios.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers("");
    });
  }, [loadUsers]);

  useEffect(() => {
    if (!didRunInitialSearch.current) {
      didRunInitialSearch.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadUsers(search);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [loadUsers, search]);

  useEffect(() => () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
  }, []);

  function clearAvatarPreview() {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    avatarPreviewRef.current = "";
    setAvatarPreviewUrl("");
  }

  function setCroppedAvatar(file: File) {
    clearAvatarPreview();
    const objectUrl = URL.createObjectURL(file);
    avatarPreviewRef.current = objectUrl;
    setAvatarFile(file);
    setAvatarPreviewUrl(objectUrl);
    setAvatarCropFile(null);
  }

  function closeModal() {
    setModalMode(null);
    setEditing(null);
    setDraft(emptyDraft);
    setAvatarFile(null);
    setAvatarCropFile(null);
    clearAvatarPreview();
    setPlatforms([]);
    setPlatformDraft({});
    setPlatformSearch("");
    setSelectedPlatforms(new Set());
    setBulkProfileKey("nao_autorizado");
    setSaving(false);
  }

  function openCreateModal() {
    setEditing(null);
    setDraft(emptyDraft);
    setAvatarFile(null);
    setAvatarCropFile(null);
    clearAvatarPreview();
    setModalMode("edit");
  }

  function openEditModal(user: UserResponseDTO) {
    setEditing(user);
    setDraft({
      nome: user.nome ?? "",
      email: user.email,
      cpf: user.cpf ?? "",
      telefone: user.telefone ?? "",
      avatar_url: user.avatar_url ?? "",
      ativo: user.ativo,
      is_admin: user.is_admin ?? false,
    });
    setAvatarFile(null);
    setAvatarCropFile(null);
    clearAvatarPreview();
    setModalMode("edit");
  }

  async function openPlatformsModal(user: UserResponseDTO) {
    setEditing(user);
    setPlatforms([]);
    setPlatformDraft({});
    setPlatformSearch("");
    setSelectedPlatforms(new Set());
    setBulkProfileKey("nao_autorizado");
    setModalMode("platforms");
    setLoadingPlatforms(true);
    setAlert(null);
    try {
      const data = await apiFetch<UserApplicationAccessDTO[]>(`/api/v1/user-applications/${user.id}`);
      setPlatforms(data);
      setPlatformDraft(Object.fromEntries(data.map((platform) => [
        platform.application_id,
        platform.role_id ?? "",
      ])));
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao carregar plataformas do usuario.",
        type: "error",
      });
    } finally {
      setLoadingPlatforms(false);
    }
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
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
        setAlert({ message: "Usuario atualizado.", type: "success" });
      } else {
        await apiFetch<UserResponseDTO>("/api/v1/users", {
          method: "POST",
          body: JSON.stringify({
            email: draft.email,
            is_admin: draft.is_admin,
          }),
        });

        setAlert({
          message: "Convite enviado. O usuario completara o cadastro pelo e-mail.",
          type: "success",
        });
      }
      closeModal();
      await loadUsers();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao salvar usuario.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(user: UserResponseDTO) {
    setAlert(null);
    try {
      const nextStatus = !user.ativo;
      await apiFetch<UserResponseDTO>(`/api/v1/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ ativo: nextStatus }),
      });
      setAlert({
        message: nextStatus ? "Usuario ativado." : "Usuario inativado.",
        type: "success",
      });
      await loadUsers();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao alterar status do usuario.",
        type: "error",
      });
    }
  }

  async function resendInvite(user: UserResponseDTO) {
    setAlert(null);
    setResendingInviteId(user.id);
    try {
      await apiFetch<UserResponseDTO>(`/api/v1/user-invites/${user.id}`, { method: "POST" });
      setAlert({
        message: "E-mail de confirmacao e definicao de senha reenviado.",
        type: "success",
      });
      await loadUsers();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao reenviar e-mail.",
        type: "error",
      });
    } finally {
      setResendingInviteId(null);
    }
  }

  function togglePlatformSelection(applicationId: string) {
    setSelectedPlatforms((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }

  function toggleFilteredPlatformSelection(applicationIds: string[], checked: boolean) {
    setSelectedPlatforms((current) => {
      const next = new Set(current);
      for (const applicationId of applicationIds) {
        if (checked) {
          next.add(applicationId);
        } else {
          next.delete(applicationId);
        }
      }
      return next;
    });
  }

  function applyBulkProfile() {
    setPlatformDraft((current) => {
      const next = { ...current };
      for (const platform of platforms) {
        if (!selectedPlatforms.has(platform.application_id)) continue;
        if (bulkProfileKey === "nao_autorizado") {
          next[platform.application_id] = "";
          continue;
        }

        const profile = editableProfiles(platform).find((item) => item.chave === bulkProfileKey);
        next[platform.application_id] = profile?.id ?? "";
      }
      return next;
    });
  }

  async function savePlatformAccess() {
    if (!editing) return;
    setSaving(true);
    setAlert(null);
    try {
      const updated = await apiFetch<UserApplicationAccessDTO[]>(`/api/v1/user-applications/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          assignments: platforms.map((platform) => ({
            application_id: platform.application_id,
            role_id: platformDraft[platform.application_id] || null,
          })),
        }),
      });
      setPlatforms(updated);
      setAlert({ message: "Acessos do usuario atualizados.", type: "success" });
      closeModal();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao salvar acessos do usuario.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const filteredPlatforms = useMemo(() => {
    const normalizedSearch = platformSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!normalizedSearch) return platforms;

    return platforms.filter((platform) => {
      const haystack = `${platform.application_nome} ${platform.application_client_id}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [platforms, platformSearch]);

  const filteredPlatformIds = useMemo(
    () => filteredPlatforms.map((platform) => platform.application_id),
    [filteredPlatforms],
  );
  const allFilteredPlatformsSelected = filteredPlatformIds.length > 0
    && filteredPlatformIds.every((applicationId) => selectedPlatforms.has(applicationId));

  const bulkProfileOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const platform of platforms) {
      for (const profile of editableProfiles(platform)) {
        if (!options.has(profile.chave)) {
          options.set(profile.chave, profile.nome);
        }
      }
    }
    return Array.from(options.entries()).map(([chave, nome]) => ({ chave, nome }));
  }, [platforms]);

  return (
    <AppShell title="Administracao de usuarios">
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
            <h1 className="text-2xl font-semibold text-white">Usuarios</h1>
            <p className="text-sm text-slate-400">
              {activeCount} ativos de {users.length} cadastrados
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="flex min-w-0 flex-1 sm:flex-none">
              <input
                className="field min-w-0 sm:w-72"
                placeholder="Pesquisar por nome ou e-mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button className="btn-secondary px-3" type="button" onClick={() => void loadUsers()} title="Recarregar">
              <RefreshCw size={17} aria-hidden="true" />
            </button>
            {isAdmin ? (
              <button className="btn-primary" type="button" onClick={openCreateModal}>
                <Plus size={17} aria-hidden="true" />
                Novo usuario
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-5 py-3 pl-[4.25rem]">Nome</th>
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
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={user.avatar_url} name={getUserDisplayName(user)} />
                        <span className="font-medium text-white">{getUserDisplayName(user)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={getStatusClassName(user)}>
                        {getStatusLabel(user)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{user.is_admin ? "Sim" : "Nao"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {isAdmin ? (
                          <>
                            {getUserStatus(user) === "pendente" ? (
                              <button
                                className="flex min-h-9 items-center justify-center rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-200 disabled:opacity-50"
                                type="button"
                                onClick={() => void resendInvite(user)}
                                disabled={resendingInviteId === user.id}
                                title="Reenviar e-mail de confirmacao"
                              >
                                <MailPlus size={15} aria-hidden="true" />
                              </button>
                            ) : null}
                            <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => openEditModal(user)}>
                              <Edit3 size={15} aria-hidden="true" />
                              Editar
                            </button>
                            <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => void openPlatformsModal(user)}>
                              <AppWindow size={15} aria-hidden="true" />
                              Plataformas
                            </button>
                          </>
                        ) : null}
                        <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => void toggleUserStatus(user)} title={user.ativo ? "Inativar" : "Ativar"}>
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
      </section>

      {modalMode === "edit" ? (
        <Modal
          title={editing ? "Editar usuario" : "Criar usuario"}
          description={editing ? "Dados cadastrais e permissoes administrativas do Nexus." : "O usuario completara os dados pelo e-mail."}
          icon={editing ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
          onClose={closeModal}
        >
          <form className="space-y-4" onSubmit={saveUser}>
            {editing ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldGroup label="Nome">
                    <input className="field" placeholder="Maria Souza" value={draft.nome} onChange={(event) => setDraft({ ...draft, nome: event.target.value })} required />
                  </FieldGroup>
                  <FieldGroup label="E-mail">
                    <input className="field" placeholder="maria@empresa.com" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required disabled />
                  </FieldGroup>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldGroup label="CPF" description="Usado para login.">
                    <input
                      className="field"
                      placeholder="000.000.000-00"
                      value={draft.cpf}
                      onChange={(event) => setDraft({ ...draft, cpf: formatCpf(event.target.value) })}
                      required
                      inputMode="numeric"
                      maxLength={14}
                    />
                  </FieldGroup>
                  <FieldGroup label="Telefone">
                    <input
                      className="field"
                      placeholder="(11) 99999-9999"
                      value={draft.telefone}
                      onChange={(event) => setDraft({ ...draft, telefone: formatPhone(event.target.value) })}
                      inputMode="tel"
                      maxLength={15}
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Avatar">
                  <input
                    className="field"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      if (file) setAvatarCropFile(file);
                    }}
                  />
                  {draft.avatar_url || avatarFile ? (
                    <span className="flex items-center gap-2 text-xs font-normal text-cyan-200">
                      <Upload size={14} aria-hidden="true" />
                      {avatarFile ? `${avatarFile.name} pronto para envio` : "Avatar atual mantido"}
                    </span>
                  ) : null}
                  {avatarPreviewUrl || draft.avatar_url ? (
                    <div className="mt-2 h-24 w-24 overflow-hidden rounded-lg border border-cyan-400/20 bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarPreviewUrl || draft.avatar_url}
                        alt="Previa do avatar"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                </FieldGroup>
              </>
            ) : (
              <FieldGroup label="E-mail">
                <input className="field" placeholder="maria@empresa.com" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
              </FieldGroup>
            )}
            <div className="flex flex-wrap gap-4">
              {editing ? (
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={draft.ativo} onChange={(event) => setDraft({ ...draft, ativo: event.target.checked })} />
                  Usuario ativo
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={draft.is_admin} onChange={(event) => setDraft({ ...draft, is_admin: event.target.checked })} />
                <ShieldCheck size={16} aria-hidden="true" />
                Administrador RaroNexus
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving} type="submit">
                <Save size={17} aria-hidden="true" />
                {saving ? "Salvando..." : editing ? "Salvar" : "Enviar convite"}
              </button>
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {avatarCropFile ? (
        <AvatarCropper
          file={avatarCropFile}
          onCancel={() => setAvatarCropFile(null)}
          onCrop={setCroppedAvatar}
        />
      ) : null}

      {modalMode === "platforms" && editing ? (
        <Modal
          title="Plataformas"
          description={`Atribua perfis de usuario para ${getUserDisplayName(editing)}.`}
          icon={<AppWindow size={19} aria-hidden="true" />}
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <FieldGroup label="Filtro">
                <input className="field" placeholder="RaroStock" value={platformSearch} onChange={(event) => setPlatformSearch(event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Perfil" description="Aplicado as selecionadas.">
                <select className="field min-w-56" value={bulkProfileKey} onChange={(event) => setBulkProfileKey(event.target.value)}>
                  <option value="nao_autorizado">Nao autorizado</option>
                  {bulkProfileOptions.map((profile) => (
                    <option key={profile.chave} value={profile.chave}>{profile.nome}</option>
                  ))}
                </select>
              </FieldGroup>
              <button className="btn-secondary" type="button" onClick={applyBulkProfile} disabled={selectedPlatforms.size === 0}>
                Aplicar aos selecionados
              </button>
            </div>

            <label className="flex w-fit items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allFilteredPlatformsSelected}
                onChange={(event) => toggleFilteredPlatformSelection(filteredPlatformIds, event.target.checked)}
                disabled={filteredPlatformIds.length === 0}
              />
              Selecionar todos
            </label>

            {loadingPlatforms ? (
              <p className="text-sm text-slate-300">Carregando plataformas...</p>
            ) : (
              <div className="max-h-[560px] overflow-y-auto rounded-lg border border-slate-700">
                {filteredPlatforms.map((platform) => (
                  <div key={platform.application_id} className="grid gap-3 border-b border-slate-700 bg-slate-950/45 p-3 last:border-b-0 md:grid-cols-[auto_1fr_260px] md:items-center">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.has(platform.application_id)}
                      onChange={() => togglePlatformSelection(platform.application_id)}
                      aria-label={`Selecionar ${platform.application_nome}`}
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <ApplicationLogo
                        name={platform.application_nome}
                        logoUrl={platform.application_logo_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{platform.application_nome}</p>
                        <p className="truncate text-xs text-slate-400">
                          {platform.application_client_id} - {platform.application_ativo ? "Ativa" : "Inativa"}
                        </p>
                      </div>
                    </div>
                    <select
                      className="field"
                      value={platformDraft[platform.application_id] ?? ""}
                      onChange={(event) => setPlatformDraft({
                        ...platformDraft,
                        [platform.application_id]: event.target.value,
                      })}
                    >
                      <option value="">Nao autorizado</option>
                      {editableProfiles(platform).map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.nome}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {filteredPlatforms.length === 0 ? (
                  <p className="p-4 text-sm text-slate-300">Nenhuma plataforma encontrada.</p>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving || loadingPlatforms} type="button" onClick={() => void savePlatformAccess()}>
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
