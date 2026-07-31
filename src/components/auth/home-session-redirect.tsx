"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function getSupabaseRedirectTarget() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const flowType = hashParams.get("type") ?? searchParams.get("type");

  if (flowType === "invite" || flowType === "signup") {
    return `/set-password${window.location.search}${window.location.hash}`;
  }

  if (flowType === "recovery") {
    return `/reset-password${window.location.search}${window.location.hash}`;
  }

  return null;
}

export function HomeSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
      const supabaseRedirectTarget = getSupabaseRedirectTarget();
      if (supabaseRedirectTarget) {
        window.location.replace(supabaseRedirectTarget);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();

      if (active && data.session) {
        router.replace("/applications");
      }
    }

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
