import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profil, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.error(
      "[page /] Session détectée —",
      "user:", user.email, `(id: ${user.id})`,
      "| rôle lu:", profil?.role ?? "aucun profil trouvé",
      "| erreur requête:", error?.message ?? "aucune"
    );

    if (profil?.role === "commercant") redirect("/commercant/dashboard");
    if (profil?.role === "livreur") redirect("/livreur");
  } else {
    console.error("[page /] Aucune session détectée (utilisateur non connecté côté serveur)");
  }

  return (
    <main className="min-h-screen bg-paper">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-route">
            <span className="font-display text-sm font-bold text-white">L+</span>
          </div>
          <span className="font-display text-lg font-bold text-ink">LivreurPlus</span>
        </div>
        <Link href="/login" className="btn-secondary">
          Se connecter
        </Link>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="badge bg-route-tint text-route-dark">Bobo-Dioulasso &amp; environs</span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-ink md:text-5xl">
            Vends en ligne.<br />Fais livrer en direct.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink/60">
            LivreurPlus connecte ta boutique à des livreurs disponibles autour de toi.
            Le client commande, tu assignes un livreur, tout le monde suit la course
            en temps réel jusqu&apos;à la livraison.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">
              Ouvrir ma boutique
            </Link>
            <Link href="/login" className="btn-secondary">
              Devenir livreur
            </Link>
          </div>
        </div>

        <div className="card relative overflow-hidden p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-ink">Commande #A18F</span>
              <span className="badge bg-route-tint text-route-dark">En livraison</span>
            </div>
            <div className="h-40 rounded-xl bg-mist relative overflow-hidden">
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: "linear-gradient(#E6E8E3 1px, transparent 1px), linear-gradient(90deg, #E6E8E3 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }} />
              <div className="livreur-pin absolute" style={{ top: "45%", left: "58%" }} />
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-mist p-3">
              <div className="h-9 w-9 rounded-full bg-route/10 flex items-center justify-center font-display text-xs font-bold text-route-dark">
                IS
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">Issa S. — Moto</p>
                <p className="text-xs text-ink/50">à 1,2 km du client</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { titre: "Catalogue en ligne", texte: "Publie tes produits avec photos et prix. Ta boutique a sa propre page publique." },
            { titre: "Attribution intelligente", texte: "Les livreurs disponibles les plus proches te sont proposés automatiquement." },
            { titre: "Suivi en temps réel", texte: "Toi et ton client voyez le livreur se déplacer sur la carte jusqu'à la livraison." },
          ].map((f) => (
            <div key={f.titre} className="card p-6">
              <h3 className="font-display text-base font-bold text-ink">{f.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{f.texte}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
