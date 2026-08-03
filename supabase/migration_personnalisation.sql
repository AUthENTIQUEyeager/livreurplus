-- ============================================================================
-- MIGRATION : personnalisation de la boutique (thème, bannière, bio)
-- À exécuter dans Supabase > SQL Editor sur un projet DÉJÀ EXISTANT.
-- Additive uniquement : ne touche à aucune colonne, table ou policy existante.
-- ============================================================================

alter table public.commerces
  add column if not exists banniere_url text,
  add column if not exists bio text,
  add column if not exists theme text not null default 'route';

-- Rien d'autre à faire : les policies RLS existantes sur "commerces"
-- (lecture publique + modification par le propriétaire) couvrent déjà
-- ces nouvelles colonnes automatiquement.
