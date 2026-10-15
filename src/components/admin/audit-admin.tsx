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

function normalizeSystemKey(raw?: string | null): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  if (lower.startsWith("rarostock")) return "rarostock";
  if (lower.startsWith("raronexus")) return "raronexus";
  if (lower.startsWith("rarogestao")) return "rarogestao";
  if (lower.startsWith("raroclients")) return "raroclients";
  if (lower.startsWith("raropay")) return "raropay";
  if (lower.startsWith("rarotickets")) return "rarotickets";
  return lower.replace(/[_-](homolog|prod|producao|dev|teste).*$/, "");
}

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
  const [actor, setActor] = useState(() => searchParams.get("actor") || "");
  const [startDate, setStartDate] = useState(
    () => searchParams.get("startDate") || searchParams.get("from") || ""
  );
  const [endDate, setEndDate] = useState(
    () => searchParams.get("endDate") || searchParams.get("to") || ""
  );
  const [selectedSystems, setSelectedSystems] = useState<string[]>(() => {
    const param = searchParams.get("systems") || searchParams.get("system");
    return param && param !== "all"
      ? param.split(",").map((s) => normalizeSystemKey(s.trim())).filter(Boolean)
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

  // Estado do painel colapsável de filtros avançados
  const [isFiltersOpen, setIsFiltersOpen] = useState(() => {
    return Boolean(
      searchParams.get("action") ||
      searchParams.get("actor") ||
      searchParams.get("startDate") ||
      searchParams.get("from") ||
      searchParams.get("endDate") ||
      searchParams.get("to") ||
      searchParams.get("systems") ||
      searchParams.get("system") ||
      searchParams.get("severities") ||
      searchParams.get("severity") ||
      searchParams.get("statuses") ||
      searchParams.get("status")
    );
  });

  // Sincroniza estados locais caso a URL mude externamente (botão voltar/avançar do navegador ou clearFilters)
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    const urlAction = searchParams.get("action") || "";
    const urlActor = searchParams.get("actor") || "";
    const urlStart = searchParams.get("startDate") || searchParams.get("from") || "";
    const urlEnd = searchParams.get("endDate") || searchParams.get("to") || "";
    const sys = searchParams.get("systems") || searchParams.get("system");
    const sev = searchParams.get("severities") || searchParams.get("severity");
    const sta = searchParams.get("statuses") || searchParams.get("status");

    setSearch((prev) => (prev !== urlSearch ? urlSearch : prev));
    setAction((prev) => (prev !== urlAction ? urlAction : prev));
    setActor((prev) => (prev !== urlActor ? urlActor : prev));
    setStartDate((prev) => (prev !== urlStart ? urlStart : prev));
    setEndDate((prev) => (prev !== urlEnd ? urlEnd : prev));

    const parsedSys = sys && sys !== "all" ? sys.split(",").map((s) => normalizeSystemKey(s.trim())).filter(Boolean) : [];
    setSelectedSystems(parsedSys);

    const parsedSev = sev && sev !== "all" ? sev.split(",").map((s) => s.trim()).filter(Boolean) : [];
    setSelectedSeverities(parsedSev);

    const parsedSta = sta && sta !== "all" ? sta.split(",").map((s) => s.trim()).filter(Boolean) : [];
    setSelectedStatuses(parsedSta);
  }, [searchParams]);

  // Consulta à API baseada nos searchParams da URL
  const fetchAuditEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      const qSearch = searchParams.get("search");
      const qAction = searchParams.get("action");
      const qActor = searchParams.get("actor");
      const qStart = searchParams.get("startDate") || searchParams.get("from");
      const qEnd = searchParams.get("endDate") || searchParams.get("to");
      const qSystems = searchParams.get("systems") || searchParams.get("system");
      const qSeverities = searchParams.get("severities") || searchParams.get("severity");
      const qStatuses = searchParams.get("statuses") || searchParams.get("status");
      const qPage = searchParams.get("page") || "1";
      const qLimit = searchParams.get("limit") || "25";

      if (qSearch?.trim()) params.set("search", qSearch.trim());
      if (qAction?.trim()) params.set("action", qAction.trim());
      if (qActor?.trim()) params.set("actor", qActor.trim());
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

  // Debounce automático para filtros de texto livre (busca geral, ação/categoria e ator)
  useEffect(() => {
    const timer = setTimeout(() => {
      const urlSearch = searchParams.get("search") || "";
      const urlAction = searchParams.get("action") || "";
      const urlActor = searchParams.get("actor") || "";

      if (
        search.trim() !== urlSearch.trim() ||
        action.trim() !== urlAction.trim() ||
        actor.trim() !== urlActor.trim()
      ) {
        const params = new URLSearchParams(searchParams.toString());
        if (search.trim()) {
          params.set("search", search.trim());
        } else {
          params.delete("search");
        }

        if (action.trim()) {
          params.set("action", action.trim());
        } else {
          params.delete("action");
        }

        if (actor.trim()) {
          params.set("actor", actor.trim());
        } else {
          params.delete("actor");
        }

        params.delete("page");
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search, action, actor, searchParams, pathname, router]);

  // Aplicação imediata dos campos de texto (ex: ao pressionar Enter)
  const flushTextFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    if (action.trim()) {
      params.set("action", action.trim());
    } else {
      params.delete("action");
    }
    if (actor.trim()) {
      params.set("actor", actor.trim());
    } else {
      params.delete("actor");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handlers reativos dinâmicos para cada filtro
  const handleSystemsChange = (newSystems: string[]) => {
    setSelectedSystems(newSystems);
    const params = new URLSearchParams(searchParams.toString());
    if (newSystems.length > 0) {
      params.set("systems", newSystems.join(","));
    } else {
      params.delete("systems");
      params.delete("system");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSeveritiesChange = (newSeverities: string[]) => {
    setSelectedSeverities(newSeverities);
    const params = new URLSearchParams(searchParams.toString());
    if (newSeverities.length > 0) {
      params.set("severities", newSeverities.join(","));
    } else {
      params.delete("severities");
      params.delete("severity");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleStatusesChange = (newStatuses: string[]) => {
    setSelectedStatuses(newStatuses);
    const params = new URLSearchParams(searchParams.toString());
    if (newStatuses.length > 0) {
      params.set("statuses", newStatuses.join(","));
    } else {
      params.delete("statuses");
      params.delete("status");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("startDate", val);
    } else {
      params.delete("startDate");
      params.delete("from");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("endDate", val);
    } else {
      params.delete("endDate");
      params.delete("to");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleLimitChange = (newLimit: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newLimit !== 25) {
      params.set("limit", String(newLimit));
    } else {
      params.delete("limit");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Limpa todos os filtros
  const clearFilters = () => {
    setSearch("");
    setAction("");
    setActor("");
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
    if (actor.trim()) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (selectedSystems.length > 0) count++;
    if (selectedSeverities.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    return count;
  }, [search, action, actor, startDate, endDate, selectedSystems, selectedSeverities, selectedStatuses]);

  // Contagem de filtros avançados (escondidos sob o botão expansível de filtros)
  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (action.trim()) count++;
    if (actor.trim()) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (selectedSystems.length > 0) count++;
    if (selectedSeverities.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    return count;
  }, [action, actor, startDate, endDate, selectedSystems, selectedSeverities, selectedStatuses]);

  // Dicionário de nomes amigáveis das plataformas (Supabase / MongoDB)
  const dynamicPlatformNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (data?.platforms) {
      for (const p of data.platforms) {
        map[p.clientId] = p.name;
      }
    }
    return map;
  }, [data?.platforms]);

  // Opções dinâmicas de plataformas
  const systemOptions: MultiSelectOption[] = useMemo(() => {
    const dynamicPlatforms = data?.platforms || [];
    if (dynamicPlatforms.length > 0) {
      return dynamicPlatforms.map((p) => ({
        value: p.clientId,
        label: p.name,
      }));
    }

    return Object.entries(SYSTEM_LABELS).map(([sys, conf]) => ({
      value: sys,
      label: conf.label,
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
              <h1 className="text-2xl font-bold tracking-tight text-white">Auditoria Unificada</h1>
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

        {/* Barra de Filtros e Busca Completa */}
        <div className="relative z-20 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md">
          {/* Linha Principal: Busca Livre + Botão de Filtros + Ações */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Input de Busca Geral */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ator, alvo, ação, e-mail, IP ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") flushTextFilters();
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Ações da Barra: Botão Filtros, Status e Limpar */}
            <div className="flex flex-wrap items-center gap-2">
              {loading && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-400 mr-1">
                  <RefreshCw size={12} className="animate-spin" />
                  <span className="hidden sm:inline">Filtrando...</span>
                </div>
              )}

              {/* Botão de Toggle do Painel de Filtros */}
              <button
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition outline-none ${
                  isFiltersOpen || advancedFiltersCount > 0
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-sm shadow-cyan-500/10"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white"
                }`}
              >
                <Filter size={14} className={advancedFiltersCount > 0 ? "text-cyan-400" : "text-slate-400"} />
                <span>Filtros</span>
                {advancedFiltersCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500/20 px-1 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
                    {advancedFiltersCount}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isFiltersOpen ? "rotate-180 text-cyan-400" : "text-slate-400"}`}
                />
              </button>

              {/* Botão Limpar Filtros */}
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                  title="Limpar todos os filtros"
                >
                  <X size={13} />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Painel Colapsável de Filtros Avançados */}
          {isFiltersOpen && (
            <div className="border-t border-slate-800/80 pt-3.5 mt-1 transition-all">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. Plataforma */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Plataforma
                  </label>
                  <MultiSelectDropdown
                    label="Todas as Plataformas"
                    options={systemOptions}
                    selected={selectedSystems}
                    onChange={handleSystemsChange}
                    showSearch
                    fullWidth
                  />
                </div>

                {/* 2. Severidade */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Severidade
                  </label>
                  <MultiSelectDropdown
                    label="Todas as Severidades"
                    options={severityOptions}
                    selected={selectedSeverities}
                    onChange={handleSeveritiesChange}
                    fullWidth
                  />
                </div>

                {/* 3. Status */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Status da Operação
                  </label>
                  <MultiSelectDropdown
                    label="Todos os Status"
                    options={statusOptions}
                    selected={selectedStatuses}
                    onChange={handleStatusesChange}
                    fullWidth
                  />
                </div>

                {/* 4. Ação / Categoria */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Ação ou Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: product.updated, auth..."
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") flushTextFilters();
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
                  />
                </div>

                {/* 5. Ator Responsável */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Ator Responsável
                  </label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Nome, e-mail, role ou ID..."
                      value={actor}
                      onChange={(e) => setActor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") flushTextFilters();
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>

                {/* 6. Período do Registro (De / Até) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={12} className="text-cyan-400" />
                    Período do Registro
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 shrink-0">De:</span>
                      <input
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]"
                        title="Data e hora inicial"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 shrink-0">Até:</span>
                      <input
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]"
                        title="Data e hora final"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabela de Eventos */}
        <div className="relative z-10 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1020px] text-left text-xs">
              <colgroup>
                <col className="w-[185px]" />
                <col className="w-[160px]" />
                <col className="w-[195px]" />
                <col className="w-[165px]" />
                <col className="w-[140px]" />
                <col className="w-[95px]" />
                <col className="w-[115px]" />
                <col className="w-[45px]" />
              </colgroup>
              <thead className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3.5 py-3 truncate">Timestamp</th>
                  <th className="px-3.5 py-3 truncate">Plataforma</th>
                  <th className="px-3.5 py-3 truncate">Ação / Categoria</th>
                  <th className="px-3.5 py-3 truncate">Ator</th>
                  <th className="px-3.5 py-3 truncate">Alvos</th>
                  <th className="px-3.5 py-3 truncate">Severidade</th>
                  <th className="px-3.5 py-3 truncate">Integridade</th>
                  <th className="px-2 py-3 text-right"></th>
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
                    const canonicalSys = normalizeSystemKey(event.system);
                    const sysConf = SYSTEM_LABELS[canonicalSys as AuditSystem] || SYSTEM_LABELS[event.system as AuditSystem];
                    const platformLabel = dynamicPlatformNames[canonicalSys] || sysConf?.label || event.system;
                    const isSuccess = event.status === "SUCCESS";

                    return (
                      <tr
                        key={event._id}
                        onClick={() => setSelectedEvent(event)}
                        className="h-14 cursor-pointer transition hover:bg-slate-800/40"
                      >
                        {/* Timestamp */}
                        <td
                          className="whitespace-nowrap px-3.5 py-2 font-mono text-[11px] text-slate-300"
                          title={formatIsoDate(event.timestamp)}
                        >
                          {formatIsoDate(event.timestamp)}
                        </td>

                        {/* Plataforma */}
                        <td className="px-3.5 py-2 overflow-hidden">
                          <span
                            className={`inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              sysConf
                                ? `${sysConf.border} ${sysConf.bg} ${sysConf.color}`
                                : "border-slate-700 bg-slate-800 text-slate-300"
                            }`}
                            title={platformLabel}
                          >
                            {platformLabel}
                          </span>
                        </td>

                        {/* Ação / Categoria */}
                        <td className="px-3.5 py-2 overflow-hidden">
                          <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                            <span className="font-semibold text-white truncate text-xs" title={event.action}>
                              {event.action}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate" title={event.category}>
                              {event.category}
                            </span>
                          </div>
                        </td>

                        {/* Ator */}
                        <td className="px-3.5 py-2 overflow-hidden">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                              <span
                                className="font-medium text-slate-200 truncate text-xs"
                                title={event.actor?.name || event.actor?.email || "Sistema"}
                              >
                                {event.actor?.name || event.actor?.email || "Sistema"}
                              </span>
                              {event.actor?.role && (
                                <span className="text-[10px] text-slate-400 truncate" title={event.actor.role}>
                                  {event.actor.role}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Alvos */}
                        <td className="px-3.5 py-2 overflow-hidden">
                          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                            {event.targets && event.targets.length > 0 ? (
                              <>
                                <span
                                  className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300 truncate max-w-[105px]"
                                  title={event.targets[0].label || `${event.targets[0].type}:${event.targets[0].id}`}
                                >
                                  {event.targets[0].label || `${event.targets[0].type}:${event.targets[0].id}`}
                                </span>
                                {event.targets.length > 1 && (
                                  <span
                                    className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400 font-mono"
                                    title={event.targets.slice(1).map((t) => t.label || `${t.type}:${t.id}`).join(", ")}
                                  >
                                    +{event.targets.length - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </div>
                        </td>

                        {/* Severidade & Status */}
                        <td className="whitespace-nowrap px-3.5 py-2 overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${
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
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                isSuccess ? "bg-emerald-400" : "bg-rose-400"
                              }`}
                              title={event.status}
                            />
                          </div>
                        </td>

                        {/* Integridade HMAC SHA-256 */}
                        <td className="whitespace-nowrap px-3.5 py-2 overflow-hidden">
                          {event.hash ? (
                            <div className="flex items-center gap-1 text-emerald-400 truncate" title={`Hash: ${event.hash}`}>
                              <Lock size={12} className="shrink-0" />
                              <span className="font-mono text-[10px] truncate">Encadeado</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 truncate">Sem hash</span>
                          )}
                        </td>

                        {/* Ação */}
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                            title="Ver detalhes completos"
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
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
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
                {(() => {
                  const modalCanonical = normalizeSystemKey(selectedEvent.system);
                  const modalSysConf = SYSTEM_LABELS[modalCanonical as AuditSystem] || SYSTEM_LABELS[selectedEvent.system as AuditSystem];
                  const modalPlatformLabel = dynamicPlatformNames[modalCanonical] || modalSysConf?.label || selectedEvent.system;

                  return (
                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-4">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500">Plataforma</span>
                        <p className={`mt-0.5 text-xs font-semibold ${modalSysConf?.color || "text-cyan-300"}`}>
                          {modalPlatformLabel}
                        </p>
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
                  );
                })()}

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

