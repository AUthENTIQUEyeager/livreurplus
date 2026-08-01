"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeconnexionPage() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut().finally(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist">
      <p className="text-sm text-ink/60">Déconnexion…</p>
    </main>
  );
}
