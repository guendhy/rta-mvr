import { plateCategoryFor } from "@/config/vehicle-usage";
import { suggestVehicleClass } from "@/config/vehicle-types";
import type { FuelType, TransmissionType, Vehicle, VehicleSpecifications, VehicleType, VehicleUsage } from "@/types";
import { SEED_OWNERS } from "./owners";
import { officeForProvince } from "./offices";

type VehicleSeed = [
  ownerIndex: number, type: VehicleType, usage: VehicleUsage, make: string, model: string, variant: string, year: number,
  color: string, body: string, fuel: FuelType, transmission: TransmissionType, engineNumber: string, chassisNumber: string, vin: string,
  country: string, specs: VehicleSpecifications,
];

/**
 * Mixed fleet across every vehicle group. Fictional identifiers — VINs are 17 characters
 * without I, O or Q. Index comments are referenced by `applications.ts`.
 */
const SEEDS: VehicleSeed[] = [
  /* 00 */ [0, "pickup", "private", "Toyota", "Hilux", "SR 2.4D 4x4 Double Cab", 2025, "White", "Double cab utility", "diesel", "manual", "2GD-4718822", "MR0HA3CD100823415", "MR0HA3CD100823415", "Thailand", { engineCapacityCc: 2393, cylinders: 4, enginePowerKw: 110, grossVehicleMassKg: 2910, tareWeightKg: 2060, seatingCapacity: 5, axleCount: 2, wheelCount: 4, doorCount: 4 }],
  /* 01 */ [1, "sedan", "private", "Toyota", "Corolla", "Ascent Sport", 2021, "Silver", "Sedan", "petrol", "cvt", "2ZR-5521093", "JTDBR3FE10J021774", "JTDBR3FE10J021774", "Japan", { engineCapacityCc: 1798, cylinders: 4, grossVehicleMassKg: 1750, seatingCapacity: 5, doorCount: 4 }],
  /* 02 */ [2, "motorcycle", "commercial", "Suzuki", "GN125", "Classic", 2021, "Blue", "Standard", "petrol", "manual", "F4A1-2219837", "LC6-2219837", "LC6PCJK6600221983", "China", { engineCapacityCc: 124, wheelCount: 2, motorcycleCategory: "Standard", sidecar: false }],
  /* 03 */ [3, "suv", "private", "Mitsubishi", "Pajero", "GLS 3.2 DI-D", 2019, "Grey", "4WD Wagon", "diesel", "automatic", "4M41-UAX8812", "JMYLYV98WKJ000412", "JMYLYV98WKJ000412", "Japan", { engineCapacityCc: 3200, cylinders: 4, grossVehicleMassKg: 2810, tareWeightKg: 2180, seatingCapacity: 7, doorCount: 5 }],
  /* 04 */ [4, "motorcycle", "commercial", "Bajaj", "Boxer 150", "BM", 2020, "Red", "Standard", "petrol", "manual", "DUZWJK-5512874", "MD2-5512874", "MD2A18AZ5LWK55128", "India", { engineCapacityCc: 144, wheelCount: 2, motorcycleCategory: "Standard", sidecar: false }],
  /* 05 */ [5, "hatchback", "private", "Suzuki", "Swift", "GL", 2022, "Red", "Hatch", "petrol", "manual", "K12M-1192034", "MA3ZC83S2NA119203", "MA3ZC83S2NA119203", "India", { engineCapacityCc: 1197, cylinders: 4, grossVehicleMassKg: 1365, seatingCapacity: 5, doorCount: 5 }],
  /* 06 */ [6, "motorcycle", "private", "Kawasaki", "KLX150", "BF", 2022, "Green", "Trail / Dual-sport", "petrol", "manual", "LX150BE-6619321", "JKA-6619321", "JKALXT0BBNA661932", "Japan", { engineCapacityCc: 144, wheelCount: 2, motorcycleCategory: "Trail / Dual-sport", sidecar: false }],
  /* 07 */ [7, "van", "commercial", "Toyota", "HiAce", "LWB Panel Van 2.8D", 2018, "White", "Panel van", "diesel", "manual", "1GD-3390127", "JTFHX02P10K033901", "JTFHX02P10K033901", "Japan", { engineCapacityCc: 2755, cylinders: 4, grossVehicleMassKg: 3300, tareWeightKg: 2050, seatingCapacity: 3, doorCount: 4, axleCount: 2 }],
  /* 08 */ [8, "pickup", "private", "Nissan", "Navara", "ST 2.3D Dual Cab", 2020, "Black", "Double cab utility", "diesel", "automatic", "YS23-0418827", "MNTCB4D23Z0041882", "MNTCB4D23Z0041882", "Thailand", { engineCapacityCc: 2298, cylinders: 4, grossVehicleMassKg: 2910, tareWeightKg: 1980, seatingCapacity: 5, axleCount: 2 }],
  /* 09 */ [9, "motorcycle", "private", "Honda", "XR150L", "Standard", 2023, "Red", "Trail / Dual-sport", "petrol", "manual", "KD12E-7741093", "KD12-5100734", "MLHKD1210P5100734", "Thailand", { engineCapacityCc: 149, wheelCount: 2, motorcycleCategory: "Trail / Dual-sport", sidecar: false }],
  /* 10 */ [20, "pmv", "pmv", "Toyota", "Coaster", "Deluxe 4.0D", 2019, "White", "Bus", "diesel", "manual", "N04C-UT48810", "JTGFB518X01042277", "JTGFB518X01042277", "Japan", { seatingCapacity: 30, standingCapacity: 0, grossVehicleMassKg: 5300, axleCount: 2, engineCapacityCc: 4009, doorCount: 2, emergencyExits: 1, routePermitNumber: "PMV-WHL-2026-0418", routeDescription: "Mount Hagen town – Kagamuga" }],
  /* 11 */ [20, "bus", "public_transport", "Isuzu", "Journey", "J 4.8D", 2017, "Blue", "Bus", "diesel", "manual", "4HG1-T88213", "JALBH54G0H7000331", "JALBH54G0H7000331", "Japan", { seatingCapacity: 33, standingCapacity: 0, grossVehicleMassKg: 8600, axleCount: 2, engineCapacityCc: 4777, doorCount: 2, emergencyExits: 2, routePermitNumber: "PMV-WHL-2025-0219", routeDescription: "Mount Hagen – Banz – Minj" }],
  /* 12 */ [21, "prime-mover", "commercial", "Kenworth", "T659", "8x4 Prime Mover", 2021, "White", "Tractor unit", "diesel", "manual", "CUM-X15-7731028", "6KW1TT659M0002214", "6KW1TT659M0002214", "Australia", { grossVehicleMassKg: 43000, tareWeightKg: 9800, payloadCapacityKg: 33200, axleCount: 3, wheelCount: 10, engineCapacityCc: 14900, enginePowerKw: 410, trailerCoupling: "Fifth wheel" }],
  /* 13 */ [21, "semi-trailer", "commercial", "Maxitrans", "Freighter", "Tri-axle Flat Top", 2021, "Grey", "Flatbed", "none", "not_applicable", "", "6M9FT3A30M0000518", "6M9FT3A30M0000518", "Australia", { trailerType: "Flatbed", grossVehicleMassKg: 34000, tareWeightKg: 7200, payloadCapacityKg: 26800, axleCount: 3, brakeType: "Air", couplingType: "Kingpin (fifth wheel)", lengthMm: 13700 }],
  /* 14 */ [21, "truck", "commercial", "Isuzu", "FVZ", "1400 Tipper", 2022, "White", "Tipper", "diesel", "manual", "6HK1-882140", "JALFVZ34SN7000184", "JALFVZ34SN7000184", "Japan", { grossVehicleMassKg: 24000, tareWeightKg: 9600, payloadCapacityKg: 14400, axleCount: 3, wheelCount: 10, engineCapacityCc: 7790, enginePowerKw: 221, trailerCoupling: "Pintle" }],
  /* 15 */ [22, "taxi", "taxi", "Toyota", "Corolla", "Ascent Taxi", 2020, "White", "Sedan (Taxi)", "petrol", "automatic", "2ZR-6620148", "JTDBR3FE80J006614", "JTDBR3FE80J006614", "Japan", { seatingCapacity: 5, engineCapacityCc: 1798, grossVehicleMassKg: 1750, doorCount: 4, routePermitNumber: "TAXI-ENB-2025-0091", routeDescription: "Kokopo – Rabaul" }],
  /* 16 */ [23, "truck", "government", "Isuzu", "FVZ", "1400 Tray", 2020, "Yellow", "Tray", "diesel", "manual", "6HK1-771093", "JALFVZ34SL7000921", "JALFVZ34SL7000921", "Japan", { grossVehicleMassKg: 24000, tareWeightKg: 9100, payloadCapacityKg: 14900, axleCount: 3, wheelCount: 10, engineCapacityCc: 7790, trailerCoupling: "None" }],
  /* 17 */ [23, "government", "government", "Toyota", "Land Cruiser", "200 GXL Wagon", 2023, "White", "Wagon", "diesel", "automatic", "1VD-0447281", "JTMHV05J804044728", "JTMHV05J804044728", "Japan", { engineCapacityCc: 4461, grossVehicleMassKg: 3350, seatingCapacity: 8, authorizationReference: "DOWH/FLT/2023/117" }],
  /* 18 */ [24, "suv", "diplomatic", "Toyota", "Land Cruiser", "Prado VX", 2024, "Black", "4WD Wagon", "diesel", "automatic", "1GD-5510326", "JTEBR3FJ10K055103", "JTEBR3FJ10K055103", "Japan", { engineCapacityCc: 2755, grossVehicleMassKg: 2990, seatingCapacity: 7, authorizationReference: "DFA/CD/2024/042" }],
  /* 19 */ [25, "agricultural", "agricultural", "John Deere", "5075E", "Utility Tractor", 2022, "Green", "Tractor", "diesel", "manual", "PE4045-RG0331", "1PY5075EKNN400331", "1PY5075EKNN400331", "India", { equipmentType: "Tractor", grossVehicleMassKg: 3200, axleCount: 2, engineCapacityCc: 4500, operatingHours: 1240 }],
  /* 20 */ [26, "emergency", "emergency", "Toyota", "Land Cruiser", "78 Ambulance", 2023, "White", "Ambulance", "diesel", "manual", "1VD-0882415", "JTERB71J300088241", "JTERB71J300088241", "Japan", { equipmentType: "Ambulance", grossVehicleMassKg: 3400, seatingCapacity: 4, engineCapacityCc: 4461, authorizationReference: "NCDPHA/EMS/2023/09" }],
  /* 21 */ [27, "suv", "rental", "Toyota", "RAV4", "GX 2.0", 2023, "Silver", "Crossover", "petrol", "cvt", "M20A-2280154", "JTMW43FV40D228015", "JTMW43FV40D228015", "Japan", { engineCapacityCc: 1987, grossVehicleMassKg: 2100, seatingCapacity: 5, doorCount: 5 }],
  /* 22 */ [27, "minibus", "rental", "Toyota", "HiAce", "Commuter 2.8D", 2022, "White", "Commuter", "diesel", "automatic", "1GD-7701263", "JTFJX02P90K077012", "JTFJX02P90K077012", "Japan", { engineCapacityCc: 2755, grossVehicleMassKg: 3700, seatingCapacity: 14, doorCount: 4, axleCount: 2 }],
  /* 23 */ [28, "light-commercial", "corporate", "Toyota", "Land Cruiser", "79 Cab Chassis", 2021, "White", "Tray", "diesel", "manual", "1VD-5562019", "JTELV71J000556201", "JTELV71J000556201", "Japan", { grossVehicleMassKg: 3510, tareWeightKg: 2280, payloadCapacityKg: 1230, axleCount: 2, engineCapacityCc: 4461, seatingCapacity: 2 }],
  /* 24 */ [11, "trailer", "private", "Local manufacturer", "Box trailer", "7x4 Single Axle", 2020, "Grey", "Box trailer", "none", "not_applicable", "", "PNG-TR-2020-00412", "PNGTRBX7X4L000412", "Papua New Guinea", { trailerType: "Box", grossVehicleMassKg: 750, tareWeightKg: 220, payloadCapacityKg: 530, axleCount: 1, brakeType: "None (unbraked)", couplingType: "Ball", lengthMm: 3200 }],
  /* 25 */ [12, "motorcycle", "private", "Honda", "Wave 110", "Alpha", 2025, "Red", "Underbone", "petrol", "semi_automatic", "JA12E-4459021", "MLH-4459021", "MLHJA1210S5445902", "Vietnam", { engineCapacityCc: 109, wheelCount: 2, motorcycleCategory: "Underbone", sidecar: false }],
  /* 26 */ [13, "sedan", "private", "Mazda", "Mazda 3", "Maxx", 2019, "Blue", "Sedan", "petrol", "automatic", "PE-VPS-3348810", "JM0BP2SA200334881", "JM0BP2SA200334881", "Japan", { engineCapacityCc: 1998, grossVehicleMassKg: 1810, seatingCapacity: 5, doorCount: 4 }],
  /* 27 */ [14, "scooter", "private", "Yamaha", "NMAX", "155 ABS", 2024, "White", "Scooter", "petrol", "cvt", "G3L9E-0098812", "MH3SG4610RK009881", "MH3SG4610RK009881", "Indonesia", { engineCapacityCc: 155, wheelCount: 2 }],
  /* 28 */ [15, "pickup", "commercial", "Isuzu", "D-Max", "SX 3.0D Single Cab", 2024, "White", "Single cab utility", "diesel", "manual", "4JJ3-1182290", "MPATFS86JRT118229", "MPATFS86JRT118229", "Thailand", { engineCapacityCc: 2999, grossVehicleMassKg: 3000, tareWeightKg: 1710, seatingCapacity: 2, axleCount: 2 }],
  /* 29 */ [16, "motorcycle", "commercial", "TVS", "HLX 125", "Gold", 2024, "Red", "With sidecar", "petrol", "manual", "OF2HK-3390775", "MD6-3390775", "MD625AF18R1339077", "India", { engineCapacityCc: 124, wheelCount: 3, motorcycleCategory: "Standard", sidecar: true }],
  /* 30 */ [17, "suv", "private", "Hyundai", "Kona", "Electric 64 kWh", 2025, "Blue", "Crossover", "electric", "automatic", "EM16-0064551", "KMHK381GFSU006455", "KMHK381GFSU006455", "South Korea", { grossVehicleMassKg: 2170, seatingCapacity: 5, doorCount: 5, batteryType: "Lithium-ion (NMC)", batteryCapacityKwh: 64, motorPowerKw: 150 }],
  /* 31 */ [18, "van", "commercial", "Nissan", "Urvan", "NV350 Panel 2.5D", 2021, "White", "Panel van", "diesel", "manual", "YD25-6634082", "JN1TC2E26Z0663408", "JN1TC2E26Z0663408", "Japan", { engineCapacityCc: 2488, grossVehicleMassKg: 3200, tareWeightKg: 1960, seatingCapacity: 3, axleCount: 2 }],
  /* 32 */ [19, "pickup", "private", "Ford", "Ranger", "XLT 2.0 Bi-Turbo", 2025, "Blue", "Double cab utility", "diesel", "automatic", "YN2X-1192856", "MNCLMFF80SW119285", "MNCLMFF80SW119285", "Thailand", { engineCapacityCc: 1996, grossVehicleMassKg: 3280, tareWeightKg: 2290, seatingCapacity: 5, axleCount: 2 }],
  /* 33 */ [10, "sedan", "private", "Toyota", "Camry", "Ascent Hybrid", 2024, "Grey", "Sedan", "hybrid", "cvt", "A25A-8820417", "JTNB23HK003882041", "JTNB23HK003882041", "Japan", { engineCapacityCc: 2487, grossVehicleMassKg: 2100, seatingCapacity: 5, doorCount: 4, batteryType: "Nickel-metal hydride", batteryCapacityKwh: 1.6, motorPowerKw: 88 }],
  /* 34 */ [7, "motorcycle", "private", "Yamaha", "XTZ125", "E", 2021, "Blue", "Trail / Dual-sport", "petrol", "manual", "E3V5E-4472910", "9C6-4472910", "9C6KE1210M0447291", "Indonesia", { engineCapacityCc: 124, wheelCount: 2, motorcycleCategory: "Trail / Dual-sport", sidecar: false }],
];

const id = (n: number) => `9b8a7c6d-5e4f-4d3c-a2b1-${String(n).padStart(12, "0")}`;

export const SEED_VEHICLES: Vehicle[] = SEEDS.map((v, i) => {
  const owner = SEED_OWNERS[v[0]];
  return {
    id: id(i + 1),
    ownerId: owner.id,
    vehicleType: v[1],
    vehicleClass: suggestVehicleClass(v[1], v[15]),
    vehicleUsage: v[2],
    bodyType: v[8],
    make: v[3],
    model: v[4],
    variant: v[5],
    year: v[6],
    modelYear: v[6],
    color: v[7],
    secondaryColor: undefined,
    engineNumber: v[11],
    chassisNumber: v[12],
    vin: v[13],
    fuelType: v[9],
    transmission: v[10],
    countryOfManufacture: v[14],
    importStatus: v[14] === "Papua New Guinea" ? "locally_assembled" : v[6] >= 2025 ? "new_import" : "used_import",
    provinceOfOperation: owner.province,
    officeId: officeForProvince(owner.province),
    specifications: v[15],
    photos: {},
    registrationStatus: "unregistered",
    plateCategory: plateCategoryFor(v[1], v[2]),
    ownershipHistory: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
});
