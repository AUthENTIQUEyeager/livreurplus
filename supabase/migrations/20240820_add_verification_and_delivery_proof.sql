-- ============================================================================
-- LIVREURPLUS V2 - ADD VERIFICATION AND DELIVERY PROOF SYSTEMS
-- Safe additive migration for live deployment
-- ============================================================================

-- Enable uuid-ossp extension if not already enabled (should be from initial schema)
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. EXTEND PROFILES TABLE WITH VERIFICATION FIELDS
-- ----------------------------------------------------------------------------
-- Add verification status columns with safe defaults
alter table public.profiles
  add column if not exists is_identity_verified boolean not null default false,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_approved_at timestamptz,
  add column if not exists verification_reason text;

-- ----------------------------------------------------------------------------
-- 2. USER VERIFICATION DOCUMENTS TABLE
-- Stores all verification documents (ID, selfie, shop photo, vehicle reg)
-- ----------------------------------------------------------------------------
create table if not exists public.user_verification_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in (
    'identity_front',
    'identity_back',
    'selfie_with_id',
    'shop_photo',
    'vehicle_registration',
    'commerce_license'
  )),
  storage_path text not null, -- Path in Supabase Storage bucket
  verified boolean not null default false,
  verified_by uuid references auth.users(id), -- Admin who verified
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_user_verification_documents_user_id on public.user_verification_documents(user_id);
create index if not exists idx_user_verification_documents_type on public.user_verification_documents(document_type);
create index if not exists idx_user_verification_documents_verified on public.user_verification_documents(verified);

-- Enable RLS
alter table public.user_verification_documents enable row level security;

-- Policies for verification documents
create policy "user_verification_documents: users can insert their own docs"
  on public.user_verification_documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_verification_documents: users can view their own docs"
  on public.user_verification_documents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_verification_documents: admins can view all docs"
  on public.user_verification_documents for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant' -- Assuming commerçants can moderate initially
    -- In production, add proper admin role check
  ));

create policy "user_verification_documents: admins can update verification status"
  on public.user_verification_documents for update
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant'
  ));

-- ----------------------------------------------------------------------------
-- 3. DELIVERY PROOF SYSTEM
-- Stores QR scan evidence and delivery confirmation photo
-- ----------------------------------------------------------------------------
create table if not exists public.delivery_proofs (
  id uuid primary key default uuid_generate_v4(),
  ordre_id uuid not null references public.commandes(id) on delete cascade,
  livreur_id uuid not null references public.profiles(id) on delete cascade,
  qr_code_data text not null, -- The data encoded in the QR code (for verification)
  qr_scanned_at timestamptz not null,
  confirmation_photo_path text not null, -- Path to delivery confirmation photo in storage
  confirmation_photo_taken_at timestamptz not null,
  -- Geolocation at time of proof (optional but useful)
  latitude double precision,
  longitude double precision,
  -- Status tracking
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  validated_by uuid references public.profiles(id), -- Who validated (commerçant or admin)
  validated_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_delivery_proofs_ordre_id on public.delivery_proofs(ordre_id);
create index if not exists idx_delivery_proofs_livreur_id on public.delivery_proofs(livreur_id);
create index if not exists idx_delivery_proofs_status on public.delivery_proofs(status);
create index if not exists idx_delivery_proofs_qr_scanned_at on public.delivery_proofs(qr_scanned_at);

-- Enable RLS
alter table public.delivery_proofs enable row level security;

-- Policies for delivery proofs
create policy "delivery_proofs: livreurs can insert their own proofs"
  on public.delivery_proofs for insert
  to authenticated
  with check (
    auth.uid() = livreur_id
    and exists (
      select 1 from public.commandes
      where id = ordre_id and livreur_id = auth.uid()
    )
  );

create policy "delivery_proofs: concerned parties can view proofs"
  on public.delivery_proofs for select
  to authenticated
  using (
    ordre_id in (
      select id from public.commandes
      where commerce_id in (
        select id from public.commerces where profile_id = auth.uid()
      )
      or livreur_id = auth.uid()
      or client_id = auth.uid()
    )
  );

create policy "delivery_proofs: commerçants and admins can update validation status"
  on public.delivery_proofs for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.commerces c on c.profile_id = p.id
      where p.id = auth.uid() and c.id = (
        select commerce_id from public.commandes where id = ordre_id
      )
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'commercant'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      join public.commerces c on c.profile_id = p.id
      where p.id = auth.uid() and c.id = (
        select commerce_id from public.commandes where id = ordre_id
      )
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'commercant'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. REPORTING SYSTEM
-- For reporting fraudulent or problematic users
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  report_type text not null check (report_type in (
    'false_identity',
    'non_livraison',
    'vol_marchandise',
    'fausse_commande',
    'harcelement',
    'autre'
  )),
  description text not null,
  evidence_photos text[], -- Array of storage paths for evidence photos
  status text not null default 'submitted' check (status in (
    'submitted',
    'under_review',
    'resolved',
    'rejected'
  )),
  admin_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_reports_reporter_id on public.reports(reporter_id);
create index if not exists idx_reports_reported_id on public.reports(reported_id);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_created_at on public.reports(created_at);

-- Enable RLS
alter table public.reports enable row level security;

-- Policies for reports
create policy "reports: users can submit reports"
  on public.reports for insert
  to authenticated
  using (true); -- Anyone can report anyone

create policy "reports: users can view their own reports"
  on public.reports for select
  to authenticated
  using (
    auth.uid() = reporter_id
    or auth.uid() = reported_id
  );

create policy "reports: moderators can view all reports"
  on public.reports for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant'
  ));

create policy "reports: moderators can update report status"
  on public.reports for update
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'commercant'
  ));

-- ----------------------------------------------------------------------------
-- 5. UPDATE EXTENSIONS AND TRIGGERS
-- ----------------------------------------------------------------------------
-- Ensure moddatetime extension exists (from initial schema)
create extension if not exists moddatetime schema extensions;

-- Add updated_at triggers to new tables if they don't exist
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'user_verification_documents_set_updated_at'
    and tgrelid = 'public.user_verification_documents'::regclass
  ) then
    create trigger user_verification_documents_set_updated_at
    before update on public.user_verification_documents
    for each row execute function extensions.moddatetime('updated_at');
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'delivery_proofs_set_updated_at'
    and tgrelid = 'public.delivery_proofs'::regclass
  ) then
    create trigger delivery_proofs_set_updated_at
    before update on public.delivery_proofs
    for each row execute function extensions.moddatetime('updated_at');
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'reports_set_updated_at'
    and tgrelid = 'public.reports'::regclass
  ) then
    create trigger reports_set_updated_at
    before update on public.reports
    for each row execute function extensions.moddatetime('updated_at');
  end if;
end $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================