import {
  Alarm,
  ArrowRight,
  Buildings,
  Camera,
  ChartLineUp,
  CheckCircle,
  ClipboardText,
  Clock,
  CloudCheck,
  Crosshair,
  DownloadSimple,
  Drop,
  Fire,
  FirstAid,
  HardHat,
  HouseLine,
  IdentificationCard,
  ListChecks,
  MapPin,
  Megaphone,
  Microphone,
  NavigationArrow,
  NotePencil,
  Phone,
  PlugsConnected,
  Radio,
  ShieldCheck,
  Siren,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Stop,
  UsersThree,
  Warning,
  WifiHigh,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  advanceIncident,
  addIncidentUpdate,
  cancelIncident,
  categoryLabels,
  createIncident,
  escalateIncident,
  formatElapsed,
  isActive,
  seedIncidents,
  statusLabels,
  statusOrder,
  type Category,
  type Incident,
  type IncidentAttachment,
  type IncidentStatus,
  type Role,
} from "./model";
import {
  defaultWorkerProfile,
  facilityZones,
  getInitials,
  responseRecipients,
  type WorkerProfile,
} from "./profile";
import { checkSupabaseReadiness, type SupabaseReadiness } from "./supabase-readiness";
import { useAuth, type AuthMembershipRole } from "./auth";
import { OperationsManagement } from "./operations";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Page =
  | "trigger"
  | "my_incidents"
  | "safety"
  | "profile"
  | "overview"
  | "incidents"
  | "teams"
  | "analytics"
  | "settings"
  | "demo"
  | "regional"
  | "queue"
  | "resources";

const roleMeta: Record<Role, { label: string; short: string; page: Page }> = {
  worker: { label: "Worker app", short: "Worker", page: "trigger" },
  company: { label: "Company command", short: "Company", page: "overview" },
  control: { label: "Control room", short: "Control", page: "regional" },
};

const navigation: Record<Role, { id: Page; label: string; icon: typeof HouseLine }[]> = {
  worker: [
    { id: "trigger", label: "Emergency", icon: Siren },
    { id: "my_incidents", label: "My incidents", icon: ClipboardText },
    { id: "safety", label: "Safety card", icon: IdentificationCard },
    { id: "profile", label: "Profile", icon: UsersThree },
  ],
  company: [
    { id: "overview", label: "Command", icon: HouseLine },
    { id: "incidents", label: "Incidents", icon: Alarm },
    { id: "teams", label: "People & units", icon: UsersThree },
    { id: "analytics", label: "Response review", icon: ChartLineUp },
    { id: "settings", label: "Pilot setup", icon: SlidersHorizontal },
    { id: "demo", label: "Demo controller", icon: Sparkle },
  ],
  control: [
    { id: "regional", label: "Regional view", icon: Crosshair },
    { id: "queue", label: "Escalation queue", icon: Radio },
    { id: "resources", label: "Resources", icon: Buildings },
  ],
};

const categoryStyles: Record<Category, { icon: typeof Fire; accent: string; soft: string; instructions: string }> = {
  fire: {
    icon: Fire,
    accent: "text-[#d74328]",
    soft: "bg-[#fee9e2] text-[#9f2d19]",
    instructions: "Move upwind, activate local alarm and use the nearest marked exit.",
  },
  hazmat: {
    icon: Drop,
    accent: "text-[#9d7200]",
    soft: "bg-[#fff0bd] text-[#735300]",
    instructions: "Do not touch the material. Isolate the area and move upwind.",
  },
  security: {
    icon: ShieldCheck,
    accent: "text-[#7d4fa0]",
    soft: "bg-[#eee1f7] text-[#633a7f]",
    instructions: "Move to a secure area. Do not confront the person or threat.",
  },
  medical: {
    icon: FirstAid,
    accent: "text-[#087e67]",
    soft: "bg-[#d9f4ec] text-[#086452]",
    instructions: "Keep the person still and safe. Do not move them unless there is immediate danger.",
  },
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function mapAuthRole(role: AuthMembershipRole): Role {
  if (role === "control_room" || role === "system_admin") return "control";
  if (role === "company_admin" || role === "responder") return "company";
  return "worker";
}

function usePersistentIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const saved = localStorage.getItem("zioguard-incidents-v1");
      return saved ? (JSON.parse(saved) as Incident[]) : seedIncidents;
    } catch {
      return seedIncidents;
    }
  });
  useEffect(() => {
    // Pilot media stays in memory only. Base64 photos and voice notes must not be
    // written to browser storage; production media belongs in private object storage.
    const safeIncidents = incidents.map((incident) => {
      const safeIncident = { ...incident };
      delete safeIncident.voiceNote;
      delete safeIncident.attachments;
      return safeIncident;
    });
    try {
      localStorage.setItem("zioguard-incidents-v1", JSON.stringify(safeIncidents));
    } catch {
      // The live incident remains available in memory if browser storage is full.
    }
  }, [incidents]);
  return [incidents, setIncidents] as const;
}

function usePersistentProfile() {
  const [profile, setProfile] = useState<WorkerProfile>(() => {
    try {
      const saved = localStorage.getItem("zioguard-worker-profile-v1");
      return saved ? { ...defaultWorkerProfile, ...(JSON.parse(saved) as Partial<WorkerProfile>) } : defaultWorkerProfile;
    } catch {
      return defaultWorkerProfile;
    }
  });
  useEffect(() => localStorage.setItem("zioguard-worker-profile-v1", JSON.stringify(profile)), [profile]);
  return [profile, setProfile] as const;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}

export default function App() {
  const auth = useAuth();
  const [role, setRole] = useState<Role>("worker");
  const [page, setPage] = useState<Page>("trigger");
  const [incidents, setIncidents] = usePersistentIncidents();
  const [profile, setProfile] = usePersistentProfile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeWorkerIncidentId, setActiveWorkerIncidentId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [drillMode, setDrillMode] = useState(false);
  const online = useOnlineStatus();
  const authenticatedRole = auth.identity ? mapAuthRole(auth.identity.role) : null;
  const activeRole = auth.required && authenticatedRole ? authenticatedRole : role;
  const activePage = navigation[activeRole].some((item) => item.id === page) ? page : roleMeta[activeRole].page;
  const effectiveProfile: WorkerProfile = auth.identity ? {
    ...profile,
    displayName: auth.identity.displayName,
    employeeId: auth.identity.employeeId,
    phone: auth.identity.phone,
    organization: auth.identity.organization,
    facility: auth.identity.facility,
    department: auth.identity.department,
    shift: auth.identity.shift,
    emergencyRole: auth.identity.emergencyRole,
    preferredLanguage: auth.identity.preferredLanguage,
  } : profile;

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleRoleChange = (nextRole: Role) => {
    setRole(nextRole);
    setPage(roleMeta[nextRole].page);
  };

  const demoTimers = useRef<number[]>([]);

  useEffect(() => () => demoTimers.current.forEach(window.clearTimeout), []);

  const handleCreateIncident = (category: Category, detail: string, zone: string, location: string, voiceNote?: string) => {
    const created = createIncident(category, detail, zone, location, {
      displayName: effectiveProfile.displayName,
      employeeId: effectiveProfile.employeeId,
      organization: effectiveProfile.organization,
      facility: effectiveProfile.facility,
    }, voiceNote, drillMode);
    setIncidents((current) => [created, ...current]);
    setActiveWorkerIncidentId(created.id);
    setToast(`${created.id} created — pilot response team notified`);
    demoTimers.current.push(window.setTimeout(() => {
      setIncidents((current) => current.map((incident) => {
        if (incident.id !== created.id || incident.status !== "triggered") return incident;
        return { ...advanceIncident(incident, "Demo Safety Lead"), assignedTeam: "Emergency response team · ERT-02" };
      }));
      setToast("Site safety desk acknowledged the alert");
    }, 4200));
    demoTimers.current.push(window.setTimeout(() => {
      setIncidents((current) => current.map((incident) => incident.id === created.id && incident.status === "acknowledged" ? advanceIncident(incident, "Demo Safety Lead") : incident));
      setToast("ERT-02 dispatched to your zone");
    }, 9000));
    return created;
  };

  const handleCancelIncident = (id: string) => {
    setIncidents((current) => current.map((incident) => incident.id === id ? cancelIncident(incident, effectiveProfile.displayName) : incident));
    setToast("False alert reported — response team updated");
  };

  const handleIncidentUpdate = (id: string, detail: string, attachment?: IncidentAttachment) => {
    setIncidents((current) => current.map((incident) => incident.id === id ? addIncidentUpdate(incident, effectiveProfile.displayName, detail, attachment) : incident));
    setToast("Incident update added to the timeline");
  };

  const handleAdvance = (id: string) => {
    setIncidents((current) => current.map((incident) => (incident.id === id ? advanceIncident(incident, activeRole === "control" ? "Pilot Regional Desk" : "Demo Safety Lead") : incident)));
    setToast("Incident timeline updated");
  };

  const handleEscalate = (id: string) => {
    setIncidents((current) => current.map((incident) => (incident.id === id ? escalateIncident(incident, "Demo Safety Lead") : incident)));
    setToast("Added to pilot control-room queue");
  };

  const handleInstall = async () => {
    if (!installPrompt) {
      setToast("Use your browser menu and choose ‘Install app’ or ‘Add to Home screen’");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const selectedIncident = incidents.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="min-h-dvh bg-[#eeece4] text-[#171915] selection:bg-[#e9ff4a] selection:text-[#171915]">
      <a href="#main-content" className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:block focus:bg-white focus:px-4 focus:py-3 focus:text-black">
        Skip to main content
      </a>
      <div className="border-b border-[#34372f] bg-[#171915] px-4 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-[#d8d7d0] sm:text-xs">
        Pilot simulation · not connected to public emergency dispatch · For immediate danger call 112
      </div>
      <div className="flex min-h-[calc(100dvh-33px)]">
        <Sidebar role={activeRole} page={activePage} online={online} roleLocked={auth.required} accountName={auth.identity?.displayName} onNavigate={setPage} onRoleChange={handleRoleChange} onInstall={handleInstall} onSignOut={auth.signOut} />
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <MobileHeader role={activeRole} online={online} roleLocked={auth.required} accountName={auth.identity?.displayName} onRoleChange={handleRoleChange} onSignOut={auth.signOut} />
          <main id="main-content" className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8 xl:p-10">
            {activeRole === "worker" && activePage === "trigger" && <TriggerPage onCreate={handleCreateIncident} onCancelIncident={handleCancelIncident} onIncidentUpdate={handleIncidentUpdate} activeIncident={incidents.find((item) => item.id === activeWorkerIncidentId) ?? null} onClearActive={() => setActiveWorkerIncidentId(null)} online={online} profile={effectiveProfile} drillMode={drillMode} />}
            {activeRole === "worker" && activePage === "my_incidents" && <MyIncidents incidents={incidents} workerId={effectiveProfile.employeeId} onSelect={setSelectedId} />}
            {activeRole === "worker" && activePage === "safety" && <SafetyCard profile={effectiveProfile} />}
            {activeRole === "worker" && activePage === "profile" && <WorkerProfilePage profile={effectiveProfile} authenticated={Boolean(auth.user)} onSave={setProfile} onSignOut={auth.signOut} />}
            {activeRole === "company" && activePage === "overview" && <CompanyOverview incidents={incidents} onSelect={setSelectedId} />}
            {activeRole === "company" && activePage === "incidents" && <IncidentRegister incidents={incidents} onSelect={setSelectedId} />}
            {activeRole === "company" && activePage === "teams" && <TeamsPage onToast={setToast} />}
            {activeRole === "company" && activePage === "analytics" && <AnalyticsPage incidents={incidents} />}
            {activeRole === "company" && activePage === "settings" && <PilotSettings onReset={() => { setIncidents(seedIncidents); setToast("Pilot data restored"); }} />}
            {activeRole === "company" && activePage === "demo" && <DemoController incidents={incidents} drillMode={drillMode} onDrillModeChange={setDrillMode} onStart={(category) => { const created = handleCreateIncident(category, "Investor demonstration scenario", effectiveProfile.defaultZone, `${effectiveProfile.facility} registered location`); setSelectedId(created.id); }} onReset={() => { setIncidents(seedIncidents); setSelectedId(null); setActiveWorkerIncidentId(null); setToast("Investor demo reset to its opening state"); }} onOpenIncident={setSelectedId} />}
            {activeRole === "control" && activePage === "regional" && <RegionalView incidents={incidents} onSelect={setSelectedId} />}
            {activeRole === "control" && activePage === "queue" && <EscalationQueue incidents={incidents} onSelect={setSelectedId} />}
            {activeRole === "control" && activePage === "resources" && <ResourcesPage />}
          </main>
        </div>
      </div>
      <MobileNavigation role={activeRole} page={activePage} onNavigate={setPage} />
      {selectedIncident && (
        <IncidentDetail
          incident={selectedIncident}
          role={activeRole}
          onClose={() => setSelectedId(null)}
          onAdvance={() => handleAdvance(selectedIncident.id)}
          onEscalate={() => handleEscalate(selectedIncident.id)}
          onNote={(detail) => handleIncidentUpdate(selectedIncident.id, detail)}
        />
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-24 z-[70] flex justify-center lg:bottom-6">
        {toast && (
          <div className="flex items-center gap-3 border border-[#45493f] bg-[#171915] px-4 py-3 text-sm font-semibold text-white shadow-[6px_6px_0_#e9ff4a]">
            <CheckCircle className="text-[#e9ff4a]" weight="fill" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid place-items-center bg-[#e9ff4a] font-display font-black text-[#171915]", compact ? "h-9 w-9 text-lg" : "h-11 w-11 text-xl")}>Z</div>
      <div>
        <div className="font-display text-xl font-extrabold leading-none tracking-[-0.04em] text-white">ZioGuard</div>
        {!compact && <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.19em] text-[#a6aa9e]">Response starts here</div>}
      </div>
    </div>
  );
}

function Sidebar({ role, page, online, roleLocked, accountName, onNavigate, onRoleChange, onInstall, onSignOut }: { role: Role; page: Page; online: boolean; roleLocked: boolean; accountName?: string; onNavigate: (page: Page) => void; onRoleChange: (role: Role) => void; onInstall: () => void; onSignOut: () => Promise<void> }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-[#34372f] bg-[#171915] p-5 lg:flex">
      <Brand />
      {!roleLocked && <div className="mt-9 rounded-none border border-[#3c4037] bg-[#20231e] p-1">
        {(Object.keys(roleMeta) as Role[]).map((item) => (
          <button key={item} onClick={() => onRoleChange(item)} className={cn("min-h-11 w-full px-3 text-left text-xs font-bold transition-colors", role === item ? "bg-[#e9ff4a] text-[#171915]" : "text-[#bfc2b7] hover:bg-[#2a2e27] hover:text-white")}>
            {roleMeta[item].label}
          </button>
        ))}
      </div>}
      {roleLocked && <div className="mt-9 border border-[#3c4037] bg-[#20231e] px-3 py-3 text-xs font-bold text-[#e9ff4a]">{roleMeta[role].label} · verified role</div>}
      <nav aria-label={`${roleMeta[role].label} navigation`} className="mt-7 flex flex-1 flex-col gap-1">
        <div className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-[#7f8478]">Workspace</div>
        {navigation[role].map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={cn("flex min-h-12 items-center gap-3 border-l-2 px-3 text-left text-sm font-semibold transition-all", page === item.id ? "border-[#e9ff4a] bg-[#252922] text-white" : "border-transparent text-[#aeb2a6] hover:bg-[#20231e] hover:text-white")}>
              <Icon size={20} weight={page === item.id ? "fill" : "regular"} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <button onClick={onInstall} className="mb-4 flex min-h-12 items-center gap-3 border border-[#44483f] px-3 text-left text-xs font-bold text-[#d4d6cf] transition hover:border-[#e9ff4a] hover:text-[#e9ff4a]">
        <DownloadSimple size={20} /> Install pilot app
      </button>
      {roleLocked && <div className="mb-4 border border-[#3c4037] bg-[#20231e] p-3"><div className="truncate text-xs font-bold text-white" title={accountName}>{accountName ?? "Authorized account"}</div><button onClick={onSignOut} className="mt-3 flex min-h-11 w-full items-center gap-2 border border-[#555a4e] px-3 text-xs font-bold text-[#d4d6cf] hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><SignOut size={18} /> Sign out</button></div>}
      <div className="flex items-center justify-between border-t border-[#353930] pt-4 text-xs text-[#a6aa9e]">
        <span className="flex items-center gap-2">{online ? <WifiHigh className="text-[#b9d800]" /> : <WifiSlash className="text-[#ff8a6d]" />} {online ? "Online" : "Offline mode"}</span>
        <span className="font-mono text-[9px] uppercase">v0.1</span>
      </div>
    </aside>
  );
}

function MobileHeader({ role, online, roleLocked, accountName, onRoleChange, onSignOut }: { role: Role; online: boolean; roleLocked: boolean; accountName?: string; onRoleChange: (role: Role) => void; onSignOut: () => Promise<void> }) {
  return (
    <header className="flex items-center justify-between border-b border-[#34372f] bg-[#171915] px-4 py-3 lg:hidden">
      <Brand compact />
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", online ? "bg-[#b9d800]" : "bg-[#ff6a4a]")} aria-label={online ? "Online" : "Offline"} />
        {!roleLocked ? <select aria-label="Switch pilot role" value={role} onChange={(event) => onRoleChange(event.target.value as Role)} className="min-h-11 border border-[#45493f] bg-[#20231e] px-3 text-sm font-bold text-white outline-none focus:border-[#e9ff4a]">
          {(Object.keys(roleMeta) as Role[]).map((item) => <option key={item} value={item}>{roleMeta[item].short}</option>)}
        </select> : <><span className="border border-[#45493f] bg-[#20231e] px-3 py-2 text-xs font-bold text-[#e9ff4a]" title={accountName}>{roleMeta[role].short}</span><button onClick={onSignOut} aria-label={`Sign out ${accountName ?? "account"}`} className="grid min-h-11 min-w-11 place-items-center border border-[#45493f] text-[#d4d6cf] hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><SignOut size={20} /></button></>}
      </div>
    </header>
  );
}

function MobileNavigation({ role, page, onNavigate }: { role: Role; page: Page; onNavigate: (page: Page) => void }) {
  const items = navigation[role].slice(0, 4);
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 grid border-t border-[#34372f] bg-[#171915] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} onClick={() => onNavigate(item.id)} className={cn("flex min-h-[70px] flex-col items-center justify-center gap-1 text-[10px] font-bold", page === item.id ? "text-[#e9ff4a]" : "text-[#a8aca0]")}>
            <Icon size={23} weight={page === item.id ? "fill" : "regular"} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,4.75rem)] font-black leading-[0.94] tracking-[-0.055em] text-[#171915]">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5d6158] sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  );
}

type CapturedLocation = {
  label: string;
  source: "device" | "facility" | "unavailable";
  accuracy?: number;
};

function TriggerPage({ onCreate, onCancelIncident, onIncidentUpdate, activeIncident, onClearActive, online, profile, drillMode }: {
  onCreate: (category: Category, detail: string, zone: string, location: string, voiceNote?: string) => Incident;
  onCancelIncident: (id: string) => void;
  onIncidentUpdate: (id: string, detail: string, attachment?: IncidentAttachment) => void;
  activeIncident: Incident | null;
  onClearActive: () => void;
  online: boolean;
  profile: WorkerProfile;
  drillMode: boolean;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [zone, setZone] = useState(profile.defaultZone);
  const [detail, setDetail] = useState("");
  const [location, setLocation] = useState<CapturedLocation>({ label: `${profile.facility} registered location`, source: "facility" });
  const [locating, setLocating] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const handleLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ label: `${profile.facility} registered location`, source: "unavailable" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = Math.round(position.coords.accuracy);
        setLocation({
          label: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
          source: "device",
          accuracy,
        });
        setLocating(false);
      },
      () => {
        setLocation({ label: `${profile.facility} registered location`, source: "unavailable" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  const handleSelectCategory = (nextCategory: Category) => {
    setCategory(nextCategory);
    setConfirmationOpen(true);
    handleLocation();
    navigator.vibrate?.(45);
  };

  const handleConfirmAlert = (voiceNote?: string) => {
    if (!category) return;
    const locationLabel = location.source === "device"
      ? `${location.label}${location.accuracy ? ` · ±${location.accuracy}m` : ""}`
      : `${location.label} · device location not used`;
    onCreate(category, detail, zone, locationLabel, voiceNote);
    setConfirmationOpen(false);
    setDetail("");
    navigator.vibrate?.([120, 80, 180]);
  };

  if (activeIncident) {
    return <WorkerIncidentTracker incident={activeIncident} facilityEmergencyNumber={profile.facilityEmergencyNumber} onUpdate={(detail, attachment) => onIncidentUpdate(activeIncident.id, detail, attachment)} onCancel={() => onCancelIncident(activeIncident.id)} onReportAnother={onClearActive} />;
  }

  return (
    <div>
      <PageHeading
        eyebrow={`${profile.facility} · ${profile.shift}`}
        title="What is happening?"
        description="Tap the emergency type. Confirm the location in the next step—nothing is sent from this screen."
        action={<a href="tel:112" className="button-secondary shrink-0"><Phone weight="fill" /> Call 112</a>}
      />
      {drillMode && <div className="mb-5 flex items-center justify-between gap-4 border-2 border-[#171915] bg-[#e9ff4a] p-4"><div><div className="font-mono text-[10px] font-black uppercase tracking-[0.2em]">Drill mode active</div><strong className="mt-1 block">Alerts created now are training records—not live emergencies.</strong></div><ShieldCheck size={27} weight="fill" /></div>}
      {!online && (
        <div className="mb-5 flex items-start gap-3 border-2 border-[#9f6f00] bg-[#fff0bd] p-4 text-sm text-[#594000]">
          <WifiSlash className="mt-0.5 shrink-0" size={20} weight="bold" />
          <div><strong>You are offline.</strong> ZioGuard cannot deliver an alert from this pilot. Use the local alarm, radio, facility number, or call 112.</div>
        </div>
      )}
      <section aria-labelledby="emergency-types" className="border-2 border-[#171915] bg-[#f7f5ee] p-4 shadow-[7px_7px_0_#c9c8c0] sm:p-7">
        <div className="flex flex-col justify-between gap-3 border-b border-[#c9c8c0] pb-5 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">Emergency console</div>
            <h2 id="emergency-types" className="mt-2 font-display text-2xl font-black tracking-[-0.04em] sm:text-3xl">Choose one option</h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#5f645a]"><MapPin size={18} weight="fill" /> Default zone: {profile.defaultZone}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5">
          {(Object.keys(categoryLabels) as Category[]).map((item) => {
            const meta = categoryStyles[item];
            const Icon = meta.icon;
            const descriptions: Record<Category, string> = {
              fire: "Smoke, flame or explosion",
              hazmat: "Chemical, gas or toxic leak",
              security: "Threat, violence or intrusion",
              medical: "Injury, illness or collapse",
            };
            return (
              <button
                key={item}
                onClick={() => handleSelectCategory(item)}
                disabled={!online}
                className="group min-h-[168px] border-2 border-[#171915] bg-[#fffefa] p-4 text-left shadow-[4px_4px_0_#171915] transition hover:-translate-y-1 hover:bg-[#e9ff4a] hover:shadow-[7px_7px_0_#171915] active:translate-y-0 active:shadow-[2px_2px_0_#171915] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[210px] sm:p-6"
              >
                <div className={cn("grid h-12 w-12 place-items-center sm:h-14 sm:w-14", meta.soft)}><Icon size={29} weight="fill" /></div>
                <div className="mt-6 font-display text-lg font-black leading-tight tracking-[-0.03em] sm:text-2xl">{categoryLabels[item]}</div>
                <div className="mt-2 text-xs leading-5 text-[#62675d] sm:text-sm">{descriptions[item]}</div>
                <div className="mt-5 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#555a51]">Tap to review <ArrowRight size={15} /></div>
              </button>
            );
          })}
        </div>
      </section>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="panel flex items-start gap-4 p-5"><ShieldCheck size={24} weight="fill" className="mt-0.5 shrink-0 text-[#567400]" /><div><h3 className="font-display font-extrabold">Safety comes first</h3><p className="mt-1 text-sm leading-6 text-[#62675d]">Move away from danger before adding details. Use the nearest manual alarm and follow the site evacuation plan.</p></div></div>
        <div className="panel flex items-start gap-4 p-5"><IdentificationCard size={24} weight="fill" className="mt-0.5 shrink-0" /><div><h3 className="font-display font-extrabold">Reporting as {profile.displayName}</h3><p className="mt-1 text-sm leading-6 text-[#62675d]">{profile.employeeId} · {profile.department} · {profile.organization}</p></div></div>
      </div>
      {confirmationOpen && category && (
        <ConfirmAlertDialog
          category={category}
          drillMode={drillMode}
          profile={profile}
          zone={zone}
          location={location}
          locating={locating}
          detail={detail}
          onZoneChange={setZone}
          onDetailChange={setDetail}
          onLocate={handleLocation}
          onUseFacilityLocation={() => setLocation({ label: `${profile.facility} registered location`, source: "facility" })}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={handleConfirmAlert}
        />
      )}
    </div>
  );
}

function ConfirmAlertDialog({ category, drillMode, profile, zone, location, locating, detail, onZoneChange, onDetailChange, onLocate, onUseFacilityLocation, onCancel, onConfirm }: {
  category: Category;
  drillMode: boolean;
  profile: WorkerProfile;
  zone: string;
  location: CapturedLocation;
  locating: boolean;
  detail: string;
  onZoneChange: (zone: string) => void;
  onDetailChange: (detail: string) => void;
  onLocate: () => void;
  onUseFacilityLocation: () => void;
  onCancel: () => void;
  onConfirm: (voiceNote?: string) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [voiceNote, setVoiceNote] = useState<string | undefined>();
  const [audioError, setAudioError] = useState<string | null>(null);
  const meta = categoryStyles[category];
  const Icon = meta.icon;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && recorderRef.current?.state !== "recording") onCancelRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordedSeconds((seconds) => {
      if (seconds >= 19) {
        recorderRef.current?.stop();
        return 20;
      }
      return seconds + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const handleStartRecording = async () => {
    setAudioError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError("Voice recording is not supported on this device. You can continue without it.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => setVoiceNote(typeof reader.result === "string" ? reader.result : undefined);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start();
      setRecordedSeconds(0);
      setRecording(true);
    } catch {
      setAudioError("Microphone permission was not available. You can continue without a voice note.");
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-alert-title" onMouseDown={(event) => { if (event.currentTarget === event.target && !recording) onCancel(); }}>
      <section className="max-h-[96dvh] w-full max-w-[700px] overflow-y-auto border-2 border-[#171915] bg-[#f7f5ee] shadow-[10px_10px_0_#171915]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#34372f] bg-[#171915] p-4 text-white sm:p-5">
          <div className="flex items-center gap-3"><div className={cn("grid h-11 w-11 place-items-center", meta.soft)}><Icon size={24} weight="fill" /></div><div><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#adb1a5]">{drillMode ? "Drill confirmation" : "Review before sending"}</div><strong>Confirm {categoryLabels[category]}</strong></div></div>
          <button onClick={onCancel} disabled={recording} aria-label="Cancel and close confirmation" className="grid h-11 w-11 place-items-center border border-[#4a4e45] hover:border-[#e9ff4a] hover:text-[#e9ff4a] disabled:opacity-40"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-7">
          {drillMode && <div className="mb-5 border-2 border-[#171915] bg-[#e9ff4a] p-3 text-center font-mono text-xs font-black uppercase tracking-[0.2em]">Training drill · no live response</div>}
          <div className="flex items-start gap-4 border-l-4 border-[#d74328] bg-[#fee9e2] p-4 text-[#662113]">
            <Warning size={24} weight="fill" className="mt-0.5 shrink-0" />
            <div><h2 id="confirm-alert-title" className="font-display text-xl font-black">Is this a real {categoryLabels[category].toLowerCase()}?</h2><p className="mt-1 text-sm leading-5">Confirm only when the site response team is genuinely needed. The worker identity and selected location will be attached.</p></div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border border-[#cccbc4] bg-white p-4"><div className="eyebrow">Reporting worker</div><div className="mt-3 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center bg-[#171915] font-display font-black text-[#e9ff4a]">{getInitials(profile.displayName)}</div><div><strong>{profile.displayName}</strong><div className="text-xs text-[#6b7066]">{profile.employeeId} · {profile.department}</div></div></div></div>
            <div className="border border-[#cccbc4] bg-white p-4"><div className="eyebrow">Company and facility</div><strong className="mt-3 block">{profile.organization}</strong><div className="text-xs text-[#6b7066]">{profile.facility} · {profile.shift}</div></div>
          </div>

          <label className="field-label mt-5">Where is the emergency?
            <select value={zone} onChange={(event) => onZoneChange(event.target.value)} className="field-input">
              {facilityZones.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <div className="mt-5 border border-[#cccbc4] bg-white p-4">
            <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Location layer</div><strong className="mt-2 flex items-center gap-2"><NavigationArrow size={18} weight="fill" /> {locating ? "Finding device location…" : location.label}</strong><div className="mt-1 text-xs text-[#6b7066]">{location.source === "device" ? `Device location available${location.accuracy ? ` · accuracy ±${location.accuracy}m` : ""}` : location.source === "facility" ? "Using registered facility location" : "GPS unavailable · facility location retained"}</div></div><span className={cn("shrink-0 px-2 py-1 font-mono text-[9px] font-bold uppercase", location.source === "device" ? "bg-[#d9f4ec] text-[#086452]" : "bg-[#fff0bd] text-[#735300]")}>{location.source}</span></div>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={onLocate} disabled={locating} className="button-secondary min-h-11 px-4"><MapPin size={18} /> {locating ? "Locating…" : "Refresh GPS"}</button><button onClick={onUseFacilityLocation} className="min-h-11 border border-[#989c91] px-4 text-xs font-bold hover:border-[#171915]">Use facility location</button></div>
          </div>

          <label className="field-label mt-5">Add a short detail <span className="font-normal text-[#85897e]">(optional)</span>
            <textarea value={detail} onChange={(event) => onDetailChange(event.target.value)} maxLength={240} rows={2} placeholder="Example: smoke near line 2; two people nearby" className="field-input resize-none" />
            <span className="mt-1 block text-right font-mono text-[10px] text-[#8a8e83]">{detail.length}/240</span>
          </label>

          <div className="mt-5 border border-[#cccbc4] bg-[#eceee6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="font-display">Optional voice note</strong><p className="mt-1 text-xs text-[#6b7066]">Record up to 20 seconds. Move to safety before recording.</p></div>{recording ? <button onClick={handleStopRecording} className="button-secondary min-h-11"><Stop size={18} weight="fill" /> Stop · {recordedSeconds}s</button> : <button onClick={handleStartRecording} className="button-secondary min-h-11"><Microphone size={18} weight="fill" /> {voiceNote ? "Record again" : "Record note"}</button>}</div>
            {voiceNote && !recording && <audio className="mt-4 w-full" controls src={voiceNote}>Voice note preview</audio>}
            {audioError && <p className="mt-3 text-xs font-semibold text-[#9f2d19]">{audioError}</p>}
          </div>

          <div className="mt-5 border border-[#cccbc4] bg-white p-4"><div className="eyebrow">Who will be notified</div><ul className="mt-3 grid gap-2 sm:grid-cols-3">{responseRecipients.map((recipient) => <li key={recipient} className="flex items-center gap-2 text-xs font-semibold"><CheckCircle size={17} weight="fill" className="text-[#6e9300]" />{recipient}</li>)}</ul></div>

          <div className="mt-5 flex items-start gap-3 bg-[#171915] p-4 text-sm leading-5 text-white"><ShieldCheck size={21} weight="fill" className="mt-0.5 shrink-0 text-[#e9ff4a]" /><span>A trackable incident will be created for the site team. This pilot does not automatically contact police, fire, ambulance, or 112.</span></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={onCancel} disabled={recording} className="button-secondary">Go back</button>
            <button ref={confirmRef} onClick={() => onConfirm(voiceNote)} disabled={recording || locating} className="button-primary disabled:cursor-wait disabled:opacity-50"><Siren size={20} weight="fill" /> Confirm and alert team</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkerIncidentTracker({ incident, facilityEmergencyNumber, onUpdate, onCancel, onReportAnother }: { incident: Incident; facilityEmergencyNumber: string; onUpdate: (detail: string, attachment?: IncidentAttachment) => void; onCancel: () => void; onReportAnother: () => void }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [attachment, setAttachment] = useState<IncidentAttachment | undefined>();
  const [clock, setClock] = useState(() => new Date());
  const meta = categoryStyles[incident.category];
  const Icon = meta.icon;
  const acknowledgement = incident.timeline.find((entry) => entry.status === "acknowledged");
  const steps = statusOrder;
  const currentIndex = incident.status === "cancelled" ? -1 : steps.indexOf(incident.status);
  const closed = incident.status === "resolved" || incident.status === "cancelled";

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleAttachment = (event: ChangeEvent<HTMLInputElement>, kind: "photo" | "audio") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") return;
      setAttachment({ id: crypto.randomUUID(), name: file.name, kind, dataUrl: reader.result, createdAt: new Date().toISOString() });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitUpdate = () => {
    if (!updateText.trim() && !attachment) return;
    onUpdate(updateText, attachment);
    setUpdateText("");
    setAttachment(undefined);
    setUpdateOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col justify-between gap-4 border-2 border-[#171915] bg-[#171915] p-5 text-white shadow-[8px_8px_0_#bfc0b8] sm:flex-row sm:items-center sm:p-7">
        <div className="flex items-center gap-4"><div className={cn("grid h-14 w-14 place-items-center", meta.soft)}><Icon size={30} weight="fill" /></div><div><div className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#adb1a5]">Live worker response</div><h1 className="mt-1 font-display text-2xl font-black sm:text-3xl">{categoryLabels[incident.category]}</h1></div></div>
        <div className="flex items-center gap-2">{incident.isDrill && <span className="bg-[#e9ff4a] px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#171915]">Drill</span>}<StatusBadge status={incident.status} /></div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="panel p-5 sm:p-7">
          <div className="flex items-start gap-4 border-l-4 border-[#7d9e00] bg-[#e8edda] p-4 text-[#354400]"><CheckCircle size={25} weight="fill" className="mt-0.5 shrink-0" /><div><div className="font-display text-lg font-black">Alert delivered</div><p className="mt-1 text-sm leading-5">Incident <strong>{incident.id}</strong> is visible to the site command team.</p></div></div>

          <div className="mt-7">
            <div className="eyebrow">Current response</div>
            <div className="mt-3 flex items-start gap-4">
              {!closed && incident.status === "triggered" ? <span className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-[#c38b00]" /> : <CheckCircle className="mt-0.5 shrink-0 text-[#6e9300]" size={22} weight="fill" />}
              <div>
                <h2 className="font-display text-2xl font-black tracking-[-0.04em]">{incident.status === "triggered" ? "Waiting for acknowledgement" : incident.status === "cancelled" ? "False alert closed" : statusLabels[incident.status]}</h2>
                <p className="mt-2 text-sm leading-6 text-[#62675d]">{acknowledgement ? `${acknowledgement.actor} acknowledged this alert. ${incident.assignedTeam ?? "A response team is being coordinated."}` : "The site safety desk and on-duty response team have been notified. Keep yourself safe while they respond."}</p>
                {!acknowledgement && !closed && <div className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#8a6200]">Waiting {formatElapsed(incident.createdAt, clock)}</div>}
              </div>
            </div>
          </div>

          <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Incident progress">
            {steps.map((step, index) => <li key={step} className="min-w-0"><div className={cn("h-2", index <= currentIndex ? "bg-[#7d9e00]" : "bg-[#d7d7d0]")} /><div className="mt-2 hidden truncate font-mono text-[8px] font-bold uppercase text-[#6f746a] sm:block">{statusLabels[step]}</div></li>)}
          </ol>

          <div className="mt-8 border-l-4 border-[#e9ff4a] bg-[#20231e] p-5 text-white"><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#adb1a5]">Do this now</div><p className="mt-2 font-semibold leading-6">{meta.instructions}</p></div>

          <dl className="mt-7 grid gap-5 border-t border-[#d1d0c8] pt-6 sm:grid-cols-2"><Detail label="Facility and zone" value={`${incident.facility} · ${incident.zone}`} /><Detail label="Available location" value={incident.location} /><Detail label="Reported by" value={`${incident.worker} · ${incident.workerId}`} /><Detail label="Response team" value={incident.assignedTeam ?? "Awaiting assignment"} /></dl>
          {incident.voiceNote && <div className="mt-6"><div className="eyebrow">Voice note</div><audio className="mt-3 w-full" controls src={incident.voiceNote}>Voice note</audio></div>}
          {(incident.attachments?.length ?? 0) > 0 && <div className="mt-6"><div className="eyebrow">Worker attachments</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{incident.attachments?.map((item) => <div key={item.id} className="border border-[#c9c8c0] bg-white p-3">{item.kind === "photo" ? <img src={item.dataUrl} alt={item.name} className="h-32 w-full object-cover" /> : <audio controls src={item.dataUrl} className="w-full">Audio update</audio>}<div className="mt-2 truncate text-xs font-bold">{item.name}</div></div>)}</div></div>}
          <div className="mt-8 border-t border-[#d1d0c8] pt-6"><div className="eyebrow">Incident timeline</div><ol className="mt-4 space-y-4">{incident.timeline.slice().reverse().map((entry) => <li key={entry.id} className="grid grid-cols-[12px_1fr] gap-3"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#7d9e00]" /><div><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{entry.label}</strong><time className="font-mono text-[9px] text-[#7b8076]">{new Date(entry.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p className="mt-1 text-xs leading-5 text-[#666b61]">{entry.detail}</p></div></li>)}</ol></div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="border-2 border-[#171915] bg-[#e9ff4a] p-5"><div className="eyebrow text-[#414b00]">Investor demo behavior</div><h2 className="mt-2 font-display text-xl font-black">Response simulation is active</h2><p className="mt-2 text-sm leading-6 text-[#424a16]">Acknowledgement and dispatch advance automatically to demonstrate realtime coordination. Production updates will come only from authenticated responders.</p></section>
          {!closed && <button onClick={() => setUpdateOpen((open) => !open)} className="button-primary"><NotePencil size={20} /> Add information</button>}
          {updateOpen && <section className="panel p-4"><label className="field-label">What changed?<textarea value={updateText} onChange={(event) => setUpdateText(event.target.value)} className="field-input resize-none" rows={3} maxLength={500} placeholder="Add a short update when you are safe" /></label><div className="mt-3 grid grid-cols-2 gap-2"><label className="button-secondary min-h-11 cursor-pointer px-3"><Camera size={18} /> Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => handleAttachment(event, "photo")} className="hidden" /></label><label className="button-secondary min-h-11 cursor-pointer px-3"><Microphone size={18} /> Voice<input type="file" accept="audio/*" capture onChange={(event) => handleAttachment(event, "audio")} className="hidden" /></label></div>{attachment && <div className="mt-3 bg-[#eceee6] p-2 text-xs font-bold">Attached: {attachment.name}</div>}<button onClick={handleSubmitUpdate} disabled={!updateText.trim() && !attachment} className="button-primary mt-3 w-full disabled:opacity-50">Add to timeline</button></section>}
          <a href={`tel:${facilityEmergencyNumber.replace(/\s/g, "")}`} className="button-secondary"><Phone size={20} /> Call facility emergency</a>
          <a href="tel:112" className="button-danger"><Phone size={20} weight="fill" /> Call 112</a>
          {!closed && <button onClick={() => setCancelOpen(true)} className="button-secondary"><Warning size={20} /> Report false alert</button>}
          <button onClick={onReportAnother} className="min-h-11 text-sm font-bold underline decoration-2 underline-offset-4">Report another emergency</button>
          <p className="text-xs leading-5 text-[#6f7469]">This pilot does not contact a public authority. For immediate danger, use the local alarm and call 112.</p>
        </aside>
      </div>

      {cancelOpen && <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="false-alert-title"><section className="w-full max-w-md border-2 border-[#171915] bg-[#f7f5ee] p-6 shadow-[8px_8px_0_#171915]"><Warning size={28} weight="fill" className="text-[#d74328]" /><h2 id="false-alert-title" className="mt-4 font-display text-2xl font-black">Report a false alert?</h2><p className="mt-3 text-sm leading-6 text-[#62675d]">The incident will be closed and the response team will be updated. The audit record will remain visible.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => setCancelOpen(false)} className="button-secondary">Keep incident open</button><button onClick={() => { onCancel(); setCancelOpen(false); }} className="button-danger">Confirm false alert</button></div></section></div>}
    </div>
  );
}

function CompanyOverview({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const active = incidents.filter(isActive);
  const actionRequired = active.filter((item) => item.status === "triggered");
  const acknowledged = active.filter((item) => item.status !== "triggered").length;
  const escalated = active.filter((item) => item.escalated).length;
  return (
    <div>
      <PageHeading eyebrow="Pilot Plant Alpha · Command view" title="Response is live." description="One operational picture for safety leads, security, first aid and management. Every action becomes part of the incident record." action={<div className="flex items-center gap-2 border border-[#a8ad9f] bg-[#f9f8f3] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.13em]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#6e9300]" /> Live pilot data</div>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active incidents" value={String(active.length)} detail="Across 2 facilities" accent="red" />
        <Metric label="Acknowledged" value={`${acknowledged}/${active.length}`} detail="Target: under 60 seconds" accent="lime" />
        <Metric label="External requests" value={String(escalated)} detail="Pilot control-room queue" accent="amber" />
        <Metric label="Teams available" value="3/4" detail="11 responders on shift" accent="dark" />
      </div>
      <section className={cn("mt-5 border-2 p-5", actionRequired.length ? "border-[#d74328] bg-[#fee9e2]" : "border-[#7d9e00] bg-[#e8edda]")}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3">{actionRequired.length ? <Warning size={25} weight="fill" className="shrink-0 text-[#9f2d19]" /> : <CheckCircle size={25} weight="fill" className="shrink-0 text-[#567400]" />}<div><div className="eyebrow">Action required</div><h2 className="mt-1 font-display text-xl font-black">{actionRequired.length ? `${actionRequired.length} incident${actionRequired.length > 1 ? "s" : ""} waiting for acknowledgement` : "No unowned incidents"}</h2><p className="mt-1 text-sm text-[#5f645a]">{actionRequired.length ? "A coordinator must accept ownership and assign the correct response team." : "Every active incident has a response owner."}</p></div></div>{actionRequired[0] && <button onClick={() => onSelect(actionRequired[0].id)} className="button-danger shrink-0">Open oldest incident</button>}</div></section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d5d4cc] p-5 sm:p-6">
            <div><div className="eyebrow">Priority queue</div><h2 className="mt-1 font-display text-2xl font-black tracking-[-0.04em]">Active incidents</h2></div>
            <span className="flex items-center gap-2 text-xs font-bold text-[#5f645a]"><Clock /> Oldest first</span>
          </div>
          <div className="divide-y divide-[#d5d4cc]">
            {active.map((incident) => <IncidentRow key={incident.id} incident={incident} onSelect={onSelect} />)}
          </div>
        </section>
        <div className="flex flex-col gap-5">
          <FacilityMap incidents={active} />
          <section className="panel p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-extrabold">Shift readiness</h2><HardHat size={22} /></div>
            <div className="mt-5 space-y-4">
              <ReadinessRow label="Emergency response" value="4 ready" tone="ready" />
              <ReadinessRow label="First aid" value="2 deployed" tone="busy" />
              <ReadinessRow label="Security" value="5 ready" tone="ready" />
              <ReadinessRow label="Fire tender" value="Maintenance" tone="warn" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "red" | "lime" | "amber" | "dark" }) {
  const accentClass = { red: "border-t-[#d74328]", lime: "border-t-[#99b700]", amber: "border-t-[#c38b00]", dark: "border-t-[#171915]" }[accent];
  return <div className={cn("panel border-t-4 p-5", accentClass)}><div className="text-xs font-semibold text-[#6b7066]">{label}</div><div className="mt-3 font-display text-4xl font-black tracking-[-0.05em]">{value}</div><div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#85897f]">{detail}</div></div>;
}

function IncidentRow({ incident, onSelect }: { incident: Incident; onSelect: (id: string) => void }) {
  const meta = categoryStyles[incident.category];
  const Icon = meta.icon;
  return (
    <button onClick={() => onSelect(incident.id)} className="grid w-full gap-4 p-5 text-left transition-colors hover:bg-[#f3f2ec] focus-visible:bg-[#f3f2ec] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
      <div className={cn("grid h-12 w-12 place-items-center", meta.soft)}><Icon size={25} weight="fill" /></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><strong className="font-display text-lg tracking-[-0.02em]">{categoryLabels[incident.category]}</strong>{incident.isDrill && <span className="bg-[#e9ff4a] px-2 py-1 font-mono text-[9px] font-black uppercase">Drill</span>}<StatusBadge status={incident.status} /></div>
        <div className="mt-1 truncate text-sm text-[#63685e]">{incident.zone} · {incident.worker}</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#888c82]">{incident.id} · active {formatElapsed(incident.createdAt)}</div>
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-[#3f433c]">Open command <ArrowRight size={17} /></div>
    </button>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const cls: Record<IncidentStatus, string> = { triggered: "bg-[#fee9e2] text-[#9f2d19]", acknowledged: "bg-[#fff0bd] text-[#735300]", dispatched: "bg-[#e8edda] text-[#4f6500]", on_scene: "bg-[#d9f4ec] text-[#086452]", resolved: "bg-[#e3e4df] text-[#50544c]", cancelled: "bg-[#f0e4e0] text-[#7d3022]" };
  return <span className={cn("px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.11em]", cls[status])}>{statusLabels[status]}</span>;
}

function FacilityMap({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="relative min-h-[280px] overflow-hidden border-2 border-[#171915] bg-[#252822] p-5 text-white shadow-[6px_6px_0_#c7c6be]">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(#777c6e_1px,transparent_1px),linear-gradient(90deg,#777c6e_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative flex items-start justify-between"><div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#adb1a5]">Facility schematic</div><h2 className="mt-1 font-display text-lg font-extrabold">Pilot Plant Alpha</h2></div><MapPin size={24} className="text-[#e9ff4a]" weight="fill" /></div>
      <div className="relative mt-6 grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-[0.1em]">
        <div className="h-20 border border-[#707568] bg-[#30342d] p-3">Warehouse <span className="mt-5 block h-2 w-2 animate-pulse rounded-full bg-[#19b58d]" /></div>
        <div className="h-20 border border-[#707568] bg-[#30342d] p-3">Production B <span className="mt-5 block h-2 w-2 animate-pulse rounded-full bg-[#ef5f3f]" /></div>
        <div className="h-16 border border-[#707568] bg-[#30342d] p-3">Admin</div>
        <div className="h-16 border border-[#707568] bg-[#30342d] p-3">Utilities</div>
      </div>
      <div className="relative mt-4 flex items-center justify-between text-xs text-[#c8cbc2]"><span>{incidents.length} active markers</span><span className="text-[#e9ff4a]">Diagram only</span></div>
    </section>
  );
}

function ReadinessRow({ label, value, tone }: { label: string; value: string; tone: "ready" | "busy" | "warn" }) {
  const color = tone === "ready" ? "bg-[#7d9e00]" : tone === "busy" ? "bg-[#c38b00]" : "bg-[#d74328]";
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", color)} />{label}</span><strong className="text-xs">{value}</strong></div>;
}

function MyIncidents({ incidents, workerId, onSelect }: { incidents: Incident[]; workerId: string; onSelect: (id: string) => void }) {
  const mine = incidents.filter((item) => item.workerId === workerId);
  const [filter, setFilter] = useState<"all" | "active" | "previous" | "drills">("all");
  const shown = mine.filter((item) => filter === "all" || (filter === "active" ? isActive(item) : filter === "previous" ? !isActive(item) && !item.isDrill : Boolean(item.isDrill)));
  return <div><PageHeading eyebrow="Worker history" title="My alerts" description="Follow active responses, review previous outcomes, and keep training drills separate from real incidents." action={<div className="flex max-w-full gap-1 overflow-x-auto border border-[#aeb1a8] bg-[#f9f8f3] p-1">{(["all", "active", "previous", "drills"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("min-h-10 shrink-0 px-3 text-xs font-bold capitalize", filter === item && "bg-[#171915] text-white")}>{item}</button>)}</div>} /><section className="panel divide-y divide-[#d5d4cc] overflow-hidden">{shown.map((item) => <div key={item.id}><IncidentRow incident={item} onSelect={onSelect} /><div className="-mt-3 flex flex-wrap gap-3 px-5 pb-4 pl-[88px] text-[10px] font-bold uppercase tracking-[0.1em] text-[#777c72]"><span>Outcome: {item.status === "resolved" ? "Resolved" : item.status === "cancelled" ? "False alert" : "Response active"}</span><span>Review: {item.reviewStatus ?? "pending"}</span></div></div>)}{shown.length === 0 && <EmptyState title="No matching alerts" body="Incidents in this category will appear here with their outcome and review state." />}</section></div>;
}

function SafetyCard({ profile }: { profile: WorkerProfile }) {
  return (
    <div><PageHeading eyebrow="Personal safety card" title="Ready before it matters." description="Your shift, site and emergency contacts are available even when the app is offline." />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="border-2 border-[#171915] bg-[#e9ff4a] p-6 shadow-[8px_8px_0_#171915] sm:p-8">
          <div className="flex justify-between gap-4"><div><div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">Pilot worker identity</div><h2 className="mt-5 font-display text-4xl font-black tracking-[-0.05em]">{profile.displayName}</h2><p className="mt-2 text-sm font-semibold">{profile.emergencyRole} · {profile.employeeId}</p></div><div className="grid h-14 w-14 place-items-center bg-[#171915] text-xl font-black text-white">{getInitials(profile.displayName)}</div></div>
          <div className="mt-8 grid grid-cols-2 gap-5 border-t border-[#a9ba34] pt-5 text-sm"><div><div className="text-xs text-[#536000]">Site</div><strong>{profile.facility}</strong></div><div><div className="text-xs text-[#536000]">Shift</div><strong>{profile.shift}</strong></div><div><div className="text-xs text-[#536000]">Default zone</div><strong>{profile.defaultZone}</strong></div><div><div className="text-xs text-[#536000]">Muster point</div><strong>{profile.musterPoint}</strong></div></div>
        </section>
        <section className="panel p-6 sm:p-8"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="font-display text-2xl font-black tracking-[-0.04em]">Emergency essentials</h2><p className="mt-1 text-sm text-[#6b7066]">Saved with the PWA for offline reference.</p></div><span className="self-start bg-[#e8edda] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#4f6500]">Offline ready</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><SafetyStep number="01" title="Raise the local alarm" body="Use the nearest manual call point or shout a clear warning." /><SafetyStep number="02" title="Move to safety" body="Follow marked exits. Never return for belongings." /><SafetyStep number="03" title="Report what you know" body="Choose a category; details can wait until you are safe." /><SafetyStep number="04" title="Account at muster" body={`Check in with your marshal at ${profile.musterPoint}.`} /></div><dl className="mt-7 grid gap-5 border-t border-[#d3d2ca] pt-6 sm:grid-cols-2"><Detail label="Facility emergency" value={profile.facilityEmergencyNumber} /><Detail label="First-aid location" value={profile.firstAidLocation} /><Detail label="Safety officer" value={profile.safetyOfficer} /><Detail label="Chemical exposure" value={profile.chemicalExposureInstruction} /></dl><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={`tel:${profile.facilityEmergencyNumber.replace(/\s/g, "")}`} className="button-primary"><Phone size={19} /> Call facility emergency</a><a href="tel:112" className="button-danger"><Phone size={19} weight="fill" /> Call 112</a></div></section>
      </div>
    </div>
  );
}

function WorkerProfilePage({ profile, authenticated, onSave, onSignOut }: { profile: WorkerProfile; authenticated: boolean; onSave: (profile: WorkerProfile) => void; onSignOut: () => Promise<void> }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const update = <Key extends keyof WorkerProfile>(key: Key, value: WorkerProfile[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const handleSave = () => {
    onSave({ ...draft, lastLogin: new Date().toISOString() });
    setSaved(true);
  };
  return (
    <div>
      <PageHeading eyebrow="Worker account" title="Your response identity." description="This information is attached automatically to an emergency, so you never need to type company or worker details under pressure." />
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="border-2 border-[#171915] bg-[#20231e] p-6 text-white shadow-[7px_7px_0_#c5c4bc]">
          <div className="grid h-20 w-20 place-items-center bg-[#e9ff4a] font-display text-2xl font-black text-[#171915]">{getInitials(draft.displayName)}</div>
          <h2 className="mt-6 font-display text-3xl font-black tracking-[-0.04em]">{draft.displayName}</h2>
          <p className="mt-2 text-sm text-[#bfc3b8]">{draft.employeeId} · {draft.emergencyRole}</p>
          <div className="mt-6 space-y-3 border-t border-[#464a42] pt-5 text-sm"><div className="flex justify-between gap-3"><span className="text-[#aeb2a7]">Account</span><strong className="text-[#e9ff4a] capitalize">{draft.accountStatus}</strong></div><div className="flex justify-between gap-3"><span className="text-[#aeb2a7]">Training</span><strong className="capitalize">{draft.trainingStatus}</strong></div><div className="flex justify-between gap-3"><span className="text-[#aeb2a7]">Push alerts</span><strong>{draft.pushEnabled ? "Enabled" : "Disabled"}</strong></div></div>
          <p className="mt-6 text-xs leading-5 text-[#9fa49a]">{authenticated ? "Identity and organization assignment are loaded from the authenticated Supabase account." : "Pilot profile data is stored on this device until authentication is required."}</p>
          {authenticated && <button onClick={onSignOut} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 border border-[#656a5f] text-sm font-bold hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><SignOut size={18} /> Sign out</button>}
        </aside>
        <section className="panel p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field-label">Full name<input className="field-input" value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} /></label>
            <label className="field-label">Employee ID<input className="field-input" value={draft.employeeId} onChange={(event) => update("employeeId", event.target.value)} /></label>
            <label className="field-label">Phone number<input className="field-input" type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} /></label>
            <label className="field-label">Preferred language<select className="field-input" value={draft.preferredLanguage} onChange={(event) => update("preferredLanguage", event.target.value)}><option>English</option><option>Hindi</option><option>Malayalam</option><option>Tamil</option><option>Kannada</option></select></label>
            <label className="field-label">Organization<input className="field-input bg-[#eceee6]" value={draft.organization} readOnly /></label>
            <label className="field-label">Assigned facility<input className="field-input bg-[#eceee6]" value={draft.facility} readOnly /></label>
            <label className="field-label">Department<input className="field-input" value={draft.department} onChange={(event) => update("department", event.target.value)} /></label>
            <label className="field-label">Shift<select className="field-input" value={draft.shift} onChange={(event) => update("shift", event.target.value)}><option>A · 06:00–14:00</option><option>B · 14:00–22:00</option><option>C · 22:00–06:00</option></select></label>
            <label className="field-label">Default work zone<select className="field-input" value={draft.defaultZone} onChange={(event) => update("defaultZone", event.target.value)}>{facilityZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
            <label className="field-label">Emergency role<input className="field-input" value={draft.emergencyRole} onChange={(event) => update("emergencyRole", event.target.value)} /></label>
          </div>
          <label className="mt-6 flex min-h-14 items-center justify-between gap-4 border border-[#adafa7] bg-[#f9f8f3] p-4"><span><strong className="block">PWA and push readiness</strong><span className="mt-1 block text-xs text-[#6b7066]">Allow site alerts on this installed device when notification delivery is connected.</span></span><input type="checkbox" checked={draft.pushEnabled} onChange={(event) => update("pushEnabled", event.target.checked)} className="h-5 w-5 accent-[#171915]" /></label>
          <div className="mt-6 flex flex-wrap items-center gap-4"><button onClick={handleSave} disabled={!draft.displayName.trim() || !draft.employeeId.trim()} className="button-primary disabled:opacity-50">Save profile</button>{saved && <span className="flex items-center gap-2 text-sm font-bold text-[#4f6500]"><CheckCircle size={20} weight="fill" /> Profile saved on this device</span>}</div>
        </section>
      </div>
    </div>
  );
}

function SafetyStep({ number, title, body }: { number: string; title: string; body: string }) { return <div className="border-l-2 border-[#171915] pl-4"><div className="font-mono text-[10px] font-bold text-[#8a8e83]">{number}</div><h3 className="mt-2 font-display font-extrabold">{title}</h3><p className="mt-1 text-sm leading-5 text-[#666b61]">{body}</p></div>; }

function IncidentRegister({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const shown = incidents.filter((item) => filter === "all" || (filter === "active" ? isActive(item) : !isActive(item)));
  return <div><PageHeading eyebrow="Auditable incident record" title="Incident register" description="Searchable, timestamped records for operational review, safety learning and pilot evidence." action={<div className="flex border border-[#aeb1a8] bg-[#f9f8f3] p-1">{(["all", "active", "resolved"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("min-h-10 px-4 text-xs font-bold capitalize", filter === item && "bg-[#171915] text-white")}>{item}</button>)}</div>} /><section className="panel divide-y divide-[#d5d4cc] overflow-hidden">{shown.map((item) => <IncidentRow key={item.id} incident={item} onSelect={onSelect} />)}</section></div>;
}

function TeamsPage({ onToast }: { onToast: (message: string) => void }) {
  return <OperationsManagement onToast={onToast} />;
}

function AnalyticsPage({ incidents }: { incidents: Incident[] }) {
  const resolved = incidents.filter((item) => item.status === "resolved").length;
  const active = incidents.filter(isActive).length;
  const drills = incidents.filter((item) => item.isDrill).length;
  const falseAlerts = incidents.filter((item) => item.status === "cancelled").length;
  const escalated = incidents.filter((item) => item.escalated).length;
  return <div><PageHeading eyebrow="Pilot learning loop" title="Measure the response, not just the alarm." description="Operational evidence for acknowledgement, mobilisation, arrival, resolution, delivery and follow-up." /><section className="mb-5 border-2 border-[#171915] bg-[#e9ff4a] p-5 shadow-[5px_5px_0_#171915] sm:p-6"><div className="eyebrow text-[#465100]">Investor pilot narrative · drill evidence</div><p className="mt-3 font-display text-2xl font-black leading-tight tracking-[-0.04em] sm:text-3xl">“The right team was notified in 8 seconds and acknowledged in 24 seconds—compared with a four-minute manual coordination baseline.”</p><p className="mt-3 text-xs font-semibold text-[#4c551b]">Demonstration claim only. Replace with measured pilot results before external publication.</p></section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Median acknowledgement" value="24s" detail="Pilot target: < 60s" accent="lime" /><Metric label="Median team assignment" value="46s" detail="Pilot target: < 90s" accent="amber" /><Metric label="Median arrival" value="4m 12s" detail="Drill sample only" accent="dark" /><Metric label="Notification delivery" value="96%" detail="Push simulation" accent="lime" /><Metric label="Active / resolved" value={`${active}/${resolved}`} detail="Current records" accent="red" /><Metric label="Unacknowledged" value={String(incidents.filter((item) => item.status === "triggered").length)} detail="Requires ownership" accent="amber" /><Metric label="Escalation rate" value={`${Math.round((escalated / Math.max(incidents.length, 1)) * 100)}%`} detail="External requests" accent="dark" /><Metric label="False-alert rate" value={`${Math.round((falseAlerts / Math.max(incidents.length, 1)) * 100)}%`} detail={`${drills} drill record${drills === 1 ? "" : "s"}`} accent="red" /></div><section className="panel mt-5 p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="eyebrow">Acknowledgement performance</div><h2 className="mt-2 font-display text-2xl font-black">Last 7 drill runs</h2></div><span className="self-start bg-[#eef0e9] px-3 py-2 text-xs font-bold">Response plan compliance · 92%</span></div><div className="mt-8 grid h-56 grid-cols-7 items-end gap-3 border-b border-l border-[#babdb3] pl-3">{[58, 76, 45, 82, 63, 91, 71].map((height, index) => <div key={index} className="group relative flex h-full items-end"><div className="w-full bg-[#171915] transition-colors hover:bg-[#8da600]" style={{ height: `${height}%` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100">{Math.round(120 - height)}s</span></div></div>)}</div><div className="mt-3 grid grid-cols-7 gap-3 pl-3 text-center font-mono text-[9px] uppercase text-[#777c72]">{["Run 1", "Run 2", "Run 3", "Run 4", "Run 5", "Run 6", "Run 7"].map((day) => <span key={day}>{day}</span>)}</div></section></div>;
}

function DemoController({ incidents, drillMode, onDrillModeChange, onStart, onReset, onOpenIncident }: { incidents: Incident[]; drillMode: boolean; onDrillModeChange: (value: boolean) => void; onStart: (category: Category) => void; onReset: () => void; onOpenIncident: (id: string) => void }) {
  const latest = incidents[0];
  const scenarios: { category: Category; name: string; detail: string }[] = [
    { category: "fire", name: "Production-line smoke", detail: "Demonstrate urgent site response and evacuation guidance." },
    { category: "hazmat", name: "Chemical leak isolation", detail: "Show layered location, EHS notification and escalation." },
    { category: "medical", name: "Warehouse injury", detail: "Show first-aid assignment and arrival tracking." },
    { category: "security", name: "Unauthorized entry", detail: "Show security ownership and controlled handoff." },
  ];
  return <div><PageHeading eyebrow="Authorized investor demonstration" title="Tell the whole response story." description="Run a controlled three-to-five-minute scenario across the worker, command, responder and review views." action={<button onClick={onReset} className="button-secondary">Reset demonstration</button>} /><div className="grid gap-5 xl:grid-cols-[1fr_380px]"><section className="panel overflow-hidden"><div className="border-b border-[#d3d2ca] p-5 sm:p-6"><div className="eyebrow">Step 1 · Choose a scenario</div><h2 className="mt-2 font-display text-2xl font-black">Start the incident narrative</h2></div><div className="grid gap-3 p-5 sm:grid-cols-2">{scenarios.map((scenario) => { const meta = categoryStyles[scenario.category]; const Icon = meta.icon; return <button key={scenario.category} onClick={() => onStart(scenario.category)} className="border-2 border-[#171915] bg-white p-5 text-left shadow-[3px_3px_0_#171915] transition hover:-translate-y-0.5 hover:bg-[#e9ff4a]"><div className={cn("grid h-11 w-11 place-items-center", meta.soft)}><Icon size={23} weight="fill" /></div><h3 className="mt-5 font-display text-lg font-black">{scenario.name}</h3><p className="mt-2 text-sm leading-5 text-[#666b61]">{scenario.detail}</p><span className="mt-4 flex items-center gap-2 font-mono text-[9px] font-bold uppercase">Start scenario <ArrowRight size={15} /></span></button>; })}</div></section><aside className="space-y-5"><section className="border-2 border-[#171915] bg-[#20231e] p-5 text-white"><div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#adb1a5]">Training boundary</div><h2 className="mt-2 font-display text-xl font-black">Drill mode</h2></div><button role="switch" aria-checked={drillMode} onClick={() => onDrillModeChange(!drillMode)} className={cn("relative h-8 w-14 border-2 border-white", drillMode ? "bg-[#e9ff4a]" : "bg-[#555a51]")}><span className={cn("absolute top-1 h-5 w-5 bg-[#171915] transition-all", drillMode ? "left-7" : "left-1")} /></button></div><p className="mt-4 text-sm leading-6 text-[#c5c8be]">When enabled, every new scenario is permanently labelled DRILL and kept separate in worker history and reporting.</p></section><section className="panel p-5"><div className="eyebrow">Demo sequence</div><ol className="mt-4 space-y-3 text-sm font-semibold">{["Worker selects and confirms", "Command receives the incident", "Safety lead acknowledges", "Response team dispatches", "Timeline and analytics update"].map((step, index) => <li key={step} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center bg-[#171915] font-mono text-[9px] text-[#e9ff4a]">{index + 1}</span>{step}</li>)}</ol></section>{latest && <button onClick={() => onOpenIncident(latest.id)} className="button-primary w-full">Open latest incident · {latest.id}</button>}</aside></div></div>;
}

function PilotSettings({ onReset }: { onReset: () => void }) {
  const [supabaseReadiness, setSupabaseReadiness] = useState<SupabaseReadiness>("checking");

  useEffect(() => {
    const controller = new AbortController();
    checkSupabaseReadiness(controller.signal)
      .then(setSupabaseReadiness)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSupabaseReadiness("unreachable");
      });
    return () => controller.abort();
  }, []);

  const databaseState: Record<SupabaseReadiness, { state: string; detail: string }> = {
    checking: { state: "Checking", detail: "Validating the configured project and schema" },
    unconfigured: { state: "Keys required", detail: "Add the public Supabase URL and publishable key" },
    schema_missing: { state: "Schema required", detail: "Project connected; apply the included ZioGuard migration" },
    ready: { state: "Schema reachable", detail: "Project and incident schema respond successfully" },
    unreachable: { state: "Check connection", detail: "The configured project or incident endpoint did not respond" },
  };

  const integrations = [
    { name: "Shared incident database", state: databaseState[supabaseReadiness].state, detail: databaseState[supabaseReadiness].detail, icon: CloudCheck },
    { name: "SMS & voice notifications", state: "Not connected", detail: "Provider credentials and delivery receipts", icon: Phone },
    { name: "n8n orchestration", state: "Planned", detail: "Signed webhooks, retries and audit events", icon: PlugsConnected },
    { name: "Authority dispatch", state: "Agreement required", detail: "Never enabled without formal integration", icon: ShieldCheck },
  ];
  return <div><PageHeading eyebrow="Pilot configuration" title="Make the boundaries visible." description="A credible pilot is explicit about what is simulated, what is connected and what evidence is still needed." /><div className="grid gap-5 xl:grid-cols-[1fr_360px]"><section className="panel overflow-hidden"><div className="border-b border-[#d6d5cd] p-5 sm:p-6"><h2 className="font-display text-2xl font-black">Integration readiness</h2></div><div className="divide-y divide-[#d6d5cd]">{integrations.map((item) => { const Icon = item.icon; return <div key={item.name} className="grid gap-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"><div className="grid h-11 w-11 place-items-center bg-[#eeefe9]"><Icon size={22} /></div><div><strong className="font-display">{item.name}</strong><p className="mt-1 text-sm text-[#6b7066]">{item.detail}</p></div><span className="justify-self-start bg-[#fff0bd] px-2.5 py-1 font-mono text-[9px] font-bold uppercase text-[#735300]">{item.state}</span></div>; })}</div></section><aside className="space-y-5"><section className="border-2 border-[#171915] bg-[#e9ff4a] p-6"><Sparkle size={27} weight="fill" /><h2 className="mt-5 font-display text-2xl font-black tracking-[-0.04em]">Pilot success gate</h2><ul className="mt-5 space-y-3 text-sm font-semibold"><li>✓ 3 emergency drills completed</li><li>✓ Workers trigger in under 10 seconds</li><li>✓ 95% of alerts acknowledged</li><li>○ Notification delivery validated</li><li>○ Legal and privacy review complete</li></ul></section><button onClick={onReset} className="button-secondary w-full">Restore sample data</button></aside></div></div>;
}

function RegionalView({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const regional = incidents.filter((item) => item.escalated && isActive(item));
  return (
    <div>
      <PageHeading
        eyebrow="Pilot regional coordination"
        title="One queue. Clear ownership."
        description="Authorized incidents requested by participating sites, separated from public emergency dispatch until an official integration exists."
        action={<div className="flex items-center gap-2 bg-[#171915] px-4 py-3 text-xs font-bold text-white"><Radio className="text-[#e9ff4a]" weight="fill" /> Pilot desk online</div>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="relative min-h-[520px] overflow-hidden border-2 border-[#171915] bg-[#20231e] p-6 text-white shadow-[7px_7px_0_#c3c2ba]">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#a8aea0_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="relative"><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#aeb2a7]">Fictional pilot region</div><h2 className="mt-2 font-display text-2xl font-black">Participating sites</h2></div>
          <div className="relative mt-8 h-[355px] border border-[#52574d] bg-[#282c25]">
            <div className="absolute left-[18%] top-[22%] h-3 w-3 animate-ping rounded-full bg-[#d74328]" />
            <MapMarker className="left-[18%] top-[22%]" label="Pilot Plant Alpha" alert />
            <MapMarker className="left-[58%] top-[58%]" label="Pilot Logistics Hub" />
            <MapMarker className="left-[71%] top-[31%]" label="Pilot Plant Beta" />
            <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 600 350" aria-hidden="true"><path d="M20 270 C120 180 170 285 270 170 S440 70 580 130" fill="none" stroke="#8b9183" strokeWidth="2" strokeDasharray="7 7" /></svg>
          </div>
          <div className="relative mt-4 flex justify-between text-xs text-[#bfc3b8]"><span>3 pilot sites</span><span>Map is schematic</span></div>
        </section>
        <section className="panel overflow-hidden">
          <div className="border-b border-[#d5d4cc] p-5 sm:p-6"><div className="eyebrow">External assistance requested</div><h2 className="mt-2 font-display text-2xl font-black">Coordination queue</h2></div>
          {regional.length ? <div className="divide-y divide-[#d5d4cc]">{regional.map((item) => <IncidentRow key={item.id} incident={item} onSelect={onSelect} />)}</div> : <EmptyState title="Queue is clear" body="Escalated active incidents will appear here." />}
        </section>
      </div>
    </div>
  );
}

function MapMarker({ className, label, alert = false }: { className: string; label: string; alert?: boolean }) { return <div className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2", className)}><div className={cn("grid h-9 w-9 place-items-center rounded-full border-4 border-[#20231e]", alert ? "bg-[#ef5f3f]" : "bg-[#e9ff4a] text-[#171915]")}><Buildings size={17} weight="fill" /></div><div className="mt-1 whitespace-nowrap bg-[#171915] px-2 py-1 text-[9px] font-bold uppercase">{label}</div></div>; }

function EscalationQueue({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const queue = incidents.filter((item) => item.escalated);
  return <div><PageHeading eyebrow="Inter-agency handoff" title="Escalation queue" description="Each request shows what the site has already done, what help it is requesting and who owns the next action." /><section className="panel divide-y divide-[#d5d4cc] overflow-hidden">{queue.map((item) => <IncidentRow key={item.id} incident={item} onSelect={onSelect} />)}</section></div>;
}

function ResourcesPage() {
  return <div><PageHeading eyebrow="Regional resource picture" title="Capacity at a glance." description="A pilot roster for coordination discussions. Real deployments require validated, real-time feeds from the responsible agencies." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><ResourceCard title="Fire & rescue" count="4" detail="Pilot units nearby" status="2 available" icon={<Fire />} /><ResourceCard title="Medical response" count="7" detail="Hospitals & ambulances" status="5 available" icon={<FirstAid />} /><ResourceCard title="Police response" count="3" detail="Jurisdiction desks" status="Connection planned" icon={<ShieldCheck />} /></div><div className="mt-5 border border-[#c5a24c] bg-[#fff0bd] p-5 text-sm leading-6 text-[#574000]"><strong>Coordination note:</strong> these are sample planning values, not authoritative availability. ZioGuard must never present estimated resources as confirmed dispatch capacity.</div></div>;
}

function ResourceCard({ title, count, detail, status, icon }: { title: string; count: string; detail: string; status: string; icon: ReactNode }) { return <section className="panel p-6"><div className="flex justify-between"><div className="grid h-12 w-12 place-items-center bg-[#171915] text-[#e9ff4a]">{icon}</div><span className="self-start bg-[#e9ebdf] px-2 py-1 text-[10px] font-bold">{status}</span></div><div className="mt-7 font-display text-5xl font-black tracking-[-0.05em]">{count}</div><h2 className="mt-2 font-display text-xl font-black">{title}</h2><p className="mt-1 text-sm text-[#6b7066]">{detail}</p></section>; }

function IncidentDetail({ incident, role, onClose, onAdvance, onEscalate, onNote }: { incident: Incident; role: Role; onClose: () => void; onAdvance: () => void; onEscalate: () => void; onNote: (detail: string) => void }) {
  const [internalNote, setInternalNote] = useState("");
  useEffect(() => { const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [onClose]);
  const meta = categoryStyles[incident.category];
  const Icon = meta.icon;
  const nextStatus = isActive(incident) && incident.status !== "cancelled" ? statusOrder[statusOrder.indexOf(incident.status) + 1] : undefined;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/55 p-0 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-labelledby="incident-title" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="h-full w-full max-w-[620px] overflow-y-auto bg-[#f4f2eb] shadow-[-12px_0_40px_rgba(0,0,0,.3)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#34372f] bg-[#171915] p-4 text-white sm:p-5"><div className="flex items-center gap-3"><div className={cn("grid h-10 w-10 place-items-center", meta.soft)}><Icon size={22} weight="fill" /></div><div><div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#adb1a6]">Live incident command</div><strong className="text-sm">{incident.id}</strong></div></div><button onClick={onClose} aria-label="Close incident" className="grid h-11 w-11 place-items-center border border-[#464a42] transition hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><X size={20} /></button></div>
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={incident.status} />{incident.escalated && <span className="bg-[#ece0f4] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#623a7e]">Control room requested</span>}</div>
          <h2 id="incident-title" className="mt-4 font-display text-4xl font-black tracking-[-0.05em] sm:text-5xl">{categoryLabels[incident.category]}</h2>
          <p className="mt-4 text-base leading-7 text-[#565b52]">{incident.description}</p>
          <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6 border-y border-[#cccbc4] py-6 text-sm"><Detail label="Facility" value={incident.facility} /><Detail label="Zone" value={incident.zone} /><Detail label="Reported by" value={`${incident.worker} · ${incident.workerId}`} /><Detail label="Active for" value={formatElapsed(incident.createdAt)} /><Detail label="People at risk" value={incident.headcount === null ? "Not confirmed" : String(incident.headcount)} /><Detail label="Location" value={incident.location} /></dl>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><section className="border border-[#c9c8c0] bg-white p-4"><div className="eyebrow">Incident ownership</div><Detail label="Incident commander" value={incident.timeline.find((entry) => entry.status === "acknowledged")?.actor ?? "Awaiting acknowledgement"} /><div className="mt-4"><Detail label="Assigned response team" value={incident.assignedTeam ?? "Awaiting assignment"} /></div></section><section className="border border-[#c9c8c0] bg-white p-4"><div className="eyebrow">Notification receipts</div><ul className="mt-3 space-y-2">{(incident.notifiedTeams ?? responseRecipients).map((recipient) => <li key={recipient} className="flex items-center justify-between gap-3 text-xs"><span>{recipient}</span><span className="flex items-center gap-1 font-bold text-[#567400]"><CheckCircle size={15} weight="fill" /> Delivered</span></li>)}</ul></section></div>
          {(incident.attachments?.length ?? 0) > 0 && <section className="mt-6"><div className="eyebrow">Attachments</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{incident.attachments?.map((item) => <div key={item.id} className="border border-[#c9c8c0] bg-white p-3">{item.kind === "photo" ? <img src={item.dataUrl} alt={item.name} className="h-36 w-full object-cover" /> : <audio controls src={item.dataUrl} className="w-full">Audio update</audio>}<div className="mt-2 truncate text-xs font-bold">{item.name}</div></div>)}</div></section>}
          {role !== "worker" && isActive(incident) && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {nextStatus && <button onClick={onAdvance} className="button-primary"><CheckCircle size={20} weight="fill" /> Mark {statusLabels[nextStatus]}</button>}
              {!incident.escalated && <button onClick={onEscalate} className="button-secondary"><Megaphone size={20} /> Request external help</button>}
            </div>
          )}
          {role !== "worker" && !incident.escalated && <p className="mt-3 text-xs leading-5 text-[#767b70]">“Request external help” adds the incident to this pilot’s control-room queue. It does not contact a public agency.</p>}
          {role !== "worker" && <section className="mt-6 border border-[#c9c8c0] bg-white p-4"><label className="field-label">Internal command note<textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} className="field-input resize-none" rows={2} maxLength={500} placeholder="Decision, observation, or handoff note" /></label><button onClick={() => { if (!internalNote.trim()) return; onNote(internalNote); setInternalNote(""); }} disabled={!internalNote.trim()} className="button-secondary mt-3 disabled:opacity-50">Add immutable note</button></section>}
          {incident.status === "resolved" && <section className="mt-6 border-2 border-[#7d9e00] bg-[#e8edda] p-4"><div className="eyebrow">Post-incident review</div><div className="mt-2 flex items-center justify-between gap-3"><strong>Review {incident.reviewStatus ?? "pending"}</strong><span className="font-mono text-[9px] font-bold uppercase">Outcome recorded</span></div></section>}
          <div className="mt-9"><div className="eyebrow">Immutable activity record</div><h3 className="mt-2 font-display text-2xl font-black">Incident timeline</h3><ol className="mt-6 space-y-0">{incident.timeline.map((entry, index) => <li key={entry.id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-6"><div className="relative"><span className={cn("relative z-10 grid h-7 w-7 place-items-center rounded-full border-2", index === incident.timeline.length - 1 ? "border-[#171915] bg-[#e9ff4a]" : "border-[#7b8075] bg-[#f4f2eb]")}><span className="h-1.5 w-1.5 rounded-full bg-[#171915]" /></span>{index < incident.timeline.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%+1px)] w-px bg-[#b6b9b0]" />}</div><div className="pb-1"><div className="flex flex-wrap justify-between gap-2"><strong className="font-display">{entry.label}</strong><time className="font-mono text-[9px] uppercase text-[#7b8076]">{new Date(entry.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p className="mt-1 text-sm leading-5 text-[#666b61]">{entry.detail}</p><div className="mt-2 text-[11px] font-semibold text-[#888c82]">By {entry.actor}</div></div></li>)}</ol></div>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[#85897f]">{label}</dt><dd className="mt-1 font-semibold leading-5">{value}</dd></div>; }

function EmptyState({ title, body }: { title: string; body: string }) { return <div className="p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center bg-[#eceee6]"><ListChecks size={24} /></div><h2 className="mt-4 font-display text-xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6b7066]">{body}</p></div>; }
