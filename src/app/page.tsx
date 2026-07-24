import Link from "next/link";
import { Activity, AppWindow, KeyRound, ShieldCheck, UsersRound } from "lucide-react";

const modules = [
  { label: "Autenticacao", value: "Supabase Auth", icon: KeyRound },
  { label: "Usuarios", value: "Diretorio central", icon: UsersRound },
  { label: "Aplicacoes", value: "Acesso por sistema", icon: AppWindow },
  { label: "Auditoria", value: "Eventos sensiveis", icon: Activity },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f3b68_0,#020617_38%,#020617_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/15 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">RaroNexus</p>
              <p className="text-sm text-slate-400">Identity Provider corporativo</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link className="btn-secondary" href="/swagger">
              Swagger
            </Link>
            <Link className="btn-primary" href="/login">
              Entrar
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_420px]">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              Uma identidade para multiplos sistemas
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              RaroNexus
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Centralize login, sessoes, tokens, usuarios e acessos a aplicacoes
              sem misturar as permissoes internas de cada sistema consumidor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/login">
                Acessar plataforma
              </Link>
              <Link className="btn-secondary" href="/admin/users">
                Administrar usuarios
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-400/20 bg-slate-900/80 p-4 shadow-2xl shadow-cyan-950/40">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium text-white">Nucleo de identidade</p>
              <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300">
                v1
              </span>
            </div>
            <div className="grid gap-3">
              {modules.map((module) => (
                <div
                  key={module.label}
                  className="flex items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-950/70 p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/15 text-cyan-200">
                    <module.icon size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{module.label}</p>
                    <p className="text-xs text-slate-400">{module.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
