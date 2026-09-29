"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, Globe2, ListChecks, Mail, Plus, Redo2, RefreshCw, RotateCcw, Save, ScrollText, Send, Server, ShieldCheck, Trash2, Undo2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ApplicationLogo } from "@/components/applications/application-logo";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { ApiFetchError, apiFetch } from "@/lib/api/client-fetch";
import type { ApplicationEmailSettingsDTO, EmailAdminSettingsDTO, EmailDeliveryLogDTO, EmailEndpointDTO, EmailGlobalSettingsDTO } from "@/lib/api/types";

export type EmailAdminSection = "global" | "endpoints" | "platforms" | "logs";

type AlertState = { message: string; type: SystemAlertType } | null;
type DeleteCandidate = { endpoint: EmailEndpointDTO; index: number } | null;

const sections: Array<{ id: EmailAdminSection; href: string; label: string; icon: React.ReactNode }> = [
  { id: "global", href: "/admin/emails/global", label: "Global", icon: <Globe2 size={16} aria-hidden="true" /> },
  { id: "endpoints", href: "/admin/emails/endpoints", label: "Endpoints", icon: <Server size={16} aria-hidden="true" /> },
  { id: "platforms", href: "/admin/emails/platforms", label: "Plataformas", icon: <ListChecks size={16} aria-hidden="true" /> },
  { id: "logs", href: "/admin/emails/logs", label: "Registros", icon: <ScrollText size={16} aria-hidden="true" /> },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stable(value: unknown) {
  return JSON.stringify(value);
}

function emptyGlobal(): EmailGlobalSettingsDTO {
  return {
    display_name: "RaroNexus",
    logo_url: "",
    primary_color: "#0ea5e9",
    footer_text: "E-mail enviado pelo RaroNexus.",
  };
}

function emptyEndpoint(): EmailEndpointDTO {
  return {
    key: "",
    name: "",
    description: "",
    active: true,
    default_subject: "",
    default_title: null,
    default_message: null,
    default_action_label: null,
    html_template: "{{body}}",
  };
}

function normalizeEndpoint(endpoint: EmailEndpointDTO): EmailEndpointDTO {
  return {
    ...endpoint,
    key: slugify(endpoint.key || endpoint.name),
    description: endpoint.description ?? "",
    default_subject: endpoint.default_subject ?? "",
    default_title: endpoint.default_title ?? null,
    default_message: endpoint.default_message ?? null,
    default_action_label: endpoint.default_action_label ?? null,
    html_template: endpoint.html_template || "{{body}}",
  };
}

function normalizeApplication(application: ApplicationEmailSettingsDTO, endpoints: EmailEndpointDTO[]): ApplicationEmailSettingsDTO {
  return {
    ...application,
    display_name: application.display_name ?? "",
    logo_url: application.logo_url ?? "",
    primary_color: application.primary_color || null,
    footer_text: application.footer_text ?? "",
    reply_to_email: application.reply_to_email ?? "",
    allowed_recipient_domains: [],
    endpoints: Object.fromEntries(endpoints.map((endpoint) => [endpoint.key, application.endpoints[endpoint.key] ?? false])),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-200">{label}</span>
      {description ? <span className="mb-2 block text-xs leading-5 text-slate-500">{description}</span> : null}
      {children}
    </label>
  );
}

function buildEndpointPreviewHtml(template: string, logoUrl?: string | null, primaryColor = "#0ea5e9", platformName = "Plataforma") {
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" width="72" style="display: inline-block; width: 72px; height: auto;" />`
    : `<div style="display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 16px; background: #e0f2fe; color: #0369a1; font-weight: 800;">RN</div>`;

  return (template || "{{body}}")
    .replaceAll("{{logo}}", logo)
    .replaceAll("{{primary_color}}", primaryColor)
    .replaceAll("{{primary-color}}", primaryColor)
    .replaceAll("{{platform-name}}", platformName)
    .replaceAll("{{platform_name}}", platformName);
}

function EmailSidebar({ section, dirty }: { section: EmailAdminSection; dirty: boolean }) {
  const pathname = usePathname();

  function confirmNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    if (!window.confirm("Existem alterações não salvas nesta tela. Deseja sair mesmo assim?")) {
      event.preventDefault();
    }
  }

  return (
    <aside className="panel shrink-0 p-2 lg:w-56">
      <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-1">
        {sections.map((item) => {
          const active = section === item.id || pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={confirmNavigation}
              className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function LogList({ logs }: { logs: EmailDeliveryLogDTO[] }) {
  if (logs.length === 0) {
    return <p className="rounded-lg border border-slate-800 bg-slate-950/45 p-4 text-sm text-slate-400">Nenhum envio registrado.</p>;
  }

  return (
    <div className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
      {logs.map((log) => (
        <div key={log.id} className="grid gap-2 bg-slate-950/45 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${log.status === "success" ? "border-emerald-400/25 bg-emerald-950/25 text-emerald-100" : "border-rose-400/25 bg-rose-950/25 text-rose-100"}`}>
                {log.status === "success" ? "Enviado" : "Erro"}
              </span>
              <span className="text-sm font-semibold text-white">{log.application_nome ?? "Aplicação removida"}</span>
              <span className="text-xs uppercase tracking-[0.14em] text-cyan-300">/api/email/{log.endpoint}</span>
            </div>
            <p className="mt-2 truncate text-sm text-slate-300">{log.subject ?? "Sem assunto"}</p>
            <p className="mt-1 text-xs text-slate-500">
              {log.recipient_count} destinatário(s) em {log.recipient_domains.join(", ") || "domínio não registrado"}
            </p>
            {log.error_message ? <p className="mt-1 text-xs text-rose-300">{log.error_message}</p> : null}
          </div>
          <p className="text-xs text-slate-500">{formatDate(log.created_at)}</p>
        </div>
      ))}
    </div>
  );
}

export function EmailAdmin({ section }: { section: EmailAdminSection }) {
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState>(null);
  const [forbidden, setForbidden] = useState(false);
  const [global, setGlobal] = useState<EmailGlobalSettingsDTO>(emptyGlobal);
  const [globalOriginal, setGlobalOriginal] = useState<EmailGlobalSettingsDTO>(emptyGlobal);
  const [endpoints, setEndpoints] = useState<EmailEndpointDTO[]>([]);
  const [endpointsOriginal, setEndpointsOriginal] = useState<EmailEndpointDTO[]>([]);
  const [applications, setApplications] = useState<ApplicationEmailSettingsDTO[]>([]);
  const [applicationsOriginal, setApplicationsOriginal] = useState<ApplicationEmailSettingsDTO[]>([]);
  const [logs, setLogs] = useState<EmailDeliveryLogDTO[]>([]);
  const [openEndpointDropdown, setOpenEndpointDropdown] = useState("");
  const [testDraft, setTestDraft] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState("");
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingEndpointKey, setSavingEndpointKey] = useState("");
  const [savingApplicationId, setSavingApplicationId] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const activeCount = useMemo(() => applications.filter((application) => Object.values(application.endpoints).some(Boolean)).length, [applications]);

  const dirty = useMemo(() => {
    if (section === "global") return stable(global) !== stable(globalOriginal);
    if (section === "endpoints") return stable(endpoints.map(normalizeEndpoint)) !== stable(endpointsOriginal.map(normalizeEndpoint));
    if (section === "platforms") {
      return stable(applications.map((app) => normalizeApplication(app, endpoints))) !== stable(applicationsOriginal.map((app) => normalizeApplication(app, endpointsOriginal)));
    }
    return false;
  }, [applications, applicationsOriginal, endpoints, endpointsOriginal, global, globalOriginal, section]);

  const applyData = useCallback((data: EmailAdminSettingsDTO) => {
    setForbidden(false);
    setGlobal(data.global);
    setGlobalOriginal(data.global);
    setEndpoints(data.endpoints);
    setEndpointsOriginal(data.endpoints);
    setApplications(data.applications);
    setApplicationsOriginal(data.applications);
    setLogs(data.recent_logs);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applyData(await apiFetch<EmailAdminSettingsDTO>("/api/v1/email/settings"));
    } catch (error) {
      if (error instanceof ApiFetchError && error.status === 403) {
        setForbidden(true);
        return;
      }
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível carregar a central de e-mails." });
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const data = await apiFetch<EmailAdminSettingsDTO>("/api/v1/email/settings");
        if (active) applyData(data);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiFetchError && error.status === 403) {
          setForbidden(true);
          return;
        }
        setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível carregar a central de e-mails." });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      active = false;
    };
  }, [applyData]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function updateEndpointDefinition(index: number, input: Partial<EmailEndpointDTO>) {
    setEndpoints((current) => current.map((endpoint, currentIndex) => (currentIndex === index ? { ...endpoint, ...input } : endpoint)));
  }

  function updateApplication(applicationId: string, input: Partial<ApplicationEmailSettingsDTO>) {
    setApplications((current) => current.map((application) => (application.application_id === applicationId ? { ...application, ...input } : application)));
  }

  function updateEndpointPermission(applicationId: string, endpointKey: string, enabled: boolean) {
    setApplications((current) =>
      current.map((application) =>
        application.application_id === applicationId
          ? {
              ...application,
              endpoints: {
                ...application.endpoints,
                [endpointKey]: enabled,
              },
            }
          : application,
      ),
    );
  }

  function addEndpoint() {
    setEndpoints((current) => [...current, emptyEndpoint()]);
  }

  async function saveGlobal() {
    setSavingGlobal(true);
    try {
      const data = await apiFetch<EmailGlobalSettingsDTO>("/api/v1/email/global", { method: "PUT", body: JSON.stringify(global) });
      setGlobal(data);
      setGlobalOriginal(data);
      setAlert({ type: "success", message: "Padrão global salvo." });
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar o padrão global." });
    } finally {
      setSavingGlobal(false);
    }
  }

  async function saveEndpoint(endpoint: EmailEndpointDTO, index: number) {
    const normalized = normalizeEndpoint(endpoint);
    if (!normalized.key) {
      setAlert({ type: "warning", message: "Informe a chave do endpoint." });
      return;
    }
    if (!normalized.html_template.includes("{{body}}")) {
      setAlert({ type: "warning", message: "O corpo HTML precisa conter a tag {{body}}." });
      return;
    }

    setSavingEndpointKey(endpoint.id ?? `new-${index}`);
    try {
      const original = endpointsOriginal[index];
      const data = await apiFetch<EmailEndpointDTO>(
        endpoint.id ? `/api/v1/email/endpoints/${encodeURIComponent(original?.key || endpoint.key)}` : "/api/v1/email/endpoints",
        { method: endpoint.id ? "PUT" : "POST", body: JSON.stringify(normalized) },
      );

      setEndpoints((current) => current.map((item, currentIndex) => (currentIndex === index ? data : item)));
      setEndpointsOriginal((current) => {
        const copy = [...current];
        copy[index] = data;
        return copy;
      });
      setApplications((current) => current.map((application) => ({ ...application, endpoints: { ...application.endpoints, [data.key]: application.endpoints[data.key] ?? false } })));
      setApplicationsOriginal((current) => current.map((application) => ({ ...application, endpoints: { ...application.endpoints, [data.key]: application.endpoints[data.key] ?? false } })));
      setAlert({ type: "success", message: endpoint.id ? "Endpoint salvo." : "Endpoint criado." });
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar o endpoint." });
    } finally {
      setSavingEndpointKey("");
    }
  }

  async function saveApplication(application: ApplicationEmailSettingsDTO) {
    setSavingApplicationId(application.application_id);
    try {
      const normalized = normalizeApplication(application, endpoints);
      const data = await apiFetch<ApplicationEmailSettingsDTO>(`/api/v1/email/applications/${application.application_id}`, {
        method: "PUT",
        body: JSON.stringify(normalized),
      });
      setApplications((current) => current.map((item) => (item.application_id === data.application_id ? data : item)));
      setApplicationsOriginal((current) => current.map((item) => (item.application_id === data.application_id ? data : item)));
      setAlert({ type: "success", message: "Plataforma salva." });
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar a plataforma." });
    } finally {
      setSavingApplicationId("");
    }
  }

  async function test(application: ApplicationEmailSettingsDTO) {
    const to = testDraft[application.application_id]?.trim();
    if (!to) {
      setAlert({ type: "warning", message: "Informe um destinatário para testar o envio." });
      return;
    }

    setTestingId(application.application_id);
    try {
      await apiFetch("/api/v1/email/test", { method: "POST", body: JSON.stringify({ application_id: application.application_id, to }) });
      setAlert({ type: "success", message: "E-mail de teste enviado." });
      await refreshLogs();
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível enviar o teste." });
    } finally {
      setTestingId("");
    }
  }

  async function refreshLogs() {
    try {
      setLogs(await apiFetch<EmailDeliveryLogDTO[]>("/api/v1/email/logs"));
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível atualizar os registros." });
    }
  }

  function openDeleteEndpoint(endpoint: EmailEndpointDTO, index: number) {
    setDeleteCandidate({ endpoint, index });
    setDeleteConfirmation("");
  }

  async function confirmDeleteEndpoint() {
    if (!deleteCandidate) return;

    const endpointKey = slugify(deleteCandidate.endpoint.key || deleteCandidate.endpoint.name);
    const expected = `/api/email/${endpointKey}`;
    if (deleteConfirmation.trim() !== expected) {
      setAlert({ type: "warning", message: "Digite a URL exata do endpoint para confirmar a remoção." });
      return;
    }

    if (!deleteCandidate.endpoint.id) {
      setEndpoints((current) => current.filter((_, index) => index !== deleteCandidate.index));
      setDeleteCandidate(null);
      setDeleteConfirmation("");
      return;
    }

    setDeleting(true);
    try {
      const data = await apiFetch<EmailAdminSettingsDTO>(`/api/v1/email/endpoints/${encodeURIComponent(endpointKey)}`, { method: "DELETE" });
      applyData(data);
      setDeleteCandidate(null);
      setDeleteConfirmation("");
      setAlert({ type: "success", message: "Endpoint removido." });
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível remover o endpoint." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell title="E-mails">
      {alert ? <SystemAlert {...alert} onClose={() => setAlert(null)} /> : null}
      <div className="space-y-5">
        <section className="panel p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-md border border-cyan-400/25 bg-cyan-950/35 px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                <Mail size={14} aria-hidden="true" />
                Central SMTP
              </p>
              <h1 className="text-2xl font-semibold text-white">E-mails</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Configure o padrão visual, endpoints, plataformas autorizadas e registros recentes.
              </p>
            </div>
            {!forbidden ? (
              <button className="btn-secondary px-3" type="button" onClick={() => void load()} title="Atualizar tudo">
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>

        {forbidden ? (
          <section className="panel px-5 py-10 text-center">
            <Mail className="mx-auto mb-3 text-slate-500" size={30} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">Sem acesso a central de e-mails</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              Sua conta pode acessar o Nexus, perfil e plataformas liberadas, mas a configuração de e-mails é restrita a administradores.
            </p>
          </section>
        ) : loading ? (
          <section className="panel p-6 text-sm text-slate-300">Carregando configuracoes...</section>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <EmailSidebar section={section} dirty={dirty} />
            <main className="min-w-0 flex-1">
              {section === "global" ? (
                <section className="panel p-5">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Padrao global</h2>
                      <p className="text-sm text-slate-400">Usado quando a plataforma não tiver sobrescritas próprias.</p>
                    </div>
                    <button className="btn-primary" type="button" disabled={!dirty || savingGlobal} onClick={() => void saveGlobal()}>
                      <Save size={16} aria-hidden="true" />
                      {savingGlobal ? "Salvando..." : "Salvar padrão global"}
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome exibido">
                      <input className="field" value={global.display_name} onChange={(event) => setGlobal({ ...global, display_name: event.target.value })} />
                    </Field>
                    <Field label="Logo URL">
                      <input className="field" value={global.logo_url ?? ""} onChange={(event) => setGlobal({ ...global, logo_url: event.target.value })} />
                    </Field>
                    <Field label="Cor principal">
                      <input className="field h-11" type="color" value={global.primary_color} onChange={(event) => setGlobal({ ...global, primary_color: event.target.value })} />
                    </Field>
                    <Field label="Rodapé">
                      <textarea className="field min-h-24" value={global.footer_text} onChange={(event) => setGlobal({ ...global, footer_text: event.target.value })} />
                    </Field>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">{activeCount} plataforma(s) com pelo menos um endpoint liberado.</p>
                </section>
              ) : null}

              {section === "endpoints" ? (
                <EndpointSection
                  endpoints={endpoints}
                  endpointsOriginal={endpointsOriginal}
                  global={global}
                  savingEndpointKey={savingEndpointKey}
                  onAdd={addEndpoint}
                  onChange={updateEndpointDefinition}
                  onSave={saveEndpoint}
                  onDelete={openDeleteEndpoint}
                />
              ) : null}

              {section === "platforms" ? (
                <PlatformSection
                  applications={applications}
                  applicationsOriginal={applicationsOriginal}
                  endpoints={endpoints}
                  endpointsOriginal={endpointsOriginal}
                  global={global}
                  openEndpointDropdown={openEndpointDropdown}
                  savingApplicationId={savingApplicationId}
                  testingId={testingId}
                  testDraft={testDraft}
                  onToggleDropdown={setOpenEndpointDropdown}
                  onEndpointPermission={updateEndpointPermission}
                  onApplicationChange={updateApplication}
                  onSave={saveApplication}
                  onTest={test}
                  onTestDraftChange={setTestDraft}
                />
              ) : null}

              {section === "logs" ? (
                <section className="panel p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Registros</h2>
                      <p className="text-sm text-slate-400">Últimos 50 envios. O corpo dos e-mails não é armazenado.</p>
                    </div>
                    <button className="btn-secondary" type="button" onClick={() => void refreshLogs()}>
                      <RefreshCw size={16} aria-hidden="true" />
                      Atualizar
                    </button>
                  </div>
                  <LogList logs={logs} />
                </section>
              ) : null}
            </main>
          </div>
        )}
      </div>

      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <section className="panel w-full max-w-lg p-5 shadow-2xl shadow-cyan-950/40">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Remover endpoint?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Essa ação remove a rota da central e todas as permissões das plataformas para este endpoint.
                </p>
              </div>
              <button className="btn-secondary min-h-9 px-3 py-2" type="button" onClick={() => setDeleteCandidate(null)} title="Fechar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="rounded-lg border border-rose-400/20 bg-rose-950/20 p-3 text-sm text-rose-100">
              Digite <strong>/api/email/{slugify(deleteCandidate.endpoint.key || deleteCandidate.endpoint.name)}</strong> para confirmar.
            </div>
            <div className="mt-4">
              <Field label="URL do endpoint">
                <input
                  className="field"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder={`/api/email/${slugify(deleteCandidate.endpoint.key || deleteCandidate.endpoint.name)}`}
                  autoFocus
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-center">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/35 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/70 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteEndpoint()}
              >
                <Trash2 size={16} aria-hidden="true" />
                {deleting ? "Removendo..." : "Remover endpoint"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type HistoryEntry = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  timestamp: number;
};

type ActionCategory = "word" | "space" | "punct";

type LastAction = {
  type: "typing" | "delete" | "other";
  category?: ActionCategory;
  timestamp: number;
  cursor: number;
};

function getCharCategory(char: string): ActionCategory {
  if (/\s/.test(char)) return "space";
  if (/[\w\u00C0-\u017F-]/.test(char)) return "word";
  return "punct";
}

function HtmlTemplateEditor({
  value,
  onChange,
  logoUrl,
  primaryColor = "#0ea5e9",
  platformName = "Plataforma",
  endpointName,
}: {
  value: string;
  onChange: (value: string) => void;
  logoUrl?: string | null;
  primaryColor?: string;
  platformName?: string;
  endpointName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const historyRef = useRef<HistoryEntry[]>([
    {
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      timestamp: Date.now(),
    },
  ]);
  const historyIndexRef = useRef<number>(0);
  const lastActionRef = useRef<LastAction>({
    type: "other",
    timestamp: 0,
    cursor: 0,
  });
  const lastEmittedValue = useRef<string>(value);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function syncUndoRedoState() {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }

  useEffect(() => {
    if (value !== lastEmittedValue.current) {
      historyRef.current = [
        {
          value,
          selectionStart: value.length,
          selectionEnd: value.length,
          timestamp: Date.now(),
        },
      ];
      historyIndexRef.current = 0;
      lastEmittedValue.current = value;
      syncUndoRedoState();
    }
  }, [value]);

  useIsomorphicLayoutEffect(() => {
    if (pendingSelectionRef.current && textareaRef.current) {
      const { start, end } = pendingSelectionRef.current;
      textareaRef.current.setSelectionRange(start, end);
      pendingSelectionRef.current = null;
    }
  });

  function truncateRedo() {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
  }

  function trimHistoryLimit() {
    if (historyRef.current.length > 250) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - 200);
      historyIndexRef.current = historyRef.current.length - 1;
    }
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    if (!entry) return;

    lastActionRef.current = {
      type: "other",
      timestamp: Date.now(),
      cursor: entry.selectionStart,
    };
    pendingSelectionRef.current = {
      start: entry.selectionStart,
      end: entry.selectionEnd,
    };
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.value = entry.value;
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
    }
    lastEmittedValue.current = entry.value;
    onChange(entry.value);
    syncUndoRedoState();
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    if (!entry) return;

    lastActionRef.current = {
      type: "other",
      timestamp: Date.now(),
      cursor: entry.selectionStart,
    };
    pendingSelectionRef.current = {
      start: entry.selectionStart,
      end: entry.selectionEnd,
    };
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.value = entry.value;
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
    }
    lastEmittedValue.current = entry.value;
    onChange(entry.value);
    syncUndoRedoState();
  }

  function commitNewHistoryEntry(nextVal: string, nextStart: number, nextEnd: number) {
    truncateRedo();
    historyRef.current.push({
      value: nextVal,
      selectionStart: nextStart,
      selectionEnd: nextEnd,
      timestamp: Date.now(),
    });
    trimHistoryLimit();
    historyIndexRef.current = historyRef.current.length - 1;
    lastActionRef.current = {
      type: "other",
      timestamp: Date.now(),
      cursor: nextStart,
    };

    pendingSelectionRef.current = { start: nextStart, end: nextEnd };
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.value = nextVal;
      textarea.setSelectionRange(nextStart, nextEnd);
    }
    lastEmittedValue.current = nextVal;
    onChange(nextVal);
    syncUndoRedoState();
  }

  function insertTag(tag: string, singleUse = false) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (singleUse && value.includes(tag)) {
      return;
    }

    if (document.activeElement !== textarea) {
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const curVal = textarea.value;

    const nextVal = curVal.slice(0, start) + tag + curVal.slice(end);
    const nextPos = start + tag.length;

    commitNewHistoryEntry(nextVal, nextPos, nextPos);
  }

  function handleTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    if (e.shiftKey) {
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = val.indexOf("\n", end);
      const actualEnd = lineEnd === -1 ? val.length : lineEnd;
      const lines = val.substring(lineStart, actualEnd).split("\n");

      let removedTotal = 0;
      let firstLineRemoved = 0;

      const newLines = lines.map((line, idx) => {
        let removeCount = 0;
        if (line.startsWith("  ")) {
          removeCount = 2;
        } else if (line.startsWith(" ") || line.startsWith("\t")) {
          removeCount = 1;
        }
        if (idx === 0) firstLineRemoved = removeCount;
        removedTotal += removeCount;
        return line.slice(removeCount);
      });

      const replaced = newLines.join("\n");
      const nextVal = val.slice(0, lineStart) + replaced + val.slice(actualEnd);
      const nextStart = Math.max(lineStart, start - firstLineRemoved);
      const nextEnd = Math.max(nextStart, end - removedTotal);

      commitNewHistoryEntry(nextVal, nextStart, nextEnd);
    } else {
      if (start === end) {
        const nextVal = val.slice(0, start) + "  " + val.slice(end);
        const nextPos = start + 2;
        commitNewHistoryEntry(nextVal, nextPos, nextPos);
      } else {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end);
        const actualEnd = lineEnd === -1 ? val.length : lineEnd;
        const lines = val.substring(lineStart, actualEnd).split("\n");

        const newLines = lines.map((line) => "  " + line);
        const replaced = newLines.join("\n");
        const nextVal = val.slice(0, lineStart) + replaced + val.slice(actualEnd);
        const nextStart = start + 2;
        const nextEnd = end + lines.length * 2;

        commitNewHistoryEntry(nextVal, nextStart, nextEnd);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const isMod = isMac ? e.metaKey : e.ctrlKey;

    if (isMod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      handleTab(e);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextVal = e.target.value;
    const nextStart = e.target.selectionStart;
    const nextEnd = e.target.selectionEnd;

    const currentEntry = historyRef.current[historyIndexRef.current];
    const prevVal = currentEntry ? currentEntry.value : "";
    const prevCursor = lastActionRef.current.cursor;
    const delta = nextVal.length - prevVal.length;
    const now = Date.now();

    if (delta === 1 && nextStart === prevCursor + 1) {
      const insertedChar = nextVal[nextStart - 1];
      const category = getCharCategory(insertedChar);

      const canMerge =
        lastActionRef.current.type === "typing" &&
        (lastActionRef.current.category === category || (category === "space" && lastActionRef.current.category === "word")) &&
        now - lastActionRef.current.timestamp < 1000 &&
        historyIndexRef.current === historyRef.current.length - 1;

      if (canMerge && currentEntry) {
        currentEntry.value = nextVal;
        currentEntry.selectionStart = nextStart;
        currentEntry.selectionEnd = nextEnd;
        currentEntry.timestamp = now;
        lastActionRef.current = {
          type: "typing",
          category: category === "space" ? "space" : lastActionRef.current.category,
          timestamp: now,
          cursor: nextStart,
        };
      } else {
        truncateRedo();
        historyRef.current.push({
          value: nextVal,
          selectionStart: nextStart,
          selectionEnd: nextEnd,
          timestamp: now,
        });
        trimHistoryLimit();
        historyIndexRef.current = historyRef.current.length - 1;
        lastActionRef.current = {
          type: "typing",
          category,
          timestamp: now,
          cursor: nextStart,
        };
      }
    } else if (delta === -1 && nextStart === prevCursor - 1) {
      const deletedChar = prevVal[nextStart];
      const category = deletedChar ? getCharCategory(deletedChar) : "punct";

      const canMerge =
        lastActionRef.current.type === "delete" &&
        lastActionRef.current.category === category &&
        now - lastActionRef.current.timestamp < 1000 &&
        historyIndexRef.current === historyRef.current.length - 1;

      if (canMerge && currentEntry) {
        currentEntry.value = nextVal;
        currentEntry.selectionStart = nextStart;
        currentEntry.selectionEnd = nextEnd;
        currentEntry.timestamp = now;
        lastActionRef.current = {
          type: "delete",
          category,
          timestamp: now,
          cursor: nextStart,
        };
      } else {
        truncateRedo();
        historyRef.current.push({
          value: nextVal,
          selectionStart: nextStart,
          selectionEnd: nextEnd,
          timestamp: now,
        });
        trimHistoryLimit();
        historyIndexRef.current = historyRef.current.length - 1;
        lastActionRef.current = {
          type: "delete",
          category,
          timestamp: now,
          cursor: nextStart,
        };
      }
    } else {
      truncateRedo();
      historyRef.current.push({
        value: nextVal,
        selectionStart: nextStart,
        selectionEnd: nextEnd,
        timestamp: now,
      });
      trimHistoryLimit();
      historyIndexRef.current = historyRef.current.length - 1;
      lastActionRef.current = {
        type: "other",
        timestamp: now,
        cursor: nextStart,
      };
    }

    lastEmittedValue.current = nextVal;
    onChange(nextVal);
    syncUndoRedoState();
  }

  return (
    <>
      <Field
        label="Corpo HTML"
        description="Use {{body}} no ponto em que o conteúdo enviado pela plataforma deve aparecer. Use {{logo}} para a logo da plataforma, {{primary_color}} para a cor principal e {{platform_name}} para o nome exibido da plataforma."
      >
        <textarea
          ref={textareaRef}
          className="field min-h-64 font-mono text-sm leading-relaxed"
          rows={14}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBeforeInput={(e: React.FormEvent<HTMLTextAreaElement> & { inputType?: string }) => {
            if (e.inputType === "historyUndo") {
              e.preventDefault();
              undo();
            } else if (e.inputType === "historyRedo") {
              e.preventDefault();
              redo();
            }
          }}
        />
      </Field>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary min-h-9 px-3 py-2 text-xs"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag("{{body}}", true)}
            disabled={value.includes("{{body}}")}
          >
            {"{{body}}"}
          </button>
          <button
            className="btn-secondary min-h-9 px-3 py-2 text-xs"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag("{{logo}}")}
          >
            {"{{logo}}"}
          </button>
          <button
            className="btn-secondary min-h-9 px-3 py-2 text-xs"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag("{{primary_color}}")}
          >
            {"{{primary_color}}"}
          </button>
          <button
            className="btn-secondary min-h-9 px-3 py-2 text-xs"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag("{{platform_name}}")}
          >
            {"{{platform_name}}"}
          </button>
          <button
            className="btn-secondary min-h-9 px-3 py-2 text-xs"
            type="button"
            onClick={() => setShowPreview((cur) => !cur)}
          >
            <Eye size={14} aria-hidden="true" />
            {showPreview ? "Ocultar preview" : "Ver preview"}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <button
            className="btn-secondary min-h-9 px-2.5 py-2 text-xs disabled:opacity-35"
            type="button"
            title="Desfazer (Ctrl + Z)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Desfazer</span>
          </button>
          <button
            className="btn-secondary min-h-9 px-2.5 py-2 text-xs disabled:opacity-35"
            type="button"
            title="Refazer (Ctrl + Y ou Ctrl + Shift + Z)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Refazer</span>
          </button>
        </div>
      </div>
      {showPreview ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-white">
          <iframe
            title={`Preview de ${endpointName || "endpoint"}`}
            sandbox=""
            className="h-[520px] w-full bg-white"
            srcDoc={buildEndpointPreviewHtml(value, logoUrl, primaryColor, platformName)}
          />
        </div>
      ) : null}
    </>
  );
}

function EndpointSection({
  endpoints,
  endpointsOriginal,
  global,
  savingEndpointKey,
  onAdd,
  onChange,
  onSave,
  onDelete,
}: {
  endpoints: EmailEndpointDTO[];
  endpointsOriginal: EmailEndpointDTO[];
  global: EmailGlobalSettingsDTO;
  savingEndpointKey: string;
  onAdd: () => void;
  onChange: (index: number, input: Partial<EmailEndpointDTO>) => void;
  onSave: (endpoint: EmailEndpointDTO, index: number) => Promise<void>;
  onDelete: (endpoint: EmailEndpointDTO, index: number) => void;
}) {
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  function getEndpointRowKey(endpoint: EmailEndpointDTO, index: number) {
    return endpoint.id ?? `new-${index}`;
  }

  function toggleEndpoint(rowKey: string) {
    setExpandedEndpoints((current) => (current[rowKey] ? {} : { [rowKey]: true }));
  }

  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Endpoints</h2>
          <p className="text-sm text-slate-400">Cada chave vira uma rota, como /api/email/equipamento-solicitado.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          Novo endpoint
        </button>
      </div>
      <div className="space-y-4">
        {endpoints.map((endpoint, index) => {
          const normalized = normalizeEndpoint(endpoint);
          const original = endpointsOriginal[index] ? normalizeEndpoint(endpointsOriginal[index]) : null;
          const endpointDirty = stable(normalized) !== stable(original);
          const rowKey = getEndpointRowKey(endpoint, index);
          const expanded = Boolean(expandedEndpoints[rowKey]);

          return (
            <article key={rowKey} className="group rounded-lg border border-slate-800 bg-slate-950/45 transition hover:border-cyan-400/35 hover:bg-slate-900/65 hover:shadow-lg hover:shadow-cyan-950/10">
              <div
                className="flex cursor-pointer flex-col gap-3 p-4 transition group-hover:bg-cyan-500/[0.03] sm:flex-row sm:items-center sm:justify-between"
                onClick={() => toggleEndpoint(rowKey)}
              >
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left transition hover:text-cyan-100"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleEndpoint(rowKey);
                  }}
                  aria-expanded={expanded}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-lg border transition group-hover:border-cyan-400/45 group-hover:text-cyan-200 ${expanded ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-200" : "border-slate-700 bg-slate-900/60 text-slate-400"}`}>
                    <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white transition group-hover:text-cyan-50">{endpoint.name || "Novo endpoint"}</span>
                    <span className="block truncate text-xs text-cyan-300">/api/email/{normalized.key || "nova-chave"}</span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-200">
                    <input type="checkbox" checked={endpoint.active} onChange={(event) => onChange(index, { active: event.target.checked })} />
                    Ativo
                  </label>
                  <button className="btn-primary min-h-9" type="button" disabled={!endpointDirty || savingEndpointKey === rowKey} onClick={() => void onSave(endpoint, index)}>
                    <Save size={15} aria-hidden="true" />
                    {endpoint.id ? "Salvar endpoint" : "Criar endpoint"}
                  </button>
                  <button
                    className="btn-secondary min-h-9 px-2 py-2 text-slate-400 hover:border-rose-400/45 hover:text-rose-200 disabled:opacity-40"
                    type="button"
                    title="Remover endpoint"
                    onClick={() => onDelete(endpoint, index)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {expanded ? (
                <div className="border-t border-slate-800 p-4 pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome">
                      <input className="field" value={endpoint.name} onChange={(event) => onChange(index, { name: event.target.value, key: endpoint.key || slugify(event.target.value) })} />
                    </Field>
                    <Field label="Chave">
                      <input className="field" value={endpoint.key} onChange={(event) => onChange(index, { key: slugify(event.target.value) })} />
                    </Field>
                    <Field label="Descrição">
                      <input className="field" value={endpoint.description ?? ""} onChange={(event) => onChange(index, { description: event.target.value })} />
                    </Field>
                    <Field label="Assunto">
                      <input className="field" value={endpoint.default_subject ?? ""} onChange={(event) => onChange(index, { default_subject: event.target.value })} />
                    </Field>
                    <div className="md:col-span-2">
                      <HtmlTemplateEditor
                        value={endpoint.html_template ?? "{{body}}"}
                        onChange={(nextHtml) => onChange(index, { html_template: nextHtml })}
                        logoUrl={global.logo_url}
                        primaryColor={global.primary_color}
                        platformName={global.display_name || "Plataforma"}
                        endpointName={endpoint.name}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PlatformSection({
  applications,
  applicationsOriginal,
  endpoints,
  endpointsOriginal,
  global,
  openEndpointDropdown,
  savingApplicationId,
  testingId,
  testDraft,
  onToggleDropdown,
  onEndpointPermission,
  onApplicationChange,
  onSave,
  onTest,
  onTestDraftChange,
}: {
  applications: ApplicationEmailSettingsDTO[];
  applicationsOriginal: ApplicationEmailSettingsDTO[];
  endpoints: EmailEndpointDTO[];
  endpointsOriginal: EmailEndpointDTO[];
  global: EmailGlobalSettingsDTO;
  openEndpointDropdown: string;
  savingApplicationId: string;
  testingId: string;
  testDraft: Record<string, string>;
  onToggleDropdown: (id: string) => void;
  onEndpointPermission: (applicationId: string, endpointKey: string, enabled: boolean) => void;
  onApplicationChange: (applicationId: string, input: Partial<ApplicationEmailSettingsDTO>) => void;
  onSave: (application: ApplicationEmailSettingsDTO) => Promise<void>;
  onTest: (application: ApplicationEmailSettingsDTO) => Promise<void>;
  onTestDraftChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {applications.map((application) => {
        const normalized = normalizeApplication(application, endpoints);
        const original = applicationsOriginal.find((item) => item.application_id === application.application_id);
        const applicationDirty = stable(normalized) !== stable(original ? normalizeApplication(original, endpointsOriginal) : null);
        const enabledCount = endpoints.filter((endpoint) => application.endpoints[endpoint.key]).length;

        return (
          <article key={application.application_id} className="panel p-5">
            <div className="mb-5 flex items-start gap-3">
              <ApplicationLogo name={application.application_nome} logoUrl={application.application_logo_url} size="md" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-white">{application.application_nome}</h2>
                <p className="truncate text-xs text-slate-500">{application.application_client_id}</p>
              </div>
              <button className="btn-primary min-h-9" type="button" disabled={!applicationDirty || savingApplicationId === application.application_id} onClick={() => void onSave(application)}>
                <Save size={15} aria-hidden="true" />
                Salvar
              </button>
            </div>
            <div className="relative mb-4">
              <button
                className={`btn-secondary w-full justify-between sm:w-auto ${enabledCount > 0 ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : ""}`}
                type="button"
                onClick={() => onToggleDropdown(openEndpointDropdown === application.application_id ? "" : application.application_id)}
              >
                <span>Endpoints liberados{enabledCount > 0 ? ` (${enabledCount})` : ""}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {openEndpointDropdown === application.application_id ? (
                <div className="absolute left-0 z-30 mt-2 w-full max-w-md overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl shadow-slate-950/70">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <p className="text-sm font-semibold text-white">Endpoints</p>
                    <p className="text-xs text-slate-400">Selecione as APIs que esta plataforma pode usar.</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {endpoints.map((endpoint) => (
                      <label key={endpoint.key} className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900/80">
                        <input className="mt-1" type="checkbox" checked={application.endpoints[endpoint.key] ?? false} onChange={(event) => onEndpointPermission(application.application_id, endpoint.key, event.target.checked)} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-white">{endpoint.name || endpoint.key}</span>
                          <span className="block truncate text-xs text-cyan-300">/api/email/{endpoint.key || "chave"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Responder para: (Opcional)">
                <input className="field" value={application.reply_to_email ?? ""} onChange={(event) => onApplicationChange(application.application_id, { reply_to_email: event.target.value })} />
              </Field>
              <Field label="Nome exibido">
                <input className="field" value={application.display_name ?? ""} onChange={(event) => onApplicationChange(application.application_id, { display_name: event.target.value })} />
              </Field>
              <Field label="Logo URL">
                <input className="field" value={application.logo_url ?? ""} onChange={(event) => onApplicationChange(application.application_id, { logo_url: event.target.value })} />
              </Field>
              <Field label="Cor principal">
                <div className="flex items-center gap-2">
                  <input
                    className="field h-11 flex-1"
                    type="color"
                    value={application.primary_color || global.primary_color}
                    onChange={(event) => onApplicationChange(application.application_id, { primary_color: event.target.value })}
                  />
                  {application.primary_color ? (
                    <button
                      className="btn-secondary min-h-11 px-3 py-2 text-slate-400 hover:border-cyan-400/45 hover:text-cyan-100"
                      type="button"
                      title="Usar cor global"
                      aria-label="Usar cor global"
                      onClick={() => onApplicationChange(application.application_id, { primary_color: null })}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {!application.primary_color ? <p className="mt-2 text-xs text-slate-500">Usando cor global</p> : null}
              </Field>
              <Field label="Rodapé">
                <textarea className="field min-h-24" value={application.footer_text ?? ""} onChange={(event) => onApplicationChange(application.application_id, { footer_text: event.target.value })} />
              </Field>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/45 p-3 sm:flex-row sm:items-center">
              <ShieldCheck size={18} className="text-cyan-300" aria-hidden="true" />
              <input
                className="field min-h-10 flex-1 py-2"
                placeholder="destinatario@dominio.com"
                value={testDraft[application.application_id] ?? ""}
                onChange={(event) => onTestDraftChange((current) => ({ ...current, [application.application_id]: event.target.value }))}
              />
              <button className="btn-secondary min-h-10 px-3 py-2" type="button" disabled={testingId === application.application_id} onClick={() => void onTest(application)}>
                <Send size={15} aria-hidden="true" />
                {testingId === application.application_id ? "Enviando..." : "Testar"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
