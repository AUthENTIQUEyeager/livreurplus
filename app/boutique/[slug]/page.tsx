"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Commande, Commerce, Produit } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { getTheme } from "@/lib/theme-presets";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

type LignePanier = { produit: Produit; quantite: number };

export default function BoutiquePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  const [panier, setPanier] = useState<Record<string, LignePanier>>({});
  const [panierOuvert, setPanierOuvert] = useState(false);

  const [nomClient, setNomClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresseTexte, setAdresseTexte] = useState("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [localisation, setLocalisation] = useState<"attente" | "ok" | "erreur">("attente");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [commandeEnvoyee, setCommandeEnvoyee] = useState<Commande | null>(null);
  const [positionLivreur, setPositionLivreur] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: com } = await supabase
        .from("commerces")
        .select("*")
        .eq("slug", params.slug)
        .eq("actif", true)
        .maybeSingle();

      if (!com) {
        setIntrouvable(true);
        setChargement(false);
        return;
      }
      setCommerce(com);

      const { data: prods } = await supabase
        .from("produits")
        .select("*")
        .eq("commerce_id", com.id)
        .eq("disponible", true)
        .order("created_at", { ascending: false });
      setProduits(prods ?? []);
      setChargement(false);
    })();
  }, [params.slug]);

  // Suivi live de la commande une fois passée
  useEffect(() => {
    if (!commandeEnvoyee) return;
    const intervalle = setInterval(async () => {
      const { data: cmd } = await supabase
        .from("commandes")
        .select("*")
        .eq("id", commandeEnvoyee.id)
        .single();
      if (cmd) setCommandeEnvoyee(cmd);

      if (cmd?.livreur_id) {
        const { data: info } = await supabase
          .from("livreurs_info")
          .select("lat, lng")
          .eq("profile_id", cmd.livreur_id)
          .maybeSingle();
        if (info?.lat && info?.lng) setPositionLivreur({ lat: info.lat, lng: info.lng });
      }
    }, 6000);
    return () => clearInterval(intervalle);
  }, [commandeEnvoyee?.id]);

  function ajouterAuPanier(p: Produit) {
    setPanier((old) => {
      const existant = old[p.id];
      return {
        ...old,
        [p.id]: { produit: p, quantite: (existant?.quantite ?? 0) + 1 },
      };
    });
  }

  function retirerDuPanier(id: string) {
    setPanier((old) => {
      const copie = { ...old };
      if (copie[id].quantite <= 1) delete copie[id];
      else copie[id] = { ...copie[id], quantite: copie[id].quantite - 1 };
      return copie;
    });
  }

  const lignes = Object.values(panier);
  const total = lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0);
  const nombreArticles = lignes.reduce((s, l) => s + l.quantite, 0);

  function demanderLocalisation() {
    if (!navigator.geolocation) {
      setLocalisation("erreur");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocalisation("ok");
      },
      () => setLocalisation("erreur"),
      { enableHighAccuracy: true }
    );
  }

  async function validerCommande(e: React.FormEvent) {
    e.preventDefault();
    if (!commerce || !position) return;
    setEnvoi(true);
    setErreur(null);

    const { data: commande, error } = await supabase
      .from("commandes")
      .insert({
        commerce_id: commerce.id,
        nom_client: nomClient,
        telephone_client: telephone,
        lat: position.lat,
        lng: position.lng,
        adresse_texte: adresseTexte,
        montant_total: total,
      })
      .select()
      .single();

    if (error || !commande) {
      setEnvoi(false);
      setErreur("Impossible d'envoyer la commande. Réessaie.");
      return;
    }

    const items = lignes.map((l) => ({
      commande_id: commande.id,
      produit_id: l.produit.id,
      nom_produit: l.produit.nom,
      quantite: l.quantite,
      prix_unitaire: l.produit.prix,
    }));
    await supabase.from("commande_items").insert(items);

    setEnvoi(false);
    setPanier({});
    setPanierOuvert(false);
    setCommandeEnvoyee(commande);
  }

  if (chargement) return <p className="p-6 text-center text-sm text-ink/50">Chargement…</p>;
  if (introuvable) {
    return <p className="p-6 text-center text-sm text-ink/50">Cette boutique n&apos;existe pas ou plus.</p>;
  }

  const theme = getTheme(commerce?.theme);
  const styleTheme = {
    "--accent": theme.accent,
    "--accent-dark": theme.accentDark,
    "--accent-tint": theme.accentTint,
  } as React.CSSProperties;

  // Vue suivi de commande
  if (commandeEnvoyee) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-mist px-5 py-8" style={styleTheme}>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-lg font-bold text-ink">Ta commande</h1>
            <StatusBadge statut={commandeEnvoyee.statut} />
          </div>
          <p className="mt-2 text-sm text-ink/60">
            {commandeEnvoyee.statut === "en_attente" &&
              `${commerce?.nom_boutique} va bientôt assigner un livreur.`}
            {commandeEnvoyee.statut === "assignee" && "Un livreur a été assigné, il va démarrer la course."}
            {commandeEnvoyee.statut === "en_livraison" && "Ton livreur est en route !"}
            {commandeEnvoyee.statut === "livree" && "Livrée. Merci pour ta commande !"}
            {commandeEnvoyee.statut === "annulee" && "Cette commande a été annulée."}
          </p>

          {commandeEnvoyee.qr_code_data &&
            commandeEnvoyee.statut !== "livree" &&
            commandeEnvoyee.statut !== "annulee" && (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-mist p-4">
                <p className="text-center text-xs text-ink/60">
                  Montre ce QR code au livreur à la réception de ta commande
                </p>
                <QRCodeDisplay data={commandeEnvoyee.qr_code_data} size={180} />
              </div>
            )}

          {(commandeEnvoyee.statut === "assignee" || commandeEnvoyee.statut === "en_livraison") && (
            <div className="mt-4">
              <LiveMap
                livreur={positionLivreur}
                destination={{ lat: commandeEnvoyee.lat, lng: commandeEnvoyee.lng }}
              />
            </div>
          )}

          <div className="mt-5 rounded-xl bg-mist p-3 text-sm">
            <div className="flex justify-between font-display font-bold text-ink">
              <span>Total</span>
              <span>{commandeEnvoyee.montant_total.toLocaleString("fr-FR")} F</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper pb-24" style={styleTheme}>
      {/* En-tête boutique */}
      {commerce!.banniere_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={commerce!.banniere_url}
          alt=""
          className="h-32 w-full object-cover sm:h-48"
        />
      )}
      <div
        className="border-b-2 px-5 py-8 text-center"
        style={{
          borderColor: "var(--accent)",
          background: `linear-gradient(180deg, var(--accent-tint) 0%, #ffffff 100%)`,
        }}
      >
        {commerce!.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={commerce!.logo_url}
            alt={commerce!.nom_boutique}
            className="mx-auto h-16 w-16 rounded-2xl border-2 border-white object-cover shadow-card"
          />
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-card">
            <span className="font-display text-lg font-bold text-white">
              {commerce!.nom_boutique.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <h1 className="mt-3 font-display text-xl font-bold text-ink">{commerce!.nom_boutique}</h1>
        {commerce!.description && <p className="mt-1 text-sm text-ink/60">{commerce!.description}</p>}
        {commerce!.adresse && <p className="mt-1 text-xs text-ink/40">{commerce!.adresse}</p>}
        {commerce!.bio && (
          <p className="mx-auto mt-3 max-w-md text-sm text-ink/70">{commerce!.bio}</p>
        )}
      </div>

      {/* Catalogue */}
      <div className="mx-auto max-w-2xl px-5 py-6">
        {produits.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/70">
              Nos produits
            </h2>
          </div>
        )}
        {produits.length === 0 ? (
          <p className="text-center text-sm text-ink/50">Catalogue vide pour l&apos;instant.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {produits.map((p) => (
              <div
                key={p.id}
                className="card overflow-hidden border-t-2"
                style={{ borderTopColor: "var(--accent)" }}
              >
                <div className="h-32 bg-[var(--accent-tint)]">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.nom} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-sm font-bold text-ink">{p.nom}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink/50">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-[var(--accent-dark)]">
                      {p.prix.toLocaleString("fr-FR")} F
                    </span>
                    {panier[p.id] ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => retirerDuPanier(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-mist font-bold text-ink"
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm font-semibold">{panier[p.id].quantite}</span>
                        <button
                          onClick={() => ajouterAuPanier(p)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] font-bold text-white"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => ajouterAuPanier(p)}
                        className="btn-primary !bg-[var(--accent)] !py-1.5 !px-3 text-xs hover:!bg-[var(--accent-dark)]"
                      >
                        Ajouter
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barre panier flottante */}
      {nombreArticles > 0 && !panierOuvert && (
        <button
          onClick={() => setPanierOuvert(true)}
          className="fixed inset-x-5 bottom-5 flex items-center justify-between rounded-2xl px-5 py-4 text-white shadow-card"
          style={{ backgroundColor: "var(--accent-dark)" }}
        >
          <span className="text-sm font-semibold">{nombreArticles} article{nombreArticles > 1 ? "s" : ""}</span>
          <span className="font-display font-bold">{total.toLocaleString("fr-FR")} F — Commander →</span>
        </button>
      )}

      {/* Panier / checkout */}
      {panierOuvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h2 className="font-display text-lg font-bold text-ink">Ta commande</h2>

            <div className="mt-4 space-y-2">
              {lignes.map((l) => (
                <div key={l.produit.id} className="flex items-center justify-between text-sm">
                  <span>{l.quantite} × {l.produit.nom}</span>
                  <span className="font-medium">{(l.quantite * l.produit.prix).toLocaleString("fr-FR")} F</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 font-display font-bold">
                <span>Total</span>
                <span>{total.toLocaleString("fr-FR")} F</span>
              </div>
            </div>

            <form onSubmit={validerCommande} className="mt-5 space-y-4">
              <div>
                <label className="label">Ton nom</label>
                <input className="input focus:!border-[var(--accent)]" value={nomClient} onChange={(e) => setNomClient(e.target.value)} required />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input
                  className="input focus:!border-[var(--accent)]"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  required
                  placeholder="Ex. 70 00 00 00"
                />
              </div>
              <div>
                <label className="label">Repère / quartier</label>
                <input
                  className="input focus:!border-[var(--accent)]"
                  value={adresseTexte}
                  onChange={(e) => setAdresseTexte(e.target.value)}
                  placeholder="Ex. Près du marché de Dioulassoba"
                />
              </div>

              <div>
                <label className="label">Position de livraison</label>
                {localisation === "ok" && position ? (
                  <p className="rounded-lg bg-[var(--accent-tint)] px-3 py-2 text-sm text-[var(--accent-dark)]">
                    Position enregistrée ✓
                  </p>
                ) : (
                  <button type="button" onClick={demanderLocalisation} className="btn-secondary w-full">
                    Partager ma position
                  </button>
                )}
                {localisation === "erreur" && (
                  <p className="mt-2 text-xs text-danger">
                    Localisation refusée. Active-la dans les réglages de ton téléphone pour continuer.
                  </p>
                )}
              </div>

              {erreur && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{erreur}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setPanierOuvert(false)} className="btn-secondary flex-1">
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={!position || envoi}
                  className="btn-primary flex-1 !bg-[var(--accent)] hover:!bg-[var(--accent-dark)]"
                >
                  {envoi ? "Envoi…" : "Confirmer la commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
