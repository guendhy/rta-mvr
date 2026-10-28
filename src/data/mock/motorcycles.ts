import type { IntendedUse, Motorcycle } from "@/types";
import { SEED_OWNERS } from "./owners";
import { officeForProvince } from "./offices";

type MotoSeed = [
  ownerIndex: number, make: string, model: string, variant: string, year: number, color: string,
  cc: number, sidecar: boolean, use: IntendedUse, engineNumber: string, chassisNumber: string, vin: string,
  country: string,
];

/** Fictional identifiers — VINs are 17 characters, no I/O/Q. */
const MOTOS: MotoSeed[] = [
  [0, "Honda", "XR150L", "Standard", 2023, "Red", 149, false, "private", "KD12E-7741093", "KD12-5100734", "MLHKD1210P5100734", "Thailand"],
  [1, "Yamaha", "YBR125", "ED", 2022, "Black", 124, false, "private", "E3X9E-1029384", "LBP-1029384", "LBPKE097000102938", "China"],
  [2, "Suzuki", "GN125", "Classic", 2021, "Blue", 124, false, "commercial", "F4A1-2219837", "LC6-2219837", "LC6PCJK6600221983", "China"],
  [3, "Honda", "CB125F", "Standard", 2024, "Silver", 124, false, "private", "JC64E-3301127", "MLH-3301127", "MLHJC6410R5330112", "Thailand"],
  [4, "Bajaj", "Boxer 150", "BM", 2020, "Red", 144, false, "commercial", "DUZWJK-5512874", "MD2-5512874", "MD2A18AZ5LWK55128", "India"],
  [5, "TVS", "Apache 160", "4V", 2023, "White", 159, false, "private", "OE4LK-8812203", "MD6-8812203", "MD626BG41P1881220", "India"],
  [6, "Kawasaki", "KLX150", "BF", 2022, "Green", 144, false, "government", "LX150BE-6619321", "JKA-6619321", "JKALXT0BBNA661932", "Japan"],
  [7, "Yamaha", "XTZ125", "E", 2021, "Blue", 124, false, "commercial", "E3V5E-4472910", "9C6-4472910", "9C6KE1210M0447291", "Indonesia"],
  [8, "Honda", "Wave 110", "Alpha", 2022, "Black", 109, false, "private", "JA12E-9930118", "MLH-9930118", "MLHJA1210N5993011", "Vietnam"],
  [9, "Haojue", "DK150", "Standard", 2023, "Grey", 149, false, "private", "HJ162FMJ-220871", "LC6-220871", "LC6PAGA19P0022087", "China"],
  [10, "Suzuki", "DR200", "SE", 2024, "Yellow", 199, false, "government", "N424-118290", "JS1-118290", "JS1SH42A0R2118290", "Japan"],
  [11, "Honda", "CRF250L", "Rally", 2024, "Red", 249, false, "private", "MD44E-2280154", "MLH-2280154", "MLHMD4410R5228015", "Thailand"],
  [12, "Bajaj", "Discover 125", "ST", 2023, "Black", 124, false, "commercial", "JZYCLF-7701263", "MD2-7701263", "MD2A76AZ8PWJ77012", "India"],
  [13, "Yamaha", "Crypton", "X", 2022, "Blue", 113, false, "private", "1S7E-5562019", "MH3-5562019", "MH31S7102N0556201", "Indonesia"],
  [14, "Honda", "XR150L", "Standard", 2025, "White", 149, false, "private", "KD12E-8823410", "KD12-6823410", "MLHKD1210S5682341", "Thailand"],
  [15, "TVS", "HLX 125", "Gold", 2024, "Red", 124, true, "commercial", "OF2HK-3390775", "MD6-3390775", "MD625AF18R1339077", "India"],
  [16, "Kawasaki", "Barako 175", "II", 2023, "Black", 174, true, "commercial", "BC175JE-4410098", "MH4-4410098", "MH4BC175KPJ441009", "Philippines"],
  [17, "Suzuki", "TF125", "Mudsplasher", 2021, "Orange", 124, false, "private", "F441-7781205", "MH8-7781205", "MH8BF4210MJ778120", "Malaysia"],
  [18, "Honda", "CG125", "Titan", 2025, "Red", 124, false, "private", "JC30E-1192856", "9C2-1192856", "9C2JC3010SR119285", "Japan"],
  [19, "Yamaha", "AG200", "F", 2024, "Blue", 196, false, "government", "3GX-8820417", "JYA-8820417", "JYA3GX00XRA882041", "Japan"],
  [0, "Bajaj", "Pulsar 180", "DTS-i", 2025, "Black", 178, false, "private", "DKZCFK-6634082", "MD2-6634082", "MD2A11CZ3SCK66340", "India"],
  [3, "Haojue", "HJ125", "8", 2025, "Silver", 124, false, "commercial", "157FMI-3348810", "LC6-3348810", "LC6PCJG86S0334881", "China"],
  [8, "Honda", "Wave 110", "Alpha", 2025, "Red", 109, false, "private", "JA12E-4459021", "MLH-4459021", "MLHJA1210S5445902", "Vietnam"],
  [13, "Yamaha", "FZ150", "i", 2024, "Black", 149, false, "private", "G3D4E-0098812", "MH3-0098812", "MH3RG4610RK009881", "Indonesia"],
  [5, "Suzuki", "AX100", "Standard", 2023, "Blue", 99, true, "commercial", "AX100-5527734", "MB8-5527734", "MB8CE47AXPB552773", "India"],
];

const id = (n: number) => `9b8a7c6d-5e4f-4d3c-a2b1-${String(n).padStart(12, "0")}`;

export const SEED_MOTORCYCLES: Motorcycle[] = MOTOS.map((m, i) => {
  const owner = SEED_OWNERS[m[0]];
  return {
    id: id(i + 1),
    ownerId: owner.id,
    make: m[1],
    model: m[2],
    variant: m[3],
    year: m[4],
    bodyType: m[7] ? "Tricycle (Sidecar)" : m[2].includes("XR") || m[2].includes("KLX") || m[2].includes("DR") || m[2].includes("CRF") || m[2].includes("AG") || m[2].includes("XTZ") ? "Off-road / Trail" : "Standard",
    color: m[5],
    engineNumber: m[9],
    chassisNumber: m[10],
    vin: m[11],
    engineCapacityCc: m[6],
    fuelType: "petrol",
    countryOfManufacture: m[12],
    importStatus: m[4] >= 2025 ? "new_import" : "used_import",
    intendedUse: m[8],
    sidecar: m[7],
    provinceOfOperation: owner.province,
    officeId: officeForProvince(owner.province),
    photos: {},
    registrationStatus: "unregistered",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
});
