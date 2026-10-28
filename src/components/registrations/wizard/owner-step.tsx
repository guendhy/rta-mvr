"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Search, UserPlus } from "lucide-react";
import { ownerService } from "@/services/owner.service";
import { registrationService } from "@/services/registration.service";
import { districtsFor, GENDERS, IDENTIFICATION_TYPES, llgsFor, PROVINCE_NAMES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, fullName } from "@/lib/formatting";
import { ownerSchema, type OwnerFormValues } from "@/lib/validation/schemas";
import { isOrganization, ownershipTypeDef, ownershipTypeLabel, OWNERSHIP_TYPES } from "@/config/ownership-types";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { OwnerCard } from "../cards";
import { useAutosave, type StepProps } from "./types";
import type { Owner, OwnerDuplicateMatch, OwnerInput } from "@/types";

const EMPTY: OwnerFormValues = {
  ownershipType: "individual", organizationName: "", organizationRegistrationNumber: "", authorizedRepresentative: "", representativePosition: "", businessPhone: "",
  firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "", nationality: "Papua New Guinean",
  identificationType: "" as OwnerFormValues["identificationType"], identificationNumber: "", mobile: "", email: "",
  province: "", district: "", llg: "", ward: "", street: "", postalAddress: "",
};

const REASON_LABEL = { identification: "Same ID number", mobile: "Same mobile", name_dob: "Same name + date of birth", organization: "Same organisation number" };

function toForm(o: Partial<Owner> | undefined): OwnerFormValues {
  return { ...EMPTY, ...Object.fromEntries(Object.entries(o ?? {}).filter(([k, v]) => k in EMPTY && v !== undefined)) } as OwnerFormValues;
}

/** Form values → owner record (empty optional strings dropped, organisation fields only for organisations). */
export function toOwnerInput(v: OwnerFormValues): OwnerInput {
  const org = isOrganization(v.ownershipType);
  const opt = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  return {
    ownershipType: v.ownershipType,
    firstName: v.firstName.trim(),
    middleName: opt(v.middleName),
    lastName: v.lastName.trim(),
    dateOfBirth: org ? opt(v.dateOfBirth) : v.dateOfBirth,
    gender: org ? (v.gender || undefined) : (v.gender || "unspecified"),
    nationality: v.nationality,
    identificationType: v.identificationType,
    identificationNumber: v.identificationNumber.trim(),
    mobile: v.mobile.trim(),
    email: opt(v.email),
    province: v.province,
    district: v.district,
    llg: v.llg,
    ward: opt(v.ward),
    street: v.street.trim(),
    postalAddress: opt(v.postalAddress),
    organizationName: org ? opt(v.organizationName) : undefined,
    organizationRegistrationNumber: org ? opt(v.organizationRegistrationNumber) : undefined,
    authorizedRepresentative: org ? opt(v.authorizedRepresentative) : undefined,
    representativePosition: org ? opt(v.representativePosition) : undefined,
    businessPhone: org ? opt(v.businessPhone) : undefined,
  };
}

/** OwnerInformationForm — conditional individual / organisation fields. */
export function OwnerInformationForm({ form, title, onCancel }: { form: UseFormReturn<OwnerFormValues>; title: string; onCancel?: () => void }) {
  const { register, watch, setValue, formState: { errors } } = form;
  const values = watch();
  const districts = useMemo(() => districtsFor(values.province), [values.province]);
  const llgs = useMemo(() => llgsFor(values.district), [values.district]);
  const org = isOrganization(values.ownershipType);
  const def = ownershipTypeDef(values.ownershipType);

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
      <section className="card sec">
        <div className="sechd"><h2 className="h2">{title}</h2>{onCancel && <button type="button" className="btn btn-g btn-sm" onClick={onCancel}>Cancel edit</button>}</div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="lbl">Ownership Type<span className="req" aria-hidden="true">*</span></legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="radiogroup" aria-label="Ownership type">
            {OWNERSHIP_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={values.ownershipType === o.value}
                className={`opt flex-col !items-start gap-0.5 text-left ${values.ownershipType === o.value ? "opt-on" : ""}`}
                onClick={() => setValue("ownershipType", o.value, { shouldDirty: true, shouldValidate: false })}
              >
                <span className="text-[14px] font-bold">{o.label}</span>
                <span className="mut text-[12px] font-medium leading-snug">{o.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {org && (
        <section className="card sec">
          <h2 className="h2">Organization details</h2>
          <div className="form">
            <Field label={def.orgNameLabel} required htmlFor="on" error={errors.organizationName?.message}><Input id="on" invalid={!!errors.organizationName} {...register("organizationName")} /></Field>
            <Field label={def.orgNumberLabel} required htmlFor="orn" error={errors.organizationRegistrationNumber?.message} help="Checked against existing owners for duplicates."><Input id="orn" mono invalid={!!errors.organizationRegistrationNumber} {...register("organizationRegistrationNumber")} /></Field>
            <Field label="Business Phone" htmlFor="bp"><Input id="bp" type="tel" mono inputMode="tel" {...register("businessPhone")} placeholder="+675 300 1000" /></Field>
            <Field label="Authorized Representative" required htmlFor="ar" error={errors.authorizedRepresentative?.message} help="Person signing for the organisation."><Input id="ar" invalid={!!errors.authorizedRepresentative} {...register("authorizedRepresentative")} /></Field>
            <Field label="Representative Position" htmlFor="rp"><Input id="rp" {...register("representativePosition")} /></Field>
          </div>
        </section>
      )}

      <section className="card sec">
        <h2 className="h2">{org ? "Representative identification" : "Personal information"}</h2>
        <div className="form">
          <Field label="First Name" required htmlFor="fn" error={errors.firstName?.message}><Input id="fn" invalid={!!errors.firstName} {...register("firstName")} /></Field>
          <Field label="Middle Name" htmlFor="mn"><Input id="mn" {...register("middleName")} /></Field>
          <Field label="Last Name" required htmlFor="ln" error={errors.lastName?.message}><Input id="ln" invalid={!!errors.lastName} {...register("lastName")} /></Field>
          {!org && <Field label="Date of Birth" required htmlFor="dob" error={errors.dateOfBirth?.message} help="Owner must be 16 or older."><Input id="dob" type="date" invalid={!!errors.dateOfBirth} {...register("dateOfBirth")} /></Field>}
          {!org && <Field label="Gender" required htmlFor="gd" error={errors.gender?.message}><Select id="gd" placeholder="Select" options={GENDERS} invalid={!!errors.gender} {...register("gender")} /></Field>}
          <Field label="Nationality" required htmlFor="nat" error={errors.nationality?.message}><Select id="nat" options={["Papua New Guinean", "Australian", "Filipino", "Chinese", "Indonesian", "Foreign national", "Other"]} {...register("nationality")} /></Field>
          <Field label="Identification Type" required htmlFor="idt" error={errors.identificationType?.message}><Select id="idt" placeholder="Select" options={IDENTIFICATION_TYPES} invalid={!!errors.identificationType} {...register("identificationType")} /></Field>
          <Field label="Identification Number" required htmlFor="idn" error={errors.identificationNumber?.message} help="Checked against existing owners for duplicates."><Input id="idn" mono invalid={!!errors.identificationNumber} {...register("identificationNumber")} /></Field>
        </div>
      </section>
      <section className="card sec">
        <h2 className="h2">Contact information</h2>
        <div className="form">
          <Field label="Mobile Number" required htmlFor="mob" error={errors.mobile?.message} help="Used for renewal and approval SMS (simulated)."><Input id="mob" type="tel" mono inputMode="tel" invalid={!!errors.mobile} {...register("mobile")} placeholder="+675 7123 4567" /></Field>
          <Field label="Email" htmlFor="em" error={errors.email?.message}><Input id="em" type="email" invalid={!!errors.email} {...register("email")} /></Field>
        </div>
      </section>
      <section className="card sec">
        <h2 className="h2">{org ? "Business address" : "Residential address"}</h2>
        <div className="form">
          <Field label="Province" required htmlFor="pv" error={errors.province?.message}>
            <Select id="pv" placeholder="Select province" options={PROVINCE_NAMES} invalid={!!errors.province} {...register("province", { onChange: () => { setValue("district", ""); setValue("llg", ""); } })} />
          </Field>
          <Field label="District" required htmlFor="ds" error={errors.district?.message}>
            <Select id="ds" placeholder={values.province ? "Select district" : "Select province first"} options={districts} disabled={!values.province} invalid={!!errors.district} {...register("district", { onChange: () => setValue("llg", "") })} />
          </Field>
          <Field label="LLG" required htmlFor="llg" error={errors.llg?.message}>
            <Select id="llg" placeholder={values.district ? "Select LLG" : "Select district first"} options={llgs} disabled={!values.district} invalid={!!errors.llg} {...register("llg")} />
          </Field>
          <Field label="Ward" htmlFor="wd"><Input id="wd" {...register("ward")} /></Field>
          <Field label={org ? "Street / Building" : "Street / Village"} required htmlFor="st" error={errors.street?.message}><Input id="st" invalid={!!errors.street} {...register("street")} /></Field>
          <Field label="Postal Address" htmlFor="po"><Input id="po" {...register("postalAddress")} /></Field>
        </div>
      </section>
    </form>
  );
}

export function OwnerStep({ detail, editable, registerApi, onSaveState, advance }: StepProps) {
  const app = detail.application;
  const isTransfer = app.type === "transfer";
  const isChangeOwner = app.type === "change_owner";
  const existingVehicleTxn = app.type !== "new" && !isTransfer;
  /** The owner this step captures: the buyer for transfers, else the registered owner. */
  const target = isTransfer ? detail.newOwner : detail.owner;
  const [mode, setMode] = useState<"selected" | "search" | "new" | "edit">(target ? "selected" : app.draft.ownerMode === "new" && !isTransfer ? "new" : "search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Owner[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [dupes, setDupes] = useState<OwnerDuplicateMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const initial = mode === "edit" ? toForm({ ...detail.owner ?? undefined, ...(isChangeOwner ? app.draft.owner : {}) }) : toForm(isTransfer ? undefined : app.draft.owner);
  const form = useForm<OwnerFormValues>({ resolver: zodResolver(ownerSchema), defaultValues: initial, mode: "onTouched" });
  const values = form.watch();

  useAutosave(values, editable && mode === "new" && !isTransfer, async (v) => {
    onSaveState("saving");
    try {
      await registrationService.saveDraft(app.id, { owner: toOwnerInput(v), ownerMode: "new" }, 2);
      onSaveState("saved");
    } catch (e) {
      onSaveState("error");
      toast.error(friendlyError(e), { description: "Your entries are still on screen. Try Save Draft again." });
    }
  });

  useEffect(() => {
    if (mode === "search") searchRef.current?.focus();
  }, [mode]);

  const search = async () => {
    setSearching(true);
    try {
      setResults((await ownerService.search(query)).filter((o) => !isTransfer || o.id !== detail.owner?.id));
    } finally {
      setSearching(false);
    }
  };

  const selectOwner = async (o: Owner) => {
    setBusy(true);
    try {
      await registrationService.attachOwner(app.id, o.id);
      await registrationService.saveDraft(app.id, { ownerMode: "existing" }, 3);
      toast.success(`${isTransfer ? "New owner" : "Owner"} ${fullName(o)} selected`);
      setDupes(null);
      advance();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const createOwner = async () => {
    setBusy(true);
    try {
      const owner = await ownerService.create(toOwnerInput(form.getValues()));
      await registrationService.attachOwner(app.id, owner.id);
      toast.success(`${isTransfer ? "New owner" : "Owner"} ${fullName(owner)} created`);
      setDupes(null);
      advance();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const latest = useRef({ mode, detail });
  latest.current = { mode, detail };

  useEffect(() => {
    registerApi({
      continueLabel: app.type === "new" ? "Continue to Classification" : "Continue",
      saveDraft: async () => {
        if (latest.current.mode !== "new" || isTransfer) return;
        await registrationService.saveDraft(app.id, { owner: toOwnerInput(form.getValues()), ownerMode: "new" }, 2);
      },
      continue: async () => {
        const m = latest.current.mode;
        const d = latest.current.detail;
        const current = isTransfer ? d.newOwner : d.owner;
        if (!editable) return true;
        if (m === "selected") {
          if (!current) {
            toast.error(isTransfer ? "Select or create the new owner first." : "Select or create the owner first.");
            return false;
          }
          return true;
        }
        if (m === "search") {
          toast.error(isTransfer ? "Select the new owner or create a new owner record." : "Select an existing owner or create a new one.");
          return false;
        }
        const ok = await form.trigger();
        if (!ok) {
          toast.error("Check the highlighted fields.");
          return false;
        }
        if (m === "edit" && d.owner) {
          const v = toOwnerInput(form.getValues());
          if (isChangeOwner) {
            // Owner-information changes are applied on approval, never directly.
            const before = d.owner as unknown as Record<string, unknown>;
            const changes = (Object.keys(v) as (keyof OwnerInput)[])
              .filter((k) => (v[k] ?? "") !== (before[k] ?? ""))
              .map((k) => ({ field: String(k), label: String(k).replace(/([A-Z])/g, " $1").toLowerCase(), from: String(before[k] ?? "—"), to: String(v[k] ?? "—") }));
            if (!changes.length) {
              toast.error("No owner details were changed.");
              return false;
            }
            await registrationService.setChangeRequest(app.id, { summary: `${changes.length} owner detail(s) corrected`, changes }, { owner: v });
            toast.success("Owner changes recorded — applied on approval");
            return true;
          }
          await ownerService.update(d.owner.id, v);
          toast.success("Owner details updated");
          return true;
        }
        const matches = await ownerService.findDuplicates(toOwnerInput(form.getValues()));
        if (matches.length) {
          setDupes(matches);
          return false;
        }
        await createOwner();
        return false;
      },
    });
    return () => registerApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  const seller = isTransfer && detail.owner ? <OwnerCard owner={detail.owner} title="Current registered owner (seller)" compact actions={<Badge tone="draft">Kept in ownership history</Badge>} /> : null;

  if (existingVehicleTxn && mode !== "edit") {
    return detail.owner ? (
      <div className="flex flex-col gap-5">
        <OwnerCard
          owner={detail.owner}
          title="Registered owner"
          actions={editable && isChangeOwner ? <button type="button" className="btn btn-p btn-sm" onClick={() => { form.reset(toForm({ ...detail.owner!, ...app.draft.owner })); setMode("edit"); }}><Pencil size={14} aria-hidden="true" />Update owner information</button> : <Badge tone="ok">Owner on record</Badge>}
        />
        {app.changeRequest && isChangeOwner && (
          <Alert tone="info" title="Requested owner changes">
            <ul className="m-0 pl-4">{app.changeRequest.changes.map((c) => <li key={c.field}>{c.label}: {c.from} → <strong>{c.to}</strong></li>)}</ul>
          </Alert>
        )}
        {!isChangeOwner && <Alert tone="info" title="Owner already on record">Confirm the owner details with the applicant. A change of owner requires a Transfer of Ownership transaction.</Alert>}
      </div>
    ) : <Alert tone="warn" title="No owner linked">This application has no owner yet.</Alert>;
  }

  if (!editable || mode === "selected") {
    return target ? (
      <div className="flex flex-col gap-5">
        {seller}
        <OwnerCard
          owner={target}
          title={isTransfer ? "New owner (buyer)" : undefined}
          actions={editable ? (
            <>
              <Badge tone="ok">{isTransfer ? "New owner selected" : "Owner selected"}</Badge>
              {!isTransfer && <button type="button" className="btn btn-s btn-sm" onClick={() => { form.reset(toForm(target)); setMode("edit"); }}><Pencil size={14} aria-hidden="true" />Edit details</button>}
              <button type="button" className="btn btn-g btn-sm" onClick={() => setMode("search")}>Change {isTransfer ? "new owner" : "owner"}</button>
            </>
          ) : <Badge tone="ok">{ownershipTypeLabel(target.ownershipType)}</Badge>}
        />
      </div>
    ) : <Alert tone="warn" title={isTransfer ? "No new owner selected" : "No owner linked"}>{isTransfer ? "Select the buyer to continue the transfer." : "This application has no owner yet."}</Alert>;
  }

  return (
    <div className="flex flex-col gap-5">
      {seller}
      {(mode === "search" || mode === "new") && (
        <section className="card sec !border-[#cfcffb] !bg-[#f5f5ff]">
          <div><h2 className="h3">{isTransfer ? "Find the new owner" : "Search existing owner"}</h2><p className="mut m-0 mt-0.5 text-[13px]">Always search first — prevents duplicate owner records. Searches people and organisations.</p></div>
          <form className="row items-end" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <div className="min-w-0 flex-[1_1_260px]">
              <label className="lbl" htmlFor="owner-search">Name, organisation, ID / registration number or phone</label>
              <input ref={searchRef} id="owner-search" className="inp" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Kila, Hagen Transport, DL-POM-0482196, 7123 4842" />
            </div>
            <button type="submit" className="btn btn-p" disabled={query.trim().length < 2 || searching}>{searching ? <span className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}Search</button>
          </form>
          {results && (
            results.length === 0 ? <p className="mut m-0 text-[13px]">No owners match “{query}”.</p> : (
              <div className="card overflow-hidden">
                <ul className="m-0 list-none divide-y divide-[#edeff3] p-0">
                  {results.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="m-0 text-[14px] font-semibold">{fullName(o)} <span className="ml-1 align-middle"><Badge tone={isOrganization(o.ownershipType) ? "insp" : "draft"}>{ownershipTypeLabel(o.ownershipType)}</Badge></span></p>
                        <p className="mono mut m-0 text-[12.5px]">{isOrganization(o.ownershipType) ? o.organizationRegistrationNumber : o.identificationNumber} · {o.mobile}{o.dateOfBirth ? ` · DOB ${formatDate(o.dateOfBirth)}` : ""}</p>
                      </div>
                      <button type="button" className="btn btn-p btn-sm" disabled={busy} onClick={() => selectOwner(o)}>{isTransfer ? "Select as New Owner" : "Use Existing Owner"}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
          {mode === "search" && (
            <div className="row">
              <span className="mut text-[13px]">Not found?</span>
              <button type="button" className="btn btn-s" onClick={() => { form.reset(EMPTY); setMode("new"); if (!isTransfer) registrationService.saveDraft(app.id, { ownerMode: "new" }, 2); }}><UserPlus size={16} aria-hidden="true" />Create New Owner</button>
            </div>
          )}
        </section>
      )}

      {(mode === "new" || mode === "edit") && (
        <OwnerInformationForm
          form={form}
          title={mode === "edit" ? (isChangeOwner ? "Update owner information" : "Edit owner details") : isTransfer ? "New owner (buyer)" : "Registered owner"}
          onCancel={mode === "edit" ? () => setMode("selected") : undefined}
        />
      )}

      <Modal
        open={!!dupes}
        onClose={() => setDupes(null)}
        title="Potential Duplicate Owner"
        description="An owner with matching details already exists. Records are never merged automatically."
        footer={
          <>
            <button type="button" className="btn btn-s" onClick={() => setDupes(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-s" onClick={createOwner} disabled={busy}>Continue Creating New Owner</button>
          </>
        }
      >
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {dupes?.map((d) => (
            <li key={d.owner.id} className="rounded-lg border border-[#e1e4ea] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[15px] font-semibold">{fullName(d.owner)}</p>
                  <p className="mono mut m-0 text-[12.5px]">{d.owner.identificationNumber} · {d.owner.mobile}{d.owner.dateOfBirth ? ` · DOB ${formatDate(d.owner.dateOfBirth)}` : ""}</p>
                  <p className="mut m-0 text-[12.5px]">{d.owner.street}, {d.owner.province}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{d.reasons.map((r) => <Badge key={r} tone="payq">{REASON_LABEL[r]}</Badge>)}</div>
                </div>
                <button type="button" className="btn btn-p btn-sm" disabled={busy} onClick={() => selectOwner(d.owner)}>Use Existing Owner</button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
