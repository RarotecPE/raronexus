import { Suspense } from "react";
import { AuditAdmin } from "@/components/admin/audit-admin";

export const metadata = {
  title: "Auditoria | RaroNexus",
  description: "Trilha unificada de auditoria, conformidade LGPD e segurança da informação.",
};

export default function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-xs text-slate-400">
          Carregando módulo de auditoria...
        </div>
      }
    >
      <AuditAdmin />
    </Suspense>
  );
}

