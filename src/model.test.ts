import { describe, expect, it } from "vitest";
import { advanceIncident, createIncident, escalateIncident, formatElapsed } from "./model";

describe("incident lifecycle", () => {
  it("creates a trackable incident with a first timeline entry", () => {
    const incident = createIncident("fire", "Smoke near line 2", "Line 2", "12, 80");
    expect(incident.id).toMatch(/^ZG-\d{4}-\d{6}$/);
    expect(incident.status).toBe("triggered");
    expect(incident.timeline).toHaveLength(1);
  });

  it("moves forward one lifecycle step at a time", () => {
    const incident = createIncident("medical", "", "Warehouse", "Unavailable");
    const next = advanceIncident(incident, "Safety desk");
    expect(next.status).toBe("acknowledged");
    expect(next.timeline.at(-1)?.actor).toBe("Safety desk");
  });

  it("adds one control-room escalation only", () => {
    const incident = createIncident("security", "", "Gate", "Unavailable");
    const escalated = escalateIncident(incident, "Safety desk");
    expect(escalated.escalated).toBe(true);
    expect(escalateIncident(escalated, "Safety desk").timeline).toHaveLength(2);
  });

  it("formats elapsed time for the response UI", () => {
    expect(formatElapsed("2026-10-03T10:00:00.000Z", new Date("2026-10-03T10:07:12.000Z"))).toBe("7m");
  });
});
