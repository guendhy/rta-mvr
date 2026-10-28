# Phase 2 — Supabase, Vercel and real integrations

Phase 1 is a static prototype: every page talks to **service interfaces**
(`src/services/interfaces/index.ts`) implemented by **mock services** (`src/services/mock/*`)
backed by `localStorage`. Phase 2 swaps the implementations, not the UI.

```
Phase 1:  Pages → Service interfaces → Mock services     → localStorage
Phase 2:  Pages → Service interfaces → Supabase services → Supabase (Postgres, Auth, Storage)
```

Nothing in this document is implemented yet.

## 1. Switching the backend

1. Add `@supabase/supabase-js` and `@supabase/ssr`, plus `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (server-only service-role key for admin tasks).
2. Create `src/services/supabase/*.supabase.ts`, one class per interface
   (`SupabaseRegistrationService implements RegistrationService`, …).
3. In each `src/services/*.service.ts`, return the Supabase class when
   `appConfig.backendMode === "supabase"` (the switch is already there).
4. Keep `MockDemoService`, Demo Tools and `/dev/demo` for local development only.

## 2. Database (Supabase PostgreSQL)

Tables map 1:1 to `src/types` (UUID primary keys, `created_at` / `updated_at`):

| Table | Notes |
| --- | --- |
| `offices`, `inspection_centers` | Reference data |
| `profiles` | 1:1 with `auth.users`; role, office, employee number, status |
| `role_permissions` | role → permission rows (replaces the permission matrix) |
| `owners` | Unique index on `identification_number`; duplicate checks via RPC |
| `vehicles` (was `motorcycles`) | `vehicle_type`, `vehicle_class`, `vehicle_usage`, `specifications jsonb`; unique `vin`, `chassis_number`, `engine_number` (nullable for trailers) |
| `vehicle_types`, `vehicle_classes`, `vehicle_usage_categories`, `vehicle_field_rules` | Replace `src/config/vehicle-*.ts` |
| `vehicle_ownership_history`, `registration_history` | Append-only; never overwritten |
| `fee_rules`, `fee_assessments`, `fee_assessment_lines` | Replace `src/config/fee-rules.ts`; `is_sample` until the official schedule is loaded |
| `document_rules`, `inspection_items`, `payment_items`, `rta_locations` | Requirement rules, checklist results, receipt lines, offices / centres / payment points |
| `registration_applications` | Status enum, assessment JSONB, approval columns, verification token |
| `application_status_history` | Replaces the embedded `history` array |
| `application_documents` | Metadata + Storage object path |
| `inspections`, `inspection_checklist_items` | One row per attempt |
| `insurance_records` | Policy + verification fields |
| `fees` | Phase 1 only — migrated into `fee_rules` |
| `payments` | Unique `(idempotency_key) WHERE status = 'successful'` |
| `plates` | Unique `plate_number`; `category` (plate series); `assigned` plates locked by `vehicle_id` |
| `audit_events`, `notifications` | Append-only / per-user |
| `counters` | Sequence table per scope — or Postgres sequences per year/province |

Business rules move into the database:

- **Workflow**: a `transition_application(id, to_status, note)` RPC validates against the same
  transition map as `src/lib/workflow.ts` and writes history atomically.
- **Numbers**: `next_sequence(key, scope)` with `SELECT … FOR UPDATE` generates transaction,
  payment, receipt, registration, certificate and label numbers without gaps or reuse.
- **Plate assignment**: a single RPC locks the plate row, checks `status = 'available'`,
  assigns it and completes the registration in one transaction.
- **Approval**: an RPC re-checks inspection, insurance, payment, documents and assessment
  server-side before generating numbers.
- **Audit**: triggers insert `audit_events` on every important change.

## 3. Auth and RLS

- Supabase Auth (email + password, optional MFA/OTP as in the design's second login step).
- `profiles.role` drives Row Level Security; policies mirror `src/lib/permissions.ts`.
  Example: cashiers can `insert` payments only for applications in `payment_required`;
  auditors get `select` only; inspection officers update only inspections.
- The demo role switcher is removed in production.

## 4. Storage

- Buckets: `owner-documents`, `vehicle-photos`, `insurance-certificates` (private).
- Replace object-URL previews with signed URLs; keep `FileMeta` plus `storage_path`.
- Size/type validation in the upload policy (10 MB, PDF/JPG/PNG).

## 5. Payments, POS and webhooks

- **Payment provider**: create intents server-side (Route Handler / Edge Function) using the
  existing idempotency key; confirm via **webhooks** before marking `successful`.
- **POS SDK**: implement `PosTerminalAdapter` for the real transport —
  `AndroidBridgePosAdapter` (Wiseasy SDK through `window.AndroidPOS` in a WebView),
  `WebUsbPosAdapter`, `WebBluetoothPosAdapter` or `LocalBridgePosAdapter` (localhost service).
  The UI already handles connect / present card / unknown status / status check.
- `checkPayment(reference)` calls the acquirer or terminal host; never auto-retry.
- Receipts print through the terminal printer adapter (`MockPosPrinterAdapter` → real SDK).

## 6. Notifications and integrations

- **Email / SMS**: renewal reminders, approval notices (e.g. Supabase Edge Function +
  local SMS gateway). Triggered from notifications or scheduled jobs.
- **Insurance**: replace the simulated `verify()` with insurer/MVIL API lookups by policy
  number and VIN.
- **Government APIs**: licence / national ID validation for owners where available.

## 7. Deployment (Vercel)

- Deploy the Next.js app to Vercel; set Supabase env vars per environment (preview/production).
- Run SQL migrations through the Supabase CLI (`supabase db push`) in CI.
- Turn off demo features in production: `appConfig.enableDemoTools = false`, mock POS off,
  `/dev/demo` already returns 404 outside development.

## 8. Migration checklist

1. Schema + RLS + RPCs, seeded from `src/data/mock` (convert seed builders to SQL/scripts).
2. Implement Supabase services one interface at a time; run UAT scenarios A–J after each.
3. Replace `useServiceQuery` live updates with Supabase Realtime subscriptions where useful.
4. Real auth, storage, payment provider and POS adapter.
5. Security review, load test, production cut-over.

## 9. Motor vehicle model migration

`docs/migrations/0002_motor_vehicle_model.sql` generalises the motorcycle-only schema without
dropping data: `motorcycles` is renamed to `vehicles` (a `motorcycles` view remains), every
existing row gets `vehicle_type = 'motorcycle'`, organisations are added to `owners`, the
application `type` check widens to every transaction type, and the fee table becomes a rule
engine (`fee_rules`). Review and apply it manually — it is never run automatically.
