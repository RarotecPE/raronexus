"use client";

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Filter,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Terminal,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { apiFetch } from "@/lib/api/client-fetch";
import type { AuditEnvelope, AuditSeverity, AuditStatus, AuditSystem } from "@/lib/audit/types";
import { MultiSelectDropdown, type MultiSelectOption } from "./audit-multi-select";
import { AuditPagination } from "./audit-pagination";

interface AuditResponse {
  events: AuditEnvelope[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platforms?: Array<{ clientId: string; name: string }>;
  stats: {
    totalEvents: number;
    pendingQueueCount: number;
    bySystem: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

const SYSTEM_LABELS: Record<AuditSystem, { label: string; color: string; border: string; bg: string }> = {
  raronexus: {
    label: "RaroNexus",
    color: "text-cyan-300",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
  },
  rarostock: {
    label: "RaroStock",
    color: "text-emerald-300",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  rarogestao: {
    label: "RaroGestão",
    color: "text-blue-300",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
  },
  raroclients: {
    label: "RaroClients",
    color: "text-purple-300",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
  },
  raropay: {
    label: "RaroPay",
    color: "text-amber-300",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  rarotickets: {
    label: "RaroTickets",
    color: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
  },
};

function formatIsoDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDiffValue(val: unknown): string {
  if (val === undefined) return "<não definido>";
  if (val === null) return "null";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function JsonDiffBlock({
  data,
  otherData,
  changedKeys,
  variant,
  allKeys,
}: {
  data: Record<string, unknown> | null | undefined;
  otherData: Record<string, unknown> | null | undefined;
  changedKeys: Set<string>;
  variant: "before" | "after";
  allKeys: string[];
}) {
  const isBefore = variant === "before";

  if (!data || typeof data !== "object") {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-center font-mono text-xs text-slate-500 italic">
        Snapshot não disponível
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed shadow-inner">
      <div className="select-none text-slate-600">&#123;</div>
      <div className="space-y-1 py-1">
        {allKeys.map((key, idx) => {
          const isChanged = changedKeys.has(key);
          const hasInThis = data && key in data;
          const hasInOther = otherData && key in otherData;
          const isLast = idx === allKeys.length - 1;

          if (!hasInThis && !hasInOther) return null;

          if (!hasInThis) {
            return (
              <div
                key={key}
                className="rounded border border-dashed border-slate-800 bg-slate-900/30 px-2 py-1 text-[10px] text-slate-500 italic"
              >
                &quot;{key}&quot;: &lt;{isBefore ? "não existia" : "removido"}&gt;
              </div>
            );
          }

          const val = data[key];
          const formattedVal = JSON.stringify(val, null, 2);
          const isMultiline = formattedVal.includes("\n");

          return (
            <div
              key={key}
              className={`rounded px-2 py-1 transition-all ${
                isChanged
                  ? isBefore
                    ? "border-l-4 border-rose-500 bg-rose-500/15 text-rose-100 shadow-sm"
                    : "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100 shadow-sm"
                  : "text-slate-400 opacity-60 hover:bg-slate-900/40 hover:opacity-100"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span
                  className={
                    isChanged
                      ? isBefore
                        ? "font-bold text-rose-300"
                        : "font-bold text-emerald-300"
                      : "font-medium text-cyan-400"
                  }
                >
                  &quot;{key}&quot;:
                </span>{" "}
                {isMultiline ? (
                  <pre
                    className={`mt-1 whitespace-pre-wrap break-all rounded p-2 text-[10px] ${
                      isChanged
                        ? isBefore
                          ? "border border-rose-500/30 bg-rose-950/40 text-rose-200"
                          : "border border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                        : "border border-slate-800 bg-slate-950 text-slate-300"
                    }`}
                  >
                    {formattedVal}
                  </pre>
                ) : (
                  <span
                    className={`break-all ${
                      isChanged
                        ? isBefore
                          ? "font-semibold text-rose-100"
                          : "font-semibold text-emerald-100"
                        : "text-slate-300"
                    }`}
                  >
                    {formattedVal}
                  </span>
                )}
                {!isLast && <span className="text-slate-600">,</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="select-none text-slate-600">&#125;</div>
    </div>
  );
}

export function AuditAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: SystemAlertType; message: string } | null>(null);

  // Estados dos inputs de filtro (editados antes de clicar em "Aplicar Filtros")
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [action, setAction] = useState(() => searchParams.get("action") || "");
  const [startDate, setStartDate] = useState(
    () => searchParams.get("startDate") || searchParams.get("from") || ""
  );
  const [endDate, setEndDate] = useState(
    () => searchParams.get("endDate") || searchParams.get("to") || ""
  );
  const [selectedSystems, setSelectedSystems] = useState<string[]>(() => {
    const param = searchParams.get("systems") || searchParams.get("system");
    return param && param !== "all"
      ? param.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  });
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(() => {
    const param = searchParams.get("severities") || searchParams.get("severity");
    return param && param !== "all"
      ? param.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const param = searchParams.get("statuses") || searchParams.get("status");
    return param && param !== "all"
      ? param.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  });

  // Modal / Drawer de Detalhes
  const [selectedEvent, setSelectedEvent] = useState<AuditEnvelope | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sincroniza estados dos inputs quando a URL mudar (ex: botão voltar/avançar do navegador)
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setAction(searchParams.get("action") || "");
    setStartDate(searchParams.get("startDate") || searchParams.get("from") || "");
    setEndDate(searchParams.get("endDate") || searchParams.get("to") || "");

    const sys = searchParams.get("systems") || searchParams.get("system");
    setSelectedSystems(sys && sys !== "all" ? sys.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const sev = searchParams.get("severities") || searchParams.get("severity");
    setSelectedSeverities(sev && sev !== "all" ? sev.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const sta = searchParams.get("statuses") || searchParams.get("status");
    setSelectedStatuses(sta && sta !== "all" ? sta.split(",").map((s) => s.trim()).filter(Boolean) : []);
  }, [searchParams]);

  // Consulta à API baseada nos searchParams da URL
  const fetchAuditEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      const qSearch = searchParams.get("search");
      const qAction = searchParams.get("action");
      const qStart = searchParams.get("startDate") || searchParams.get("from");
      const qEnd = searchParams.get("endDate") || searchParams.get("to");
      const qSystems = searchParams.get("systems") || searchParams.get("system");
      const qSeverities = searchParams.get("severities") || searchParams.get("severity");
      const qStatuses = searchParams.get("statuses") || searchParams.get("status");
      const qPage = searchParams.get("page") || "1";
      const qLimit = searchParams.get("limit") || "25";

      if (qSearch?.trim()) params.set("search", qSearch.trim());
      if (qAction?.trim()) params.set("action", qAction.trim());
      if (qStart?.trim()) params.set("startDate", qStart.trim());
      if (qEnd?.trim()) params.set("endDate", qEnd.trim());
      if (qSystems && qSystems !== "all") params.set("systems", qSystems);
      if (qSeverities && qSeverities !== "all") params.set("severities", qSeverities);
      if (qStatuses && qStatuses !== "all") params.set("statuses", qStatuses);
      params.set("page", qPage);
      params.set("limit", qLimit);

      const res = await apiFetch<AuditResponse>(`/api/v1/audit?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      if (!isSilent) {
        setAlert({
          type: "error",
          message: err?.message || "Erro ao carregar registros de auditoria.",
        });
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAuditEvents();
  }, [fetchAuditEvents]);

  // Aplica filtros atualizando a URL
  const applyFilters = (newPage = 1, newLimit?: number) => {
    const currentLimit = newLimit ?? (parseInt(searchParams.get("limit") || "25", 10) || 25);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (action.trim()) params.set("action", action.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedSystems.length > 0) params.set("systems", selectedSystems.join(","));
    if (selectedSeverities.length > 0) params.set("severities", selectedSeverities.join(","));
    if (selectedStatuses.length > 0) params.set("statuses", selectedStatuses.join(","));
    if (newPage > 1) params.set("page", String(newPage));
    if (currentLimit !== 25) params.set("limit", String(currentLimit));

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Limpa todos os filtros
  const clearFilters = () => {
    setSearch("");
    setAction("");
    setStartDate("");
    setEndDate("");
    setSelectedSystems([]);
    setSelectedSeverities([]);
    setSelectedStatuses([]);
    router.push(pathname, { scroll: false });
  };

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (action.trim()) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (selectedSystems.length > 0) count++;
    if (selectedSeverities.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    return count;
  }, [search, action, startDate, endDate, selectedSystems, selectedSeverities, selectedStatuses]);

  // Opções dinâmicas de plataformas
  const systemOptions: MultiSelectOption[] = useMemo(() => {
    const dynamicPlatforms = data?.platforms || [];
    if (dynamicPlatforms.length > 0) {
      return dynamicPlatforms.map((p) => {
        const conf = SYSTEM_LABELS[p.clientId as AuditSystem];
        return {
          value: p.clientId,
          label: p.name,
          badge: conf ? conf.label : p.clientId,
          badgeClass: conf
            ? `${conf.border} ${conf.bg} ${conf.color} border`
            : "border border-slate-700 bg-slate-800 text-slate-300",
        };
      });
    }

    return Object.entries(SYSTEM_LABELS).map(([sys, conf]) => ({
      value: sys,
      label: conf.label,
      badge: conf.label,
      badgeClass: `${conf.border} ${conf.bg} ${conf.color} border`,
    }));
  }, [data?.platforms]);

  const severityOptions: MultiSelectOption[] = [
    { value: "INFO", label: "INFO", badge: "INFO", badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
    { value: "WARNING", label: "WARNING", badge: "WARN", badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
    { value: "CRITICAL", label: "CRITICAL", badge: "CRIT", badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-500/30" },
  ];

  const statusOptions: MultiSelectOption[] = [
    { value: "SUCCESS", label: "Sucesso", badge: "OK", badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
    { value: "FAILURE", label: "Falha", badge: "ERRO", badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-500/30" },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const page = data?.page ?? (parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = data?.limit ?? (parseInt(searchParams.get("limit") || "25", 10) || 25);
  const stats = data?.stats;

  const changedKeysSet = useMemo(() => {
    if (!selectedEvent) return new Set<string>();
    if (selectedEvent.changes && selectedEvent.changes.length > 0) {
      return new Set(selectedEvent.changes.map((c) => c.field));
    }
    const before = selectedEvent.diff?.before || {};
    const after = selectedEvent.diff?.after || {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffs = new Set<string>();
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        diffs.add(k);
      }
    }
    return diffs;
  }, [selectedEvent]);

  const allDiffKeys = useMemo(() => {
    if (!selectedEvent?.diff) return [];
    const beforeKeys = Object.keys(selectedEvent.diff.before || {});
    const afterKeys = Object.keys(selectedEvent.diff.after || {});
    return Array.from(new Set([...beforeKeys, ...afterKeys]));
  }, [selectedEvent]);

  return (
    <AppShell title="Auditoria">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Cabeçalho da Página */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Auditoria Unificada</h1>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                  Atlas & Redis
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Trilha centralizada de integridade criptográfica, conformidade LGPD e ações em todo o ecossistema RAROTEC.
              </p>
            </div>
          </div>

          {/* Ações Globais */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAuditEvents()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
              Atualizar
            </button>
          </div>
        </header>

        {alert && (
          <SystemAlert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}

        {/* Cards de Métricas e KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Total Persistido</span>
              <Database size={16} className="text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {stats?.totalEvents ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Coleção audit_events (MongoDB)</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Fila Upstash Redis</span>
              <Activity size={16} className={stats?.pendingQueueCount ? "text-amber-400" : "text-emerald-400"} />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {stats?.pendingQueueCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Stream buffer pendente</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Por Sistema</span>
              <Layers size={16} className="text-blue-400" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(stats?.bySystem || {}).map(([sys, count]) => {
                const conf = SYSTEM_LABELS[sys as AuditSystem];
                return (
                  <span
                    key={sys}
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${conf ? conf.border + " " + conf.bg + " " + conf.color : "border-slate-700 bg-slate-800 text-slate-300"}`}
                  >
                    {conf?.label || sys}: {count}
                  </span>
                );
              })}
              {Object.keys(stats?.bySystem || {}).length === 0 && (
                <span className="text-xs text-slate-500">Nenhum evento</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Severidade</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                INFO: {stats?.bySeverity?.INFO ?? 0}
              </span>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">
                WARN: {stats?.bySeverity?.WARNING ?? 0}
              </span>
              <span className="rounded bg-rose-500/15 px-2 py-0.5 text-rose-300">
                CRIT: {stats?.bySeverity?.CRITICAL ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca Completa */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md">
          {/* Linha 1: Busca Livre + Multi-seletores Dropdown */}
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ator, alvo, ação, e-mail, IP ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters(1);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Multi-Select Plataformas / Sistemas */}
              <MultiSelectDropdown
                label="Sistemas"
                options={systemOptions}
                selected={selectedSystems}
                onChange={setSelectedSystems}
                showSearch
              />

              {/* Multi-Select Severidade */}
              <MultiSelectDropdown
                label="Severidade"
                options={severityOptions}
                selected={selectedSeverities}
                onChange={setSelectedSeverities}
              />

              {/* Multi-Select Status */}
              <MultiSelectDropdown
                label="Status"
                options={statusOptions}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </div>
          </div>

          {/* Linha 2: Período (Data/Hora De / Até), Filtro Ação/Categoria e Botões de Ação */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-800/80 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Período (Data Inicial e Final com Horário) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={13} className="text-cyan-400" />
                  <span>De:</span>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Até:</span>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Filtro Ação / Categoria (texto livre) */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-[220px]">
                <span className="shrink-0">Ação / Categoria:</span>
                <input
                  type="text"
                  placeholder="Ex: product.updated, inventory..."
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters(1);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Botões Aplicar Filtros e Limpar */}
            <div className="flex items-center gap-2 self-end lg:self-auto">
              {activeFiltersCount > 0 && (
                <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-md">
                  {activeFiltersCount} {activeFiltersCount === 1 ? "filtro ativo" : "filtros ativos"}
                </span>
              )}

              <button
                type="button"
                onClick={() => applyFilters(1)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition disabled:opacity-50"
              >
                <Filter size={13} />
                Aplicar Filtros
              </button>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                  title="Limpar todos os filtros"
                >
                  <X size={13} />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Eventos */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Sistema</th>
                  <th className="px-4 py-3.5">Ação / Categoria</th>
                  <th className="px-4 py-3.5">Ator</th>
                  <th className="px-4 py-3.5">Alvos</th>
                  <th className="px-4 py-3.5">Severidade</th>
                  <th className="px-4 py-3.5">Integridade</th>
                  <th className="px-4 py-3.5 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-cyan-400" />
                        <span>Carregando trilha de auditoria...</span>
                      </div>
                    </td>
                  </tr>
                ) : data?.events && data.events.length > 0 ? (
                  data.events.map((event) => {
                    const sysConf = SYSTEM_LABELS[event.system as AuditSystem];
                    const isSuccess = event.status === "SUCCESS";

                    return (
                      <tr
                        key={event._id}
                        onClick={() => setSelectedEvent(event)}
                        className="cursor-pointer transition hover:bg-slate-800/40"
                      >
                        {/* Timestamp */}
                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-300">
                          {formatIsoDate(event.timestamp)}
                        </td>

                        {/* Sistema */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              sysConf
                                ? `${sysConf.border} ${sysConf.bg} ${sysConf.color}`
                                : "border-slate-700 bg-slate-800 text-slate-300"
                            }`}
                          >
                            {sysConf?.label || event.system}
                          </span>
                        </td>

                        {/* Ação / Categoria */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{event.action}</span>
                            <span className="text-[10px] text-slate-400">{event.category}</span>
                          </div>
                        </td>

                        {/* Ator */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-200">
                                {event.actor?.name || event.actor?.email || "Sistema"}
                              </span>
                              {event.actor?.role && (
                                <span className="text-[10px] text-slate-400">
                                  {event.actor.role}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Alvos */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {event.targets && event.targets.length > 0 ? (
                              event.targets.slice(0, 2).map((t, idx) => (
                                <span
                                  key={idx}
                                  className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300"
                                >
                                  {t.label || `${t.type}:${t.id}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                            {event.targets && event.targets.length > 2 && (
                              <span className="rounded bg-slate-800 px-1 text-[10px] text-slate-400">
                                +{event.targets.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Severidade & Status */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                event.severity === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : event.severity === "WARNING"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-slate-700/50 text-slate-300"
                              }`}
                            >
                              {event.severity}
                            </span>
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSuccess ? "bg-emerald-400" : "bg-rose-400"
                              }`}
                              title={event.status}
                            />
                          </div>
                        </td>

                        {/* Integridade HMAC SHA-256 */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {event.hash ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Lock size={12} />
                              <span className="font-mono text-[10px]">Encadeado</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">Sem hash</span>
                          )}
                        </td>

                        {/* Ação */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                      Nenhum evento de auditoria encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé Informativo */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-2.5 text-xs text-slate-400">
            <span>
              Página <strong>{page}</strong> de <strong>{data?.totalPages ?? 1}</strong> ({data?.total ?? 0} registros encontrados)
            </span>
            <span className="text-[11px] text-slate-500">
              Retenção garantida no MongoDB Atlas Cluster0 (São Paulo)
            </span>
          </div>
        </div>

        {/* Paginação Server-Side */}
        <AuditPagination
          page={page}
          limit={limit}
          total={data?.total ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={(newPage) => applyFilters(newPage, limit)}
          onLimitChange={(newLimit) => applyFilters(1, newLimit)}
          disabled={loading}
        />

        {/* Modal / Drawer com Detalhes do Evento */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Evento de Auditoria: {selectedEvent.action}
                    </h2>
                    <p className="font-mono text-xs text-slate-400">ID: {selectedEvent._id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(selectedEvent, null, 2), selectedEvent._id)
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                  >
                    {copiedId === selectedEvent._id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedId === selectedEvent._id ? "Copiado!" : "Copiar JSON"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Corpo do Modal com Abas / Seções */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Metadados Principais */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-4">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Sistema</span>
                    <p className="mt-0.5 text-xs font-semibold text-cyan-300">{selectedEvent.system}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Severidade</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-200">{selectedEvent.severity}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Status</span>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-400">{selectedEvent.status}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Timestamp</span>
                    <p className="mt-0.5 font-mono text-xs text-slate-300">
                      {formatIsoDate(selectedEvent.timestamp)}
                    </p>
                  </div>
                </div>

                {/* Ator e Contexto */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                      <User size={14} /> Ator Responsável
                    </h3>
                    <div className="space-y-1 text-xs">
                      <p className="text-white font-medium">{selectedEvent.actor?.name || "N/A"}</p>
                      <p className="text-slate-400 font-mono">{selectedEvent.actor?.email || "Sem e-mail"}</p>
                      <p className="text-slate-400">Role: {selectedEvent.actor?.role || "user"}</p>
                      <p className="text-slate-500 font-mono text-[11px]">ID: {selectedEvent.actor?.userId || "N/A"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                      <Terminal size={14} /> Contexto da Requisição
                    </h3>
                    <div className="space-y-1 text-xs">
                      <p className="text-slate-300">
                        IP: <span className="font-mono text-cyan-300">{selectedEvent.context?.ip || "Desconhecido"}</span>
                      </p>
                      <p className="text-slate-400 truncate" title={selectedEvent.context?.userAgent || ""}>
                        User-Agent: {selectedEvent.context?.userAgent || "N/A"}
                      </p>
                      {selectedEvent.ingestedAt && (
                        <p className="text-slate-400">
                          Ingestão: <span className="font-mono text-[11px]">{formatIsoDate(selectedEvent.ingestedAt)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Alvos da Ação */}
                {selectedEvent.targets && selectedEvent.targets.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                      Alvos Afetados ({selectedEvent.targets.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.targets.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white"
                        >
                          <span className="text-cyan-400 font-mono text-[11px]">{t.type}</span>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">#{t.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prova Criptográfica de Imutabilidade */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                      <Lock size={14} className="text-emerald-400" /> Integridade Criptográfica (HMAC SHA-256)
                    </h3>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Cadeia Válida
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Hash do Evento:</span>
                      <span className="text-emerald-300 break-all">{selectedEvent.hash || "Não assinado"}</span>
                    </div>
                    {selectedEvent.prevHash && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Hash Anterior:</span>
                        <span className="text-slate-400 break-all">{selectedEvent.prevHash}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rastreamento de Alterações (Antes vs Depois) */}
                {(selectedEvent.diff || (selectedEvent.changes && selectedEvent.changes.length > 0)) && (
                  <div className="rounded-xl border border-cyan-500/30 bg-slate-900/60 p-4 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 p-1.5 text-cyan-400">
                          <ArrowRightLeft size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                            Alterações de Estado (Antes vs Depois)
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Campos alterados destacados com comparação lado a lado
                          </p>
                        </div>
                      </div>
                      {changedKeysSet.size > 0 && (
                        <span className="self-start sm:self-auto rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                          {changedKeysSet.size} {changedKeysSet.size === 1 ? "campo modificado" : "campos modificados"}
                        </span>
                      )}
                    </div>

                    {/* Tabela de Campos Modificados */}
                    {selectedEvent.changes && selectedEvent.changes.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-semibold uppercase text-slate-400">
                            <tr>
                              <th className="px-3.5 py-2.5">Campo Alterado</th>
                              <th className="px-3.5 py-2.5">Tipo</th>
                              <th className="px-3.5 py-2.5 text-rose-300">Antes (Original)</th>
                              <th className="px-3.5 py-2.5 text-emerald-300">Depois (Novo)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {selectedEvent.changes.map((change, idx) => {
                              const isAdded = change.before === undefined;
                              const isRemoved = change.after === undefined;

                              return (
                                <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="px-3.5 py-2.5">
                                    <span className="inline-block rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-300">
                                      {change.field}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <span
                                      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                        isAdded
                                          ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                          : isRemoved
                                            ? "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                                            : "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                                      }`}
                                    >
                                      {isAdded ? "Adicionado" : isRemoved ? "Removido" : "Modificado"}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 bg-rose-500/5">
                                    <div className="flex items-center gap-1.5 text-rose-300">
                                      <span className="font-bold text-rose-500 select-none">-</span>
                                      <span className="break-all font-medium line-through opacity-85">
                                        {formatDiffValue(change.before)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5 bg-emerald-500/5">
                                    <div className="flex items-center gap-1.5 text-emerald-300">
                                      <span className="font-bold text-emerald-400 select-none">+</span>
                                      <span className="break-all font-semibold">
                                        {formatDiffValue(change.after)}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Snapshots JSON Completos (Antes e Depois) com destaque nos campos alterados */}
                    {selectedEvent.diff && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Snapshots JSON Lado a Lado
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Linhas com <span className="font-bold text-rose-400">borda vermelha</span> e{" "}
                            <span className="font-bold text-emerald-400">borda verde</span> destacam os campos modificados
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Coluna Antes */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Snapshot JSON Antes:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    JSON.stringify(selectedEvent.diff?.before, null, 2),
                                    "before"
                                  )
                                }
                                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 transition"
                              >
                                {copiedId === "before" ? (
                                  <>
                                    <Check size={11} className="text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <JsonDiffBlock
                              data={selectedEvent.diff.before}
                              otherData={selectedEvent.diff.after}
                              changedKeys={changedKeysSet}
                              variant="before"
                              allKeys={allDiffKeys}
                            />
                          </div>

                          {/* Coluna Depois */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Snapshot JSON Depois:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    JSON.stringify(selectedEvent.diff?.after, null, 2),
                                    "after"
                                  )
                                }
                                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 transition"
                              >
                                {copiedId === "after" ? (
                                  <>
                                    <Check size={11} className="text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <JsonDiffBlock
                              data={selectedEvent.diff.after}
                              otherData={selectedEvent.diff.before}
                              changedKeys={changedKeysSet}
                              variant="after"
                              allKeys={allDiffKeys}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payload Detalhado (JSON) */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                    Detalhes do Payload & Sanitização LGPD
                  </h3>
                  <pre className="max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-200">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

