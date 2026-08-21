"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function VerificationPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  // Form state
  const [documentType, setDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Define document types with labels
  const documentTypes = [
    { value: "identity_front", label: "Pièce d'identité (recto)" },
    { value: "identity_back", label: "Pièce d'identité (verso)" },
    { value: "selfie_with_id", label: "Selfie avec pièce d'identité" },
    { value: "shop_photo", label: "Photo de votre boutique/point de vente" },
    { value: "vehicle_registration", label: "Carte d'immatriculation de votre véhicule" },
    { value: "commerce_license", label: "Licence ou patente de commerce" }
  ];

  async function loadProfileAndDocuments() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login if not authenticated
        window.location.href = "/login";
        return;
      }

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Get verification documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("user_verification_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);

    } catch (err) {
      console.error("Error loading verification data:", err);
      setError("Erreur lors du chargement des données. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfileAndDocuments();

    // Set up real-time subscription for document updates
    const channel = supabase
      .channel("public:user_verification_documents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_verification_documents" },
        (payload) => {
          const newDocument = payload.new as { user_id?: string };
          if (newDocument.user_id === profile?.id) {
            loadProfileAndDocuments(); // Refresh data
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadProfileAndDocuments, supabase]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      setUploadError("Veuillez sélectionner un fichier image (JPG, PNG, etc.)");
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Le fichier est trop lourd. Taille maximale : 5 Mo");
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    setUploadError(null);
    setUploadSuccess(null);
  }

  async function handleUpload() {
    if (!documentType || !selectedFile) {
      setUploadError("Veuillez sélectionner un type de document et un fichier");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      // Upload to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop() || "jpg";
      const fileName = `${documentType}/${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}.${fileExt}`;

      const { error: storageUploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, selectedFile);

      if (storageUploadError) throw storageUploadError;

      // Insert document record
      const { error: dbError } = await supabase
        .from("user_verification_documents")
        .insert({
          user_id: user.id,
          document_type: documentType,
          storage_path: fileName,
          verified: false,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadSuccess("Document téléchargé avec succès ! En attente de validation.");
      setDocumentType("");
      setSelectedFile(null);
      setFilePreview(null);

      // Refresh documents list
      await loadProfileAndDocuments();

    } catch (err) {
      console.error("Error uploading document:", err);
      setUploadError(
        err instanceof Error
          ? err.message
          : "Erreur lors du téléchargement. Veuillez vérifier votre fichier et réessayer."
      );
    } finally {
      setUploading(false);
    }
  }

  function getDocumentTypeLabel(type: string): string {
    const typeObj = documentTypes.find((t) => t.value === type);
    return typeObj ? typeObj.label : type;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist">
        <div className="text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-route">
            <span className="font-display text-sm font-bold text-white">L+</span>
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-ink">
            Vérification d&apos;identité
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Chargement de vos informations&hellip;
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist">
        <div className="text-center">
          <p className="text-sm text-ink/60">
            Veuillez vous connecter pour accéder à cette page
          </p>
          <Link href="/login" className="mt-4 btn-primary">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // Calculate verification progress
  const requiredDocs = ["identity_front", "identity_back", "selfie_with_id", "shop_photo"];

  const verifiedDocsCount = documents.filter(
    (doc) =>
      doc.verified &&
      requiredDocs.includes(doc.document_type)
  ).length;

  const progressPercent = requiredDocs.length > 0 ? Math.round((verifiedDocsCount / requiredDocs.length) * 100) : 100;
  const isFullyVerified = verifiedDocsCount === requiredDocs.length;

  return (
    <div className="min-h-screen bg-paper">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-route">
            <span className="font-display text-sm font-bold text-white">L+</span>
          </div>
          <span className="font-display text-lg font-bold text-ink">LivreurPlus</span>
        </div>
        <Link href="/" className="btn-secondary">
          Retour à l&apos;accueil
        </Link>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="space-y-8">
          {/* Profile Info */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  {profile.nom || "Utilisateur"}
                </h2>
                <p className="mt-1 text-sm text-ink/60">
                  {profile.role === "commercant" && "Commerçant"}
                  {profile.role === "livreur" && "Livreur"}
                  {profile.role === "client" && "Client"}
                </p>
              </div>
              {profile.is_identity_verified && (
                <span className="badge bg-route-tint text-route-dark">
                  Identité vérifiée
                </span>
              )}
            </div>
          </div>

          {/* Verification Progress */}
          {requiredDocs.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold text-ink mb-4">
                Progression de la vérification
              </h2>
              <div className="space-y-4">
                <div className="w-full bg-line rounded-full h-2.5">
                  <div
                    className="bg-route h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-ink/60 text-center">
                  {verifiedDocsCount}/{requiredDocs.length} documents vérifiés
                  {isFullyVerified && " - Vérification complète !"}
                </p>
              </div>
            </div>
          )}

          {/* Required Documents List */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-ink mb-4">
              Documents requis pour la vérification
            </h2>
            <div className="space-y-4">
              {requiredDocs.map((docType) => {
                const doc = documents.find((d) => d.document_type === docType);
                const label =
                  documentTypes.find((t) => t.value === docType)?.label ||
                  docType;
                const isVerified = doc?.verified ?? false;
                const isUploaded = !!doc;
                const isPending = isUploaded && !isVerified;

                return (
                  <div key={docType} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-display text-base font-bold text-ink">
                          {label}
                        </h3>
                        <p className="mt-1 text-sm text-ink/60">
                          {isVerified
                            ? "Document validé par l'équipe"
                            : isPending
                              ? "Document en attente de validation"
                              : "Document non téléchargé"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            isVerified
                              ? "bg-green-tint text-green"
                              : isPending
                                ? "bg-amber-tint text-amber"
                                : "bg-line-tint text-line"
                          }`}
                        >
                          {isVerified
                            ? "Validé"
                            : isPending
                              ? "En attente"
                              : "Manquant"}
                        </span>
                      </div>
                    </div>
                    {isUploaded && doc.storage_path && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-ink">Aperçu :</p>
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/verification-documents/${doc.storage_path}`}
                          alt="Document preview"
                          className="max-w-full h-32 object-contain rounded border border-line"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Section */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-ink mb-4">
              Téléverser un document
            </h2>

            {uploadError && (
              <div className="mb-4 rounded-bg bg-amber-tint px-3 py-2 text-xs text-amber">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="mb-4 rounded-lg bg-route-tint px-3 py-2 text-xs text-route-dark">
                {uploadSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Type de document
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-route"
                >
                  <option value="">Sélectionnez un type de document</option>
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Sélectionner un fichier (image uniquement, max 5 Mo)
                </label>
                <div
                  className="border-2 border-dashed border-ink/20 rounded-md p-4 text-center cursor-pointer"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="max-w-full h-48 object-contain rounded-md" />
                  ) : (
                    <>
                      <p className="text-sm text-ink/60">Cliquez pour sélectionner un fichier</p>
                      <p className="text-xs text-ink/40">JPG, PNG, GIF autorisés (5 Mo max)</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  id="file-input"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {selectedFile && !filePreview && (
                  <p className="mt-2 text-sm text-ink/60">
                    {selectedFile.name} ({Math.round(selectedFile.size / 1024)} Ko)
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !documentType || !selectedFile}
                  className={`btn-primary !py-2.5 px-6 text-xs ${
                    uploading || !documentType || !selectedFile ? "opacity-50" : ""
                  }`}
                >
                  {uploading ? "Téléversement..." : "Téléverser le document"}
                </button>
              </div>
            </div>
          </div>

          {/* All Documents */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-ink mb-4">
              Tous vos documents téléversés
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-ink/60 text-center">
                Aucun document téléversé pour le moment
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-display text-base font-bold text-ink">
                          {getDocumentTypeLabel(doc.document_type)}
                        </h3>
                        <p className="mt-1 text-sm text-ink/60">
                          Téléversé le {new Date(doc.created_at).toLocaleDateString(
                            "fr-FR"
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            doc.verified
                              ? "bg-green-tint text-green"
                              : "bg-amber-tint text-amber"
                          }`}
                        >
                          {doc.verified ? "Validé" : "En attente"}
                        </span>
                      </div>
                    </div>
                    {doc.storage_path && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-ink">Aperçu :</p>
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/verification-documents/${doc.storage_path}`}
                          alt="Document preview"
                          className="max-w-full h-32 object-contain rounded border border-line"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes and Help */}
          <div className="card p-6 bg-route-tint">
            <h2 className="font-display text-lg font-bold text-route-dark mb-4">
              Informations importantes
            </h2>
            <ul className="space-y-2 text-sm text-route-dark/80 list-disc pl-5">
              <li>
                La vérification d&apos;identité est obligatoire pour recevoir des commandes
                (pour les commerçants) ou effectuer des livraisons (pour les livreurs).
              </li>
              <li>
                Tous les documents sont traités de manière confidentielle et sécurisée.
              </li>
              <li>
                La validation des documents prend généralement moins de 24 heures ouvrées.
              </li>
              <li>
                En cas de problème avec vos documents, vous serez notifié par email ou
                notification dans l&apos;application.
              </li>
              <li>
                Pour toute question, contactez le support via l&apos;aide dans l&apos;application.
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-8 bg-mist">
        <p className="text-xs text-ink/40 text-center">
          LivreurPlus &copy; {new Date().getFullYear()} - Tous droits réservés
        </p>
      </footer>
    </div>
  );
}