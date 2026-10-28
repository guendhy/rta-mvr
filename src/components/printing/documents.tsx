"use client";

/* eslint-disable @next/next/no-img-element -- print layouts need plain <img> so the browser prints them reliably */
import { formatDate, formatDateLong, formatMoney, formatTime, fullName } from "@/lib/formatting";
import { generators } from "@/lib/generators";
import { transactionLabel } from "@/config/transaction-types";
import { getVehicleType, vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { FUEL_TYPES, vehicleUsageLabel } from "@/config/vehicle-usage";
import { formatSpecValue } from "@/config/vehicle-fields";
import { QrCode } from "@/components/ui/qr-code";
import type { Office, Owner, ReceiptData, RegistrationApplication, Vehicle } from "@/types";

const LOGO = "/brand/rta-logo.png";
const FLAG = ["#ED1C24", "#FFD21A", "#1FA84F", "#1515E8"];

function FlagBar({ height }: { height: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", height }} aria-hidden="true">
      {FLAG.map((c) => <div key={c} style={{ background: c }} />)}
    </div>
  );
}

const mono = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const sans = "Inter, system-ui, sans-serif";
const SAMPLE_NOTE = "Amounts marked SAMPLE are illustrative placeholders, not the official PNG RTA fee schedule.";

/** Short line label for the 58 mm receipt ("Registration fee — Light vehicle" → "Registration fee"). */
const shortLine = (name: string) => name.split(" — ")[0];

/** 58mm thermal receipt (≈220px wide). */
export function ThermalReceipt({ data, id }: { data: ReceiptData; id: string }) {
  const row = (k: string, v?: string | number) => (v === undefined || v === "" ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><span>{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
  ));
  const block = (k: string, v?: string) => (v ? <div><div>{k}</div><div style={{ fontWeight: 600, wordBreak: "break-all" }}>{v}</div></div> : null);
  const hasSample = data.lines.some((l) => l.sample);
  return (
    <div id={id} style={{ width: "58mm", boxSizing: "border-box", padding: "14px 10px 20px", background: "#fff", color: "#000", fontFamily: mono, fontSize: 11, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 3 }}>
        <img src={LOGO} alt="RTA logo" style={{ width: 56, height: 56, filter: "grayscale(1) contrast(1.4)" }} />
        <span style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em" }}>ROAD TRAFFIC AUTHORITY</span>
        <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: ".1em" }}>PAPUA NEW GUINEA</span>
        <span>{data.office}</span>
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ textAlign: "center", fontFamily: sans, fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>MOTOR VEHICLE<br />OFFICIAL RECEIPT</div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {block("Receipt No.", data.receiptNumber)}
        {block("Transaction Ref.", data.transactionNumber)}
        {block("Transaction Type", data.transactionType.toUpperCase())}
        {block("Registration No.", data.registrationNumber ?? "Pending approval")}
        {block("Plate", data.plateNumber)}
        {block("Owner", data.owner.toUpperCase())}
        {block("Vehicle", data.vehicle.toUpperCase())}
        {block("Vehicle Type", data.vehicleType.toUpperCase())}
        {block("VIN / Chassis", data.vinOrChassis)}
        {data.engineNumber ? block("Engine No.", data.engineNumber) : null}
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {data.lines.map((l, i) => <div key={`${l.name}-${i}`}>{row(`${shortLine(l.name)}${l.sample ? " *" : ""}`, l.amount.toFixed(2))}</div>)}
      </div>
      <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 0", display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 800, fontSize: 15 }}><span>PAID</span><span>{formatMoney(data.amount)}</span></div>
      {hasSample && <div style={{ fontSize: 9.5 }}>* SAMPLE amount — not the official PNG RTA fee schedule.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {row("Method", data.paymentMethod.toUpperCase())}
        {row("Card", data.cardMasked)}
        {row("Approval", data.approvalCode)}
        {data.amountTendered !== undefined && row("Tendered", data.amountTendered.toFixed(2))}
        {data.change !== undefined && row("Change", data.change.toFixed(2))}
        {block("Payment Ref.", data.paymentReference)}
        {row("Terminal", data.terminalId)}
        {row("Cashier", data.cashier.toUpperCase())}
        {row("Date", formatDate(data.paidAt, "dd/MM/yyyy"))}
        {row("Time", formatTime(data.paidAt))}
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
        <QrCode path={data.verifyPath} size={112} label="Receipt verification QR code" />
        <span>Scan to verify authenticity</span>
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: 11 }}>Official RTA Transaction Receipt</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>DEMO PROTOTYPE · NOT A VALID RECEIPT</div>
    </div>
  );
}

/** A4 official receipt. */
export function A4Receipt({ data, id }: { data: ReceiptData; id: string }) {
  const pair = (k: string, v: string | undefined, isMono = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #E1E4EA", paddingBottom: 7 }}>
      <span style={{ color: "#3A3F4A" }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all", ...(isMono ? { fontFamily: mono, fontSize: 13.5 } : {}) }}>{v || "—"}</span>
    </div>
  );
  const meta = (k: string, v: string | undefined, isMono = false) => (
    <div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "#3A3F4A" }}>{k}</p>
      <p style={{ margin: "3px 0 0", fontWeight: 600, wordBreak: "break-all", ...(isMono ? { fontFamily: mono, fontSize: 13 } : {}) }}>{v || "—"}</p>
    </div>
  );
  const hasSample = data.lines.some((l) => l.sample);
  const td = { padding: "9px 0", borderBottom: "1px solid #E1E4EA" } as const;
  return (
    <div id={id} style={{ width: 794, minHeight: 1123, boxSizing: "border-box", padding: "64px 72px 56px", background: "#fff", color: "#0B0B0F", fontFamily: sans, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <img src={LOGO} alt="Road Traffic Authority seal" style={{ width: 80, height: 80 }} />
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: ".1em" }}>ROAD TRAFFIC AUTHORITY</p>
            <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, letterSpacing: ".12em" }}>PAPUA NEW GUINEA</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#3A3F4A" }}>{data.office}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A" }}>OFFICIAL RECEIPT</p>
          <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 17, fontWeight: 700 }}>{data.receiptNumber}</p>
        </div>
      </div>
      <FlagBar height={6} />
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Motor Vehicle Transaction Receipt</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px 40px", fontSize: 15 }}>
        {pair("Transaction ref.", data.transactionNumber, true)}
        {pair("Transaction type", data.transactionType)}
        {pair("Registration No.", data.registrationNumber ?? "Issued on approval", true)}
        {pair("Plate", data.plateNumber ?? "—", true)}
        {pair("Registered owner", data.owner)}
        {pair("Vehicle", data.vehicle)}
        {pair("Vehicle type", data.vehicleType)}
        {pair("VIN / chassis", data.vinOrChassis, true)}
        {data.engineNumber ? pair("Engine number", data.engineNumber, true) : null}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", fontSize: 12, letterSpacing: ".08em", color: "#3A3F4A", padding: "10px 0", borderBottom: "1.5px solid #0B0B0F" }}>DESCRIPTION</th>
            <th style={{ textAlign: "right", fontSize: 12, letterSpacing: ".08em", color: "#3A3F4A", padding: "10px 0", borderBottom: "1.5px solid #0B0B0F" }}>AMOUNT (K)</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={`${l.name}-${i}`}>
              <td style={td}>{l.name}{l.sample && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", border: "1px solid #6E5200", color: "#6E5200", borderRadius: 4, padding: "1px 5px" }}>SAMPLE</span>}</td>
              <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.amount.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: "14px 0", fontSize: 18, fontWeight: 800 }}>Amount paid</td>
            <td style={{ padding: "14px 0", textAlign: "right", fontSize: 22, fontWeight: 800 }}>{formatMoney(data.amount)}</td>
          </tr>
          {data.amountTendered !== undefined && (
            <tr><td style={{ padding: "4px 0", color: "#3A3F4A", fontSize: 14 }}>Amount tendered / change</td><td style={{ padding: "4px 0", textAlign: "right", color: "#3A3F4A", fontSize: 14 }}>{formatMoney(data.amountTendered)} / {formatMoney(data.change)}</td></tr>
          )}
        </tbody>
      </table>
      {hasSample && <p style={{ margin: 0, fontSize: 12, color: "#3A3F4A" }}>{SAMPLE_NOTE}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "14px 24px", padding: "18px 20px", background: "#F4F5F8", borderRadius: 8, fontSize: 14 }}>
        {meta("METHOD", [data.paymentMethod, data.cardMasked].filter(Boolean).join(" "))}
        {meta("PAYMENT REF.", data.paymentReference, true)}
        {meta("APPROVAL CODE", data.approvalCode, true)}
        {meta("TERMINAL", data.terminalId, true)}
        {meta("CASHIER", data.cashier)}
        {meta("DATE · TIME", `${formatDate(data.paidAt)} · ${formatTime(data.paidAt)}`)}
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, borderTop: "1.5px solid #0B0B0F", paddingTop: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <QrCode path={data.verifyPath} size={104} label="Receipt verification QR code" />
          <div style={{ maxWidth: 220 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Verify this receipt</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.45, color: "#3A3F4A" }}>Scan to confirm receipt number, amount and payment status.</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Official RTA Transaction Receipt</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#3A3F4A" }}>Demo prototype output — not a valid official receipt</p>
        </div>
      </div>
    </div>
  );
}

export interface CertificateData {
  application: RegistrationApplication;
  owner: Owner;
  vehicle: Vehicle;
  office: Office | null;
  supervisorName: string;
  receiptNumber?: string;
}

const lbl = { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A" } as const;
const val = { margin: "3px 0 0", fontWeight: 600 } as const;

/** "2,910 kg · 5 seats" — GVM and seating where the vehicle type records them. */
function massAndSeating(v: Vehicle): { label: string; value: string } | null {
  const gvm = v.specifications?.grossVehicleMassKg;
  const seats = v.specifications?.seatingCapacity;
  const hasGvm = gvm !== undefined && gvm !== "";
  const hasSeats = seats !== undefined && seats !== "";
  if (!hasGvm && !hasSeats) return null;
  if (hasGvm && hasSeats) return { label: "GVM / SEATING", value: `${formatSpecValue("grossVehicleMassKg", gvm)} · ${seats}` };
  if (hasGvm) return { label: "GVM", value: formatSpecValue("grossVehicleMassKg", gvm) };
  return { label: "SEATING CAPACITY", value: String(seats) };
}

/** A4 Motor Vehicle Registration Certificate with QR verification. */
export function CertificateOfRegistration({ data, id }: { data: CertificateData; id: string }) {
  const { application: a, owner: o, vehicle: v } = data;
  const address = [o.street, o.ward, o.llg, o.district, o.province].filter(Boolean).join(", ");
  const hasEngine = getVehicleType(v.vehicleType).hasEngine && !!v.engineNumber;
  const ms = massAndSeating(v);
  const f = (k: string, value: React.ReactNode, opts: { mono?: boolean; span?: number; strong?: boolean } = {}) => (
    <div style={opts.span ? { gridColumn: `span ${opts.span}` } : undefined}>
      <p style={lbl}>{k}</p>
      <p style={{ ...val, fontFamily: opts.mono ? mono : sans, fontWeight: opts.strong ? 800 : 600, wordBreak: "break-all" }}>{value || "—"}</p>
    </div>
  );
  return (
    <div id={id} style={{ width: 794, height: 1123, boxSizing: "border-box", padding: 40, background: "#fff", fontFamily: sans, color: "#0B0B0F" }}>
      <div style={{ height: "100%", boxSizing: "border-box", border: "2px solid #0B0B0F", padding: 6 }}>
        <div style={{ height: "100%", boxSizing: "border-box", border: "1px solid #0B0B0F", display: "flex", flexDirection: "column" }}>
          <FlagBar height={10} />
          <div style={{ padding: "24px 40px 0", display: "flex", alignItems: "center", gap: 20 }}>
            <img src={LOGO} alt="Road Traffic Authority seal" style={{ width: 96, height: 96 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".2em" }}>PAPUA NEW GUINEA</p>
              <p style={{ margin: "2px 0 0", fontSize: 21, fontWeight: 800, letterSpacing: ".12em" }}>ROAD TRAFFIC AUTHORITY</p>
              <h1 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>Motor Vehicle Registration Certificate</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A" }}>CERTIFICATE NO.</p>
              <p style={{ margin: "2px 0 0", fontFamily: mono, fontSize: 14, fontWeight: 700 }}>{a.certificateNumber ?? "—"}</p>
            </div>
          </div>
          <div style={{ margin: "22px 40px 0", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: "1px solid #0B0B0F" }}>
            <div style={{ padding: "14px 18px", borderRight: "1px solid #0B0B0F" }}>
              <p style={lbl}>REGISTRATION NUMBER</p>
              <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 21, fontWeight: 700 }}>{a.registrationNumber ?? v.registrationNumber}</p>
            </div>
            <div style={{ padding: "14px 18px", background: "#FFD21A" }}>
              <p style={{ ...lbl, color: "#0B0B0F" }}>PLATE NUMBER</p>
              <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 26, fontWeight: 700, letterSpacing: ".08em" }}>{a.plateNumber ?? v.plateNumber ?? "PENDING"}</p>
            </div>
          </div>
          <div style={{ margin: "16px 40px 0", borderBottom: "1px solid #C9CED8", paddingBottom: 12 }}>
            <p style={lbl}>REGISTERED OWNER</p>
            <p style={{ margin: "3px 0 0", fontWeight: 700, fontSize: 18 }}>{fullName(o).toUpperCase()}</p>
            <p style={{ margin: "2px 0 0", fontSize: 15 }}>{address}</p>
          </div>
          <div style={{ margin: "14px 40px 0", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px 22px", fontSize: 16 }}>
            {f("VEHICLE TYPE", vehicleTypeLabel(v.vehicleType))}
            {f("CLASS", vehicleClassLabel(v.vehicleType, v.vehicleClass))}
            {f("VEHICLE USE", vehicleUsageLabel(v.vehicleUsage))}
            {f("MAKE", v.make)}
            {f("MODEL", [v.model, v.variant].filter(Boolean).join(" "))}
            {f("YEAR", v.year)}
            {f("COLOUR", v.color)}
            {f("VIN / CHASSIS NUMBER", v.vin && v.chassisNumber && v.vin !== v.chassisNumber ? `${v.vin} / ${v.chassisNumber}` : v.vin || v.chassisNumber, { mono: true, span: 2 })}
            {f("ENGINE NUMBER", hasEngine ? v.engineNumber : "N/A — no engine", { mono: hasEngine })}
            {ms ? f(ms.label, ms.value) : f("BODY TYPE", v.bodyType)}
            {f("FUEL", FUEL_TYPES.find((x) => x.value === v.fuelType)?.label ?? v.fuelType)}
            {f("REGISTRATION DATE", formatDateLong(a.registrationDate ?? v.registrationDate))}
            {f("EXPIRATION DATE", formatDateLong(a.expiryDate ?? v.registrationExpiry), { strong: true })}
            {f("PROVINCE", v.provinceOfOperation)}
          </div>
          <div style={{ margin: "auto 40px 0", paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <QrCode path={`/verify/registration/${a.verificationToken}`} size={112} label="Registration verification QR code" />
              <div style={{ maxWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Scan to verify</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.45, color: "#3A3F4A" }}>Verification reference</p>
                <p style={{ margin: "2px 0 0", fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{generators.verificationReference(a.verificationToken)}</p>
              </div>
            </div>
            <div style={{ textAlign: "center", width: 230 }}>
              <div style={{ height: 44 }} />
              <div style={{ borderTop: "1.5px solid #0B0B0F", paddingTop: 6 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{data.supervisorName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#3A3F4A" }}>Authorized Registration Supervisor</p>
              </div>
            </div>
          </div>
          <div style={{ margin: "20px 40px 24px", paddingTop: 10, borderTop: "1px solid #C9CED8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#3A3F4A", fontFamily: mono }}>
            <span>Txn {a.transactionNumber}</span>
            {data.receiptNumber && <span>Receipt {data.receiptNumber}</span>}
            <span>{transactionLabel(a.type, true)}</span>
            {data.office?.name && <span>{data.office.name}</span>}
            <span>DEMO — NOT VALID</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Same component under the document's official name. */
export const MotorVehicleCertificate = CertificateOfRegistration;

/** Registration label (100 × 70 mm windscreen / body sticker) for any vehicle type. */
export function RegistrationLabel({ data, id }: { data: CertificateData; id: string }) {
  const { application: a, vehicle: v } = data;
  const expiry = a.expiryDate ?? v.registrationExpiry;
  return (
    <div id={id} style={{ width: "100mm", height: "70mm", boxSizing: "border-box", background: "#fff", border: "2px solid #0B0B0F", borderRadius: 10, overflow: "hidden", fontFamily: sans, color: "#0B0B0F", display: "flex", flexDirection: "column" }}>
      <FlagBar height={7} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#0B0B0F", color: "#fff" }}>
        <img src={LOGO} alt="RTA" style={{ width: 30, height: 30 }} />
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".1em" }}>RTA · PAPUA NEW GUINEA</p>
          <p style={{ margin: 0, fontSize: 9.5, color: "#C4C7D0" }}>Motor Vehicle Registration · {vehicleTypeLabel(v.vehicleType)}</p>
        </div>
        <p style={{ margin: "0 0 0 auto", fontSize: 26, fontWeight: 800, color: "#FFD21A", fontFamily: mono }}>{formatDate(expiry, "yyyy")}</p>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "#3A3F4A" }}>PLATE</p>
          <p style={{ margin: 0, fontFamily: mono, fontSize: 24, fontWeight: 800, letterSpacing: ".06em", background: "#FFD21A", display: "inline-block", padding: "0 8px", borderRadius: 4 }}>{a.plateNumber ?? v.plateNumber ?? "—"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "#3A3F4A" }}>REGISTRATION</p>
          <p style={{ margin: 0, fontFamily: mono, fontSize: 11.5, fontWeight: 700 }}>{a.registrationNumber ?? v.registrationNumber}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10 }}>{v.make} {v.model} · {vehicleUsageLabel(v.vehicleUsage)}</p>
          <p style={{ margin: "3px 0 0", fontSize: 10.5 }}><strong>Expires {formatDate(expiry)}</strong>{a.labelNumber ? ` · ${a.labelNumber}` : ""}</p>
        </div>
        <QrCode path={`/verify/registration/${a.verificationToken}`} size={86} label="Label verification QR code" />
      </div>
    </div>
  );
}
