"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Commande, StatutLivreur } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });
const QRScanner = dynamic(() => import("@/components/QRScanner"), { ssr: false });

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
  // Delivery confirmation states
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

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

  function gererScanQR(texteScanne: string) {
    setShowScanner(false);

    // Format attendu : "LIVREURPLUS:<id_commande>:<pin>"
    const parties = texteScanne.split(":");
    if (parties.length !== 3 || parties[0] !== "LIVREURPLUS") {
      setConfirmationError("QR code non reconnu. Réessaie ou tape le PIN manuellement.");
      return;
    }

    const [, idScanne, pinScanne] = parties;
    if (!courseEnCours || idScanne !== courseEnCours.id) {
      setConfirmationError("Ce QR code ne correspond pas à la commande en cours.");
      return;
    }

    setConfirmationError(null);
    setEnteredPin(pinScanne);
  }

  async function confirmerLivraison() {
    // Validate PIN
    if (!courseEnCours || !courseEnCours.qr_pin || enteredPin !== courseEnCours.qr_pin) {
      setConfirmationError("PIN incorrect. Veuillez vérifier le code affiché sur l'application du client.");
      return;
    }

    // Validate photo
    if (!photoFile) {
      setConfirmationError("Veuillez prendre une photo du colis livré.");
      return;
    }

    setConfirmationLoading(true);
    setConfirmationError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      // Upload photo to Supabase Storage
      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `delivery-proofs/${courseEnCours.id}/${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      // Get public URL for the photo (optional, we can store just the path)
      const {
        data: { publicUrl },
      } = supabase.storage.from('delivery-proofs').getPublicUrl(fileName);

      // Insert delivery proof
      const { data, error: dbError } = await supabase
        .from('delivery_proofs')
        .insert({
          ordre_id: courseEnCours.id,
          livreur_id: user.id,
          qr_code_data: courseEnCours.qr_code_data || '',
          qr_scanned_at: new Date().toISOString(),
          confirmation_photo_path: fileName,
          confirmation_photo_taken_at: new Date().toISOString(),
          status: 'pending' // Will be validated by commerçant or admin
        });

      if (dbError) throw dbError;

      // Update commande status to en_livraison (now in delivery process with proof)
      await supabase.from("commandes").update({ statut: "en_livraison" }).eq("id", courseEnCours.id);

      // Close modal and reset form
      setShowConfirmationModal(false);
      setEnteredPin("");
      setPhotoPreview(null);
      setPhotoFile(null);
      setConfirmationLoading(false);

      // Update status to en_course (actively delivering)
      await changerStatut("en_course");
      chargerTout();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      setConfirmationLoading(false);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setConfirmationError(`Erreur lors de la confirmation : ${message}`);
    }
  }

  async function terminerLivraison() {
    if (!courseEnCours) return;
    // Instead of directly marking as delivered, open confirmation modal
    setShowConfirmationModal(true);
    // Reset form when opening modal
    setEnteredPin("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setConfirmationError(null);
  }

  if (chargement) {
    return <p className="p-6 text-sm text-ink/50">Chargement…</p>;
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  
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
                    Confirmer la livraison
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

      {/* Delivery Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="font-display text-xl font-bold text-ink mb-4">Confirmer la livraison</h2>

            {/* PIN Input */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-ink">Code PIN de validation (4 chiffres)</label>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="text-xs font-medium text-route underline"
                >
                  Scanner le QR à la place
                </button>
              </div>
              <input
                type="password"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-route"
                maxLength={4}
                placeholder="1234"
              />
              {confirmationError && (
                <p className="mt-2 text-sm text-amber">{confirmationError}</p>
              )}
            </div>

            {showScanner && (
              <QRScanner onScan={gererScanQR} onClose={() => setShowScanner(false)} />
            )}

            {/* Photo Capture */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink mb-2">Photo du colis livré</label>
              <div className="border-2 border-dashed border-ink/20 rounded-md p-4 text-center cursor-pointer"
                onClick={() => document.getElementById('photo-input')?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="max-w-full h-48 object-contain rounded-md" />
                ) : (
                  <>
                    <p className="text-sm text-ink/60">Cliquez pour prendre une photo</p>
                    <p className="text-xs text-ink/40">La photo prouvera que vous avez bien livré le colis</p>
                  </>
                )}
              </div>
              <input
                type="file"
                id="photo-input"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    // Create preview URL
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />
              {!photoFile && (
                <p className="mt-2 text-sm text-amber">Veuillez prendre une photo du colis livré</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConfirmationModal(false);
                  setEnteredPin("");
                  setPhotoPreview(null);
                  setPhotoFile(null);
                  setConfirmationError(null);
                }}
                className="btn-secondary flex-1 !py-2.5 text-xs"
              >
                Annuler
              </button>
              <button
                onClick={confirmerLivraison}
                disabled={confirmationLoading || !enteredPin || !photoFile}
                className={`btn-primary flex-1 !py-2.5 text-xs ${confirmationLoading || !enteredPin || !photoFile ? 'opacity-50' : ''}`}
              >
                {confirmationLoading ? 'Confirmation...' : 'Confirmer la livraison'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}