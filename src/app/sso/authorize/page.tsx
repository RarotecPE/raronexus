"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SsoAuthorizePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Conectando ao RaroNexus...");

  useEffect(() => {
    let active = true;

    async function authorize() {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const supabase = createBrowserSupabaseClient();
      const params = new URLSearchParams(window.location.search);

      if (params.get("prompt") === "login") {
        params.delete("prompt");
        const nextPath = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
        await supabase.auth.signOut();
        window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const requestPayload = {
        client_id: params.get("client_id") ?? "",
        redirect_uri: params.get("redirect_uri") ?? "",
        state: params.get("state") ?? "",
      };

      const response = await fetch("/api/v1/sso/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestPayload),
      });
      const payload = await response.json();

      if (!active) return;

      if (!payload.success) {
        if (response.status === 401) {
          if (params.get("prompt") === "none") {
            const redirectUri = params.get("redirect_uri");
            if (redirectUri) {
              const redirectUrl = new URL(redirectUri);
              redirectUrl.searchParams.set("error", "login_required");
              redirectUrl.searchParams.set("state", params.get("state") ?? "");
              window.location.replace(redirectUrl.toString());
              return;
            }
          }

          router.replace(`/login?next=${encodeURIComponent(currentUrl)}`);
          return;
        }

        setMessage(payload.message ?? "Nao foi possivel autorizar o acesso.");
        return;
      }

      window.location.replace(payload.data.redirect_to);
    }

    void authorize();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <section className="panel max-w-md p-6 text-center">
        <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        <h1 className="text-xl font-semibold text-white">RaroNexus</h1>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
      </section>
    </main>
  );
}
