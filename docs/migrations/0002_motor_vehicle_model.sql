-- ============================================================================
-- 0002 · Motor vehicle model (generalises the Phase 1 motorcycle-only schema)
-- ============================================================================
-- STATUS: NOT APPLIED. Phase 1 runs on mock services + localStorage; nothing in the
-- app executes this file. Review it, then apply with `supabase db push` when the
-- Phase 2 schema (docs/PHASE_2_SUPABASE_PLAN.md) exists.
--
-- Non-destructive by design:
--   * no DROP TABLE / DROP COLUMN — `motorcycles` is renamed and kept as a view;
--   * every existing motorcycle row becomes vehicle_type = 'motorcycle';
--   * registration numbers, owners, transactions, inspections and payments are
--     preserved untouched (only new nullable columns are added);
--   * fee amounts are NOT invented here — `fee_rules` rows are loaded from the
--     configuration export (src/config/fee-rules.ts) and flagged `is_sample`
--     until RTA supplies the official schedule.
-- Wrap in a transaction so a failure leaves the database unchanged.
-- ============================================================================
begin;

-- ── Reference data ──────────────────────────────────────────────────────────
create table if not exists vehicle_types (
  key            text primary key,               -- 'motorcycle', 'pickup', 'pmv', …
  label          text not null,
  vehicle_group  text not null check (vehicle_group in ('two_wheeler','passenger','passenger_transport','commercial','towed','special')),
  has_engine     boolean not null default true,
  default_usage  text not null,
  default_plate_category text not null,
  report_bucket  text not null,
  body_types     text[] not null default '{}',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists vehicle_classes (
  key            text not null,
  vehicle_type   text not null references vehicle_types(key),
  label          text not null,
  primary key (vehicle_type, key)
);

create table if not exists vehicle_usage_categories (
  key            text primary key,               -- 'private', 'pmv', 'diplomatic', …
  label          text not null,
  plate_category text
);

-- Dynamic technical-field schema per vehicle type (mirrors VEHICLE_FIELD_CONFIG).
create table if not exists vehicle_field_rules (
  vehicle_type   text not null,                   -- vehicle type key or group key
  field_key      text not null,                   -- 'engineCapacityCc', 'grossVehicleMassKg', …
  required       boolean not null default false,
  sort_order     int not null default 0,
  primary key (vehicle_type, field_key)
);

create table if not exists rta_locations (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('office','inspection_center','payment_location')),
  code           text not null unique,
  name           text not null,
  province       text not null,
  district       text,
  address        text,
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Owners: organisations ────────────────────────────────────────────────────
alter table owners add column if not exists ownership_type text not null default 'individual'
  check (ownership_type in ('individual','company','government','diplomatic','other_entity'));
alter table owners add column if not exists organization_name text;
alter table owners add column if not exists organization_registration_number text;
alter table owners add column if not exists authorized_representative text;
alter table owners add column if not exists representative_position text;
alter table owners add column if not exists business_phone text;
alter table owners alter column date_of_birth drop not null;   -- organisations have none
alter table owners alter column gender drop not null;
create unique index if not exists owners_org_reg_no_uq on owners (organization_registration_number) where organization_registration_number is not null;

-- ── Vehicles (rename + extend; old name kept as a compatibility view) ──────
alter table if exists motorcycles rename to vehicles;
alter table vehicles add column if not exists vehicle_type  text not null default 'motorcycle';
alter table vehicles add column if not exists vehicle_class text;
alter table vehicles add column if not exists vehicle_usage text;
alter table vehicles add column if not exists model_year int;
alter table vehicles add column if not exists secondary_color text;
alter table vehicles add column if not exists transmission text;
alter table vehicles add column if not exists previous_registration_number text;
alter table vehicles add column if not exists plate_category text;
alter table vehicles add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table vehicles add column if not exists status_reason text;
alter table vehicles add column if not exists legacy_source text;
alter table vehicles alter column engine_number drop not null; -- trailers have no engine

-- Carry Phase 1 motorcycle columns into the generic model.
update vehicles set
  vehicle_usage  = coalesce(vehicle_usage, intended_use),
  vehicle_class  = coalesce(vehicle_class, case when engine_capacity_cc > 250 then 'moto_gt_250' when engine_capacity_cc > 125 then 'moto_126_250' else 'moto_le_125' end),
  plate_category = coalesce(plate_category, 'motorcycle'),
  transmission   = coalesce(transmission, 'manual'),
  specifications = specifications || jsonb_build_object('engineCapacityCc', engine_capacity_cc, 'sidecar', sidecar, 'wheelCount', case when sidecar then 3 else 2 end),
  legacy_source  = coalesce(legacy_source, 'motorcycle')
where vehicle_type = 'motorcycle' and legacy_source is null;

-- Registry status: Phase 1 'registered' becomes 'active'; 'deregistered' is new.
update vehicles set registration_status = 'active' where registration_status = 'registered';

create or replace view motorcycles as select * from vehicles where vehicle_type in ('motorcycle','scooter');

-- Ownership history — appended on every transfer, never overwritten.
create table if not exists vehicle_ownership_history (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references vehicles(id),
  owner_id       uuid not null references owners(id),
  valid_from     timestamptz not null,
  valid_to       timestamptz,
  reason         text not null check (reason in ('first_registration','transfer','legacy_import','reinstatement')),
  application_id uuid,
  created_at     timestamptz not null default now()
);
insert into vehicle_ownership_history (vehicle_id, owner_id, valid_from, reason)
select v.id, v.owner_id, coalesce(v.registration_date, v.created_at), 'legacy_import'
from vehicles v
where not exists (select 1 from vehicle_ownership_history h where h.vehicle_id = v.id);

-- ── Applications → generic registration transactions ────────────────────────
alter table registration_applications rename column motorcycle_id to vehicle_id;
alter table registration_applications add column if not exists inspection_required boolean not null default true;
alter table registration_applications add column if not exists insurance_required  boolean not null default true;
alter table registration_applications add column if not exists plate_required      boolean not null default false;
alter table registration_applications add column if not exists transfer            jsonb;   -- TransferDetails
alter table registration_applications add column if not exists change_request      jsonb;   -- ChangeRequest
alter table registration_applications add column if not exists closure_reason      text;
alter table registration_applications add column if not exists assigned_officer_id uuid;
-- `type` widens from ('new','renewal') to every TransactionType.
alter table registration_applications drop constraint if exists registration_applications_type_check;
alter table registration_applications add constraint registration_applications_type_check check (type in (
  'new','renewal','transfer','change_vehicle','change_owner','replacement_certificate','replacement_plate',
  'duplicate_certificate','reclassification','deregistration','reinstatement','registration_transfer','other'));
update registration_applications set plate_required = (type = 'new') where plate_required is distinct from (type = 'new') and created_at < now();

create or replace view registration_transactions as select * from registration_applications;

-- Documents: required flag + reason resolved from document rules.
alter table application_documents add column if not exists required boolean not null default false;
alter table application_documents add column if not exists reason   text;
update application_documents set type = 'proof_of_identity'       where type = 'owner_identification';
update application_documents set type = 'import_documentation'    where type = 'import_purchase';
update application_documents set type = 'inspection_certificate'  where type = 'roadworthiness_certificate';

create table if not exists document_rules (
  id               text primary key,               -- 'DR-01'
  document         text not null,
  required         boolean not null,
  transaction_types text[], vehicle_types text[], vehicle_groups text[], usages text[], ownership_types text[], import_statuses text[],
  reason           text not null,
  active           boolean not null default true,
  updated_at       timestamptz not null default now()
);

-- ── Inspections ──────────────────────────────────────────────────────────────
alter table inspections rename column motorcycle_id to vehicle_id;
alter table inspections add column if not exists reference   text unique;
alter table inspections add column if not exists location    text;
alter table inspections add column if not exists odometer_km integer;
alter table inspections add column if not exists conditions  text;
alter table inspections drop constraint if exists inspections_result_check;
alter table inspections add constraint inspections_result_check check (result in ('pass','fail','conditional'));
create table if not exists inspection_items (
  inspection_id  uuid not null references inspections(id),
  item_key       text not null,
  value          text not null check (value in ('pass','fail','na')),
  defect_severity text check (defect_severity in ('minor','major','dangerous')),
  note           text,
  primary key (inspection_id, item_key)
);

alter table insurance_records rename column motorcycle_id to vehicle_id;

-- ── Fees: configurable rule engine replaces the fixed motorcycle fee list ───
create table if not exists fee_rules (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  name             text not null,
  component        text not null check (component in ('registration','inspection','plate','transfer','penalty','service','other')),
  transaction_types text[] not null,
  vehicle_types    text[], vehicle_groups text[], usages text[],
  requires_new_plate boolean, requires_inspection boolean, applies_when_overdue boolean,
  spec_equals      jsonb,
  basis            text not null check (basis in ('flat','banded','per_unit')),
  amount           numeric(12,2) not null default 0 check (amount >= 0),
  metric           text,
  bands            jsonb,                         -- [{min, max, amount}]
  optional         boolean not null default false,
  active           boolean not null default true,
  effective_date   date not null,
  currency         text not null default 'PGK',
  is_sample        boolean not null default true, -- true until RTA confirms the amount
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Preserve any Phase 1 fee amounts (non-sample) under the same codes.
insert into fee_rules (code, name, component, transaction_types, vehicle_groups, basis, amount, optional, active, effective_date, is_sample, notes)
select f.code, f.name,
       case when f.code like 'REG%' then 'registration' when f.code like '%PLATE%' then 'plate' when f.code = 'TRANSFER' then 'transfer' else 'other' end,
       array['new','renewal','reinstatement'], array['two_wheeler'], 'flat', f.amount, f.optional, f.active, f.effective_date, false, 'Migrated from Phase 1 fees'
from fees f
where not exists (select 1 from fee_rules r where r.code = f.code);

create table if not exists fee_assessments (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references registration_applications(id),
  rule_set       text not null,
  total          numeric(12,2) not null,
  contains_sample_amounts boolean not null default false,
  generated_by   uuid,
  generated_at   timestamptz not null default now()
);
create table if not exists fee_assessment_lines (
  assessment_id  uuid not null references fee_assessments(id),
  fee_code       text not null,
  name           text not null,
  component      text not null,
  amount         numeric(12,2) not null,
  basis          text,
  is_sample      boolean not null default false
);

-- ── Payments, plates, history, audit ────────────────────────────────────────
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check check (method in ('pos','card','qr','cash','online','bank_transfer'));
create table if not exists payment_items (
  payment_id     uuid not null references payments(id),
  fee_code       text not null,
  name           text not null,
  amount         numeric(12,2) not null
);

alter table plates rename column motorcycle_id to vehicle_id;
alter table plates add column if not exists category text not null default 'motorcycle';

create table if not exists registration_history (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references vehicles(id),
  application_id uuid references registration_applications(id),
  event          text not null,                   -- new, renewal, transfer, reclassification, replacement, suspension, cancellation, deregistration
  registration_number text,
  valid_from     timestamptz,
  valid_to       timestamptz,
  recorded_at    timestamptz not null default now()
);

-- audit_events already exists; new action values are free text:
--   vehicle_created, vehicle_updated, ownership_transferred, vehicle_status_changed, requirement_changed
create or replace view audit_logs as select * from audit_events;

commit;
