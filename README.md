# PNG RTA Motor Vehicle Registration & Payment System

**Road Traffic Authority — Papua New Guinea.** A static, interactive UAT prototype of the full
motor vehicle registration lifecycle for **every vehicle class** — motorcycles, cars, SUVs,
pickups, vans, buses, taxis, PMVs, trucks, prime movers, trailers, special-purpose, government,
diplomatic, emergency and agricultural vehicles:

```
Transaction Selection → Registered Owner → Vehicle Classification → Vehicle Details
→ Supporting Documents → Inspection / Verification → Fee Assessment → Review → Payment
→ Approval → Registration Certificate → Renewal / Transfer / Record Management
```

Everything runs **locally in the browser** with dummy data. There is no backend, no Supabase,
no payment gateway, no POS hardware, no email/SMS and no environment variables.

> The UI follows the Claude design canvas *"PNG RTA Motor Vehicle Registration & Payment System"*
> (colours, typography, components, layouts, print documents, mobile and Android POS screens).
> Phase 1 was motorcycle-only; motorcycle is now one vehicle type among many and existing
> motorcycle records are migrated automatically (see *Legacy data compatibility*).

**Fees are sample values.** The official PNG RTA fee schedule is not connected. Amounts marked
**Sample** in the UI are illustrative placeholders from `src/config/fee-rules.ts`; the only
non-sample amounts are those already configured in the Phase 1 motorcycle prototype.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with any demo account below. Seed data is created
automatically on first load.

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | Production build and server |

Requires Node.js 18.18+ (tested on Node 24).

## Demo credentials

All accounts use the password **`password123`**. The login page has one quick-fill button per role.

| Role | Email | Demo user |
| --- | --- | --- |
| Super Administrator | superadmin@rta.gov.pg | Michael Tamate · RTA-EMP-0001 |
| RTA Administrator | admin@rta.gov.pg | Joanne Sakias · RTA-EMP-0014 |
| Registration Officer | registration@rta.gov.pg | Grace Wari · RTA-EMP-0102 |
| Verification Officer | verification@rta.gov.pg | Dorcas Pundi · RTA-EMP-0255 |
| Vehicle Inspector | inspection@rta.gov.pg | Lucas Kumul · RTA-EMP-0215 |
| Cashier / Payment Officer | cashier@rta.gov.pg | Esther Moi · RTA-EMP-0321 |
| Supervisor / Approver | supervisor@rta.gov.pg | Peter Kaupa · RTA-EMP-0044 |
| Plate Officer | plate@rta.gov.pg | Thomas Yakam · RTA-EMP-0408 |
| Reporting / Audit User | auditor@rta.gov.pg | Ruth Aisi · RTA-EMP-0510 |

All people, organisations, IDs, VINs and phone numbers are fictional.

## Demo roles & permissions

A **DEMO MODE** badge and a **Demo Role** switcher sit in the header (and in Demo Tools / the
mobile "More" menu). Switching roles updates navigation and allowed actions immediately.

| Role | Access |
| --- | --- |
| Super Administrator | Everything |
| RTA Administrator | Everything except role editing, incl. vehicle / fee / requirement configuration |
| Registration Officer | Applications, new registrations, renewals, transfers and other transactions, registry, assessment |
| Verification Officer | Verification queue (documents), insurance verification, registry |
| Vehicle Inspector | Inspection queue and history, registry (read) |
| Cashier / Payment Officer | Payment processing, POS terminal, payment history |
| Supervisor / Approver | Approvals, applications, registry, renewals, transfers, documents, reports |
| Plate Officer | Plate inventory (by plate series) and plate assignment |
| Reporting / Audit User | Read-only: dashboard, applications, registry, payments, reports, audit logs |

Permissions are centralised in `src/lib/permissions.ts`, editable at **Administration → Roles**,
and enforced twice: the dashboard layout blocks unauthorised URLs ("Access restricted"), and
every mutating mock service calls `requirePermission(...)`. Administration pages are hidden from
roles without administration permissions.

## Transactions

Step 1 of **New Vehicle Transaction** offers every RTA transaction (`src/config/transaction-types.ts`):
New Vehicle Registration, Registration Renewal, Transfer of Ownership, Change of Vehicle Details,
Change of Owner Information, Replacement Registration Certificate, Duplicate Certificate,
Replacement Plate, Vehicle Reclassification, Deregistration / Cancellation, Registration
Reinstatement, Registration Transfer and Other. New registrations capture owner and vehicle;
every other transaction starts from a registry record found by registration number, plate, VIN,
chassis, engine number, owner name or phone. Renewals (`/renewals`) and transfers (`/transfers`)
have dedicated start screens.

The 10-step wizard (`/registrations/new?id=…`):

| Step | Content |
| --- | --- |
| 1 Transaction | Transaction type and the steps it implies |
| 2 Owner | Individual, Company / Organization, Government Agency, Diplomatic Mission or Other Entity — conditional fields; for transfers the buyer is captured and the seller kept |
| 3 Classification | Vehicle type, class (filtered by type), body type and **use** (recorded separately) |
| 4 Vehicle Details | Common fields + **dynamic technical fields** from `VEHICLE_FIELD_CONFIG` (engine cc / sidecar for motorcycles, seating / GVM / axles / permit for buses & PMVs, GVM / payload / coupling for trucks, mass / brakes / coupling for trailers, battery fields for EVs) |
| 5 Documents | Requirements resolved from transaction × vehicle type × use × ownership × import status |
| 6 Inspection | Vehicle-aware checklist; Passed / Failed / Conditional Approval / Requires Reinspection; insurance verification where required |
| 7 Fee Assessment | Itemised result of the fee engine (registration, inspection, plate, transfer, penalty, service, other) |
| 8 Review | Everything checked before payment |
| 9 Payment | POS terminal, card, QR, cash, electronic payment, bank transfer |
| 10 Approval | Supervisor approval, plate assignment (series matches type and use), certificate |

The state machine lives in `src/lib/workflow.ts`:

```
draft → pending → [for_inspection] → [for_insurance_verification] → for_assessment
      → payment_required → paid → for_approval → approved (awaiting plate) → registered
for_inspection → inspection_failed → for_inspection          (reinspection)
for_approval   → returned → pending → …                       (correction; paid stages are kept)
for_approval   → rejected
```

Inspection and insurance stages are skipped when the rules say they are not required. A zero
assessment (e.g. a diplomatic renewal) skips payment. Approval never overwrites history:
transfers append to the vehicle's ownership history, renewals extend the expiry, reclassification
and change-of-details apply the recorded change request, deregistration marks the record
Deregistered and releases its plate.

Generated numbers (counters persisted locally, never reused):

| Item | Format |
| --- | --- |
| Transaction | `RTA-MV-2026-00000001` (Phase 1 records keep `RTA-MC-…`) |
| Payment reference | `PAY-20261027-000001` |
| Receipt | `RTA-OR-2026-000001` |
| Registration | `REG-{PROVINCE}-{YY}-{SEQ}` e.g. `REG-NCD-26-000001` (existing numbers are always kept) |
| Certificate / label | `CERT-MVR-2026-000001` / `LBL-2026-000001` |
| Inspection reference / certificate | `INS-NCD-2026-000001` / `RWC-2026-000001` |

## Configuration

| Module | Source | Admin page |
| --- | --- | --- |
| Vehicle types, groups, classes, body types | `src/config/vehicle-types.ts` | Administration → Vehicle Configuration |
| Vehicle use, plate series, fuel, transmission | `src/config/vehicle-usage.ts` | Vehicle Configuration |
| Dynamic technical fields | `src/config/vehicle-fields.ts` | Vehicle Configuration · Requirements |
| Transaction types | `src/config/transaction-types.ts` | Registration Configuration |
| Document requirements | `src/config/document-requirements.ts` (seed) → `documentRules` store | Requirements (editable) |
| Inspection checklists & requirement rules | `src/config/inspection-checklists.ts` | Requirements |
| Fee rules | `src/config/fee-rules.ts` (seed) → `feeRules` store | Fees & Penalties (editable) |
| Statuses and badge colours | `src/config/statuses.ts` (`getStatusLabel`, `getStatusVariant`) | Registration Configuration |
| Payment channels | `src/config/payment-channels.ts` + settings | Settings |

The fee engine is `calculateVehicleFees()` in `src/lib/fees.ts`: the most specific active rule per
component wins (vehicle type › use › group), banded rules read the vehicle's specification
(GVM, seating, engine cc) or months overdue, and the result is itemised
(`registrationFee`, `inspectionFee`, `plateFee`, `transferFee`, `penalty`, `serviceFee`, `total`).

## Test scenarios (seeded)

| Transaction | Scenario |
| --- | --- |
| RTA-MV-2026-00000027 | A — New registration (pickup) ready for inspection |
| RTA-MV-2026-00000028 | B — Failed inspection requiring reinspection (motorcycle with sidecar) |
| RTA-MV-2026-00000029 | C — Expired insurance (van) |
| RTA-MV-2026-00000030 | D — All requirements complete, ready for payment |
| RTA-MV-2026-00000031 | E — POS payment declined (hybrid sedan) |
| RTA-MV-2026-00000032 | F — Paid, awaiting supervisor approval (electric SUV) |
| RTA-MV-2026-00000033 | G — Approved, waiting for plate assignment (light commercial) |
| RTA-MV-2026-00000005 | H — Expired registration ready for renewal |
| RTA-MV-2026-00000034 | I — Returned for correction |
| RTA-MV-2026-00000035 | J — Rejected application |
| RTA-MV-2026-00000036 | K — Transfer of ownership awaiting approval (truck) |
| RTA-MV-2026-00000037 | L — PMV renewal requiring inspection |
| RTA-MV-2026-00000038 | M — Replacement plate awaiting payment (government truck) |
| RTA-MV-2026-00000039 | N — Deregistration awaiting approval |
| RTA-MV-2026-00000040 | O — Diplomatic renewal, no amount due |
| RTA-MV-2026-00000041 | P — Reclassification Private → Taxi |

(The year in the transaction number is the current year.) **Demo Tools → Scenarios** can *Open*
each seeded record or create a *New* one in that state. Seed totals: 29 owners (20 individuals,
9 organisations), 35 vehicles across every vehicle group, 47 transactions of 7 types, ~100 plates
in 10 series. Dates are relative to "now", so today's KPIs always have data.

## Legacy data compatibility

Phase 1 stored motorcycles under `rta:motorcycles` (seed version 3). On first load the mock
backend runs `migrateLegacyStorage()` (`src/services/mock/migrate.ts` + `src/lib/legacy.ts`):
every motorcycle becomes a vehicle with `vehicleType = "motorcycle"` (class from engine cc,
sidecar kept as a specification), registration numbers, owners, transaction history, inspections,
insurance and payments are preserved, document types are mapped, administrator-changed fee
amounts are kept, and `registered` becomes `active`. The matching non-destructive SQL for
Supabase is in `docs/migrations/0002_motor_vehicle_model.sql` (not applied automatically).

## Demo Tools

The yellow **Demo Tools** button (desktop) or **More → Open Demo Tools** (mobile):

- **Current role** — switch roles.
- **POS terminal** — Connected / Disconnected / Offline / Device Error / Printer Error.
- **Next POS payment result** — Approve / Decline / Timeout / Disconnect / Unknown.
- **Network** — Online / Weak (slower responses) / Offline (payments disabled, drafts still save).
- **POS device mode** — auto-detect / force / off.
- **Simulated errors** (fire once) — Save Failed, Payment Timeout, Inspection Submission Failed,
  Plate Assignment Conflict, Network Error, Printer Error.
- **Scenarios** and **Utilities** — Generate Test Application, Reset Demo Data, Clear Local Storage.

`/dev/demo` (development only) shows the session, role, network, POS and payment-simulation
state, counters, settings and a JSON inspector of every mock table.

## Mock POS

`src/services/interfaces` defines `PosTerminalAdapter` (detect, connect, disconnect, getStatus,
initiatePayment, checkPayment, cancelPayment, printReceipt). Phase 1 ships
`MockPosTerminalAdapter` simulating a **Wiseasy P5** (`RTA Smart POS`, serial `WSP5-00094821`,
terminal `RTA-POM-001`, merchant `RTA-PNG-0001`, Android bridge).

Flow: Detect → Connect → Send Amount → Present Card → Processing → Approved / Declined /
Timeout / Connection Lost / Unknown. Safety rules:

- one idempotency key per application assessment; at most one successful payment ever
  ("This registration has already been paid." disables further payment);
- an unknown / timed-out attempt blocks all new payments until **Check Payment Status** runs;
- *Unknown* simulates "bank approved, terminal lost the reply" — the status check finds the
  approval and records it, so the card is never charged twice; *Timeout* resolves to "not
  charged" and unlocks Retry; payments are never retried automatically.

**POS device mode** (`usePosEnvironment()`) turns on for 720×1280 / 1280×720 screens, `?pos=1`,
a Wiseasy user agent or the Demo Tools override, and shows the large-button Smart POS layout.

## Printing

`src/lib/print.ts` clones the chosen document into a dedicated print root and opens the browser
print dialog with the right page size, so navigation, headers, buttons and modals never print.

- 58 mm thermal receipt and A4 official receipt (with QR verification)
- A4 Certificate of Registration (with QR)
- Registration label (100 × 70 mm, with QR)
- Reports (A4 landscape)

`PrinterAdapter` has `BrowserPrinterAdapter` and `MockPosPrinterAdapter` ("Print on POS",
which honours the printer-error simulation). QR codes are generated locally and point to the
public pages `/verify/registration/[token]` and `/verify/receipt/[token]`, which show only
non-sensitive fields.

## Resetting demo data

**Administration → Settings → Demo Data** (each with confirmation): Restore Original Seed Data,
Clear Drafts, Reset Payments, Reset Plate Inventory, Reset POS Terminals, Clear Notifications,
Clear Audit Logs, Clear All Local Data. Demo Tools also has Reset Demo Data and Clear Local
Storage. All data lives in `localStorage` under the `rta:` prefix.

## Project structure

```
src/
  app/
    (auth)/login                     Fake authentication
    (dashboard)/                     Authenticated shell + route permission guard
      dashboard, registrations (list, new = 8-step wizard, [id] record, approval),
      renewals, registry, inspections, insurance, payments (queue/history, [id], pos,
      collect/[applicationId]), plates, documents, reports, administration/*, dev/demo
    verify/registration/[token], verify/receipt/[token]   Public verification
  components/   ui (design system), layout (shell, sidebar, header, mobile nav, demo tools),
                registrations, inspections, insurance, payments, pos, printing, plates,
                registry, reports, admin, dashboard
  data/mock/    Seed data and the scenario builder (owners, vehicles, applications, …)
  services/
    interfaces/ Service contracts used by every page
    mock/       Mock implementations (localStorage + artificial latency)
    *.service.ts  Entry points that bind an interface to its implementation
  hooks/        use-service (live queries), use-demo-user, use-pos-environment,
                use-network-simulation, use-local-storage
  lib/          mock-storage, permissions, workflow, generators, formatting, constants,
                mock-delay, print, errors, config, validation/ (Zod schemas)
  types/        Domain models (UUID ids, ISO timestamps)
docs/PHASE_2_SUPABASE_PLAN.md
```

## Mock data architecture

```
Pages / Components → Service interfaces → Mock services → mockStorage (localStorage)
```

- Pages never import mock arrays or touch `localStorage`; they call e.g.
  `registrationService.list()`, `paymentService.payCash()`.
- Mock services add 200–800 ms latency (`mockDelay`, ×2.5 on a weak network) so skeletons
  and busy states can be tested, write audit events and notifications, and enforce permissions
  and workflow rules.
- `useServiceQuery` re-runs silently whenever mock storage changes, so every open screen stays
  consistent.
- Records use UUIDs and ISO timestamps and are normalised (owners, vehicles, applications,
  inspections, insurance, payments, plates) to map directly onto Postgres tables.

## Future Supabase migration

Phase 2 replaces `services/mock/*` with Supabase implementations behind the same interfaces
and flips `appConfig.backendMode` to `"supabase"` — no page rewrites. See
[docs/PHASE_2_SUPABASE_PLAN.md](docs/PHASE_2_SUPABASE_PLAN.md).
