import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0f3b68_0,#020617_42%,#020617_100%)] px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/">
            <BrandMark />
          </Link>
        </header>
        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_440px]">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              SSO corporativo
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">{description}</p>
          </div>
          <div className="panel p-5 shadow-2xl shadow-cyan-950/40">{children}</div>
        </section>
      </div>
    </main>
  );
}
