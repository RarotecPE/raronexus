"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface AuditPaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  disabled?: boolean;
}

export function AuditPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  disabled = false,
}: AuditPaginationProps) {
  if (total === 0) return null;

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  // Gera a lista de números de páginas inteligentes
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      if (start > 2) pages.push("ellipsis");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between shadow-lg backdrop-blur-sm">
      {/* Informações de Contagem e Seletor de Limite */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div>
          Exibindo{" "}
          <span className="font-semibold text-white">
            {startItem} a {endItem}
          </span>{" "}
          de <span className="font-semibold text-white">{total}</span> eventos
        </div>

        <div className="flex items-center gap-2">
          <span>Exibir:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={disabled}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
          >
            <option value={15}>15 por pág.</option>
            <option value={25}>25 por pág.</option>
            <option value={50}>50 por pág.</option>
            <option value={100}>100 por pág.</option>
          </select>
        </div>
      </div>

      {/* Controles de Navegação de Página */}
      <div className="flex items-center gap-1.5 self-center sm:self-auto">
        {/* Primeira Página */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || disabled}
          title="Primeira página"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Página Anterior */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          title="Página anterior"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Números de Página */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span key={`ell-${idx}`} className="px-1 text-xs text-slate-500 select-none">
                  ...
                </span>
              );
            }
            const isActive = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                disabled={disabled}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                  isActive
                    ? "border border-cyan-500/50 bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Próxima Página */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || disabled}
          title="Próxima página"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>

        {/* Última Página */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || disabled}
          title="Última página"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

