"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Search, UserPlus } from "lucide-react";
import { ownerService } from "@/services/owner.service";
import { registrationService } from "@/services/registration.service";
import { districtsFor, GENDERS, IDENTIFICATION_TYPES, llgsFor, PROVINCE_NAMES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, fullName } from "@/lib/formatting";
import { ownerSchema, type OwnerFormValues } from "@/lib/validation/schemas";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { OwnerCard } from "../cards";
import { useAutosave, type StepProps } from "./types";
import type { Owner, OwnerDuplicateMatch } from "@/types";

const EMPTY: OwnerFormValues = {
  firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "" as OwnerFormValues["gender"], nationality: "Papua New Guinean",
  identificationType: "" as OwnerFormValues["identificationType"], identificationNumber: "", mobile: "", email: "",
  province: "", district: "", llg: "", ward: "", street: "", postalAddress: "",
};

const REASON_LABEL = { identification: "Same ID number", mobile: "Same mobile", name_dob: "Same name + date of birth" };

function toForm(o: Partial<Owner> | undefined): OwnerFormValues {
  return { ...EMPTY, ...Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => k in EMPTY)) } as OwnerFormValues;
}

export function OwnerStep({ detail, editable, registerApi, onSaveState, advance }: StepProps) {
  const app = detail.application;
  const [mode, setMode] = useState<"selected" | "search" | "new" | "edit">(detail.owner ? "selected" : app.draft.ownerMode === "new" ? "new" : "search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Owner[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [dupes, setDupes] = useState<OwnerDuplicateMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const form = useForm<OwnerFormValues>({ resolver: zodResolver(ownerSchema), defaultValues: mode === "edit" ? toForm(detail.owner ?? undefined) : toForm(app.draft.owner), mode: "onTouched" });
  const { register, watch, setValue, formState: { errors } } = form;
  const values = watch();
  const districts = useMemo(() => districtsFor(values.province), [values.province]);
  const llgs = useMemo(() => llgsFor(values.district), [values.district]);

  useAutosave(values, editable && mode === "new", async (v) => {
    onSaveState("saving");
    try {
      await registrationService.saveDraft(app.id, { owner: v, ownerMode: "new" }, 1);
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
      setResults(await ownerService.search(query));
    } finally {
      setSearching(false);
    }
  };

  const selectOwner = async (o: Owner) => {
    setBusy(true);
    try {
      await registrationService.attachOwner(app.id, o.id);
      await registrationService.saveDraft(app.id, { ownerMode: "existing" }, 2);
      toast.success(`Owner ${fullName(o)} selected`);
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
      const v = form.getValues();
      const owner = await ownerService.create({ ...v, middleName: v.middleName || undefined, email: v.email || undefined, ward: v.ward || undefined, postalAddress: v.postalAddress || undefined });
      await registrationService.attachOwner(app.id, owner.id);
      toast.success(`Owner ${fullName(owner)} created`);
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
      continueLabel: "Continue to Motorcycle",
      saveDraft: async () => {
        if (latest.current.mode !== "new") return;
        await registrationService.saveDraft(app.id, { owner: form.getValues(), ownerMode: "new" }, 1);
      },
      continue: async () => {
        const m = latest.current.mode;
        if (!editable) return true;
        if (m === "selected") {
          if (!latest.current.detail.owner) {
            toast.error("Select or create the owner first.");
            return false;
          }
          return true;
        }
        if (m === "search") {
          toast.error("Select an existing owner or create a new one.");
          return false;
        }
        const ok = await form.trigger();
        if (!ok) {
          toast.error("Check the highlighted fields.");
          return false;
        }
        if (m === "edit" && latest.current.detail.owner) {
          await ownerService.update(latest.current.detail.owner.id, form.getValues());
          toast.success("Owner details updated");
          return true;
        }
        const matches = await ownerService.findDuplicates(form.getValues());
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

  if (!editable || mode === "selected") {
    return detail.owner ? (
      <div className="flex flex-col gap-5">
        <OwnerCard
          owner={detail.owner}
          actions={editable ? (
            <>
              <Badge tone="ok">Owner selected</Badge>
              <button type="button" className="btn btn-s btn-sm" onClick={() => { form.reset(toForm(detail.owner!)); setMode("edit"); }}><Pencil size={14} aria-hidden="true" />Edit details</button>
              <button type="button" className="btn btn-g btn-sm" onClick={() => setMode("search")}>Change owner</button>
            </>
          ) : <Badge tone="ok">{app.type === "renewal" ? "Reviewed for renewal" : "Owner on record"}</Badge>}
        />
        {app.type === "renewal" && <Alert tone="info" title="Renewal — owner already on record">Confirm the owner details with the applicant. Owner changes require a Transfer Registration transaction.</Alert>}
      </div>
    ) : <Alert tone="warn" title="No owner linked">This application has no owner yet.</Alert>;
  }

  return (
    <div className="flex flex-col gap-5">
      {(mode === "search" || mode === "new") && (
        <section className="card sec !border-[#cfcffb] !bg-[#f5f5ff]">
          <div><h2 className="h3">Search existing owner</h2><p className="mut m-0 mt-0.5 text-[13px]">Always search first — prevents duplicate owner records.</p></div>
          <form className="row items-end" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <div className="min-w-0 flex-[1_1_260px]">
              <label className="lbl" htmlFor="owner-search">Name, ID number or mobile</label>
              <input ref={searchRef} id="owner-search" className="inp" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Kila, DL-POM-0482196, 7123 4842" />
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
                        <p className="m-0 text-[14px] font-semibold">{fullName(o)}</p>
                        <p className="mono mut m-0 text-[12.5px]">{o.identificationNumber} · {o.mobile} · DOB {formatDate(o.dateOfBirth)}</p>
                      </div>
                      <button type="button" className="btn btn-p btn-sm" disabled={busy} onClick={() => selectOwner(o)}>Use Existing Owner</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
          {mode === "search" && (
            <div className="row">
              <span className="mut text-[13px]">Not found?</span>
              <button type="button" className="btn btn-s" onClick={() => { setMode("new"); registrationService.saveDraft(app.id, { ownerMode: "new" }, 1); }}><UserPlus size={16} aria-hidden="true" />Create New Owner</button>
            </div>
          )}
        </section>
      )}

      {(mode === "new" || mode === "edit") && (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
          <section className="card sec">
            <div className="sechd"><h2 className="h2">{mode === "edit" ? "Edit owner details" : "Personal information"}</h2>{mode === "edit" && <button type="button" className="btn btn-g btn-sm" onClick={() => setMode("selected")}>Cancel edit</button>}</div>
            <div className="form">
              <Field label="First Name" required htmlFor="fn" error={errors.firstName?.message}><Input id="fn" autoFocus invalid={!!errors.firstName} {...register("firstName")} /></Field>
              <Field label="Middle Name" htmlFor="mn"><Input id="mn" {...register("middleName")} /></Field>
              <Field label="Last Name" required htmlFor="ln" error={errors.lastName?.message}><Input id="ln" invalid={!!errors.lastName} {...register("lastName")} /></Field>
              <Field label="Date of Birth" required htmlFor="dob" error={errors.dateOfBirth?.message} help="Owner must be 16 or older."><Input id="dob" type="date" invalid={!!errors.dateOfBirth} {...register("dateOfBirth")} /></Field>
              <Field label="Gender" required htmlFor="gd" error={errors.gender?.message}><Select id="gd" placeholder="Select" options={GENDERS} invalid={!!errors.gender} {...register("gender")} /></Field>
              <Field label="Nationality" required htmlFor="nat" error={errors.nationality?.message}><Select id="nat" options={["Papua New Guinean", "Australian", "Filipino", "Chinese", "Indonesian", "Other"]} {...register("nationality")} /></Field>
            </div>
          </section>
          <section className="card sec">
            <h2 className="h2">Identification</h2>
            <div className="form">
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
            <h2 className="h2">Residential address</h2>
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
              <Field label="Street / Village" required htmlFor="st" error={errors.street?.message}><Input id="st" invalid={!!errors.street} {...register("street")} /></Field>
              <Field label="Postal Address" htmlFor="po"><Input id="po" {...register("postalAddress")} /></Field>
            </div>
          </section>
        </form>
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
                  <p className="mono mut m-0 text-[12.5px]">{d.owner.identificationNumber} · {d.owner.mobile} · DOB {formatDate(d.owner.dateOfBirth)}</p>
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
