-- ============================================================================
-- Ajoute le blocage utilisateur + corrige une faille de sécurité :
-- la policy "un utilisateur modifie son propre profil" n'a aucune
-- restriction de colonne. Sans ce correctif, n'importe qui pourrait :
--   - se donner is_admin = true lui-même
--   - se débloquer lui-même une fois bloqué
-- Migration additive, sûre à exécuter sur un projet en production.
-- ============================================================================

alter table public.profiles
  add column if not exists est_bloque boolean not null default false;

-- Empêche quiconque n'est pas déjà admin de modifier is_admin/est_bloque,
-- même sur sa propre ligne. Les autres colonnes (nom, telephone, avatar_url)
-- restent modifiables normalement par leur propriétaire.
create or replace function public.proteger_colonnes_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin) or (new.est_bloque is distinct from old.est_bloque) then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
      new.is_admin := old.is_admin;
      new.est_bloque := old.est_bloque;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_colonnes_admin on public.profiles;
create trigger profiles_proteger_colonnes_admin
  before update on public.profiles
  for each row execute function public.proteger_colonnes_admin();

-- Permet à un admin de modifier N'IMPORTE QUEL profil (nécessaire pour
-- bloquer/débloquer d'autres utilisateurs). Le trigger ci-dessus reste actif
-- et protège quand même les colonnes sensibles pour tout non-admin.
drop policy if exists "profiles: admin peut tout modifier" on public.profiles;
create policy "profiles: admin peut tout modifier"
  on public.profiles for update
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));
