"use client";

import Link from "next/link";
import {
  AppWindow,
  Braces,
  ChevronDown,
  ExternalLink,
  Code2,
  Grid2X2,
  Home,
  LogOut,
  Mail,
  UserRound,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUserRole } from "@/components/auth/user-role-provider";
import { ApplicationLogo } from "@/components/applications/application-logo";
import { BrandMark } from "@/components/layout/brand-mark";
import { InstallPromptCard } from "@/components/pwa/install-prompt-card";
import { ThemeToggleButton } from "@/components/theme/theme-toggle-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiFetch, isAuthFetchError } from "@/lib/api/client-fetch";
import type { ApplicationResponseDTO, UserResponseDTO } from "@/lib/api/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type HeaderMenu = "applications" | "account" | null;

const navigationItems = [
  { label: "Início", href: "/home", icon: Home, adminOnly: false },
  { label: "Plataformas", href: "/applications", icon: AppWindow, adminOnly: false },
  { label: "Usuários", href: "/admin/users", icon: UsersRound, adminOnly: true },
];

const apiNavigationItems = [
  { label: "E-mails", href: "/admin/emails/global", icon: Mail },
  { label: "Constantes", href: "/admin/constants", icon: Braces },
];

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { cachedRole, setCachedRole } = useUserRole();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const apiMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileApiMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<UserResponseDTO | null>(null);
  const [applications, setApplications] = useState<ApplicationResponseDTO[]>([]);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [apiMenuOpen, setApiMenuOpen] = useState(false);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  const redirectToLogin = useCallback(async () => {
    setCachedRole(null);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router, setCachedRole]);

  useEffect(() => {
    let active = true;

    apiFetch<UserResponseDTO>("/api/v1/users/me")
      .then((loadedUser) => {
        if (!active) return;
        setUser(loadedUser);
        const admin = Boolean(loadedUser.is_admin);
        setIsAdmin(admin);
        setCachedRole(admin ? "admin" : "user");
        setCheckingSession(false);
      })
      .catch((error) => {
        if (!active) return;
        if (isAuthFetchError(error)) {
          void redirectToLogin();
          return;
        }
        setUser(null);
        setIsAdmin(false);
        setCachedRole(null);
        setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [redirectToLogin, setCachedRole]);

  const loadApplications = useCallback(async () => {
    setAppsLoading(true);
    setAppsError("");

    try {
      const loadedApplications = await apiFetch<ApplicationResponseDTO[]>("/api/v1/applications");
      setApplications(
        loadedApplications.filter(
          (application) => application.homepage_url && application.client_id !== "raronexus",
        ),
      );
    } catch {
      setApplications([]);
      setAppsError("Não foi possível carregar os aplicativos.");
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!openMenu) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!apiMenuOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (apiMenuRef.current?.contains(target) || mobileApiMenuRef.current?.contains(target)) return;
      setApiMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setApiMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [apiMenuOpen]);

  async function signOut() {
    setCachedRole(null);
    const supabase = createBrowserSupabaseClient();
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    await supabase.auth.signOut();
    router.push("/login");
  }

  const apiNavigationActive = apiNavigationItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const displayName = user?.nome || user?.email || "Usuário";
  const roleLabel = isAdmin ? "Administrador" : "Usuário";
  const showAdminButtons = checkingSession ? cachedRole === "admin" : isAdmin;
  const visibleNavigationItems = navigationItems.filter(
    (item) => !item.adminOnly || showAdminButtons,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f3b68_0,#020617_36%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-5">
        <header className="relative z-30 mb-6 grid grid-cols-[auto_1fr] items-center gap-4 border-b border-cyan-400/15 pb-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Link href="/home" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="hidden text-base font-semibold text-slate-200 sm:block">
              {title}
            </span>
          </Link>

          <nav className="absolute left-1/2 top-1/2 z-30 hidden -translate-x-1/2 -translate-y-1/2 flex-wrap justify-center gap-2 lg:flex">
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (checkingSession) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    aria-disabled="true"
                    tabIndex={-1}
                    className={`btn-secondary pointer-events-none ${active ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : ""}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  className={`btn-secondary ${active ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : ""}`}
                  href={item.href}
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}

            {showAdminButtons ? (
              <div ref={apiMenuRef} className="relative">
                <button
                  className={`btn-secondary ${
                    checkingSession
                      ? "pointer-events-none"
                      : apiNavigationActive || apiMenuOpen
                        ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100"
                        : ""
                  }`}
                  type="button"
                  aria-disabled={checkingSession}
                  aria-expanded={apiMenuOpen}
                  aria-haspopup={!checkingSession ? "menu" : undefined}
                  onClick={!checkingSession ? () => setApiMenuOpen((open) => !open) : undefined}
                >
                  <Code2 size={16} aria-hidden="true" />
                  APIs
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${apiMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {!checkingSession && isAdmin && apiMenuOpen ? (
                  <div
                    className="absolute left-1/2 z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-slate-950/90 backdrop-blur-md"
                    role="menu"
                  >
                  {apiNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-slate-900/80 hover:text-cyan-100 ${active ? "bg-cyan-500/15 text-cyan-100" : "text-slate-200"}`}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setApiMenuOpen(false)}
                      >
                        <Icon size={16} aria-hidden="true" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
            ) : null}
          </nav>

          <div ref={menuRef} className="relative z-30 col-start-2 row-start-1 flex justify-end gap-2 lg:col-start-2 lg:row-start-auto">
            <ThemeToggleButton className="px-3" />

            <div className="relative">
              <button
                className={`btn-secondary min-h-10 px-3 ${openMenu === "applications" ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : ""}`}
                type="button"
                title="Aplicativos"
                aria-label="Aplicativos"
                aria-expanded={openMenu === "applications"}
                onClick={() => {
                  setOpenMenu((current) => {
                    const nextMenu = current === "applications" ? null : "applications";
                    if (nextMenu === "applications") void loadApplications();
                    return nextMenu;
                  });
                }}
              >
                <Grid2X2 size={16} aria-hidden="true" />
              </button>

              {openMenu === "applications" ? (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-slate-950/90 backdrop-blur-md">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <p className="text-sm font-semibold text-white">Aplicativos</p>
                    <p className="text-xs text-slate-400">Sistemas liberados para sua conta</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {appsLoading ? (
                      <p className="px-3 py-3 text-sm text-slate-400">Carregando aplicativos...</p>
                    ) : appsError ? (
                      <p className="px-3 py-3 text-sm text-rose-300">{appsError}</p>
                    ) : applications.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-400">Nenhum outro aplicativo disponível.</p>
                    ) : (
                      applications.map((application) => (
                        <a
                          key={application.id}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-slate-900/80"
                          href={application.homepage_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ApplicationLogo name={application.nome} logoUrl={application.logo_url} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                            {application.nome}
                          </span>
                          <ExternalLink size={14} className="text-slate-500" aria-hidden="true" />
                        </a>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-transparent bg-transparent px-1.5 py-1 transition hover:bg-slate-900/80 ${openMenu === "account" ? "bg-slate-900/80" : ""}`}
                type="button"
                title={displayName}
                aria-label="Conta"
                aria-expanded={openMenu === "account"}
                onClick={() => setOpenMenu((current) => (current === "account" ? null : "account"))}
              >
                <UserAvatar src={user?.avatar_url} name={displayName} size="sm" />
                <ChevronDown size={14} className="hidden text-slate-500 sm:block" aria-hidden="true" />
              </button>

              {openMenu === "account" ? (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-slate-950/90 backdrop-blur-md">
                  <div className="border-b border-slate-800 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={user?.avatar_url} name={displayName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                        <p className="truncate text-xs text-slate-400">{user?.email}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{roleLabel}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/80 hover:text-cyan-100"
                      href="/profile"
                    >
                      <UserRound size={16} aria-hidden="true" />
                      Editar perfil
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/80 hover:text-rose-200"
                      type="button"
                      onClick={() => void signOut()}
                    >
                      <LogOut size={16} aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {checkingSession ? (
          <section className="panel p-6 text-sm text-slate-300">
            Validando sessão...
          </section>
        ) : children}
      </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-400/15 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-2xl shadow-slate-950/80 backdrop-blur lg:hidden">
          <div
            className="mx-auto grid max-w-md gap-1 text-[11px]"
            style={{
              gridTemplateColumns: `repeat(${visibleNavigationItems.length + (showAdminButtons ? 1 : 0)}, minmax(0, 1fr))`,
            }}
          >
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (checkingSession) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    aria-disabled="true"
                    tabIndex={-1}
                    className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold pointer-events-none ${
                      active
                        ? "bg-cyan-500/15 text-cyan-100"
                        : "text-slate-400"
                    }`}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="max-w-full truncate text-[11px] leading-tight">{item.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-cyan-500/15 text-cyan-100"
                      : "text-slate-400 hover:bg-slate-900/80 hover:text-cyan-100"
                  }`}
                  href={item.href}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="max-w-full truncate text-[11px] leading-tight">{item.label}</span>
                </Link>
              );
            })}

            {showAdminButtons ? (
              <div ref={mobileApiMenuRef} className="relative flex h-11 items-center justify-center">
                {!checkingSession && isAdmin && apiMenuOpen ? (
                  <div
                    className="absolute bottom-full left-1/2 z-50 mb-3 w-44 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/80"
                    role="menu"
                  >
                    {apiNavigationItems.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-slate-900/80 hover:text-cyan-100 ${active ? "bg-cyan-500/15 text-cyan-100" : "text-slate-200"}`}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setApiMenuOpen(false)}
                        >
                          <Icon size={16} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                <button
                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold transition ${
                    checkingSession
                      ? "text-slate-400 pointer-events-none"
                      : apiNavigationActive || apiMenuOpen
                        ? "bg-cyan-500/15 text-cyan-100"
                        : "text-slate-400 hover:bg-slate-900/80 hover:text-cyan-100"
                  }`}
                  type="button"
                  aria-disabled={checkingSession}
                  aria-expanded={apiMenuOpen}
                  aria-haspopup={!checkingSession && isAdmin ? "menu" : undefined}
                  onClick={!checkingSession && isAdmin ? () => setApiMenuOpen((open) => !open) : undefined}
                >
                  <Code2 size={18} aria-hidden="true" />
                  <span className="text-[11px] leading-tight">APIs</span>
                </button>
              </div>
            ) : null}
          </div>
        </nav>

      <InstallPromptCard />
    </main>
  );
}
