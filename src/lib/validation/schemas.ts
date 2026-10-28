import { differenceInYears, parseISO, isValid } from "date-fns";
import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .regex(/^\+?675[\s-]?\d{3,4}[\s-]?\d{4}$|^7\d{3}[\s-]?\d{4}$/, "Use a PNG mobile number, e.g. +675 7123 4567");

export const ownerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  middleName: z.string().trim().max(60).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  dateOfBirth: z.string().min(1, "Date of birth is required").refine((v) => {
    const d = parseISO(v);
    return isValid(d) && v <= today() && differenceInYears(new Date(), d) >= 16 && differenceInYears(new Date(), d) <= 110;
  }, "Owner must be between 16 and 110 years old"),
  gender: z.enum(["male", "female", "unspecified"], { errorMap: () => ({ message: "Select a gender" }) }),
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
});
export type OwnerFormValues = z.infer<typeof ownerSchema>;

const currentYear = new Date().getFullYear();

export const motorcycleSchema = z.object({
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  variant: z.string().trim().max(40).optional().or(z.literal("")),
  year: z.coerce.number({ invalid_type_error: "Enter the year" }).int().min(1970, "Year must be 1970 or later").max(currentYear + 1, `Year cannot be after ${currentYear + 1}`),
  bodyType: z.string().min(1, "Body type is required"),
  color: z.string().min(1, "Colour is required"),
  engineNumber: z.string().trim().min(5, "Engine number must be at least 5 characters").max(25).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  chassisNumber: z.string().trim().min(5, "Chassis number must be at least 5 characters").max(25).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  vin: z.string().trim().toUpperCase().length(17, "VIN must be exactly 17 characters").regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN uses letters and numbers only (no I, O or Q)"),
  engineCapacityCc: z.coerce.number({ invalid_type_error: "Enter the engine capacity" }).int().min(49, "Minimum 49 cc").max(2500, "Maximum 2500 cc"),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]),
  countryOfManufacture: z.string().min(1, "Country is required"),
  importStatus: z.enum(["new_import", "used_import", "locally_assembled", "local_resale"]),
  intendedUse: z.enum(["private", "commercial", "government", "other"], { errorMap: () => ({ message: "Select the intended use" }) }),
  sidecar: z.boolean(),
  provinceOfOperation: z.string().min(1, "Province of operation is required"),
});
export type MotorcycleFormValues = z.infer<typeof motorcycleSchema>;

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
