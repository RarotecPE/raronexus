"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeClass?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  showSearch?: boolean;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  showSearch = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = selected.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition outline-none ${
          hasSelection
            ? "border-cyan-500/50 bg-slate-900 text-cyan-300 shadow-sm shadow-cyan-500/10"
            : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white"
        }`}
      >
        <span>{label}</span>
        {hasSelection && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500/20 px-1 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
            {selected.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform duration-150 ${isOpen ? "rotate-180 text-cyan-400" : "text-slate-400"}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] max-w-[320px] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl backdrop-blur-md">
          {showSearch && options.length > 5 && (
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1 px-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] text-cyan-400 hover:underline font-medium"
            >
              Selecionar todos
            </button>
            {hasSelection && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] text-rose-400 hover:underline font-medium"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-500 italic">
                Nenhum item encontrado
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition select-none ${
                      isChecked
                        ? "bg-cyan-500/10 text-cyan-200"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition ${
                          isChecked
                            ? "border-cyan-400 bg-cyan-500 text-slate-950"
                            : "border-slate-600 bg-slate-950"
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    {opt.badge && (
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${opt.badgeClass || "bg-slate-800 text-slate-400"}`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

