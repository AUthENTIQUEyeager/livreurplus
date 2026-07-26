import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function createClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `[lib/supabase/server.ts] Variable(s) d'environnement manquante(s) sur Vercel — ` +
        `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "présente" : "MANQUANTE"}, ` +
        `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "présente" : "MANQUANTE"}. ` +
        `Vérifie Settings > Environment Variables sur Vercel (scope Production coché) puis redéploie.`
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // appelé depuis un Server Component : le middleware s'occupe
          // du rafraîchissement de session, on peut ignorer ici.
        }
      },
    },
  });
}
