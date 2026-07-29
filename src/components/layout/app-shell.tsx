"use client";

import Link from "next/link";
import { AppWindow, LogOut, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { apiFetch } from "@/lib/api/client-fetch";
import type { UserResponseDTO } from "@/lib/api/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    apiFetch<UserResponseDTO>("/api/v1/users/me")
      .then((user) => {
        if (active) setIsAdmin(Boolean(user.is_admin));
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f3b68_0,#020617_36%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/15 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="hidden text-xs text-slate-400 sm:block">{title}</span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/profile">
              <UserRound size={16} aria-hidden="true" />
              Perfil
            </Link>
            <Link className="btn-secondary" href="/applications">
              <AppWindow size={16} aria-hidden="true" />
              Plataformas
            </Link>
            {isAdmin ? (
              <Link className="btn-secondary" href="/admin/users">
                <UsersRound size={16} aria-hidden="true" />
                Usuarios
              </Link>
            ) : null}
            <button className="btn-secondary" type="button" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
