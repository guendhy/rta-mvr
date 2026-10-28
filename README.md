# PNG RTA Motorcycle Registration & Payment System — Phase 1 Prototype

A fully static, interactive UAT prototype of the **Papua New Guinea Road Traffic Authority (RTA)**
motorcycle registration and payment system. It covers the complete operational workflow — owner
capture, motorcycle details, documents, roadworthiness inspection, third-party insurance, fee
assessment, payment (cash / POS / online / bank transfer), simulated POS terminal, receipts,
supervisor approval, registration numbers, plate assignment, certificates, labels, renewals,
reporting and administration.

Everything runs **locally in the browser** with dummy data. There is no backend, no Supabase,
no payment gateway, no POS hardware, no email/SMS and no environment variables.

> The UI follows the Claude design canvas *"PNG RTA Motorcycle Registration & Payment System"*
> (colours, typography, components, layouts, print documents, mobile and Android POS screens).

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

All accounts use the password **`password123`**. The login page has quick-fill buttons.

| Role | Email | Demo user |
| --- | --- | --- |
| Super Admin | superadmin@rta.gov.pg | Michael Tamate · RTA-EMP-0001 |
| RTA Admin | admin@rta.gov.pg | Joanne Sakias · RTA-EMP-0014 |
| Registration Officer | registration@rta.gov.pg | Grace Wari · RTA-EMP-0102 |
| Inspection Officer | inspection@rta.gov.pg | Lucas Kumul · RTA-EMP-0215 |
| Cashier | cashier@rta.gov.pg | Esther Moi · RTA-EMP-0321 |
| Supervisor | supervisor@rta.gov.pg | Peter Kaupa · RTA-EMP-0044 |
| Plate Officer | plate@rta.gov.pg | Thomas Yakam · RTA-EMP-0408 |
| Auditor | auditor@rta.gov.pg | Ruth Aisi · RTA-EMP-0510 |

All people, IDs, VINs and phone numbers are fictional.

## Demo roles & permissions

A **DEMO MODE** badge and a **Demo Role** switcher sit in the header (and in Demo Tools / the
mobile "More" menu). Switching roles updates navigation and allowed actions immediately.

| Role | Access |
| --- | --- |
| Super Admin | Everything |
| RTA Admin | Dashboard, registrations, registry, inspections, insurance, payments, plates, documents, reports, administration (except role editing) |
| Registration Officer | Dashboard, registrations, registry, renewals, documents (incl. document verification, assessment) |
| Inspection Officer | Dashboard, inspection queue and history |
| Cashier | Dashboard, payment queue, POS terminal, payment history |
| Supervisor | Dashboard, approval queue, registered applications, registry, reports |
| Plate Officer | Dashboard, plate inventory, plate assignment |
| Auditor | Read-only: registration records, registry, payments, reports, audit logs |

Permissions are centralised in `src/lib/permissions.ts`, editable at **Administration → Roles**,
and enforced twice: the dashboard layout blocks unauthorised URLs ("Access restricted"), and
every mutating mock service calls `requirePermission(...)`.

## Workflow

```
Login → Dashboard → Owner → Motorcycle → Documents → Inspection → Insurance → Assessment
→ Payment (POS / cash / online / bank) → Receipt → Supervisor Approval → Registration Number
→ Plate Assignment → Certificate + Label → Registered → Renewal → Reports
```

The state machine lives in `src/lib/workflow.ts`:

```
draft → pending → for_inspection → for_insurance_verification → for_assessment
      → payment_required → paid → for_approval → approved (awaiting plate) → registered
for_inspection → inspection_failed → for_inspection          (reinspection)
for_approval   → returned → pending → …                       (correction; paid stages are kept)
for_approval   → rejected
```

Invalid transitions throw. Approval requires Inspection = Passed, Insurance = Verified,
Payment = Successful, required Documents = Verified and a valid Assessment.

Generated numbers (counters persisted locally, never reused):

| Item | Format |
| --- | --- |
| Transaction | `RTA-MC-2026-000001` |
| Payment reference | `PAY-20261027-000001` |
| Receipt | `RTA-OR-2026-000001` |
| Registration | `MC-{PROVINCE}-{YEAR}-{SEQ}` e.g. `MC-NCD-2026-000001` |
| Certificate / label | `COR-2026-000001` / `LBL-2026-000001` |
| Roadworthiness certificate | `RWC-2026-000001` |

Fees come from configuration (**Administration → Fees**): registration without sidecar K185,
with sidecar K345, number plate K120, and optional fees. Change K185 → K190 and the next
assessment uses it immediately.

## Test scenarios (seeded)

| Transaction | Scenario |
| --- | --- |
| RTA-MC-2026-000021 | A — New registration ready for inspection |
| RTA-MC-2026-000022 | B — Failed inspection requiring reinspection |
| RTA-MC-2026-000023 | C — Expired insurance |
| RTA-MC-2026-000024 | D — All requirements complete, ready for payment |
| RTA-MC-2026-000026 | E — POS payment declined |
| RTA-MC-2026-000025 | F — Paid, awaiting supervisor approval |
| RTA-MC-2026-000027 | G — Approved, waiting for plate assignment |
| RTA-MC-2026-000005 | H — Expired registration ready for renewal |
| RTA-MC-2026-000029 | I — Returned for correction |
| RTA-MC-2026-000030 | J — Rejected application |

**Demo Tools → Scenarios** can *Open* each seeded record or create a *New* one in that state.
Seed totals: 20 owners, 25 motorcycles, 30 applications, 25+ inspections, 25+ insurance
records, 25 payments, 50 plates, 50+ audit events, 15 notifications, 5 terminals, 5 offices,
12 users (8 demo logins). Dates are relative to "now", so today's KPIs always have data.

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
  data/mock/    Seed data and the scenario builder (owners, motorcycles, applications, …)
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
- Records use UUIDs and ISO timestamps and are normalised (owners, motorcycles, applications,
  inspections, insurance, payments, plates) to map directly onto Postgres tables.

## Future Supabase migration

Phase 2 replaces `services/mock/*` with Supabase implementations behind the same interfaces
and flips `appConfig.backendMode` to `"supabase"` — no page rewrites. See
[docs/PHASE_2_SUPABASE_PLAN.md](docs/PHASE_2_SUPABASE_PLAN.md).
