import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Route de diagnostic TEMPORAIRE — à supprimer une fois le bug de
// redirection résolu. But : voir en un seul appel, sans fouiller les logs
// Vercel, exactement ce que le serveur perçoit (cookies reçus, session
// détectée, résultat brut de la requête profil).
//
// Usage : ouvrir https://livreurplus.vercel.app/api/debug-auth dans le
// navigateur juste après connexion (le cookie de session doit être envoyé
// automatiquement par le navigateur).
export async function GET() {
  const cookieStore = cookies();
  const toutesLesCookies = cookieStore.getAll().map((c) => ({
    name: c.name,
    // on ne montre que la longueur des valeurs sensibles, jamais la valeur brute
    valueLength: c.value?.length ?? 0,
  }));

  const supabase = createClient();
  const {
    data: { user },
    error: erreurUser,
  } = await supabase.auth.getUser();

  let profil = null;
  let erreurProfil = null;

  if (user) {
    const res = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profil = res.data;
    erreurProfil = res.error;
  }

  return NextResponse.json({
    cookiesRecus: toutesLesCookies,
    nombreDeCookiesSupabase: toutesLesCookies.filter((c) => c.name.startsWith("sb-")).length,
    utilisateurDetecte: user
      ? { id: user.id, email: user.email, created_at: user.created_at }
      : null,
    erreurGetUser: erreurUser?.message ?? null,
    profilTrouve: profil,
    erreurRequeteProfil: erreurProfil
      ? { message: erreurProfil.message, code: erreurProfil.code, details: erreurProfil.details }
      : null,
  });
}
