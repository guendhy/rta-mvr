"use client";

/* eslint-disable @next/next/no-img-element -- print layouts need plain <img> so the browser prints them reliably */
import { formatDate, formatDateLong, formatMoney, formatTime, fullName } from "@/lib/formatting";
import { QrCode } from "@/components/ui/qr-code";
import type { Motorcycle, Office, Owner, ReceiptData, RegistrationApplication } from "@/types";
import { INTENDED_USES } from "@/lib/constants";

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

/** 58mm thermal receipt (≈220px wide). */
export function ThermalReceipt({ data, id }: { data: ReceiptData; id: string }) {
  const row = (k: string, v?: string | number) => (v === undefined || v === "" ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><span>{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
  ));
  const block = (k: string, v?: string) => (v ? <div><div>{k}</div><div style={{ fontWeight: 600, wordBreak: "break-all" }}>{v}</div></div> : null);
  return (
    <div id={id} style={{ width: "58mm", boxSizing: "border-box", padding: "14px 10px 20px", background: "#fff", color: "#000", fontFamily: mono, fontSize: 11, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 3 }}>
        <img src={LOGO} alt="RTA logo" style={{ width: 56, height: 56, filter: "grayscale(1) contrast(1.4)" }} />
        <span style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em" }}>ROAD TRAFFIC AUTHORITY</span>
        <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: ".1em" }}>PAPUA NEW GUINEA</span>
        <span>{data.office}</span>
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ textAlign: "center", fontFamily: sans, fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>MOTORCYCLE REGISTRATION<br />PAYMENT RECEIPT</div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {block("Receipt No.", data.receiptNumber)}
        {block("Transaction No.", data.transactionNumber)}
        {block("Registration No.", data.registrationNumber ?? "Pending approval")}
        {block("Owner", data.owner)}
        {block("Motorcycle", data.motorcycle)}
        {block("VIN / Chassis", data.vinOrChassis)}
        {block("Engine No.", data.engineNumber)}
      </div>
      <div style={{ borderTop: "1px dashed #000" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {data.lines.map((l) => row(l.name.replace("Motorcycle ", ""), l.amount.toFixed(2)))}
      </div>
      <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 0", display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 800, fontSize: 15 }}><span>PAID</span><span>{formatMoney(data.amount)}</span></div>
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
  const cell = (k: string, v?: string) => (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #E1E4EA" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A", textTransform: "uppercase" }}>{k}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 600, fontFamily: /No\.|Ref|VIN|Engine|Terminal/.test(k) ? mono : sans, wordBreak: "break-all" }}>{v || "—"}</p>
    </div>
  );
  return (
    <div id={id} style={{ width: 794, minHeight: 1123, boxSizing: "border-box", padding: 48, background: "#fff", color: "#0B0B0F", fontFamily: sans }}>
      <FlagBar height={8} />
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "24px 0", borderBottom: "2px solid #0B0B0F" }}>
        <img src={LOGO} alt="Road Traffic Authority seal" style={{ width: 84, height: 84 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: ".12em" }}>ROAD TRAFFIC AUTHORITY</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: ".16em" }}>PAPUA NEW GUINEA</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#3A3F4A" }}>{data.office}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A" }}>OFFICIAL RECEIPT</p>
          <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 18, fontWeight: 700 }}>{data.receiptNumber}</p>
        </div>
      </div>
      <h1 style={{ margin: "26px 0 8px", fontSize: 24, fontWeight: 800 }}>Motorcycle Registration Payment Receipt</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 32 }}>
        {cell("Receipt Number", data.receiptNumber)}
        {cell("Transaction Number", data.transactionNumber)}
        {cell("Registration Number", data.registrationNumber ?? "Issued on approval")}
        {cell("Owner", data.owner)}
        {cell("Motorcycle", data.motorcycle)}
        {cell("VIN / Chassis", data.vinOrChassis)}
        {cell("Engine Number", data.engineNumber)}
        {cell("Payment Method", data.paymentMethod)}
        {cell("Payment Reference", data.paymentReference)}
        {cell("Terminal ID", data.terminalId)}
        {cell("Cashier", data.cashier)}
        {cell("Date / Time", `${formatDateLong(data.paidAt)} · ${formatTime(data.paidAt)}`)}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 28, fontSize: 14 }}>
        <thead><tr><th style={{ textAlign: "left", padding: "10px 12px", background: "#F4F5F8", fontSize: 12, letterSpacing: ".06em" }}>DESCRIPTION</th><th style={{ textAlign: "right", padding: "10px 12px", background: "#F4F5F8", fontSize: 12, letterSpacing: ".06em" }}>AMOUNT (PGK)</th></tr></thead>
        <tbody>
          {data.lines.map((l) => <tr key={l.name}><td style={{ padding: "10px 12px", borderBottom: "1px solid #E1E4EA" }}>{l.name}</td><td style={{ padding: "10px 12px", borderBottom: "1px solid #E1E4EA", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(l.amount)}</td></tr>)}
          <tr><td style={{ padding: "14px 12px", fontWeight: 800, fontSize: 16 }}>TOTAL PAID</td><td style={{ padding: "14px 12px", textAlign: "right", fontWeight: 800, fontSize: 20, background: "#FFD21A" }}>{formatMoney(data.amount)}</td></tr>
          {data.amountTendered !== undefined && <tr><td style={{ padding: "6px 12px", color: "#3A3F4A" }}>Amount tendered / change</td><td style={{ padding: "6px 12px", textAlign: "right", color: "#3A3F4A" }}>{formatMoney(data.amountTendered)} / {formatMoney(data.change)}</td></tr>}
          {data.approvalCode && <tr><td style={{ padding: "6px 12px", color: "#3A3F4A" }}>Card / approval code</td><td style={{ padding: "6px 12px", textAlign: "right", color: "#3A3F4A", fontFamily: mono }}>{data.cardMasked} · {data.approvalCode}</td></tr>}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 48, gap: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <QrCode path={data.verifyPath} size={112} label="Receipt verification QR code" />
          <div style={{ maxWidth: 200 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Scan to verify</p><p style={{ margin: "3px 0 0", fontSize: 12, color: "#3A3F4A", lineHeight: 1.45 }}>Confirms the receipt number, amount and payment status with the RTA.</p></div>
        </div>
        <div style={{ textAlign: "center", width: 230 }}>
          <div style={{ height: 44 }} />
          <div style={{ borderTop: "1.5px solid #0B0B0F", paddingTop: 6 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{data.cashier}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: "#3A3F4A" }}>Cashier</p></div>
        </div>
      </div>
      <p style={{ marginTop: 40, paddingTop: 10, borderTop: "1px solid #C9CED8", fontSize: 11.5, color: "#3A3F4A", textAlign: "center" }}>Demo prototype output — not a valid official receipt.</p>
    </div>
  );
}

export interface CertificateData {
  application: RegistrationApplication;
  owner: Owner;
  motorcycle: Motorcycle;
  office: Office | null;
  supervisorName: string;
  receiptNumber?: string;
}

const lbl = { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#3A3F4A" } as const;
const val = { margin: "3px 0 0", fontWeight: 600 } as const;

/** A4 Certificate of Registration with QR verification. */
export function CertificateOfRegistration({ data, id }: { data: CertificateData; id: string }) {
  const { application: a, owner: o, motorcycle: m } = data;
  const address = [o.street, o.ward, o.llg, o.district, o.province].filter(Boolean).join(", ");
  const f = (k: string, v: React.ReactNode, isMono = false) => (
    <div><p style={lbl}>{k}</p><p style={{ ...val, fontFamily: isMono ? mono : sans }}>{v || "—"}</p></div>
  );
  return (
    <div id={id} style={{ width: 794, height: 1123, boxSizing: "border-box", padding: 40, background: "#fff", fontFamily: sans, color: "#0B0B0F" }}>
      <div style={{ height: "100%", boxSizing: "border-box", border: "2px solid #0B0B0F", padding: 6 }}>
        <div style={{ height: "100%", boxSizing: "border-box", border: "1px solid #0B0B0F", display: "flex", flexDirection: "column" }}>
          <FlagBar height={10} />
          <div style={{ padding: "26px 44px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
            <img src={LOGO} alt="Road Traffic Authority seal" style={{ width: 96, height: 96 }} />
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: ".2em" }}>INDEPENDENT STATE OF PAPUA NEW GUINEA</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: ".14em" }}>ROAD TRAFFIC AUTHORITY</p>
            <div style={{ width: 80, height: 2, background: "#0B0B0F", margin: "6px 0" }} />
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: ".02em" }}>CERTIFICATE OF REGISTRATION</h1>
            <p style={{ margin: 0, fontSize: 15, color: "#3A3F4A" }}>Motorcycle{a.type === "renewal" ? " · Renewal" : ""}</p>
          </div>
          <div style={{ margin: "22px 44px 0", display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #0B0B0F" }}>
            <div style={{ padding: "12px 18px", borderRight: "1px solid #0B0B0F" }}><p style={lbl}>REGISTRATION NUMBER</p><p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 20, fontWeight: 700 }}>{a.registrationNumber}</p></div>
            <div style={{ padding: "12px 18px", background: "#FFD21A" }}><p style={{ ...lbl, color: "#0B0B0F" }}>PLATE NUMBER</p><p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 24, fontWeight: 700, letterSpacing: ".08em" }}>{a.plateNumber ?? m.plateNumber ?? "PENDING"}</p></div>
          </div>
          <div style={{ margin: "16px 44px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 24px", fontSize: 15 }}>
            <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid #C9CED8", paddingBottom: 10 }}>
              <p style={lbl}>REGISTERED OWNER</p>
              <p style={{ margin: "3px 0 0", fontWeight: 700, fontSize: 18 }}>{fullName(o).toUpperCase()}</p>
              <p style={{ margin: "2px 0 0", fontSize: 13.5 }}>{address}</p>
            </div>
            {f("CERTIFICATE NUMBER", a.certificateNumber, true)}
            {f("MAKE", m.make)}
            {f("MODEL", m.model)}
            {f("VARIANT", m.variant)}
            {f("YEAR", m.year)}
            {f("COLOR", m.color)}
            {f("ENGINE NUMBER", m.engineNumber, true)}
            {f("CHASSIS NUMBER", m.chassisNumber, true)}
            {f("VIN", m.vin, true)}
            {f("ENGINE CAPACITY", `${m.engineCapacityCc} cc`)}
            {f("INTENDED USE", INTENDED_USES.find((u) => u.value === m.intendedUse)?.label)}
            {f("PROVINCE", m.provinceOfOperation)}
            {f("REGISTRATION DATE", formatDateLong(a.registrationDate))}
            <div><p style={lbl}>EXPIRY DATE</p><p style={{ ...val, fontWeight: 800 }}>{formatDateLong(a.expiryDate)}</p></div>
            {f("SIDECAR", m.sidecar ? "Yes" : "No")}
          </div>
          <div style={{ margin: "auto 44px 0", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <QrCode path={`/verify/registration/${a.verificationToken}`} size={108} label="Registration verification QR code" />
              <div style={{ maxWidth: 170 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Scan to verify</p><p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.45, color: "#3A3F4A" }}>Confirms this registration is valid and current in the RTA registry.</p></div>
            </div>
            <div style={{ textAlign: "center", width: 230 }}>
              <div style={{ height: 40 }} />
              <div style={{ borderTop: "1.5px solid #0B0B0F", paddingTop: 6 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{data.supervisorName}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: "#3A3F4A" }}>Authorized Registration Supervisor</p></div>
            </div>
          </div>
          <div style={{ margin: "18px 44px 22px", paddingTop: 10, borderTop: "1px solid #C9CED8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 11.5, color: "#3A3F4A", fontFamily: mono }}>
            <span>Txn {a.transactionNumber}</span>{data.receiptNumber && <span>Receipt {data.receiptNumber}</span>}<span>{data.office?.name}</span><span>DEMO — NOT VALID</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Registration label (100 × 70 mm windscreen/fork sticker). */
export function RegistrationLabel({ data, id }: { data: CertificateData; id: string }) {
  const { application: a, motorcycle: m } = data;
  return (
    <div id={id} style={{ width: "100mm", height: "70mm", boxSizing: "border-box", background: "#fff", border: "2px solid #0B0B0F", borderRadius: 10, overflow: "hidden", fontFamily: sans, color: "#0B0B0F", display: "flex", flexDirection: "column" }}>
      <FlagBar height={7} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#0B0B0F", color: "#fff" }}>
        <img src={LOGO} alt="RTA" style={{ width: 30, height: 30 }} />
        <div style={{ lineHeight: 1.15 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".1em" }}>RTA · PAPUA NEW GUINEA</p>
          <p style={{ margin: 0, fontSize: 9.5, color: "#C4C7D0" }}>Motorcycle Registration</p>
        </div>
        <p style={{ margin: "0 0 0 auto", fontSize: 26, fontWeight: 800, color: "#FFD21A", fontFamily: mono }}>{formatDate(a.expiryDate, "yyyy")}</p>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "#3A3F4A" }}>PLATE</p>
          <p style={{ margin: 0, fontFamily: mono, fontSize: 26, fontWeight: 800, letterSpacing: ".06em", background: "#FFD21A", display: "inline-block", padding: "0 8px", borderRadius: 4 }}>{a.plateNumber ?? m.plateNumber ?? "—"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "#3A3F4A" }}>REGISTRATION</p>
          <p style={{ margin: 0, fontFamily: mono, fontSize: 11.5, fontWeight: 700 }}>{a.registrationNumber}</p>
          <p style={{ margin: "4px 0 0", fontSize: 10.5 }}><strong>Expires {formatDate(a.expiryDate)}</strong> · {a.labelNumber}</p>
        </div>
        <QrCode path={`/verify/registration/${a.verificationToken}`} size={86} label="Label verification QR code" />
      </div>
    </div>
  );
}
