export const appConfig = {
  // FUTURE: switch to "supabase" once Supabase service implementations exist (see docs/PHASE_2_SUPABASE_PLAN.md).
  backendMode: "mock" as "mock" | "supabase",
  enableMockPos: true,
  enableDemoTools: true,
  enableOfflineSimulation: true,
  enableLocalPersistence: true,
  version: "1.0.0-demo",
};

export const isDevelopment = process.env.NODE_ENV === "development";
