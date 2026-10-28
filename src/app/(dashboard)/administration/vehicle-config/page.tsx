"use client";

import { useState } from "react";
import { inspectionProfileFor } from "@/config/inspection-checklists";
import { EV_FIELDS, FIELD_GROUP_REASON, SPEC_FIELDS } from "@/config/vehicle-fields";
import { FUEL_TYPES, IMPORT_STATUSES, PLATE_CATEGORIES, TRANSMISSION_TYPES, VEHICLE_USAGES, plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { VEHICLE_GROUPS, VEHICLE_REPORT_BUCKETS, VEHICLE_TYPES, vehicleTypeLabel, type VehicleClassDef } from "@/config/vehicle-types";
import { useDemoUser } from "@/hooks/use-demo-user";
import { KpiCard, PageHeader, Section, Tabs } from "@/components/ui/layout-bits";
import { ActiveBadge } from "@/components/admin/admin-bits";
import { ChipList, ConfigTable, ReadOnlyBanner, StaticConfigNotice, VehicleFieldMatrix, YesNo } from "@/components/admin/config-bits";
import { VehicleConfigPreview } from "@/components/admin/vehicle-config-preview";

type TabKey = "types" | "classes" | "usage" | "fields" | "preview";

const plateWithPrefix = (value: string) => {
  const p = PLATE_CATEGORIES.find((c) => c.value === value);
  return p ? `${p.label} (${p.prefix})` : value;
};

/** What decides the class, from the class key. Descriptive only — the rule lives in `suggestVehicleClass`. */
function classBasis(key: string): string {
  if (key.startsWith("moto_")) return "Engine capacity (cc)";
  if (key.startsWith("pt_")) return "Seating capacity";
  if (key.endsWith("_trailer")) return "Trailer mass (ATM)";
  if (["light_vehicle", "light_commercial", "medium_rigid", "heavy_rigid"].includes(key)) return "Gross vehicle mass (GVM)";
  if (key === "heavy_combination") return "Prime mover + trailer combination";
  return "Configured per vehicle type";
}

const ALL_CLASSES: (VehicleClassDef & { types: string[] })[] = (() => {
  const map = new Map<string, VehicleClassDef & { types: string[] }>();
  for (const t of VEHICLE_TYPES) {
    for (const c of t.classes) {
      const row = map.get(c.key) ?? { ...c, types: [] };
      row.types.push(t.label);
      map.set(c.key, row);
    }
  }
  return [...map.values()];
})();

const ALL_BODY_TYPES: { name: string; types: string[] }[] = (() => {
  const map = new Map<string, string[]>();
  for (const t of VEHICLE_TYPES) for (const b of t.bodyTypes) map.set(b, [...(map.get(b) ?? []), t.label]);
  return [...map.entries()].map(([name, types]) => ({ name, types })).sort((a, b) => a.name.localeCompare(b.name));
})();

const typesByUsage = (usage: string) => VEHICLE_TYPES.filter((t) => t.defaultUsage === usage).map((t) => t.label);

function VehicleTypesTab() {
  return (
    <div className="flex flex-col gap-6">
      {VEHICLE_GROUPS.map((g) => {
        const types = VEHICLE_TYPES.filter((t) => t.group === g.key);
        return (
          <Section key={g.key} title={g.label} description={`${g.description} · ${types.length} type${types.length === 1 ? "" : "s"}`}>
            <ConfigTable
              caption={`${g.label} vehicle types`}
              minWidth={1080}
              head={
                <tr>
                  <th scope="col">Vehicle type</th>
                  <th scope="col">Classes</th>
                  <th scope="col">Body types</th>
                  <th scope="col">Engine</th>
                  <th scope="col">Default use</th>
                  <th scope="col">Default plate series</th>
                  <th scope="col">Inspection profile</th>
                  <th scope="col">Report bucket</th>
                  <th scope="col">Status</th>
                </tr>
              }
            >
              {types.map((t) => (
                <tr key={t.key}>
                  <td>
                    <span className="block font-semibold">{t.label}</span>
                    <span className="mono mut text-[11.5px]">{t.key}</span>
                  </td>
                  <td className="min-w-[180px]"><ChipList items={t.classes.map((c) => c.label)} empty="None" /></td>
                  <td className="min-w-[200px] text-[12.5px]">{t.bodyTypes.join(", ")}</td>
                  <td><YesNo value={t.hasEngine} /></td>
                  <td className="whitespace-nowrap">{vehicleUsageLabel(t.defaultUsage)}</td>
                  <td className="whitespace-nowrap">{plateWithPrefix(t.defaultPlateCategory)}</td>
                  <td className="mono whitespace-nowrap">{inspectionProfileFor(t.key).code}</td>
                  <td className="whitespace-nowrap">{VEHICLE_REPORT_BUCKETS.find((b) => b.key === t.reportBucket)?.label ?? t.reportBucket}</td>
                  <td><ActiveBadge active={t.active} /></td>
                </tr>
              ))}
            </ConfigTable>
            <p className="help m-0">Technical fields: {FIELD_GROUP_REASON[g.key]}</p>
          </Section>
        );
      })}
    </div>
  );
}

function ClassesTab() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Vehicle classes" description="Classes decide fee bands and inspection frequency. The registration screens suggest a class from the specification.">
        <ConfigTable
          caption="Vehicle classes"
          minWidth={760}
          head={<tr><th scope="col">Class</th><th scope="col">Key</th><th scope="col">Decided by</th><th scope="col">Used by vehicle types</th></tr>}
        >
          {ALL_CLASSES.map((c) => (
            <tr key={c.key}>
              <td className="font-semibold">{c.label}</td>
              <td className="mono text-[12px]">{c.key}</td>
              <td className="whitespace-nowrap">{classBasis(c.key)}</td>
              <td><ChipList items={c.types} /></td>
            </tr>
          ))}
        </ConfigTable>
      </Section>
      <Section title="Body types" description="Each body type is linked to the vehicle types it is valid for.">
        <ConfigTable caption="Body types" minWidth={560} head={<tr><th scope="col">Body type</th><th scope="col">Valid for</th></tr>}>
          {ALL_BODY_TYPES.map((b) => (
            <tr key={b.name}>
              <td className="font-semibold whitespace-nowrap">{b.name}</td>
              <td><ChipList items={b.types} /></td>
            </tr>
          ))}
        </ConfigTable>
      </Section>
    </div>
  );
}

function UsageTab() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Usage categories" description="Use is recorded separately from the vehicle type. Fees, documents and the plate series depend on both.">
        <ConfigTable
          caption="Usage categories"
          minWidth={720}
          head={<tr><th scope="col">Use</th><th scope="col">Key</th><th scope="col">Plate series implied</th><th scope="col">Default use for</th></tr>}
        >
          {VEHICLE_USAGES.map((u) => (
            <tr key={u.value}>
              <td className="font-semibold whitespace-nowrap">{u.label}</td>
              <td className="mono text-[12px]">{u.value}</td>
              <td className="whitespace-nowrap">{u.plateCategory ? plateWithPrefix(u.plateCategory) : <span className="mut">Vehicle type default</span>}</td>
              <td><ChipList items={typesByUsage(u.value)} empty="—" /></td>
            </tr>
          ))}
        </ConfigTable>
        <p className="help m-0">Two-wheelers and towed equipment always keep their own plate series ({plateCategoryLabel("motorcycle")}, {plateCategoryLabel("trailer")}), whatever the use.</p>
      </Section>
      <div className="g2">
        <Section title="Fuel types">
          <ConfigTable caption="Fuel types" minWidth={360} head={<tr><th scope="col">Fuel type</th><th scope="col">Key</th><th scope="col">Battery fields</th></tr>}>
            {FUEL_TYPES.map((f) => (
              <tr key={f.value}>
                <td className="font-semibold">{f.label}</td>
                <td className="mono text-[12px]">{f.value}</td>
                <td>{f.value === "electric" || f.value === "hybrid" ? <YesNo value yes="Required" /> : <span className="mut">—</span>}</td>
              </tr>
            ))}
          </ConfigTable>
          <p className="help m-0">Electric and hybrid switch on: {EV_FIELDS.map((f) => SPEC_FIELDS[f.key]?.label ?? f.key).join(", ")}.</p>
        </Section>
        <Section title="Transmission types">
          <ConfigTable caption="Transmission types" minWidth={300} head={<tr><th scope="col">Transmission</th><th scope="col">Key</th></tr>}>
            {TRANSMISSION_TYPES.map((t) => (
              <tr key={t.value}><td className="font-semibold">{t.label}</td><td className="mono text-[12px]">{t.value}</td></tr>
            ))}
          </ConfigTable>
          <p className="help m-0">Towed equipment records “Not applicable”.</p>
        </Section>
      </div>
      <div className="g2">
        <Section title="Import status">
          <ChipList items={IMPORT_STATUSES.map((i) => i.label)} />
          <p className="help m-0">Imported vehicles need import documentation and customs clearance on first registration (see Requirements).</p>
        </Section>
        <Section title="Report buckets" description="How vehicle types roll up on the dashboard and reports.">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {VEHICLE_REPORT_BUCKETS.map((b) => {
              const types = VEHICLE_TYPES.filter((t) => t.reportBucket === b.key).map((t) => vehicleTypeLabel(t.key));
              return (
                <li key={b.key} className="flex flex-col gap-1 border-b border-[#edeff3] pb-2 last:border-0 last:pb-0">
                  <span className="text-[13.5px] font-semibold">{b.label}</span>
                  <ChipList items={types} empty="No types" />
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function FieldsTab() {
  const library = Object.values(SPEC_FIELDS);
  return (
    <div className="flex flex-col gap-6">
      <Section title="Dynamic field schema" description="Technical-specification fields shown on Vehicle Details, by vehicle type. A new type needs only a configuration entry — no new form code.">
        <VehicleFieldMatrix />
      </Section>
      <Section title="Field library" description={`${library.length} specification fields available to any vehicle type.`}>
        <ConfigTable
          caption="Specification field library"
          minWidth={820}
          head={<tr><th scope="col">Field</th><th scope="col">Key</th><th scope="col">Input</th><th scope="col">Unit</th><th scope="col">Allowed values</th><th scope="col">Help</th></tr>}
        >
          {library.map((f) => (
            <tr key={f.key}>
              <td className="font-semibold">{f.label}</td>
              <td className="mono text-[12px]">{f.key}</td>
              <td className="whitespace-nowrap">{f.input === "number" ? (f.integer ? "Whole number" : "Number") : f.input === "select" ? "List" : f.input === "boolean" ? "Yes / No" : "Text"}</td>
              <td>{f.unit ?? <span className="mut">—</span>}</td>
              <td className="text-[12.5px]">
                {f.options ? f.options.join(", ") : f.min !== undefined || f.max !== undefined ? `${f.min?.toLocaleString("en-US") ?? "—"} to ${f.max?.toLocaleString("en-US") ?? "—"}` : <span className="mut">Free text</span>}
              </td>
              <td className="mut text-[12.5px]">{f.help ?? "—"}</td>
            </tr>
          ))}
        </ConfigTable>
      </Section>
    </div>
  );
}

export default function VehicleConfigPage() {
  const { can } = useDemoUser();
  const [tab, setTab] = useState<TabKey>("types");
  const canManage = can("vehicle_config.manage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration · Configuration"
        title="Vehicle Configuration"
        description="Vehicle types, classes, body types, uses, fuel and the technical fields each type needs. Registration, inspection, fee and report screens all read from this configuration."
      />
      <StaticConfigNotice>
        <p>
          Static configuration in Phase 1 — editable once the <span className="mono">vehicle_types</span> tables are connected (Phase 2).
          Use the <strong>Preview</strong> tab to check how a vehicle type and use flow through classes, fields, plate category, inspection, documents and fees.
        </p>
      </StaticConfigNotice>
      {!canManage && <ReadOnlyBanner what="the vehicle configuration" />}

      <div className="g4">
        <KpiCard label="Vehicle types" value={VEHICLE_TYPES.filter((t) => t.active).length} footer={`${VEHICLE_GROUPS.length} groups`} />
        <KpiCard label="Vehicle classes" value={ALL_CLASSES.length} footer={`${ALL_BODY_TYPES.length} body types`} />
        <KpiCard label="Usage categories" value={VEHICLE_USAGES.length} footer={`${PLATE_CATEGORIES.length} plate categories`} />
        <KpiCard label="Specification fields" value={Object.keys(SPEC_FIELDS).length} footer={`${FUEL_TYPES.length} fuel types`} />
      </div>

      <Tabs<TabKey>
        label="Vehicle configuration sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "types", label: "Vehicle Types", count: VEHICLE_TYPES.length },
          { value: "classes", label: "Classes & Body Types" },
          { value: "usage", label: "Usage, Fuel & Transmission" },
          { value: "fields", label: "Technical Fields" },
          { value: "preview", label: "Preview" },
        ]}
      />

      {tab === "types" && <VehicleTypesTab />}
      {tab === "classes" && <ClassesTab />}
      {tab === "usage" && <UsageTab />}
      {tab === "fields" && <FieldsTab />}
      {tab === "preview" && <VehicleConfigPreview />}
    </div>
  );
}
