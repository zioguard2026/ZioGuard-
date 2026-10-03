import { describe, expect, it } from "vitest";
import { advanceIncident, cancelIncident, categoryLabels, createIncident, dispatchIncident, escalateIncident, formatElapsed, isActive } from "./model";

describe("incident lifecycle", () => {
  it("keeps the four approved worker emergency choices", () => {
    expect(categoryLabels).toEqual({
      fire: "FIRE",
      hazmat: "HAZMAT",
      security: "SECURITY",
      medical: "AMBULANCE",
    });
  });

  it("assigns and dispatches a control-room response unit", () => {
    const incident = createIncident("medical", "Worker needs an ambulance", "Warehouse", "Facility location");
    const dispatched = dispatchIncident(incident, "Police Control Operator", "Ambulance Unit A-12");
    expect(dispatched.status).toBe("dispatched");
    expect(dispatched.assignedTeam).toBe("Ambulance Unit A-12");
    expect(dispatched.timeline.at(-1)?.label).toContain("dispatched");
  });

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

  it("closes a false alert without deleting its audit trail", () => {
    const incident = createIncident("security", "", "North gate", "Facility location");
    const cancelled = cancelIncident(incident, "Demo Worker 01");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.timeline.at(-1)?.label).toBe("False alert reported");
    expect(isActive(cancelled)).toBe(false);
  });
});
