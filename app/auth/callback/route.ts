import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const roleChoisi = searchParams.get("role"); // 'commercant' | 'livreur', défini sur /login

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Le trigger handle_new_user() a créé le profil avec role='client' par
      // défaut (Google ne transmet pas de metadata custom). On applique le
      // rôle choisi sur /login seulement si c'est la toute première connexion
      // de cet utilisateur, pour ne jamais écraser un rôle déjà confirmé.
      if (roleChoisi === "commercant" || roleChoisi === "livreur") {
        const { data: profil } = await supabase
          .from("profiles")
          .select("role, created_at")
          .eq("id", data.user.id)
          .single();

        const vientDetreCree =
          profil && Date.now() - new Date(profil.created_at).getTime() < 60_000;

        if (profil && vientDetreCree && profil.role === "client") {
          await supabase.from("profiles").update({ role: roleChoisi }).eq("id", data.user.id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erreur=connexion_impossible`);
}
