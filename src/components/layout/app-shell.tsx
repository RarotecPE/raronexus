"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

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
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-semibold text-white">RaroNexus</span>
              <span className="block text-xs text-slate-400">{title}</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/profile">
              <UserRound size={16} aria-hidden="true" />
              Perfil
            </Link>
            <Link className="btn-secondary" href="/admin/users">
              <UsersRound size={16} aria-hidden="true" />
              Usuarios
            </Link>
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
