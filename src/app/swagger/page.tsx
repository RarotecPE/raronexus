import { AppShell } from "@/components/layout/app-shell";
import { SwaggerClient } from "./swagger-client";

export default function SwaggerPage() {
  return (
    <AppShell title="Documentação">
      <div className="space-y-4">
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Documentação da API (Swagger / OpenAPI)
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Explore e teste interativamente todos os endpoints REST, autenticação SSO, constantes e central de e-mails do RaroNexus.
              </p>
            </div>
            <a
              href="/api/v1/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary shrink-0 !min-h-9 !px-3 text-xs"
            >
              Exportar OpenAPI JSON
            </a>
          </div>
        </section>

        <SwaggerClient />
      </div>
    </AppShell>
  );
}
