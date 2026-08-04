"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Commerce, Produit } from "@/lib/types";

export default function CataloguePage() {
  const supabase = createClient();
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);

  const [formOuvert, setFormOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Produit | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [prix, setPrix] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  async function charger() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: com } = await supabase
      .from("commerces")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    setCommerce(com);
    if (com) {
      const { data: prods } = await supabase
        .from("produits")
        .select("*")
        .eq("commerce_id", com.id)
        .order("created_at", { ascending: false });
      setProduits(prods ?? []);
    }
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function televerserImage(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || !userId) return;

    if (!fichier.type.startsWith("image/")) {
      setErreur("Le fichier doit être une image.");
      return;
    }
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur("Image trop lourde (5 Mo max).");
      return;
    }

    setUploadEnCours(true);
    setErreur(null);

    const extension = fichier.name.split(".").pop() || "jpg";
    const chemin = `${userId}/produit-${Date.now()}.${extension}`;

    const { error: erreurUpload } = await supabase.storage
      .from("products")
      .upload(chemin, fichier, { upsert: true, contentType: fichier.type });

    if (erreurUpload) {
      setUploadEnCours(false);
      setErreur("Échec de l'envoi de l'image : " + erreurUpload.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("products").getPublicUrl(chemin);

    setImageUrl(publicUrl);
    setUploadEnCours(false);
  }

  function ouvrirCreation() {
    setEnEdition(null);
    setNom("");
    setDescription("");
    setPrix("");
    setImageUrl("");
    setErreur(null);
    setFormOuvert(true);
  }

  function ouvrirEdition(p: Produit) {
    setEnEdition(p);
    setNom(p.nom);
    setDescription(p.description);
    setPrix(String(p.prix));
    setImageUrl(p.image_url ?? "");
    setErreur(null);
    setFormOuvert(true);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!commerce) return;
    setEnvoi(true);
    setErreur(null);

    const payload = {
      commerce_id: commerce.id,
      nom,
      description,
      prix: parseFloat(prix.replace(",", ".")) || 0,
      image_url: imageUrl || null,
    };

    const { error } = enEdition
      ? await supabase.from("produits").update(payload).eq("id", enEdition.id)
      : await supabase.from("produits").insert(payload);

    setEnvoi(false);
    if (error) return setErreur(error.message);
    setFormOuvert(false);
    charger();
  }

  async function basculerDisponibilite(p: Produit) {
    await supabase.from("produits").update({ disponible: !p.disponible }).eq("id", p.id);
    charger();
  }

  async function supprimer(p: Produit) {
    if (!confirm(`Supprimer "${p.nom}" du catalogue ?`)) return;
    await supabase.from("produits").delete().eq("id", p.id);
    charger();
  }

  if (chargement) return <p className="text-sm text-ink/50">Chargement…</p>;

  if (!commerce) {
    return (
      <p className="text-sm text-ink/60">
        Crée d&apos;abord ta boutique depuis le tableau de bord.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Catalogue</h1>
        <button onClick={ouvrirCreation} className="btn-primary">
          + Ajouter un produit
        </button>
      </div>

      {produits.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm text-ink/60">
            Ton catalogue est vide. Ajoute un premier produit pour qu&apos;il apparaisse sur ta page publique.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produits.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="h-32 bg-mist">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.nom} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-ink">{p.nom}</h3>
                  <span className="whitespace-nowrap font-display text-sm font-bold text-route-dark">
                    {p.prix.toLocaleString("fr-FR")} F
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink/50">{p.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => basculerDisponibilite(p)}
                    className={`badge ${p.disponible ? "bg-route-tint text-route-dark" : "bg-mist text-ink/50"}`}
                  >
                    {p.disponible ? "Disponible" : "Masqué"}
                  </button>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => ouvrirEdition(p)} className="font-medium text-ink/60 hover:text-ink">
                      Modifier
                    </button>
                    <button onClick={() => supprimer(p)} className="font-medium text-danger hover:underline">
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOuvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h2 className="font-display text-lg font-bold text-ink">
              {enEdition ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <form onSubmit={enregistrer} className="mt-4 space-y-4">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prix (FCFA)</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={prix}
                    onChange={(e) => setPrix(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Photo</label>
                  <label className="btn-secondary w-full cursor-pointer !py-2.5 text-xs">
                    {uploadEnCours ? "Envoi…" : imageUrl ? "Changer" : "Choisir une photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={televerserImage}
                      disabled={uploadEnCours}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {imageUrl && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Retirer la photo
                  </button>
                </div>
              )}

              <div>
                <label className="label">Ou coller un lien d&apos;image</label>
                <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
              {erreur && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{erreur}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOuvert(false)}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" disabled={envoi} className="btn-primary flex-1">
                  {envoi ? "…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
