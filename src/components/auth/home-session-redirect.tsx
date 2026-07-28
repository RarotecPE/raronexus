"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function HomeSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
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
