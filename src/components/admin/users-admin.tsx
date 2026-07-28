"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  Edit3,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { uploadAvatar } from "@/lib/avatar-upload";
import { apiFetch } from "@/lib/api/client-fetch";
import { formatCpf, formatPhone } from "@/lib/formatters";
import type { UserApplicationAccessDTO, UserResponseDTO } from "@/lib/api/types";

type DraftUser = {
  nome: string;
  email: string;
  password: string;
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
  password: "",
  cpf: "",
  telefone: "",
  avatar_url: "",
  ativo: true,
  is_admin: false,
};

function editableProfiles(platform: UserApplicationAccessDTO) {
  return platform.roles.filter((profile) => profile.chave !== "nao_autorizado" && profile.ativo);
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

export function UsersAdmin() {
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
  const [platforms, setPlatforms] = useState<UserApplicationAccessDTO[]>([]);
  const [platformDraft, setPlatformDraft] = useState<Record<string, string>>({});
  const [platformSearch, setPlatformSearch] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [bulkProfileKey, setBulkProfileKey] = useState("nao_autorizado");
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);

  const isAdmin = Boolean(me?.is_admin);
  const activeCount = useMemo(() => users.filter((user) => user.ativo).length, [users]);

  const loadUsers = useCallback(async (query = search) => {
    setLoading(true);
    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
      const [profile, loadedUsers] = await Promise.all([
        apiFetch<UserResponseDTO>("/api/v1/users/me"),
        apiFetch<UserResponseDTO[]>(`/api/v1/users${suffix}`),
      ]);
      setMe(profile);
      setUsers(loadedUsers);
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao carregar usuarios.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers("");
    });
  }, [loadUsers]);

  function closeModal() {
    setModalMode(null);
    setEditing(null);
    setDraft(emptyDraft);
    setAvatarFile(null);
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
    setModalMode("edit");
  }

  function openEditModal(user: UserResponseDTO) {
    setEditing(user);
    setDraft({
      nome: user.nome,
      email: user.email,
      password: "",
      cpf: user.cpf ?? "",
      telefone: user.telefone ?? "",
      avatar_url: user.avatar_url ?? "",
      ativo: user.ativo,
      is_admin: user.is_admin ?? false,
    });
    setAvatarFile(null);
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
      const data = await apiFetch<UserApplicationAccessDTO[]>(`/api/v1/users/${user.id}/applications`);
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
        setAlert({ message: "Usuario atualizado.", type: "success" });
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

        setAlert({ message: "Usuario criado.", type: "success" });
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

  async function toggleUserActive(user: UserResponseDTO) {
    setAlert(null);
    try {
      if (user.ativo) {
        await apiFetch<UserResponseDTO>(`/api/v1/users/${user.id}`, { method: "DELETE" });
        setAlert({ message: "Usuario inativado.", type: "success" });
      } else {
        await apiFetch<UserResponseDTO>(`/api/v1/users/${user.id}`, {
          method: "PUT",
          body: JSON.stringify({ ativo: true }),
        });
        setAlert({ message: "Usuario ativado.", type: "success" });
      }
      await loadUsers();
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : "Erro ao alterar status do usuario.",
        type: "error",
      });
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
      const updated = await apiFetch<UserApplicationAccessDTO[]>(`/api/v1/users/${editing.id}/applications`, {
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
            <form
              className="flex min-w-0 flex-1 gap-2 sm:flex-none"
              onSubmit={(event) => {
                event.preventDefault();
                void loadUsers(search);
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
            </form>
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
          <table className="w-full min-w-[840px] text-left text-sm">
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
                        {isAdmin ? (
                          <>
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
                        <button className="btn-secondary min-h-9 px-3 py-1.5" type="button" onClick={() => void toggleUserActive(user)} title={user.ativo ? "Inativar" : "Ativar"}>
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
          description="Dados cadastrais e permissoes administrativas do Nexus."
          icon={editing ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
          onClose={closeModal}
        >
          <form className="space-y-4" onSubmit={saveUser}>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" placeholder="Nome" value={draft.nome} onChange={(event) => setDraft({ ...draft, nome: event.target.value })} required />
              <input className="field" placeholder="E-mail" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required disabled={Boolean(editing)} />
            </div>
            {!editing ? (
              <input className="field" placeholder="Senha inicial" type="password" minLength={6} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} required />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
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
            </div>
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Avatar
              <input
                className="field"
                type="file"
                accept="image/*"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              />
              {draft.avatar_url || avatarFile ? (
                <span className="flex items-center gap-2 text-xs font-normal text-cyan-200">
                  <Upload size={14} aria-hidden="true" />
                  {avatarFile?.name ?? "Avatar atual mantido"}
                </span>
              ) : null}
            </label>
            <div className="flex flex-wrap gap-4">
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

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" disabled={saving} type="submit">
                <Save size={17} aria-hidden="true" />
                {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </button>
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modalMode === "platforms" && editing ? (
        <Modal
          title="Plataformas"
          description={`Atribua perfis de usuario para ${editing.nome}.`}
          icon={<AppWindow size={19} aria-hidden="true" />}
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input className="field" placeholder="Filtrar por plataforma" value={platformSearch} onChange={(event) => setPlatformSearch(event.target.value)} />
              <select className="field min-w-56" value={bulkProfileKey} onChange={(event) => setBulkProfileKey(event.target.value)}>
                <option value="nao_autorizado">Nao autorizado</option>
                {bulkProfileOptions.map((profile) => (
                  <option key={profile.chave} value={profile.chave}>{profile.nome}</option>
                ))}
              </select>
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{platform.application_nome}</p>
                      <p className="truncate text-xs text-slate-400">
                        {platform.application_client_id} - {platform.application_ativo ? "Ativa" : "Inativa"}
                      </p>
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
