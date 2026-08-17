"use client";

import Link from "next/link";
import {
  AppWindow,
  ChevronDown,
  ExternalLink,
  Grid2X2,
  Home,
  LogOut,
  Mail,
  UserRound,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  { label: "Início", href: "/home", icon: Home },
  { label: "Usuários", href: "/admin/users", icon: UsersRound },
  { label: "Plataformas", href: "/applications", icon: AppWindow },
  { label: "E-mails", href: "/admin/emails/global", icon: Mail },
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<UserResponseDTO | null>(null);
  const [applications, setApplications] = useState<ApplicationResponseDTO[]>([]);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  const redirectToLogin = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let active = true;

    apiFetch<UserResponseDTO>("/api/v1/users/me")
      .then((loadedUser) => {
        if (!active) return;
        setUser(loadedUser);
        setIsAdmin(Boolean(loadedUser.is_admin));
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
        setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [redirectToLogin]);

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

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleNavigationItems = navigationItems;
  const displayName = user?.nome || user?.email || "Usuário";
  const roleLabel = isAdmin ? "Administrador" : "Usuário";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f3b68_0,#020617_36%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-5">
        <header className="relative mb-6 grid grid-cols-[auto_1fr] items-center gap-4 border-b border-cyan-400/15 pb-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Link href="/home" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="hidden text-base font-semibold text-slate-200 sm:block">
              {title}
            </span>
          </Link>

          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-wrap justify-center gap-2 lg:flex">
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

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
          </nav>

          <div ref={menuRef} className="relative col-start-2 row-start-1 flex justify-end gap-2 lg:col-start-2 lg:row-start-auto">
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
                <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl shadow-slate-950/70">
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
                <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl shadow-slate-950/70">
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

      {!checkingSession ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-400/15 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-2xl shadow-slate-950/80 backdrop-blur lg:hidden">
          <div
            className="mx-auto grid max-w-md gap-1"
            style={{ gridTemplateColumns: `repeat(${visibleNavigationItems.length}, minmax(0, 1fr))` }}
          >
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-cyan-500/15 text-cyan-100"
                      : "text-slate-400 hover:bg-slate-900/80 hover:text-cyan-100"
                  }`}
                  href={item.href}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <InstallPromptCard />
    </main>
  );
}
