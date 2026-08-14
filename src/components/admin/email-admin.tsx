"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, Plus, RefreshCw, Save, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ApplicationLogo } from "@/components/applications/application-logo";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { ApiFetchError, apiFetch } from "@/lib/api/client-fetch";
import type {
  ApplicationEmailSettingsDTO,
  EmailAdminSettingsDTO,
  EmailDeliveryLogDTO,
  EmailEndpointDTO,
  EmailGlobalSettingsDTO,
} from "@/lib/api/types";

type AlertState = { message: string; type: SystemAlertType } | null;
type TestDraft = Record<string, string>;
type DeleteCandidate = { endpoint: EmailEndpointDTO; index: number } | null;

function linesToArray(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

function arrayToLines(value: string[]) {
  return value.join("\n");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
    default_title: "",
    default_message: "",
    default_action_label: "",
  };
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-200">{label}</span>
      {description ? <span className="mb-2 block text-xs leading-5 text-slate-500">{description}</span> : null}
      {children}
    </label>
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
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                log.status === "success"
                  ? "border-emerald-400/25 bg-emerald-950/25 text-emerald-100"
                  : "border-rose-400/25 bg-rose-950/25 text-rose-100"
              }`}
              >
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

export function EmailAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [global, setGlobal] = useState<EmailGlobalSettingsDTO>(emptyGlobal);
  const [endpoints, setEndpoints] = useState<EmailEndpointDTO[]>([]);
  const [applications, setApplications] = useState<ApplicationEmailSettingsDTO[]>([]);
  const [logs, setLogs] = useState<EmailDeliveryLogDTO[]>([]);
  const [testDraft, setTestDraft] = useState<TestDraft>({});
  const [alert, setAlert] = useState<AlertState>(null);
  const [forbidden, setForbidden] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [openEndpointDropdown, setOpenEndpointDropdown] = useState("");

  const activeCount = useMemo(() => applications.filter((application) => (
    Object.values(application.endpoints).some(Boolean)
  )).length, [applications]);

  function applyData(data: EmailAdminSettingsDTO) {
    setForbidden(false);
    setGlobal(data.global);
    setEndpoints(data.endpoints);
    setApplications(data.applications);
    setLogs(data.recent_logs);
  }

  async function load() {
    setLoading(true);
    try {
      applyData(await apiFetch<EmailAdminSettingsDTO>("/api/v1/email/settings"));
    } catch (error) {
      if (error instanceof ApiFetchError && error.status === 403) {
        setForbidden(true);
        return;
      }
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível carregar a central de e-mails.",
      });
    } finally {
      setLoading(false);
    }
  }

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
        setAlert({
          type: "error",
          message: error instanceof Error ? error.message : "Não foi possível carregar a central de e-mails.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitial();

    return () => {
      active = false;
    };
  }, []);

  function updateEndpointDefinition(index: number, input: Partial<EmailEndpointDTO>) {
    setEndpoints((current) => current.map((endpoint, currentIndex) => (
      currentIndex === index ? { ...endpoint, ...input } : endpoint
    )));
  }

  function updateApplication(applicationId: string, input: Partial<ApplicationEmailSettingsDTO>) {
    setApplications((current) => current.map((application) => (
      application.application_id === applicationId ? { ...application, ...input } : application
    )));
  }

  function updateEndpointPermission(applicationId: string, endpointKey: string, enabled: boolean) {
    setApplications((current) => current.map((application) => (
      application.application_id === applicationId
        ? { ...application, endpoints: { ...application.endpoints, [endpointKey]: enabled } }
        : application
    )));
  }

  function getEnabledEndpointCount(application: ApplicationEmailSettingsDTO) {
    return endpoints.filter((endpoint) => application.endpoints[endpoint.key]).length;
  }

  function addEndpoint() {
    setEndpoints((current) => [...current, emptyEndpoint()]);
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
      setApplications((current) => current.map((application) => {
        const remainingEndpoints = { ...application.endpoints };
        delete remainingEndpoints[endpointKey];
        return { ...application, endpoints: remainingEndpoints };
      }));
      setDeleteCandidate(null);
      setDeleteConfirmation("");
      return;
    }

    setDeleting(true);
    try {
      const data = await apiFetch<EmailAdminSettingsDTO>(`/api/v1/email/endpoints/${encodeURIComponent(endpointKey)}`, {
        method: "DELETE",
      });
      applyData(data);
      setDeleteCandidate(null);
      setDeleteConfirmation("");
      setAlert({ type: "success", message: "Endpoint removido." });
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível remover o endpoint.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const normalizedEndpoints = endpoints.map((endpoint) => ({
        ...endpoint,
        key: slugify(endpoint.key || endpoint.name),
      }));
      const normalizedApplications = applications.map((application) => ({
        ...application,
        endpoints: Object.fromEntries(normalizedEndpoints.map((endpoint) => [
          endpoint.key,
          application.endpoints[endpoint.key] ?? false,
        ])),
      }));

      const data = await apiFetch<EmailAdminSettingsDTO>("/api/v1/email/settings", {
        method: "PUT",
        body: JSON.stringify({
          global,
          endpoints: normalizedEndpoints,
          applications: normalizedApplications,
        }),
      });
      applyData(data);
      setAlert({ type: "success", message: "Configurações de e-mail atualizadas." });
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível salvar as configurações.",
      });
    } finally {
      setSaving(false);
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
      await apiFetch("/api/v1/email/test", {
        method: "POST",
        body: JSON.stringify({ application_id: application.application_id, to }),
      });
      setAlert({ type: "success", message: "E-mail de teste enviado." });
      await load();
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar o teste.",
      });
    } finally {
      setTestingId("");
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
                Configure endpoints, padrões de envio e quais plataformas podem usar cada rota.
              </p>
            </div>
            {!forbidden ? (
              <div className="flex gap-2">
                <button className="btn-secondary px-3" type="button" onClick={() => void load()} title="Atualizar">
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
                <button className="btn-primary" type="button" disabled={saving} onClick={() => void save()}>
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {forbidden ? (
          <section className="panel px-5 py-10 text-center">
            <Mail className="mx-auto mb-3 text-slate-500" size={30} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">Sem acesso à central de e-mails</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              Sua conta pode acessar o Nexus, perfil e plataformas liberadas, mas a configuração de e-mails é restrita a administradores.
            </p>
          </section>
        ) : loading ? (
          <section className="panel p-6 text-sm text-slate-300">Carregando configurações...</section>
        ) : (
          <>
            <section className="panel p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Padrão global</h2>
                  <p className="text-sm text-slate-400">Usado quando a plataforma não tiver sobrescritas próprias.</p>
                </div>
                <span className="rounded-md border border-emerald-400/25 bg-emerald-950/25 px-2 py-1 text-xs font-medium text-emerald-100">
                  {activeCount} plataforma(s) com endpoint liberado
                </span>
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
            </section>

            <section className="panel p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Endpoints</h2>
                  <p className="text-sm text-slate-400">Cada chave vira uma rota, como /api/email/equipamento-solicitado.</p>
                </div>
                <button className="btn-secondary" type="button" onClick={addEndpoint}>
                  <Plus size={16} aria-hidden="true" />
                  Novo endpoint
                </button>
              </div>

              <div className="space-y-4">
                {endpoints.map((endpoint, index) => {
                  const keyPreview = slugify(endpoint.key || endpoint.name) || "nova-chave";

                  return (
                    <article key={`${endpoint.id ?? "new"}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{endpoint.name || "Novo endpoint"}</p>
                          <p className="text-xs text-cyan-300">/api/email/{keyPreview}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <input
                              type="checkbox"
                              checked={endpoint.active}
                              onChange={(event) => updateEndpointDefinition(index, { active: event.target.checked })}
                            />
                            Ativo
                          </label>
                          <button
                            className="btn-secondary min-h-9 px-2 py-2 text-slate-400 hover:border-rose-400/45 hover:text-rose-200"
                            type="button"
                            title="Remover endpoint"
                            onClick={() => openDeleteEndpoint(endpoint, index)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nome">
                          <input
                            className="field"
                            value={endpoint.name}
                            onChange={(event) => updateEndpointDefinition(index, {
                              name: event.target.value,
                              key: endpoint.key || slugify(event.target.value),
                            })}
                          />
                        </Field>
                        <Field label="Chave" description="Usada na URL da API.">
                          <input
                            className="field"
                            value={endpoint.key}
                            onChange={(event) => updateEndpointDefinition(index, { key: slugify(event.target.value) })}
                          />
                        </Field>
                        <Field label="Descrição">
                          <input className="field" value={endpoint.description ?? ""} onChange={(event) => updateEndpointDefinition(index, { description: event.target.value })} />
                        </Field>
                        <Field label="Assunto padrão">
                          <input className="field" value={endpoint.default_subject ?? ""} onChange={(event) => updateEndpointDefinition(index, { default_subject: event.target.value })} />
                        </Field>
                        <Field label="Título padrão">
                          <input className="field" value={endpoint.default_title ?? ""} onChange={(event) => updateEndpointDefinition(index, { default_title: event.target.value })} />
                        </Field>
                        <Field label="Botão padrão">
                          <input className="field" value={endpoint.default_action_label ?? ""} onChange={(event) => updateEndpointDefinition(index, { default_action_label: event.target.value })} />
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="Mensagem padrão" description="Pode ficar vazia se a plataforma enviar a mensagem no payload.">
                            <textarea className="field min-h-24" value={endpoint.default_message ?? ""} onChange={(event) => updateEndpointDefinition(index, { default_message: event.target.value })} />
                          </Field>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {applications.map((application) => (
                <article key={application.application_id} className="panel p-5">
                  <div className="mb-5 flex items-start gap-3">
                    <ApplicationLogo name={application.application_nome} logoUrl={application.application_logo_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold text-white">{application.application_nome}</h2>
                      <p className="truncate text-xs text-slate-500">{application.application_client_id}</p>
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <button
                      className={`btn-secondary w-full justify-between sm:w-auto ${
                        getEnabledEndpointCount(application) > 0 ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : ""
                      }`}
                      type="button"
                      onClick={() => setOpenEndpointDropdown((current) => (
                        current === application.application_id ? "" : application.application_id
                      ))}
                    >
                      <span>
                        Endpoints liberados
                        {getEnabledEndpointCount(application) > 0 ? ` (${getEnabledEndpointCount(application)})` : ""}
                      </span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>

                    {openEndpointDropdown === application.application_id ? (
                      <div className="absolute left-0 z-30 mt-2 w-full max-w-md overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl shadow-slate-950/70">
                        <div className="border-b border-slate-800 px-4 py-3">
                          <p className="text-sm font-semibold text-white">Endpoints</p>
                          <p className="text-xs text-slate-400">Selecione as APIs que esta plataforma pode usar.</p>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          {endpoints.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-slate-400">Nenhum endpoint cadastrado.</p>
                          ) : endpoints.map((endpoint) => (
                            <label
                              key={endpoint.key}
                              className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900/80"
                            >
                              <input
                                className="mt-1"
                                type="checkbox"
                                checked={application.endpoints[endpoint.key] ?? false}
                                onChange={(event) => updateEndpointPermission(application.application_id, endpoint.key, event.target.checked)}
                              />
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
                    <Field label="Domínios permitidos" description="Um domínio por linha, como rarotec.com.br.">
                      <textarea
                        className="field min-h-28"
                        value={arrayToLines(application.allowed_recipient_domains)}
                        onChange={(event) => updateApplication(application.application_id, {
                          allowed_recipient_domains: linesToArray(event.target.value),
                        })}
                      />
                    </Field>
                    <Field label="Responder para" description="Opcional. Usado como Reply-To.">
                      <input className="field" value={application.reply_to_email ?? ""} onChange={(event) => updateApplication(application.application_id, { reply_to_email: event.target.value })} />
                    </Field>
                    <Field label="Nome exibido">
                      <input className="field" value={application.display_name ?? ""} onChange={(event) => updateApplication(application.application_id, { display_name: event.target.value })} />
                    </Field>
                    <Field label="Logo URL">
                      <input className="field" value={application.logo_url ?? ""} onChange={(event) => updateApplication(application.application_id, { logo_url: event.target.value })} />
                    </Field>
                    <Field label="Cor principal">
                      <input className="field h-11" type="color" value={application.primary_color || global.primary_color} onChange={(event) => updateApplication(application.application_id, { primary_color: event.target.value })} />
                    </Field>
                    <Field label="Rodapé">
                      <textarea className="field min-h-24" value={application.footer_text ?? ""} onChange={(event) => updateApplication(application.application_id, { footer_text: event.target.value })} />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/45 p-3 sm:flex-row sm:items-center">
                    <ShieldCheck size={18} className="text-cyan-300" aria-hidden="true" />
                    <input
                      className="field min-h-10 flex-1 py-2"
                      placeholder="destinatario@dominio.com"
                      value={testDraft[application.application_id] ?? ""}
                      onChange={(event) => setTestDraft((current) => ({ ...current, [application.application_id]: event.target.value }))}
                    />
                    <button
                      className="btn-secondary min-h-10 px-3 py-2"
                      type="button"
                      disabled={testingId === application.application_id}
                      onClick={() => void test(application)}
                    >
                      <Send size={15} aria-hidden="true" />
                      {testingId === application.application_id ? "Enviando..." : "Testar"}
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <section className="panel p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">Envios recentes</h2>
                <p className="text-sm text-slate-400">Auditoria técnica sem armazenar o corpo dos e-mails.</p>
              </div>
              <LogList logs={logs} />
            </section>
          </>
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
              <button
                className="btn-secondary min-h-9 px-3 py-2"
                type="button"
                onClick={() => setDeleteCandidate(null)}
                title="Fechar"
              >
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
