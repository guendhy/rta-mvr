import { differenceInYears, parseISO, isValid } from "date-fns";
import { z } from "zod";
import { getVehicleType } from "@/config/vehicle-types";
import { vehicleFieldsFor } from "@/config/vehicle-fields";

const today = () => new Date().toISOString().slice(0, 10);

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .regex(/^\+?675[\s-]?\d{3,4}[\s-]?\d{4}$|^7\d{3}[\s-]?\d{4}$/, "Use a PNG mobile number, e.g. +675 7123 4567");

const optionalText = (max = 120) => z.string().trim().max(max).optional().or(z.literal(""));

/**
 * Registered owner. Individuals need personal details; companies, government agencies,
 * diplomatic missions and other entities need the organisation, its registration number
 * and an authorized representative (whose name and ID go in the personal fields).
 */
export const ownerSchema = z.object({
  ownershipType: z.enum(["individual", "company", "government", "diplomatic", "other_entity"], { errorMap: () => ({ message: "Select the ownership type" }) }),
  organizationName: optionalText(),
  organizationRegistrationNumber: optionalText(40),
  authorizedRepresentative: optionalText(),
  representativePosition: optionalText(80),
  businessPhone: optionalText(30),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  middleName: z.string().trim().max(60).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "unspecified"]).optional().or(z.literal("")),
  nationality: z.string().min(1, "Nationality is required"),
  identificationType: z.enum(["drivers_licence", "passport", "national_id", "other_government_id"], { errorMap: () => ({ message: "Select an identification type" }) }),
  identificationNumber: z.string().trim().min(5, "Enter the identification number").max(30).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  mobile: phoneSchema,
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  province: z.string().min(1, "Province is required"),
  district: z.string().min(1, "District is required"),
  llg: z.string().min(1, "Select the LLG — list is filtered by district"),
  ward: z.string().trim().max(40).optional().or(z.literal("")),
  street: z.string().trim().min(3, "Street / village is required").max(120),
  postalAddress: z.string().trim().max(120).optional().or(z.literal("")),
}).superRefine((v, ctx) => {
  if (v.ownershipType === "individual") {
    const d = v.dateOfBirth ? parseISO(v.dateOfBirth) : null;
    if (!v.dateOfBirth || !d || !isValid(d) || v.dateOfBirth > today() || differenceInYears(new Date(), d) < 16 || differenceInYears(new Date(), d) > 110) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Owner must be between 16 and 110 years old" });
    }
    if (!v.gender) ctx.addIssue({ code: "custom", path: ["gender"], message: "Select a gender" });
    return;
  }
  if (!v.organizationName?.trim()) ctx.addIssue({ code: "custom", path: ["organizationName"], message: "Organization name is required" });
  if (!v.organizationRegistrationNumber?.trim()) ctx.addIssue({ code: "custom", path: ["organizationRegistrationNumber"], message: "Registration number is required" });
  if (!v.authorizedRepresentative?.trim()) ctx.addIssue({ code: "custom", path: ["authorizedRepresentative"], message: "Authorized representative is required" });
});
export type OwnerFormValues = z.infer<typeof ownerSchema>;

const currentYear = new Date().getFullYear();

/** Step 3 — classification. Body type options depend on the vehicle type. */
export const classificationSchema = z.object({
  vehicleType: z.string().min(1, "Select the vehicle type"),
  vehicleClass: z.string().min(1, "Select the vehicle class"),
  vehicleUsage: z.string().min(1, "Select the vehicle use / purpose"),
  bodyType: z.string().min(1, "Select the body type"),
});
export type ClassificationFormValues = z.infer<typeof classificationSchema>;

/**
 * Step 4 — common vehicle details. Type-specific technical fields are validated from the
 * dynamic field configuration (`vehicleFieldsFor`), so new vehicle types need no new code.
 */
export function vehicleSchemaFor(vehicleType: string | undefined) {
  const def = getVehicleType(vehicleType);
  return z.object({
    make: z.string().trim().min(1, "Make is required"),
    model: z.string().trim().min(1, "Model is required"),
    variant: z.string().trim().max(60).optional().or(z.literal("")),
    year: z.coerce.number({ invalid_type_error: "Enter the year" }).int().min(1950, "Year must be 1950 or later").max(currentYear + 1, `Year cannot be after ${currentYear + 1}`),
    modelYear: z.union([z.coerce.number().int().min(1950).max(currentYear + 2), z.literal("")]).optional(),
    color: z.string().min(1, "Colour is required"),
    secondaryColor: z.string().optional().or(z.literal("")),
    engineNumber: def.hasEngine
      ? z.string().trim().min(5, "Engine number must be at least 5 characters").max(25).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only")
      : z.string().trim().max(25).optional().or(z.literal("")),
    chassisNumber: z.string().trim().min(5, "Chassis number must be at least 5 characters").max(25).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
    vin: z.string().trim().toUpperCase().length(17, "VIN must be exactly 17 characters").regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN uses letters and numbers only (no I, O or Q)"),
    fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "lpg", "none"]),
    transmission: z.enum(["manual", "automatic", "cvt", "semi_automatic", "not_applicable"]),
    countryOfManufacture: z.string().min(1, "Country is required"),
    importStatus: z.enum(["new_import", "used_import", "locally_assembled", "local_resale"]),
    provinceOfOperation: z.string().min(1, "Province of operation is required"),
    previousRegistrationNumber: z.string().trim().max(30).optional().or(z.literal("")),
    specifications: z.record(z.union([z.string(), z.number(), z.boolean()]).optional()),
  }).superRefine((v, ctx) => {
    if (def.hasEngine && v.fuelType === "none") ctx.addIssue({ code: "custom", path: ["fuelType"], message: "Select the fuel type" });
    for (const f of vehicleFieldsFor(def.key, { fuelType: v.fuelType })) {
      const raw = v.specifications?.[f.key];
      const empty = raw === undefined || raw === "" || raw === null;
      if (empty) {
        if (f.required && f.input !== "boolean") ctx.addIssue({ code: "custom", path: ["specifications", f.key], message: `${f.label} is required for ${def.label.toLowerCase()}s` });
        continue;
      }
      if (f.input === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) ctx.addIssue({ code: "custom", path: ["specifications", f.key], message: `${f.label} must be a number` });
        else if (f.integer && !Number.isInteger(n)) ctx.addIssue({ code: "custom", path: ["specifications", f.key], message: `${f.label} must be a whole number` });
        else if (f.min !== undefined && n < f.min) ctx.addIssue({ code: "custom", path: ["specifications", f.key], message: `Minimum ${f.min}${f.unit ? ` ${f.unit}` : ""}` });
        else if (f.max !== undefined && n > f.max) ctx.addIssue({ code: "custom", path: ["specifications", f.key], message: `Maximum ${f.max.toLocaleString("en-US")}${f.unit ? ` ${f.unit}` : ""}` });
      }
    }
    const gvm = Number(v.specifications?.grossVehicleMassKg);
    const tare = Number(v.specifications?.tareWeightKg);
    if (gvm && tare && tare >= gvm) ctx.addIssue({ code: "custom", path: ["specifications", "tareWeightKg"], message: "Tare weight must be less than the GVM" });
  });
}
export type VehicleFormValues = z.infer<ReturnType<typeof vehicleSchemaFor>>;

/** Transfer of ownership — sale details. */
export const transferSchema = z.object({
  saleDate: z.string().min(1, "Sale / transfer date is required").refine((v) => v <= today(), "Date cannot be in the future"),
  salePrice: z.union([z.coerce.number().min(0, "Price cannot be negative").max(100_000_000), z.literal("")]).optional(),
  reason: z.enum(["sale", "gift", "inheritance", "court_order", "company_restructure", "other"]),
  sellerConsent: z.literal(true, { errorMap: () => ({ message: "The seller's signed consent is required" }) }),
});
export type TransferFormValues = z.infer<typeof transferSchema>;

export const insuranceSchema = z.object({
  provider: z.string().min(1, "Select the insurance provider"),
  policyNumber: z.string().trim().min(5, "Enter the policy number").max(40),
  policyHolder: z.string().trim().min(3, "Enter the policy holder"),
  coverageStart: z.string().min(1, "Coverage start is required"),
  coverageExpiry: z.string().min(1, "Coverage expiry is required"),
  premium: z.coerce.number({ invalid_type_error: "Enter the premium" }).min(0, "Premium cannot be negative").max(100000),
  vinOrChassis: z.string().trim().min(5, "Enter the VIN or chassis number on the policy"),
}).refine((v) => v.coverageExpiry > v.coverageStart, { path: ["coverageExpiry"], message: "Expiry must be after the start date" });
export type InsuranceFormValues = z.infer<typeof insuranceSchema>;

export const amountSchema = z.coerce.number({ invalid_type_error: "Enter an amount" }).min(0.01, "Enter an amount").max(1_000_000);
