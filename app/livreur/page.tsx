"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Commande, StatutLivreur } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function LivreurPage() {
  const supabase = createClient();
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [statut, setStatut] = useState<StatutLivreur>("hors_ligne");
  const [vehicule, setVehicule] = useState("moto");
  const [positionActuelle, setPositionActuelle] = useState<{ lat: number; lng: number } | null>(null);
  const [courseEnCours, setCourseEnCours] = useState<Commande | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurGeoloc, setErreurGeoloc] = useState<string | null>(null);

  const derniereEcriture = useRef(0);

  async function chargerTout() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profil } = await supabase.from("profiles").select("nom").eq("id", user.id).single();
    setNom(profil?.nom ?? "");

    const { data: info } = await supabase
      .from("livreurs_info")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (info) {
      setStatut(info.statut);
      setVehicule(info.vehicule ?? "moto");
    } else {
      await supabase.from("livreurs_info").insert({ profile_id: user.id, statut: "hors_ligne" });
    }

    const { data: course } = await supabase
      .from("commandes")
      .select("*")
      .eq("livreur_id", user.id)
      .in("statut", ["assignee", "en_livraison"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCourseEnCours(course);
    setChargement(false);
  }

  useEffect(() => {
    chargerTout();
    const intervalle = setInterval(chargerTout, 20000);
    return () => clearInterval(intervalle);
  }, []);

  // Géolocalisation : suit la position et l'envoie à Supabase (throttlé à 8s)
  useEffect(() => {
    if (statut === "hors_ligne" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPositionActuelle({ lat: latitude, lng: longitude });
        setErreurGeoloc(null);

        const maintenant = Date.now();
        if (maintenant - derniereEcriture.current < 8000) return;
        derniereEcriture.current = maintenant;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
          .from("livreurs_info")
          .update({ lat: latitude, lng: longitude, updated_at: new Date().toISOString() })
          .eq("profile_id", user.id);

        if (courseEnCours && courseEnCours.statut === "en_livraison") {
          await supabase.from("positions_livraison").insert({
            commande_id: courseEnCours.id,
            livreur_id: user.id,
            lat: latitude,
            lng: longitude,
          });
        }
      },
      () => setErreurGeoloc("Active la localisation pour recevoir des courses proches de toi."),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut, courseEnCours?.id, courseEnCours?.statut]);

  async function changerStatut(nouveau: StatutLivreur) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setStatut(nouveau);
    await supabase.from("livreurs_info").update({ statut: nouveau }).eq("profile_id", user.id);
  }

  async function demarrerLivraison() {
    if (!courseEnCours) return;
    await supabase.from("commandes").update({ statut: "en_livraison" }).eq("id", courseEnCours.id);
    await changerStatut("en_course");
    chargerTout();
  }

  async function terminerLivraison() {
    if (!courseEnCours) return;
    if (!confirm("Confirmer la livraison auprès du client ?")) return;
    await supabase.from("commandes").update({ statut: "livree" }).eq("id", courseEnCours.id);
    await changerStatut("disponible");
    setCourseEnCours(null);
    chargerTout();
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (chargement) return <p className="p-6 text-sm text-ink/50">Chargement…</p>;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between bg-white px-5 py-4">
        <div>
          <p className="text-xs text-ink/40">Bonjour</p>
          <p className="font-display text-sm font-bold text-ink">{nom}</p>
        </div>
        <button onClick={deconnexion} className="text-xs font-semibold text-ink/40">
          Déconnexion
        </button>
      </header>

      <div className="px-5 py-5">
        {/* Disponibilité */}
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              {statut === "disponible" && "Disponible"}
              {statut === "en_course" && "En course"}
              {statut === "hors_ligne" && "Hors ligne"}
            </p>
            <p className="text-xs text-ink/50">
              {statut === "hors_ligne"
                ? "Passe en ligne pour recevoir des courses"
                : "Ta position est partagée en direct"}
            </p>
          </div>
          {statut !== "en_course" && (
            <button
              onClick={() => changerStatut(statut === "disponible" ? "hors_ligne" : "disponible")}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                statut === "disponible" ? "bg-route" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  statut === "disponible" ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          )}
        </div>

        {erreurGeoloc && (
          <p className="mt-3 rounded-lg bg-amber-tint px-3 py-2 text-xs text-amber">{erreurGeoloc}</p>
        )}

        {/* Course en cours */}
        {courseEnCours ? (
          <div className="mt-5">
            <p className="label">Course en cours</p>
            <div className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold text-ink">{courseEnCours.nom_client}</p>
                  <p className="text-xs text-ink/50">{courseEnCours.telephone_client}</p>
                </div>
                <StatusBadge statut={courseEnCours.statut} />
              </div>
              <p className="mt-2 text-sm text-ink/70">{courseEnCours.adresse_texte}</p>
              <p className="mt-1 font-display text-sm font-bold text-route-dark">
                {courseEnCours.montant_total.toLocaleString("fr-FR")} F à encaisser
              </p>

              <div className="mt-4">
                <LiveMap
                  livreur={positionActuelle}
                  destination={{ lat: courseEnCours.lat, lng: courseEnCours.lng }}
                  hauteur="220px"
                />
              </div>

              <div className="mt-4 flex gap-3">
                <a
                  href={`tel:${courseEnCours.telephone_client}`}
                  className="btn-secondary flex-1 !py-2.5 text-xs"
                >
                  Appeler
                </a>
                {courseEnCours.statut === "assignee" ? (
                  <button onClick={demarrerLivraison} className="btn-primary flex-1 !py-2.5 text-xs">
                    Démarrer la livraison
                  </button>
                ) : (
                  <button onClick={terminerLivraison} className="btn-primary flex-1 !py-2.5 text-xs">
                    Marquer comme livrée
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card mt-5 p-6 text-center">
            <p className="text-sm text-ink/60">
              {statut === "disponible"
                ? "Aucune course pour l'instant. Reste en ligne, tu seras notifié dès qu'un commerçant t'assigne une livraison."
                : "Passe en ligne pour commencer à recevoir des courses."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
