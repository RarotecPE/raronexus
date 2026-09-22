"use client";

import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { lintGutter, linter } from "@codemirror/lint";
import {
  ArrowLeft,
  Braces,
  Check,
  Clipboard,
  FileJson,
  Globe2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SystemAlert, type SystemAlertType } from "@/components/ui/system-alert";
import { ApiFetchError, apiFetch } from "@/lib/api/client-fetch";
import { MAX_CONSTANT_BYTES } from "@/lib/api/validators/constant";
import type { ApiConstantDetail, ApiConstantSummary } from "@/lib/api/constant-types";

type AlertState = { type: SystemAlertType; message: string } | null;
type EditorState = ApiConstantDetail & { isNew: boolean };
type Confirmation = "save" | "delete" | null;

const EMPTY_CONTENT = "{\n  \n}";

function createEditor(): EditorState {
  return {
    id: "",
    name: "",
    is_public: false,
    current_version: 1,
    content_hash: "",
    original_size: 0,
    compressed_size: 0,
    created_at: "",
    updated_at: "",
    content: EMPTY_CONTENT,
    isNew: true,
  };
}

function snapshot(editor: EditorState | null) {
  if (!editor) return "";
  return JSON.stringify({
    name: editor.name,
    is_public: editor.is_public,
    content: editor.content,
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string) {
  if (!value) return "Ainda não salva";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getJsonError(content: string) {
  if (!content.trim()) return "O JSON não pode ficar vazio.";
  try {
    JSON.parse(content);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON inválido.";
    const match = message.match(/(?:position|posição)\s+(\d+)/i);
    if (!match) return message;
    const position = Number(match[1]);
    const before = content.slice(0, position);
    const lines = before.split("\n");
    return `${message} Linha ${lines.length}, coluna ${(lines.at(-1)?.length ?? 0) + 1}.`;
  }
}

function ConfirmModal({
  editor,
  kind,
  value,
  busy,
  warnRename,
  warnPublicCache,
  onValueChange,
  onCancel,
  onConfirm,
}: {
  editor: EditorState;
  kind: Exclude<Confirmation, null>;
  value: string;
  busy: boolean;
  warnRename: boolean;
  warnPublicCache: boolean;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="constant-confirm-title"
        className="panel flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden shadow-2xl"
      >
        <header className="shrink-0 border-b border-slate-800 px-5 py-4">
          <h2 id="constant-confirm-title" className="text-lg font-semibold text-white">
            {kind === "delete" ? "Excluir constante?" : "Confirmar alteração sensível"}
          </h2>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm text-slate-300">
          {kind === "delete" ? (
            <>
              <p>Essa operação remove todas as versões e não pode ser desfeita.</p>
              <label className="block">
                <span className="mb-2 block">Digite <strong>{editor.name}</strong> para confirmar.</span>
                <input className="field" autoFocus value={value} onChange={(event) => onValueChange(event.target.value)} />
              </label>
            </>
          ) : (
            <>
              {warnRename ? (
                <p>A URL anterior deixará de funcionar assim que o novo nome for salvo. URLs versionadas continuam válidas durante o período de retenção.</p>
              ) : null}
              {warnPublicCache ? (
                <p>Cópias públicas já armazenadas em cache podem permanecer disponíveis por até 15 dias.</p>
              ) : null}
            </>
          )}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-800 bg-slate-950/75 px-5 py-4">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className={kind === "delete" ? "inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50" : "btn-primary"}
            disabled={busy || (kind === "delete" && value !== editor.name)}
            onClick={onConfirm}
          >
            {kind === "delete" ? <Trash2 size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            {busy ? "Processando..." : kind === "delete" ? "Excluir" : "Confirmar e salvar"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ConstantsAdmin() {
  const [constants, setConstants] = useState<ApiConstantSummary[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [origin, setOrigin] = useState("");
  const [lightTheme, setLightTheme] = useState(false);

  const dirty = editor ? snapshot(editor) !== savedSnapshot : false;
  const jsonError = editor ? getJsonError(editor.content) : null;
  const apiUrl = editor?.name ? `${origin}/api/constants/${editor.name}` : "";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? constants.filter((item) => item.name.includes(term)) : constants;
  }, [constants, search]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ApiConstantSummary[]>("/api/v1/constants", { cache: "no-store" });
      setConstants(data);
      setForbidden(false);
    } catch (error) {
      if (error instanceof ApiFetchError && error.status === 403) {
        setForbidden(true);
      } else {
        setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível carregar as constantes." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateTheme = () => setLightTheme(document.body.classList.contains("theme-light"));
    const initialLoad = window.setTimeout(() => {
      void loadList();
      setOrigin(window.location.origin);
      updateTheme();
    }, 0);
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.clearTimeout(initialLoad);
      observer.disconnect();
    };
  }, [loadList]);

  useEffect(() => {
    function saveShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editor && dirty && !jsonError && !busy) requestSave();
      }
    }
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  });

  async function selectConstant(id: string) {
    if (dirty && !window.confirm("Existem alterações não salvas. Deseja descartá-las?")) return;
    setDetailLoading(true);
    try {
      const detail = await apiFetch<ApiConstantDetail>(`/api/v1/constants/${id}`, { cache: "no-store" });
      const next = { ...detail, isNew: false };
      setEditor(next);
      setSavedSnapshot(snapshot(next));
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível abrir a constante." });
    } finally {
      setDetailLoading(false);
    }
  }

  function newConstant() {
    if (dirty && !window.confirm("Existem alterações não salvas. Deseja descartá-las?")) return;
    const next = createEditor();
    setEditor(next);
    setSavedSnapshot(snapshot(next));
  }

  function requestSave() {
    if (!editor || jsonError || !editor.name.trim()) return;
    const original = constants.find((item) => item.id === editor.id);
    const sensitive = Boolean(original && (
      original.name !== editor.name ||
      (original.is_public && !editor.is_public)
    ));
    if (sensitive) {
      setConfirmationValue(original?.name ?? "");
      setConfirmation("save");
    } else {
      void save();
    }
  }

  async function save() {
    if (!editor || jsonError) return;
    setBusy(true);
    try {
      const detail = editor.isNew
        ? await apiFetch<ApiConstantDetail>("/api/v1/constants", {
            method: "POST",
            body: JSON.stringify({ name: editor.name, is_public: editor.is_public, content: editor.content }),
          })
        : await apiFetch<ApiConstantDetail>(`/api/v1/constants/${editor.id}`, {
            method: "PUT",
            body: JSON.stringify({
              name: editor.name,
              is_public: editor.is_public,
              content: editor.content,
              expected_version: editor.current_version,
              expected_updated_at: editor.updated_at,
            }),
          });
      const next = { ...detail, isNew: false };
      setEditor(next);
      setSavedSnapshot(snapshot(next));
      setConfirmation(null);
      setConfirmationValue("");
      setAlert({ type: "success", message: editor.isNew ? "Constante criada com sucesso." : "Nova versão publicada com sucesso." });
      await loadList();
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar a constante." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editor || editor.isNew) return;
    setBusy(true);
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/constants/${editor.id}`, { method: "DELETE" });
      setEditor(null);
      setSavedSnapshot("");
      setConfirmation(null);
      setConfirmationValue("");
      setAlert({ type: "success", message: "Constante excluída com sucesso." });
      await loadList();
    } catch (error) {
      setAlert({ type: "error", message: error instanceof Error ? error.message : "Não foi possível excluir a constante." });
    } finally {
      setBusy(false);
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    function preventDefaults(e: DragEvent) {
      e.preventDefault();
    }
    window.addEventListener("dragover", preventDefaults);
    window.addEventListener("drop", preventDefaults);
    return () => {
      window.removeEventListener("dragover", preventDefaults);
      window.removeEventListener("drop", preventDefaults);
    };
  }, []);

  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function processJsonFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setAlert({
        type: "error",
        message: `O arquivo "${file.name}" não é um arquivo JSON válido (.json).`,
      });
      return;
    }

    if (file.size > MAX_CONSTANT_BYTES) {
      setAlert({
        type: "error",
        message: `O arquivo "${file.name}" tem ${(file.size / 1024 / 1024).toFixed(1)} MB e excede o limite máximo de 10 MB.`,
      });
      return;
    }

    try {
      const text = await file.text();
      const cleanFileName = file.name
        .replace(/\.json$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, "")
        .slice(0, 80);

      setEditor((prev) => {
        const base = prev ?? createEditor();
        const nextName = base.isNew && !base.name.trim() ? cleanFileName : base.name;
        return {
          ...base,
          name: nextName,
          content: text,
        };
      });

      setAlert({
        type: "success",
        message: `Arquivo "${file.name}" importado com sucesso (${formatBytes(file.size)}).`,
      });
    } catch {
      setAlert({
        type: "error",
        message: `Não foi possível ler o arquivo "${file.name}".`,
      });
    }
  }

  async function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await processJsonFile(file);
    } finally {
      event.target.value = "";
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processJsonFile(file);
    }
  }

  function formatJson() {
    if (!editor || jsonError) return;
    setEditor({ ...editor, content: JSON.stringify(JSON.parse(editor.content), null, 2) });
  }

  async function copyUrl() {
    if (!apiUrl) return;
    await navigator.clipboard.writeText(apiUrl);
    setAlert({ type: "success", message: "URL copiada." });
  }

  return (
    <AppShell title="Constantes">
      {alert ? <SystemAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {forbidden ? (
        <section className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <ShieldAlert className="mb-4 text-amber-300" size={34} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">Sem acesso à central de constantes</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">Somente administradores do RaroNexus podem gerenciar constantes.</p>
        </section>
      ) : (
        <div
          className="relative grid min-h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-400 bg-slate-950/85 backdrop-blur-sm transition-all">
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10">
                  <Upload size={32} className="animate-bounce" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Solte o arquivo JSON aqui
                </h3>
                <p className="max-w-sm text-sm text-slate-300">
                  O conteúdo será importado diretamente para o editor de constantes (limite de 10 MB).
                </p>
              </div>
            </div>
          ) : null}
          <aside className={`panel min-h-0 p-3 ${editor ? "hidden lg:flex" : "flex"} flex-col`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-white">Constantes</h2>
                <p className="text-xs text-slate-500">{constants.length} cadastrada(s)</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary !min-h-10 !px-3" onClick={() => void loadList()} title="Atualizar">
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
                <button type="button" className="btn-primary !min-h-10 !px-3" onClick={newConstant} title="Nova constante">
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true" />
              <input className="field !pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." />
            </label>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {loading ? <p className="p-3 text-sm text-slate-500">Carregando...</p> : null}
              {!loading && filtered.length === 0 ? <p className="p-3 text-sm text-slate-500">Nenhuma constante encontrada.</p> : null}
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void selectConstant(item.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${editor?.id === item.id ? "border-cyan-400/50 bg-cyan-500/10" : "border-slate-800 bg-slate-950/45 hover:border-cyan-400/30 hover:bg-slate-900/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="break-all text-sm font-semibold text-white">{item.name}</span>
                    {item.is_public ? <Globe2 size={15} className="shrink-0 text-emerald-300" aria-label="Pública" /> : <LockKeyhole size={15} className="shrink-0 text-amber-300" aria-label="Privada" />}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">v{item.current_version} · {formatBytes(item.original_size)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.updated_at)}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className={`panel min-h-0 overflow-hidden ${editor ? "flex" : "hidden lg:flex"} flex-col`}>
            {!editor ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <FileJson className="mb-4 text-cyan-300" size={36} aria-hidden="true" />
                <h2 className="font-semibold text-white">Selecione ou crie uma constante</h2>
                <p className="mt-2 text-sm text-slate-500">O conteúdo JSON ficará compactado no storage privado.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Carregando conteúdo...</div>
            ) : (
              <>
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" className="btn-secondary !min-h-9 !px-2 lg:hidden" onClick={() => setEditor(null)} title="Voltar à lista">
                      <ArrowLeft size={16} aria-hidden="true" />
                    </button>
                    <Braces className="shrink-0 text-cyan-300" size={20} aria-hidden="true" />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-white">{editor.isNew ? "Nova constante" : editor.name}</h2>
                      <p className="text-xs text-slate-500">{editor.isNew ? "Ainda não publicada" : `Versão ${editor.current_version}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!editor.isNew ? (
                      <button type="button" className="btn-secondary !min-h-10 !px-3 text-rose-300" onClick={() => { setConfirmationValue(""); setConfirmation("delete"); }} title="Excluir constante">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button type="button" className="btn-primary !min-h-10" disabled={!dirty || Boolean(jsonError) || !editor.name.trim() || busy} onClick={requestSave}>
                      <Save size={16} aria-hidden="true" />
                      Salvar
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-slate-200">Nome na API</span>
                      <input
                        className="field font-mono"
                        value={editor.name}
                        onChange={(event) => setEditor({ ...editor, name: event.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "") })}
                        placeholder="exemplo: stock-categories"
                        maxLength={80}
                      />
                    </label>
                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold text-slate-200">Visibilidade</legend>
                      <div className="flex rounded-lg border border-slate-700 bg-slate-950/45 p-1">
                        <button type="button" className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${!editor.is_public ? "bg-amber-500/15 text-amber-200" : "text-slate-400 hover:text-white"}`} onClick={() => setEditor({ ...editor, is_public: false })}>
                          Privada
                        </button>
                        <button type="button" className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${editor.is_public ? "bg-emerald-500/15 text-emerald-200" : "text-slate-400 hover:text-white"}`} onClick={() => setEditor({ ...editor, is_public: true })}>
                          Pública
                        </button>
                      </div>
                    </fieldset>
                  </div>

                  <div>
                    <span className="mb-1 block text-sm font-semibold text-slate-200">URL da API</span>
                    <div className="flex gap-2">
                      <input className="field min-w-0 font-mono text-xs" readOnly value={apiUrl || "/api/constants/{nome}"} />
                      <button type="button" className="btn-secondary shrink-0 !px-3" disabled={!apiUrl} onClick={() => void copyUrl()} title="Copiar URL">
                        <Clipboard size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">Conteúdo JSON</h3>
                      <p className="text-xs text-slate-500">Aceita qualquer raiz JSON válida. Limite de 10 MB.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleFileImport}
                      />
                      <button
                        type="button"
                        className="btn-secondary !min-h-9 !px-3 text-xs"
                        onClick={triggerImport}
                        title="Importar arquivo .json"
                      >
                        <Upload size={15} aria-hidden="true" />
                        Importar JSON
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !min-h-9 !px-3 text-xs"
                        disabled={Boolean(jsonError)}
                        onClick={formatJson}
                        title="Formatar indentação do JSON"
                      >
                        <WandSparkles size={15} aria-hidden="true" />
                        Formatar
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    <CodeMirror
                      value={editor.content}
                      height="min(56vh, 620px)"
                      minHeight="360px"
                      theme={lightTheme ? "light" : "dark"}
                      extensions={[json(), linter(jsonParseLinter()), lintGutter()]}
                      onChange={(content) => setEditor({ ...editor, content })}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        highlightActiveLine: true,
                        highlightActiveLineGutter: true,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className={jsonError ? "text-rose-300" : "text-emerald-300"}>
                      {jsonError ?? "JSON válido"}
                    </p>
                    <p className="text-slate-500">
                      Atual: {formatBytes(new TextEncoder().encode(editor.content).length)}
                      {!editor.isNew ? ` · Compactado: ${formatBytes(editor.compressed_size)} · Atualizado em ${formatDate(editor.updated_at)}` : ""}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {confirmation && editor ? (
        <ConfirmModal
          editor={editor}
          kind={confirmation}
          value={confirmationValue}
          busy={busy}
          warnRename={Boolean(!editor.isNew && constants.find((item) => item.id === editor.id)?.name !== editor.name)}
          warnPublicCache={Boolean(!editor.isNew && constants.find((item) => item.id === editor.id)?.is_public && !editor.is_public)}
          onValueChange={setConfirmationValue}
          onCancel={() => { setConfirmation(null); setConfirmationValue(""); }}
          onConfirm={() => confirmation === "delete" ? void remove() : void save()}
        />
      ) : null}
    </AppShell>
  );
}
