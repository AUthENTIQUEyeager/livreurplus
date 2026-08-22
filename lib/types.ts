export type Role = "commercant" | "livreur" | "client";

export type StatutCommande =
  | "en_attente"
  | "assignee"
  | "en_livraison"
  | "livree"
  | "annulee";

export type StatutLivreur = "disponible" | "en_course" | "hors_ligne";

export type DocumentType =
  | "identity_front"
  | "identity_back"
  | "selfie_with_id"
  | "shop_photo"
  | "vehicle_registration"
  | "commerce_license";

export type DeliveryProofStatus = "pending" | "validated" | "rejected";

export type ReportStatus = "submitted" | "under_review" | "resolved" | "rejected";

export interface Profile {
  id: string;
  role: Role;
  nom: string;
  telephone: string | null;
  avatar_url: string | null;
  created_at: string;
  is_identity_verified?: boolean;
  verification_submitted_at?: string;
  verification_approved_at?: string;
  verification_reason?: string | null;
  is_admin?: boolean;
  est_bloque?: boolean;
}

export interface Commerce {
  id: string;
  profile_id: string;
  nom_boutique: string;
  slug: string;
  description: string;
  logo_url: string | null;
  adresse: string;
  actif: boolean;
  banniere_url: string | null;
  bio: string | null;
  theme: string;
  created_at: string;
}

export interface Produit {
  id: string;
  commerce_id: string;
  nom: string;
  description: string;
  prix: number;
  image_url: string | null;
  disponible: boolean;
  created_at: string;
}

export interface Commande {
  id: string;
  commerce_id: string;
  client_id: string | null;
  nom_client: string;
  telephone_client: string;
  livreur_id: string | null;
  statut: StatutCommande;
  lat: number;
  lng: number;
  adresse_texte: string;
  montant_total: number;
  created_at: string;
  updated_at: string;
  qr_code_data?: string | null;
  qr_pin?: string | null;
}

export interface CommandeItem {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
}

export interface LivreurProche {
  profile_id: string;
  nom: string;
  telephone: string | null;
  vehicule: string;
  lat: number;
  lng: number;
  distance_km: number;
}

export interface UserVerificationDocument {
  id: string;
  user_id: string;
  document_type: DocumentType;
  storage_path: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryProof {
  id: string;
  ordre_id: string;
  livreur_id: string;
  qr_code_data: string;
  qr_scanned_at: string;
  confirmation_photo_path: string;
  confirmation_photo_taken_at: string;
  latitude: number | null;
  longitude: number | null;
  status: DeliveryProofStatus;
  validated_by: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  report_type: string;
  description: string;
  evidence_photos: string[];
  status: ReportStatus;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LABELS_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  assignee: "Assignée",
  en_livraison: "En livraison",
  livree: "Livrée",
  annulee: "Annulée",
};
