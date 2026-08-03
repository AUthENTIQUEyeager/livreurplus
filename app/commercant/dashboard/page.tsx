"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Commerce, StatutCommande } from "@/lib/types";

function slugifier(texte: string) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DashboardPage() {
  const supabase = createClient();
  const [chargement, setChargement] = useState(true);
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [stats, setStats] = useState<Record<StatutCommande, number>>({
    en_attente: 0,
    assignee: 0,
    en_livraison: 0,
    livree: 0,
    annulee: 0,
  });

  // Formulaire de création
  const [nomBoutique, setNomBoutique] = useState("");
  const [description, setDescription] = useState("");
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
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
        const { data: commandes } = await supabase
          .from("commandes")
          .select("statut")
          .eq("commerce_id", com.id);

        const compte: Record<string, number> = {};
        (commandes ?? []).forEach((c) => {
          compte[c.statut] = (compte[c.statut] ?? 0) + 1;
        });
        setStats((s) => ({ ...s, ...compte }));
      }

      setChargement(false);
    })();
  }, []);

  async function creerBoutique(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const slug = slugifier(nomBoutique) || `boutique-${Date.now()}`;

    const { data, error } = await supabase
      .from("commerces")
      .insert({
        profile_id: user.id,
        nom_boutique: nomBoutique,
        slug,
        description,
        adresse,
      })
      .select()
      .single();

    setEnvoi(false);
    if (error) {
      setErreur(
        error.code === "23505"
          ? "Ce nom de boutique donne une adresse déjà utilisée, essaie une variante."
          : error.message
      );
      return;
    }
    setCommerce(data);
  }

  if (chargement) {
    return <p className="text-sm text-ink/50">Chargement…</p>;
  }

  if (!commerce) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-bold text-ink">Crée ta boutique</h1>
        <p className="mt-1 text-sm text-ink/60">
          Ces infos apparaîtront sur ta page publique, visible par tes clients.
        </p>
        <form onSubmit={creerBoutique} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label">Nom de la boutique</label>
            <input
              className="input"
              value={nomBoutique}
              onChange={(e) => setNomBoutique(e.target.value)}
              required
              placeholder="Ex. Chez Fatou — Épicerie"
            />
            {nomBoutique && (
              <p className="mt-1 text-xs text-ink/40">
                Adresse publique : /boutique/{slugifier(nomBoutique)}
              </p>
            )}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que tu vends, tes horaires, ta spécialité…"
            />
          </div>
          <div>
            <label className="label">Adresse / quartier</label>
            <input
              className="input"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Ex. Secteur 15, Bobo-Dioulasso"
            />
          </div>
          {erreur && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{erreur}</p>}
          <button type="submit" disabled={envoi} className="btn-primary w-full">
            {envoi ? "Création…" : "Créer ma boutique"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{commerce.nom_boutique}</h1>
          <p className="mt-1 text-sm text-ink/60">
            Page publique :{" "}
            <Link href={`/boutique/${commerce.slug}`} className="font-medium text-route hover:underline">
              /boutique/{commerce.slug}
            </Link>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/commercant/personnalisation" className="btn-secondary">
            Personnaliser
          </Link>
          <Link href="/commercant/catalogue" className="btn-primary">
            Gérer le catalogue
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {(
          [
            ["en_attente", "En attente"],
            ["assignee", "Assignées"],
            ["en_livraison", "En livraison"],
            ["livree", "Livrées"],
            ["annulee", "Annulées"],
          ] as [StatutCommande, string][]
        ).map(([cle, label]) => (
          <div key={cle} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{stats[cle]}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/commercant/commandes" className="btn-secondary">
          Voir toutes les commandes →
        </Link>
      </div>
    </div>
  );
}
