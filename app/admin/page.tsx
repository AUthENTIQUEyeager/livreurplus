"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type DocumentAValider = {
  id: string;
  user_id: string;
  document_type: string;
  storage_path: string;
  verified: boolean;
  created_at?: string;
};

const LABELS_DOCUMENTS: Record<string, string> = {
  identity_front: "CNI recto",
  identity_back: "CNI verso",
  selfie_with_id: "Selfie avec CNI",
  shop_photo: "Photo boutique",
  vehicle_registration: "Carte grise",
  commerce_license: "Registre de commerce",
};

export default function AdminPage() {
  const supabase = createClient();

  const [chargement, setChargement] = useState(true);
  const [autorise, setAutorise] = useState<boolean | null>(null);

  const [profils, setProfils] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<DocumentAValider[]>([]);
  const [imagesSignees, setImagesSignees] = useState<Record<string, string>>({});
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"utilisateurs" | "documents">("documents");

  const chargerDonnees = useCallback(async () => {
    const { data: tousLesProfils } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setProfils(tousLesProfils ?? []);

    const res = await fetch("/api/verification-documents?all=true");
    if (res.ok) {
      const json = await res.json();
      setDocuments(json.documents ?? []);
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAutorise(false);
        setChargement(false);
        return;
      }

      const { data: monProfil } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!monProfil?.is_admin) {
        setAutorise(false);
        setChargement(false);
        return;
      }

      setAutorise(true);
      await chargerDonnees();
      setChargement(false);
    })();
  }, [supabase, chargerDonnees]);

  useEffect(() => {
    (async () => {
      const urls: Record<string, string> = {};
      for (const doc of documents) {
        const { data } = await supabase.storage
          .from("verification-documents")
          .createSignedUrl(doc.storage_path, 300);
        if (data?.signedUrl) urls[doc.id] = data.signedUrl;
      }
      setImagesSignees(urls);
    })();
  }, [documents, supabase]);

  async function validerDocument(documentId: string, verified: boolean) {
    setActionEnCours(documentId);
    setErreur(null);
    try {
      const res = await fetch("/api/verification-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, verified }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Échec de la validation");
      }
      await chargerDonnees();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionEnCours(null);
    }
  }

  async function basculerBlocage(profil: Profile) {
    setActionEnCours(profil.id);
    setErreur(null);
    const { error } = await supabase
      .from("profiles")
      .update({ est_bloque: !profil.est_bloque })
      .eq("id", profil.id);
    if (error) {
      setErreur(error.message);
    } else {
      await chargerDonnees();
    }
    setActionEnCours(null);
  }

  if (chargement) {
    return <p className="p-6 text-center text-sm text-ink/50">Chargement…</p>;
  }

  if (!autorise) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="card max-w-sm p-6">
          <h1 className="font-display text-xl font-bold text-ink">Accès refusé</h1>
          <p className="mt-2 text-sm text-ink/60">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  const nbParRole = profils.reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl p-4 pb-16">
      <h1 className="mb-4 font-display text-2xl font-bold text-ink">Superadmin</h1>

      {erreur && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{erreur}</div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink">{profils.length}</p>
          <p className="text-xs text-ink/50">Inscrits</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink">{nbParRole.client ?? 0}</p>
          <p className="text-xs text-ink/50">Clients</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink">{nbParRole.commercant ?? 0}</p>
          <p className="text-xs text-ink/50">Commerçants</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink">{nbParRole.livreur ?? 0}</p>
          <p className="text-xs text-ink/50">Livreurs</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setOnglet("documents")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            onglet === "documents" ? "bg-ink text-white" : "bg-mist text-ink/60"
          }`}
        >
          Documents à valider ({documents.length})
        </button>
        <button
          onClick={() => setOnglet("utilisateurs")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            onglet === "utilisateurs" ? "bg-ink text-white" : "bg-mist text-ink/60"
          }`}
        >
          Utilisateurs
        </button>
      </div>

      {onglet === "documents" && (
        <div className="space-y-3">
          {documents.length === 0 && (
            <p className="text-sm text-ink/50">Aucun document en attente.</p>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              {imagesSignees[doc.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagesSignees[doc.id]}
                  alt={LABELS_DOCUMENTS[doc.document_type] ?? doc.document_type}
                  className="h-32 w-full rounded-md object-cover sm:w-40"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-md bg-mist text-xs text-ink/40 sm:w-40">
                  Chargement…
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">
                  {LABELS_DOCUMENTS[doc.document_type] ?? doc.document_type}
                </p>
                <p className="text-xs text-ink/50">Utilisateur : {doc.user_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={actionEnCours === doc.id}
                  onClick={() => validerDocument(doc.id, true)}
                  className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50"
                >
                  Valider
                </button>
                <button
                  disabled={actionEnCours === doc.id}
                  onClick={() => validerDocument(doc.id, false)}
                  className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {onglet === "utilisateurs" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs text-ink/50">
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Rôle</th>
                <th className="py-2 pr-3">Téléphone</th>
                <th className="py-2 pr-3">Vérifié</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {profils.map((p) => (
                <tr key={p.id} className="border-b border-ink/5">
                  <td className="py-2 pr-3">{p.nom || "—"}</td>
                  <td className="py-2 pr-3 capitalize">{p.role}</td>
                  <td className="py-2 pr-3">{p.telephone || "—"}</td>
                  <td className="py-2 pr-3">{p.is_identity_verified ? "✅" : "—"}</td>
                  <td className="py-2 pr-3">
                    {p.est_bloque ? (
                      <span className="text-red-600">Bloqué</span>
                    ) : (
                      <span className="text-green-600">Actif</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      disabled={actionEnCours === p.id}
                      onClick={() => basculerBlocage(p)}
                      className="text-xs font-medium text-route underline disabled:opacity-50"
                    >
                      {p.est_bloque ? "Débloquer" : "Bloquer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
