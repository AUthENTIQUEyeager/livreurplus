import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Variables Supabase manquantes sur Vercel :",
      "NEXT_PUBLIC_SUPABASE_URL =", supabaseUrl ? "présente" : "MANQUANTE",
      "| NEXT_PUBLIC_SUPABASE_ANON_KEY =", supabaseAnonKey ? "présente" : "MANQUANTE"
    );
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const protectedPaths = ["/commercant", "/livreur", "/admin"];
    const isProtected = protectedPaths.some((p) => path.startsWith(p));

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    if (isProtected && user) {
      const { data: profil } = await supabase
        .from("profiles")
        .select("est_bloque")
        .eq("id", user.id)
        .maybeSingle();

      if (profil?.est_bloque) {
        const url = request.nextUrl.clone();
        url.pathname = "/compte-bloque";
        return NextResponse.redirect(url);
      }
    }

    return response;
  } catch (err) {
    console.error(
      "[middleware] Erreur lors de la création du client Supabase — vérifie le FORMAT des variables (URL complète avec https://, pas de guillemets, pas d'espace) :",
      err instanceof Error ? err.message : err,
      "| URL reçue (longueur):", supabaseUrl.length,
      "| Anon key reçue (longueur):", supabaseAnonKey.length
    );
    return response;
  }
}
