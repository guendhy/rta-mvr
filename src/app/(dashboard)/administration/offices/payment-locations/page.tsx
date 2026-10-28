"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { enabledPaymentChannels } from "@/config/payment-channels";
import { TERMINAL_ADMIN_STATUS } from "@/config/statuses";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { PROVINCE_NAMES } from "@/lib/constants";
import { posService } from "@/services/pos.service";
import { settingsService } from "@/services/settings.service";
import type { Office, PosTerminal, TerminalAdminStatus } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { ActiveBadge, FilterBar, FilterSelect, ResultCount, SearchField } from "@/components/admin/admin-bits";
import { ChipList } from "@/components/admin/config-bits";
import { LocationsNav } from "@/components/admin/locations-nav";

interface PaymentLocation {
  office: Office;
  terminals: PosTerminal[];
  usable: number;
  cashiers: number;
  channels: string[];
}

const STATUS_ORDER: TerminalAdminStatus[] = ["online", "idle", "offline", "maintenance", "disabled"];

function TerminalSummary({ terminals }: { terminals: PosTerminal[] }) {
  if (!terminals.length) return <span className="mut text-[12.5px]">No terminals</span>;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((s) => {
        const n = terminals.filter((t) => t.status === s).length;
        return n ? <Badge key={s} tone={TERMINAL_ADMIN_STATUS[s].tone}>{n} {TERMINAL_ADMIN_STATUS[s].label}</Badge> : null;
      })}
    </span>
  );
}

export default function PaymentLocationsPage() {
  const { can } = useDemoUser();
  const data = useServiceQuery(async () => {
    const [offices, terminals, settings] = await Promise.all([settingsService.listOffices(), posService.listTerminals(), settingsService.get()]);
    return { offices, terminals, settings };
  }, []);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [pos, setPos] = useState("");

  const locations = useMemo<PaymentLocation[]>(() => {
    if (!data.data) return [];
    const channels = enabledPaymentChannels(data.data.settings);
    return data.data.offices.map((office) => {
      const terminals = data.data!.terminals.filter((t) => t.officeId === office.id);
      const usable = terminals.filter((t) => t.status !== "disabled" && t.status !== "maintenance").length;
      return {
        office,
        terminals,
        usable,
        cashiers: new Set(terminals.map((t) => t.assignedCashierId).filter(Boolean)).size,
        channels: channels.filter((c) => c.method !== "pos" || usable > 0).map((c) => c.label),
      };
    });
  }, [data.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return locations.filter(
      (l) =>
        (!province || l.office.province === province) &&
        (!pos || (pos === "yes" ? l.usable > 0 : l.usable === 0)) &&
        (!term || `${l.office.name} ${l.office.code} ${l.office.district} ${l.terminals.map((t) => t.terminalId).join(" ")}`.toLowerCase().includes(term)),
    );
  }, [locations, q, province, pos]);

  const columns: ColumnDef<PaymentLocation, unknown>[] = [
    { id: "name", header: "Payment Location", accessorFn: (l) => l.office.name, cell: ({ row }) => <span className="font-semibold">{row.original.office.name}<span className="mono mut block text-[11.5px] font-normal">{row.original.office.code}</span></span> },
    { id: "province", header: "Province", accessorFn: (l) => l.office.province },
    { id: "terminals", header: "POS Terminals", accessorFn: (l) => l.terminals.length, cell: ({ row }) => <TerminalSummary terminals={row.original.terminals} /> },
    { id: "cashiers", header: "Assigned Cashiers", accessorFn: (l) => l.cashiers, meta: { align: "right" } },
    { id: "channels", header: "Payment Channels", enableSorting: false, cell: ({ row }) => <span className="block min-w-[220px]"><ChipList items={row.original.channels} empty="None enabled" /></span> },
    { id: "status", header: "Office Status", accessorFn: (l) => l.office.status, cell: ({ row }) => <ActiveBadge active={row.original.office.status === "active"} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration · Locations"
        title="Locations · Payment Locations"
        description="Where payments are taken: RTA offices, their POS terminals and the payment channels available at the counter."
        actions={can("terminals.manage") ? <Link href="/administration/terminals" className="btn btn-s"><CreditCard size={16} aria-hidden="true" />Manage POS Terminals</Link> : undefined}
      />
      <LocationsNav />
      <p className="mut m-0 text-[13px]">
        Payment channels are switched on system-wide in Administration → Settings. POS appears only where the office has a usable terminal (not disabled or in maintenance).
      </p>
      <FilterBar>
        <SearchField id="pl-q" value={q} onChange={setQ} placeholder="Office, code, district or Terminal ID" />
        <FilterSelect id="pl-prov" label="Province" value={province} onChange={setProvince} options={PROVINCE_NAMES.map((p) => ({ value: p, label: p }))} all="All provinces" />
        <FilterSelect id="pl-pos" label="POS terminals" value={pos} onChange={setPos} options={[{ value: "yes", label: "Has a usable terminal" }, { value: "no", label: "No usable terminal" }]} all="Any" />
      </FilterBar>
      {data.error ? (
        <ErrorState message={data.error} onRetry={() => data.reload()} />
      ) : (
        <>
          {data.data && <ResultCount shown={rows.length} total={locations.length} noun="payment locations" />}
          <DataTable
            storageKey="admin-payment-locations"
            data={data.data ? rows : undefined}
            loading={data.loading}
            columns={columns}
            initialSort={[{ id: "name", desc: false }]}
            mobileCard={(l) => (
              <MobileCard
                title={l.office.code}
                badge={<ActiveBadge active={l.office.status === "active"} />}
                lines={[
                  l.office.name,
                  `${l.office.district}, ${l.office.province}`,
                  <TerminalSummary key="t" terminals={l.terminals} />,
                  `${l.cashiers} assigned cashier${l.cashiers === 1 ? "" : "s"}`,
                  <ChipList key="c" items={l.channels} empty="No channels enabled" />,
                ]}
              />
            )}
            empty={{ title: "No payment locations found", message: q || province || pos ? "No locations match the current filters." : "Add an RTA office to create a payment location." }}
          />
        </>
      )}
    </div>
  );
}
