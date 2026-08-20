-- ============================================================================
-- LIVREURPLUS V2 - ADD QR CODE AND PIN TO COMMANDES
-- Safe additive migration for live deployment
-- ============================================================================

-- Add QR code and PIN columns to commandes table if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public'
                 and table_name = 'commandes'
                 and column_name = 'qr_code_data') then
    alter table public.commandes
      add column qr_code_data text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public'
                 and table_name = 'commandes'
                 and column_name = 'qr_pin') then
    alter table public.commandes
      add column qr_pin text;
  end if;
end $$;

-- Indexes for performance (if columns were added)
create index if not exists idx_commandes_qr_pin on public.commandes(qr_pin);
create index if not exists idx_commandes_qr_code_data on public.commandes(qr_code_data);

-- Update existing commandes with a generated PIN and QR code data
-- We'll generate a random 4-digit PIN for each commande that doesn't have one
-- Note: This is safe to run multiple times as it only updates where qr_pin is null
update public.commandes
set
  qr_pin = lpad(floor(random() * 9999)::text, 4, '0'),
  qr_code_data = concat('LIVREURPLUS:', id, ':', lpad(floor(random() * 9999)::text, 4, '0'))
where qr_pin is null;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================