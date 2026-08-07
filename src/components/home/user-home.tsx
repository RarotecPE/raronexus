"use client";

import Link from "next/link";
import { AppWindow, CheckCircle2, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiFetch } from "@/lib/api/client-fetch";
import type { UserResponseDTO } from "@/lib/api/types";

const actions = [
  {
    title: "Perfil",
    description: "Atualize seus dados, avatar e senha.",
    href: "/profile",
    icon: UserRound,
  },
  {
    title: "Plataformas",
    description: "Acesse os sistemas liberados para sua conta.",
    href: "/applications",
    icon: AppWindow,
  },
  {
    title: "Usuários",
    description: "Acesse a área de usuários do Nexus.",
    href: "/admin/users",
    icon: UsersRound,
  },
];

export function UserHome() {
  const [user, setUser] = useState<UserResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    apiFetch<UserResponseDTO>("/api/v1/users/me")
      .then((profile) => {
        if (!active) return;
        setUser(profile);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar sua conta.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.nome || user?.email || "usuário";

  return (
    <AppShell title="Início">
      {loading ? (
        <section className="panel p-6 text-sm text-slate-300">
          Carregando sua página inicial...
        </section>
      ) : message ? (
        <section className="panel p-6 text-sm text-rose-200">
          {message}
        </section>
      ) : user ? (
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar src={user.avatar_url} name={displayName} size="lg" />
                <div>
                  <p className="mb-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 bg-emerald-950/25 px-2 py-1 text-xs font-medium text-emerald-100">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Sessão ativa no RaroNexus
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                    Bem-vindo, {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Escolha uma área para continuar.
                  </p>
                </div>
              </div>
              {user.is_admin ? (
                <span className="w-fit rounded-md border border-cyan-400/25 bg-cyan-950/35 px-3 py-1.5 text-xs font-medium text-cyan-100">
                  Administrador RaroNexus
                </span>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                className="group rounded-lg border border-slate-700/70 bg-slate-950/45 p-4 transition hover:border-cyan-400/45 hover:bg-slate-900/70"
                href={action.href}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200 transition group-hover:bg-cyan-400/20">
                  <action.icon size={20} aria-hidden="true" />
                </div>
                <h2 className="font-semibold text-white">{action.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">{action.description}</p>
              </Link>
            ))}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
