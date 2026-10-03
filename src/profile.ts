export type AccountStatus = "active" | "pending" | "suspended";
export type TrainingStatus = "current" | "expiring" | "required";

export interface WorkerProfile {
  displayName: string;
  employeeId: string;
  phone: string;
  organization: string;
  facility: string;
  department: string;
  shift: string;
  defaultZone: string;
  preferredLanguage: string;
  emergencyRole: string;
  trainingStatus: TrainingStatus;
  accountStatus: AccountStatus;
  lastLogin: string;
  pushEnabled: boolean;
  facilityEmergencyNumber: string;
  musterPoint: string;
  firstAidLocation: string;
  safetyOfficer: string;
  chemicalExposureInstruction: string;
}

export const facilityZones = [
  "Production Block B",
  "Warehouse aisle 7",
  "Chemical store",
  "North gate",
  "Utility block",
  "Other / unsure",
];

export const defaultWorkerProfile: WorkerProfile = {
  displayName: "Demo Worker 01",
  employeeId: "W-1042",
  phone: "+91 90000 01042",
  organization: "ZioGuard Demo Industries",
  facility: "Pilot Plant Alpha",
  department: "Production",
  shift: "A · 06:00–14:00",
  defaultZone: facilityZones[0],
  preferredLanguage: "English",
  emergencyRole: "Production operator",
  trainingStatus: "current",
  accountStatus: "active",
  lastLogin: new Date().toISOString(),
  pushEnabled: true,
  facilityEmergencyNumber: "+91 90000 00112",
  musterPoint: "East car park",
  firstAidLocation: "Admin block · ground floor clinic",
  safetyOfficer: "Demo Safety Lead · EHS desk",
  chemicalExposureInstruction: "Move upwind, avoid contact, remove contaminated clothing only when instructed, and report to the decontamination point.",
};

export const responseRecipients = [
  "Site safety desk",
  "On-duty response team",
  "Shift supervisor",
];

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ZG";
}
