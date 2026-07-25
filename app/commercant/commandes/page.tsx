"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Commande, CommandeItem, Commerce, LivreurProche } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function CommandesPage() {
  const supabase = createClient();
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ouverte, setOuverte] = useState<Commande | null>(null);
  const [items, setItems] = useState<CommandeItem[]>([]);
  const [candidats, setCandidats] = useState<LivreurProche[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [positionLivreur, setPositionLivreur] = useState<{ lat: number; lng: number } | null>(null);

  async function charger() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: com } = await supabase
      .from("commerces")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    setCommerce(com);
    if (com) {
      const { data: cmds } = await supabase
        .from("commandes")
        .select("*")
        .eq("commerce_id", com.id)
        .order("created_at", { ascending: false });
      setCommandes(cmds ?? []);
    }
    setChargement(false);
  }

  useEffect(() => {
    charger();
    // Rafraîchissement simple par polling — suffisant pour un tableau de commandes
    const intervalle = setInterval(charger, 15000);
    return () => clearInterval(intervalle);
  }, []);

  async function ouvrirCommande(c: Commande) {
    setOuverte(c);
    setCandidats([]);
    setPositionLivreur(null);
    const { data: lignes } = await supabase
      .from("commande_items")
      .select("*")
      .eq("commande_id", c.id);
    setItems(lignes ?? []);

    if (c.livreur_id && (c.statut === "assignee" || c.statut === "en_livraison")) {
      const { data: info } = await supabase
        .from("livreurs_info")
        .select("lat, lng")
        .eq("profile_id", c.livreur_id)
        .maybeSingle();
      if (info?.lat && info?.lng) setPositionLivreur({ lat: info.lat, lng: info.lng });
    }
  }

  async function chercherLivreurs(c: Commande) {
    setRechercheEnCours(true);
    const { data, error } = await supabase.rpc("livreurs_proches", {
      order_lat: c.lat,
      order_lng: c.lng,
      rayon_km: 15,
      limite: 5,
    });
    setRechercheEnCours(false);
    if (!error) setCandidats(data ?? []);
  }

  async function assigner(c: Commande, livreurId: string) {
    const { error } = await supabase
      .from("commandes")
      .update({ livreur_id: livreurId, statut: "assignee" })
      .eq("id", c.id);
    if (!error) {
      await charger();
      setOuverte(null);
    }
  }

  async function annuler(c: Commande) {
    if (!confirm("Annuler cette commande ?")) return;
    await supabase.from("commandes").update({ statut: "annulee" }).eq("id", c.id);
    await charger();
    setOuverte(null);
  }

  if (chargement) return <p className="text-sm text-ink/50">Chargement…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Commandes</h1>

      {commandes.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm text-ink/60">Aucune commande pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs font-semibold uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-mist/50"
                  onClick={() => ouvrirCommande(c)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.nom_client}</p>
                    <p className="text-xs text-ink/40">{c.telephone_client}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{c.montant_total.toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3">
                    <StatusBadge statut={c.statut} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-route">Détails →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouverte && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">{ouverte.nom_client}</h2>
                <p className="text-xs text-ink/50">{ouverte.telephone_client}</p>
              </div>
              <StatusBadge statut={ouverte.statut} />
            </div>

            <p className="mt-3 text-sm text-ink/70">{ouverte.adresse_texte}</p>

            <div className="mt-4 divide-y divide-line rounded-xl border border-line">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between px-3 py-2 text-sm">
                  <span>
                    {it.quantite} × {it.nom_produit}
                  </span>
                  <span className="font-medium">{(it.quantite * it.prix_unitaire).toLocaleString("fr-FR")} F</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 text-sm font-display font-bold">
                <span>Total</span>
                <span>{ouverte.montant_total.toLocaleString("fr-FR")} F</span>
              </div>
            </div>

            {(ouverte.statut === "assignee" || ouverte.statut === "en_livraison") && (
              <div className="mt-4">
                <p className="label">Suivi en direct</p>
                <LiveMap
                  livreur={positionLivreur}
                  destination={{ lat: ouverte.lat, lng: ouverte.lng }}
                />
              </div>
            )}

            {ouverte.statut === "en_attente" && (
              <div className="mt-5">
                {candidats.length === 0 ? (
                  <button
                    onClick={() => chercherLivreurs(ouverte)}
                    disabled={rechercheEnCours}
                    className="btn-primary w-full"
                  >
                    {rechercheEnCours ? "Recherche…" : "Trouver des livreurs à proximité"}
                  </button>
                ) : (
                  <div>
                    <p className="label">Livreurs disponibles les plus proches</p>
                    <div className="space-y-2">
                      {candidats.map((l) => (
                        <div
                          key={l.profile_id}
                          className="flex items-center justify-between rounded-xl border border-line p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-ink">{l.nom}</p>
                            <p className="text-xs text-ink/50">
                              {l.vehicule} · {l.distance_km.toFixed(1)} km
                            </p>
                          </div>
                          <button
                            onClick={() => assigner(ouverte, l.profile_id)}
                            className="btn-primary !py-2 !px-4 text-xs"
                          >
                            Assigner
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setOuverte(null)} className="btn-secondary flex-1">
                Fermer
              </button>
              {(ouverte.statut === "en_attente" || ouverte.statut === "assignee") && (
                <button onClick={() => annuler(ouverte)} className="flex-1 text-sm font-semibold text-danger">
                  Annuler la commande
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
