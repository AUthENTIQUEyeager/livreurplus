export type Role = "commercant" | "livreur" | "client";

export type StatutCommande =
  | "en_attente"
  | "assignee"
  | "en_livraison"
  | "livree"
  | "annulee";

export type StatutLivreur = "disponible" | "en_course" | "hors_ligne";

export interface Profile {
  id: string;
  role: Role;
  nom: string;
  telephone: string | null;
  avatar_url: string | null;
  created_at: string;
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

export const LABELS_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  assignee: "Assignée",
  en_livraison: "En livraison",
  livree: "Livrée",
  annulee: "Annulée",
};
