import { MockDemoService } from "./mock/demo.mock";

export { SCENARIOS, type ScenarioKey } from "./mock/demo.mock";

/** QA-only utilities (Demo Tools, /dev/demo). Not part of the Phase 2 backend. */
export const demoService = new MockDemoService();
