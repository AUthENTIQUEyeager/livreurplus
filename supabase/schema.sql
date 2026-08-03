-- ============================================================================
-- LIVREURPLUS V2 — SCHEMA SUPABASE
-- À exécuter dans Supabase > SQL Editor (une seule fois, sur un projet neuf)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILS (extension de auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('commercant', 'livreur', 'client')),
  nom text not null default '',
  telephone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chacun peut lire les profils (nécessaire pour afficher le nom du livreur
-- assigné à un commerçant, ou le nom du commerçant à un client). On limite
-- volontairement les colonnes exposées côté app plutôt qu'au niveau SQL ici.
create policy "profiles: lecture publique authentifiée"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: un utilisateur modifie son propre profil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "profiles: un utilisateur crée son propre profil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Création automatique du profil à l'inscription (évite les lignes manquantes
-- qui causent des redirect loops côté app). SECURITY DEFINER pour contourner
-- la RLS au moment précis de l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, nom)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 2. COMMERCES
-- ----------------------------------------------------------------------------
create table public.commerces (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nom_boutique text not null,
  slug text not null unique,
  description text default '',
  logo_url text,
  adresse text default '',
  actif boolean not null default true,
  banniere_url text,
  bio text,
  theme text not null default 'route',
  created_at timestamptz not null default now()
);

alter table public.commerces enable row level security;

create policy "commerces: lecture publique"
  on public.commerces for select
  to anon, authenticated
  using (actif = true);

create policy "commerces: le propriétaire voit toujours sa boutique"
  on public.commerces for select
  to authenticated
  using (profile_id = auth.uid());

create policy "commerces: création par le propriétaire"
  on public.commerces for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "commerces: modification par le propriétaire"
  on public.commerces for update
  to authenticated
  using (profile_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 2bis. STORAGE — bannières boutique
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "banners: lecture publique"
  on storage.objects for select
  to public
  using (bucket_id = 'banners');

create policy "banners: upload par le propriétaire"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "banners: remplacement par le propriétaire"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "banners: suppression par le propriétaire"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ----------------------------------------------------------------------------
-- 3. PRODUITS (catalogue)
-- ----------------------------------------------------------------------------
create table public.produits (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces(id) on delete cascade,
  nom text not null,
  description text default '',
  prix numeric(12,2) not null check (prix >= 0),
  image_url text,
  disponible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.produits enable row level security;

create policy "produits: lecture publique des produits disponibles"
  on public.produits for select
  to anon, authenticated
  using (disponible = true);

create policy "produits: le propriétaire gère son catalogue"
  on public.produits for all
  to authenticated
  using (commerce_id in (select id from public.commerces where profile_id = auth.uid()))
  with check (commerce_id in (select id from public.commerces where profile_id = auth.uid()));


-- ----------------------------------------------------------------------------
-- 4. LIVREURS (statut + position temps réel)
-- ----------------------------------------------------------------------------
create table public.livreurs_info (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  statut text not null default 'hors_ligne' check (statut in ('disponible', 'en_course', 'hors_ligne')),
  vehicule text default 'moto',
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);

alter table public.livreurs_info enable row level security;

create policy "livreurs_info: le livreur gère sa propre ligne"
  on public.livreurs_info for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Les commerçants doivent voir les livreurs disponibles pour pouvoir assigner
create policy "livreurs_info: visible par les commerçants"
  on public.livreurs_info for select
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'commercant')
  );


-- ----------------------------------------------------------------------------
-- 5. COMMANDES
-- ----------------------------------------------------------------------------
create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces(id) on delete restrict,
  client_id uuid references public.profiles(id),
  nom_client text not null,
  telephone_client text not null,
  livreur_id uuid references public.profiles(id),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'assignee', 'en_livraison', 'livree', 'annulee')),
  lat double precision not null,
  lng double precision not null,
  adresse_texte text default '',
  montant_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commandes enable row level security;

-- Un client (avec ou sans compte) peut créer une commande.
-- On force statut='en_attente' et livreur_id=null à la création.
create policy "commandes: création publique (client)"
  on public.commandes for insert
  to anon, authenticated
  with check (statut = 'en_attente' and livreur_id is null);

create policy "commandes: le commerçant voit ses commandes"
  on public.commandes for select
  to authenticated
  using (commerce_id in (select id from public.commerces where profile_id = auth.uid()));

create policy "commandes: le livreur assigné voit sa course"
  on public.commandes for select
  to authenticated
  using (livreur_id = auth.uid());

create policy "commandes: le client voit sa propre commande"
  on public.commandes for select
  to authenticated
  using (client_id = auth.uid());

create policy "commandes: le commerçant met à jour (assignation, annulation)"
  on public.commandes for update
  to authenticated
  using (commerce_id in (select id from public.commerces where profile_id = auth.uid()));

create policy "commandes: le livreur assigné met à jour le statut de sa course"
  on public.commandes for update
  to authenticated
  using (livreur_id = auth.uid());

create trigger commandes_set_updated_at
  before update on public.commandes
  for each row execute function extensions.moddatetime('updated_at');


-- ----------------------------------------------------------------------------
-- 6. LIGNES DE COMMANDE
-- ----------------------------------------------------------------------------
create table public.commande_items (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  nom_produit text not null,
  quantite integer not null check (quantite > 0),
  prix_unitaire numeric(12,2) not null
);

alter table public.commande_items enable row level security;

create policy "commande_items: création publique liée à la commande"
  on public.commande_items for insert
  to anon, authenticated
  with check (true);

create policy "commande_items: lecture si accès à la commande parente"
  on public.commande_items for select
  to authenticated
  using (
    commande_id in (
      select id from public.commandes
      where commerce_id in (select id from public.commerces where profile_id = auth.uid())
         or livreur_id = auth.uid()
         or client_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 7. HISTORIQUE DE POSITION (trace du trajet, pour le tracking live)
-- ----------------------------------------------------------------------------
create table public.positions_livraison (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes(id) on delete cascade,
  livreur_id uuid not null references public.profiles(id),
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table public.positions_livraison enable row level security;

create policy "positions: le livreur assigné publie sa position"
  on public.positions_livraison for insert
  to authenticated
  with check (
    livreur_id = auth.uid()
    and commande_id in (select id from public.commandes where livreur_id = auth.uid())
  );

create policy "positions: visible par commerçant, livreur et client concernés"
  on public.positions_livraison for select
  to authenticated
  using (
    commande_id in (
      select id from public.commandes
      where commerce_id in (select id from public.commerces where profile_id = auth.uid())
         or livreur_id = auth.uid()
         or client_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 8. MATCHING — livreurs disponibles les plus proches (Haversine)
-- ----------------------------------------------------------------------------
create or replace function public.livreurs_proches(
  order_lat double precision,
  order_lng double precision,
  rayon_km double precision default 15,
  limite integer default 5
)
returns table (
  profile_id uuid,
  nom text,
  telephone text,
  vehicule text,
  lat double precision,
  lng double precision,
  distance_km double precision
)
language sql
stable
security definer set search_path = public
as $$
  select
    li.profile_id,
    p.nom,
    p.telephone,
    li.vehicule,
    li.lat,
    li.lng,
    (
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(order_lat)) * cos(radians(li.lat)) *
          cos(radians(li.lng) - radians(order_lng)) +
          sin(radians(order_lat)) * sin(radians(li.lat))
        ))
      )
    ) as distance_km
  from public.livreurs_info li
  join public.profiles p on p.id = li.profile_id
  where li.statut = 'disponible'
    and li.lat is not null
    and li.lng is not null
  order by distance_km asc
  limit limite;
$$;

-- Nécessite l'extension moddatetime pour updated_at automatique
create extension if not exists moddatetime schema extensions;

-- Index utiles
create index idx_produits_commerce on public.produits(commerce_id);
create index idx_commandes_commerce on public.commandes(commerce_id);
create index idx_commandes_livreur on public.commandes(livreur_id);
create index idx_commandes_statut on public.commandes(statut);
create index idx_positions_commande on public.positions_livraison(commande_id);

-- ============================================================================
-- FIN DU SCHÉMA
-- Prochaine étape : Authentication > Providers > activer Google dans Supabase
-- ============================================================================
