export type Role = "worker" | "company" | "control";
export type Category = "fire" | "hazmat" | "security" | "medical";
export type IncidentStatus =
  | "triggered"
  | "acknowledged"
  | "dispatched"
  | "on_scene"
  | "resolved"
  | "cancelled";

export interface ReporterSnapshot {
  displayName: string;
  employeeId: string;
  organization: string;
  facility: string;
}

export interface TimelineEntry {
  id: string;
  status: IncidentStatus | "note" | "escalated";
  label: string;
  detail: string;
  at: string;
  actor: string;
}

export interface IncidentAttachment {
  id: string;
  name: string;
  kind: "photo" | "audio";
  dataUrl: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  category: Category;
  status: IncidentStatus;
  worker: string;
  workerId: string;
  organization: string;
  facility: string;
  zone: string;
  location: string;
  createdAt: string;
  description: string;
  headcount: number | null;
  escalated: boolean;
  severity: "critical" | "high" | "medium";
  notifiedTeams?: string[];
  assignedTeam?: string;
  voiceNote?: string;
  attachments?: IncidentAttachment[];
  isDrill?: boolean;
  reviewStatus?: "pending" | "complete";
  timeline: TimelineEntry[];
}

export const statusOrder: Exclude<IncidentStatus, "cancelled">[] = [
  "triggered",
  "acknowledged",
  "dispatched",
  "on_scene",
  "resolved",
];

export const statusLabels: Record<IncidentStatus, string> = {
  triggered: "Triggered",
  acknowledged: "Acknowledged",
  dispatched: "Team dispatched",
  on_scene: "Team on scene",
  resolved: "Resolved",
  cancelled: "False alert closed",
};

export const categoryLabels: Record<Category, string> = {
  fire: "Fire / explosion",
  hazmat: "Hazardous material",
  security: "Security threat",
  medical: "Medical emergency",
};

export const seedIncidents: Incident[] = [
  {
    id: "ZG-2026-001247",
    category: "fire",
    status: "dispatched",
    worker: "Demo Worker 01",
    workerId: "W-1042",
    organization: "ZioGuard Demo Industries",
    facility: "Pilot Plant Alpha",
    zone: "Production Block B",
    location: "Demo grid B-14",
    createdAt: "2026-10-03T10:42:13+05:30",
    description: "Smoke visible near the powder-coating line. No open flame confirmed.",
    headcount: 4,
    escalated: true,
    severity: "critical",
    timeline: [
      {
        id: "t-1",
        status: "triggered",
        label: "Fire alert triggered",
        detail: "Alert created from worker mobile device.",
        at: "2026-10-03T10:42:13+05:30",
        actor: "Demo Worker 01",
      },
      {
        id: "t-2",
        status: "acknowledged",
        label: "Incident acknowledged",
        detail: "Site safety lead accepted coordination.",
        at: "2026-10-03T10:42:35+05:30",
        actor: "Demo Safety Lead",
      },
      {
        id: "t-3",
        status: "escalated",
        label: "External assistance requested",
        detail: "Shared with pilot control-room queue. No government dispatch was initiated.",
        at: "2026-10-03T10:42:48+05:30",
        actor: "Demo Safety Lead",
      },
      {
        id: "t-4",
        status: "dispatched",
        label: "EHS response team dispatched",
        detail: "Unit ERT-02 en route from east gate.",
        at: "2026-10-03T10:43:10+05:30",
        actor: "Control desk",
      },
    ],
  },
  {
    id: "ZG-2026-001246",
    category: "medical",
    status: "on_scene",
    worker: "Demo Worker 02",
    workerId: "W-0871",
    organization: "ZioGuard Demo Industries",
    facility: "Pilot Plant Alpha",
    zone: "Warehouse aisle 7",
    location: "Demo grid W-07",
    createdAt: "2026-10-03T09:18:41+05:30",
    description: "Worker slipped while moving a pallet. Conscious; possible ankle injury.",
    headcount: 1,
    escalated: false,
    severity: "high",
    timeline: [
      {
        id: "t-5",
        status: "triggered",
        label: "Medical alert triggered",
        detail: "Alert created from worker mobile device.",
        at: "2026-10-03T09:18:41+05:30",
        actor: "Demo Worker 02",
      },
      {
        id: "t-6",
        status: "acknowledged",
        label: "First aider assigned",
        detail: "Demo First Aider accepted the incident.",
        at: "2026-10-03T09:19:02+05:30",
        actor: "Shift desk",
      },
      {
        id: "t-7",
        status: "dispatched",
        label: "Medical team dispatched",
        detail: "On-site first-aid team sent to aisle 7.",
        at: "2026-10-03T09:19:20+05:30",
        actor: "Shift desk",
      },
      {
        id: "t-8",
        status: "on_scene",
        label: "First aider on scene",
        detail: "Assessment underway; ambulance not currently required.",
        at: "2026-10-03T09:22:14+05:30",
        actor: "Demo First Aider",
      },
    ],
  },
  {
    id: "ZG-2026-001241",
    category: "hazmat",
    status: "resolved",
    worker: "Demo Supervisor 01",
    workerId: "W-0914",
    organization: "ZioGuard Demo Industries",
    facility: "Pilot Plant Beta",
    zone: "Chemical store",
    location: "Demo grid C-03",
    createdAt: "2026-10-02T15:07:11+05:30",
    description: "Odour reported near sealed solvent drums. Area isolated as a precaution.",
    headcount: 0,
    escalated: false,
    severity: "medium",
    isDrill: true,
    reviewStatus: "complete",
    timeline: [
      {
        id: "t-9",
        status: "triggered",
        label: "Hazmat alert triggered",
        detail: "Area supervisor raised a precautionary alert.",
        at: "2026-10-02T15:07:11+05:30",
        actor: "Demo Supervisor 01",
      },
      {
        id: "t-10",
        status: "resolved",
        label: "Incident resolved",
        detail: "No leak found. Ventilation inspected and area released.",
        at: "2026-10-02T15:31:48+05:30",
        actor: "EHS lead",
      },
    ],
  },
  {
    id: "ZG-2026-001238",
    category: "security",
    status: "resolved",
    worker: "Demo Worker 03",
    workerId: "W-0712",
    organization: "ZioGuard Demo Logistics",
    facility: "Pilot Logistics Hub",
    zone: "North perimeter",
    location: "Demo grid N-01",
    createdAt: "2026-10-01T22:11:03+05:30",
    description: "Unidentified person observed beyond the secured boundary.",
    headcount: null,
    escalated: true,
    severity: "high",
    timeline: [
      {
        id: "t-11",
        status: "triggered",
        label: "Security alert triggered",
        detail: "Night-shift worker reported a perimeter concern.",
        at: "2026-10-01T22:11:03+05:30",
        actor: "Demo Worker 03",
      },
      {
        id: "t-12",
        status: "resolved",
        label: "Incident closed",
        detail: "Security patrol verified and escorted a contractor to reception.",
        at: "2026-10-01T22:29:15+05:30",
        actor: "Hub security",
      },
    ],
  },
];

export function createIncident(
  category: Category,
  description: string,
  zone: string,
  location: string,
  reporter: ReporterSnapshot = {
    displayName: "Demo Worker 01",
    employeeId: "W-1042",
    organization: "ZioGuard Demo Industries",
    facility: "Pilot Plant Alpha",
  },
  voiceNote?: string,
  isDrill = false,
): Incident {
  const now = new Date();
  const suffix = Math.floor(100000 + Math.random() * 900000);
  const id = `ZG-${now.getFullYear()}-${suffix}`;
  return {
    id,
    category,
    status: "triggered",
    worker: reporter.displayName,
    workerId: reporter.employeeId,
    organization: reporter.organization,
    facility: reporter.facility,
    zone,
    location,
    createdAt: now.toISOString(),
    description: description.trim() || "No additional details provided.",
    headcount: null,
    escalated: false,
    severity: category === "fire" || category === "hazmat" ? "critical" : "high",
    notifiedTeams: ["Site safety desk", "On-duty response team", "Shift supervisor"],
    voiceNote,
    isDrill,
    reviewStatus: "pending",
    timeline: [
      {
        id: crypto.randomUUID(),
        status: "triggered",
        label: `${categoryLabels[category]} alert triggered`,
        detail: "Pilot alert created from worker device. On-site response team notified in this demo.",
        at: now.toISOString(),
        actor: reporter.displayName,
      },
    ],
  };
}

export function addIncidentUpdate(
  incident: Incident,
  actor: string,
  detail: string,
  attachment?: IncidentAttachment,
): Incident {
  const now = new Date().toISOString();
  return {
    ...incident,
    attachments: attachment ? [...(incident.attachments ?? []), attachment] : incident.attachments,
    timeline: [
      ...incident.timeline,
      {
        id: crypto.randomUUID(),
        status: "note",
        label: attachment ? `${attachment.kind === "photo" ? "Photo" : "Voice"} update added` : "Worker update added",
        detail: detail.trim() || `${attachment?.name ?? "Attachment"} added to the incident.`,
        at: now,
        actor,
      },
    ],
  };
}

export function advanceIncident(incident: Incident, actor: string): Incident {
  if (incident.status === "cancelled") return incident;
  const currentIndex = statusOrder.indexOf(incident.status);
  if (currentIndex < 0 || currentIndex === statusOrder.length - 1) return incident;
  const nextStatus = statusOrder[currentIndex + 1];
  const details: Record<IncidentStatus, string> = {
    triggered: "Incident created.",
    acknowledged: "Coordination ownership accepted.",
    dispatched: "Site response resources have been sent.",
    on_scene: "Assigned response team has reached the incident zone.",
    resolved: "Incident closed after response lead review.",
    cancelled: "Incident closed as a false or accidental alert.",
  };
  return {
    ...incident,
    status: nextStatus,
    timeline: [
      ...incident.timeline,
      {
        id: crypto.randomUUID(),
        status: nextStatus,
        label: statusLabels[nextStatus],
        detail: details[nextStatus],
        at: new Date().toISOString(),
        actor,
      },
    ],
  };
}

export function cancelIncident(incident: Incident, actor: string): Incident {
  if (incident.status === "resolved" || incident.status === "cancelled") return incident;
  const now = new Date().toISOString();
  return {
    ...incident,
    status: "cancelled",
    timeline: [
      ...incident.timeline,
      {
        id: crypto.randomUUID(),
        status: "cancelled",
        label: "False alert reported",
        detail: "The reporting worker marked this incident as an accidental or false alert. The event remains in the audit record.",
        at: now,
        actor,
      },
    ],
  };
}

export function escalateIncident(incident: Incident, actor: string): Incident {
  if (incident.escalated) return incident;
  return {
    ...incident,
    escalated: true,
    timeline: [
      ...incident.timeline,
      {
        id: crypto.randomUUID(),
        status: "escalated",
        label: "External assistance requested",
        detail: "Added to the pilot control-room queue. This demo does not dispatch a public authority.",
        at: new Date().toISOString(),
        actor,
      },
    ],
  };
}

export function formatElapsed(from: string, to = new Date()): string {
  const delta = Math.floor((to.getTime() - new Date(from).getTime()) / 1000);
  if (delta < 0) return "demo";
  const seconds = delta;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function isActive(incident: Incident): boolean {
  return incident.status !== "resolved" && incident.status !== "cancelled";
}
