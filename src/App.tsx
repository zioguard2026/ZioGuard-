import {
  Alarm,
  ArrowRight,
  Buildings,
  ChartLineUp,
  Check,
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
  Phone,
  PlugsConnected,
  Radio,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkle,
  UsersThree,
  Warning,
  WifiHigh,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  advanceIncident,
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
  type IncidentStatus,
  type Role,
} from "./model";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Page =
  | "trigger"
  | "my_incidents"
  | "safety"
  | "overview"
  | "incidents"
  | "teams"
  | "analytics"
  | "settings"
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
  ],
  company: [
    { id: "overview", label: "Command", icon: HouseLine },
    { id: "incidents", label: "Incidents", icon: Alarm },
    { id: "teams", label: "People & units", icon: UsersThree },
    { id: "analytics", label: "Response review", icon: ChartLineUp },
    { id: "settings", label: "Pilot setup", icon: SlidersHorizontal },
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

const zoneOptions = ["Production Block B", "Warehouse aisle 7", "Chemical store", "North gate", "Other / unsure"];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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
  useEffect(() => localStorage.setItem("zioguard-incidents-v1", JSON.stringify(incidents)), [incidents]);
  return [incidents, setIncidents] as const;
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
  const [role, setRole] = useState<Role>("worker");
  const [page, setPage] = useState<Page>("trigger");
  const [incidents, setIncidents] = usePersistentIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const online = useOnlineStatus();

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

  const handleCreateIncident = (category: Category, detail: string, zone: string, location: string) => {
    const created = createIncident(category, detail, zone, location);
    setIncidents((current) => [created, ...current]);
    setSelectedId(created.id);
    setToast(`${created.id} created — pilot response team notified`);
  };

  const handleAdvance = (id: string) => {
    setIncidents((current) => current.map((incident) => (incident.id === id ? advanceIncident(incident, role === "control" ? "Pilot Regional Desk" : "Demo Safety Lead") : incident)));
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
        <Sidebar role={role} page={page} online={online} onNavigate={setPage} onRoleChange={handleRoleChange} onInstall={handleInstall} />
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <MobileHeader role={role} online={online} onRoleChange={handleRoleChange} />
          <main id="main-content" className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8 xl:p-10">
            {role === "worker" && page === "trigger" && <TriggerPage onCreate={handleCreateIncident} online={online} />}
            {role === "worker" && page === "my_incidents" && <MyIncidents incidents={incidents} onSelect={setSelectedId} />}
            {role === "worker" && page === "safety" && <SafetyCard />}
            {role === "company" && page === "overview" && <CompanyOverview incidents={incidents} onSelect={setSelectedId} />}
            {role === "company" && page === "incidents" && <IncidentRegister incidents={incidents} onSelect={setSelectedId} />}
            {role === "company" && page === "teams" && <TeamsPage />}
            {role === "company" && page === "analytics" && <AnalyticsPage incidents={incidents} />}
            {role === "company" && page === "settings" && <PilotSettings onReset={() => { setIncidents(seedIncidents); setToast("Pilot data restored"); }} />}
            {role === "control" && page === "regional" && <RegionalView incidents={incidents} onSelect={setSelectedId} />}
            {role === "control" && page === "queue" && <EscalationQueue incidents={incidents} onSelect={setSelectedId} />}
            {role === "control" && page === "resources" && <ResourcesPage />}
          </main>
        </div>
      </div>
      <MobileNavigation role={role} page={page} onNavigate={setPage} />
      {selectedIncident && (
        <IncidentDetail
          incident={selectedIncident}
          role={role}
          onClose={() => setSelectedId(null)}
          onAdvance={() => handleAdvance(selectedIncident.id)}
          onEscalate={() => handleEscalate(selectedIncident.id)}
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

function Sidebar({ role, page, online, onNavigate, onRoleChange, onInstall }: { role: Role; page: Page; online: boolean; onNavigate: (page: Page) => void; onRoleChange: (role: Role) => void; onInstall: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-[#34372f] bg-[#171915] p-5 lg:flex">
      <Brand />
      <div className="mt-9 rounded-none border border-[#3c4037] bg-[#20231e] p-1">
        {(Object.keys(roleMeta) as Role[]).map((item) => (
          <button key={item} onClick={() => onRoleChange(item)} className={cn("min-h-11 w-full px-3 text-left text-xs font-bold transition-colors", role === item ? "bg-[#e9ff4a] text-[#171915]" : "text-[#bfc2b7] hover:bg-[#2a2e27] hover:text-white")}>
            {roleMeta[item].label}
          </button>
        ))}
      </div>
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
      <div className="flex items-center justify-between border-t border-[#353930] pt-4 text-xs text-[#a6aa9e]">
        <span className="flex items-center gap-2">{online ? <WifiHigh className="text-[#b9d800]" /> : <WifiSlash className="text-[#ff8a6d]" />} {online ? "Online" : "Offline mode"}</span>
        <span className="font-mono text-[9px] uppercase">v0.1</span>
      </div>
    </aside>
  );
}

function MobileHeader({ role, online, onRoleChange }: { role: Role; online: boolean; onRoleChange: (role: Role) => void }) {
  return (
    <header className="flex items-center justify-between border-b border-[#34372f] bg-[#171915] px-4 py-3 lg:hidden">
      <Brand compact />
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", online ? "bg-[#b9d800]" : "bg-[#ff6a4a]")} aria-label={online ? "Online" : "Offline"} />
        <select aria-label="Switch pilot role" value={role} onChange={(event) => onRoleChange(event.target.value as Role)} className="min-h-11 border border-[#45493f] bg-[#20231e] px-3 text-sm font-bold text-white outline-none focus:border-[#e9ff4a]">
          {(Object.keys(roleMeta) as Role[]).map((item) => <option key={item} value={item}>{roleMeta[item].short}</option>)}
        </select>
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

function TriggerPage({ onCreate, online }: { onCreate: (category: Category, detail: string, zone: string, location: string) => void; online: boolean }) {
  const [category, setCategory] = useState<Category>("fire");
  const [zone, setZone] = useState(zoneOptions[0]);
  const [detail, setDetail] = useState("");
  const [location, setLocation] = useState("Facility location on file");
  const [locating, setLocating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const handleLocation = () => {
    if (!navigator.geolocation) {
      setLocation("Location unavailable — facility location will be used");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} · ±${Math.round(position.coords.accuracy)}m`);
        setLocating(false);
      },
      () => {
        setLocation("Permission unavailable — facility location will be used");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleConfirmAlert = () => {
    setConfirmationOpen(false);
    onCreate(category, detail, zone, location);
    navigator.vibrate?.([120, 80, 180]);
    setCreatedId("created");
  };

  if (createdId) {
    return (
      <div className="mx-auto max-w-2xl pt-4 sm:pt-10">
        <div className="border-2 border-[#171915] bg-white p-6 shadow-[10px_10px_0_#171915] sm:p-10">
          <div className="grid h-16 w-16 place-items-center bg-[#dff2a8] text-[#355000]"><Check size={36} weight="bold" /></div>
          <h1 className="mt-7 font-display text-4xl font-black tracking-[-0.05em] sm:text-6xl">Alert received.</h1>
          <p className="mt-4 text-lg leading-7 text-[#555a51]">Stay safe. Your pilot incident has been added to the company command dashboard.</p>
          <div className="mt-7 border-l-4 border-[#e9ff4a] bg-[#171915] p-5 text-white">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#aeb3a5]">Do this now</div>
            <p className="mt-2 font-semibold leading-6">{categoryStyles[category].instructions}</p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <a href="tel:112" className="button-danger"><Phone size={20} weight="fill" /> Call 112</a>
            <button onClick={() => { setCreatedId(null); setDetail(""); }} className="button-secondary">Back to emergency screen</button>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#6f7469]">Pilot note: no real responder, public authority, SMS, or voice call was dispatched from this demo.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeading eyebrow="Worker emergency console" title="What is happening?" description="Choose the closest emergency type. You can raise an alert in seconds; details are optional and can be added after you are safe." action={<a href="tel:112" className="button-danger shrink-0"><Phone weight="fill" /> Call 112</a>} />
      {!online && (
        <div className="mb-5 flex items-start gap-3 border border-[#9f6f00] bg-[#fff0bd] p-4 text-sm text-[#594000]">
          <WifiSlash className="mt-0.5 shrink-0" size={20} weight="bold" />
          <div><strong>Offline:</strong> the pilot can open from cache, but this alert will stay only on this device until a shared backend is connected.</div>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <section aria-labelledby="emergency-types" className="panel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="emergency-types" className="font-display text-xl font-extrabold tracking-[-0.03em]">1. Select emergency</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7066]">Tap once</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(Object.keys(categoryLabels) as Category[]).map((item) => {
              const meta = categoryStyles[item];
              const Icon = meta.icon;
              return (
                <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={cn("group min-h-[132px] border-2 p-4 text-left transition-all active:translate-y-0.5 sm:min-h-[150px]", category === item ? "border-[#171915] bg-[#e9ff4a] shadow-[5px_5px_0_#171915]" : "border-[#d1d0c8] bg-[#f9f8f3] hover:border-[#787c72]")}>
                  <Icon size={31} weight={category === item ? "fill" : "bold"} className={category === item ? "text-[#171915]" : meta.accent} />
                  <div className="mt-5 font-display text-base font-extrabold leading-tight sm:text-lg">{categoryLabels[item]}</div>
                  <div className="mt-1 text-xs text-[#62675d]">{item === "fire" ? "Smoke, flame, explosion" : item === "hazmat" ? "Gas, leak, toxic material" : item === "security" ? "Threat, violence, intrusion" : "Injury, illness, collapse"}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="field-label">2. Where are you?
              <select value={zone} onChange={(event) => setZone(event.target.value)} className="field-input">
                {zoneOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <div>
              <div className="field-label">Device location</div>
              <button onClick={handleLocation} disabled={locating} className="field-input flex w-full items-center gap-2 text-left disabled:opacity-60">
                <MapPin size={18} /> <span className="truncate">{locating ? "Finding location…" : location}</span>
              </button>
            </div>
          </div>
          <label className="field-label mt-5">3. Add detail <span className="font-normal text-[#85897e]">(optional)</span>
            <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={240} rows={3} placeholder="Example: smoke near line 2; two people nearby" className="field-input resize-none" />
            <span className="mt-1 block text-right font-mono text-[10px] text-[#8a8e83]">{detail.length}/240</span>
          </label>
        </section>
        <aside className="flex flex-col gap-5">
          <div className="border-2 border-[#171915] bg-[#20231e] p-5 text-white shadow-[7px_7px_0_#c9c8c0] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#adb1a5]">4. Raise the alert</div>
                <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">Review before sending</h2>
              </div>
              <span className={cn("px-2.5 py-1 font-mono text-[10px] font-bold uppercase", categoryStyles[category].soft)}>{category}</span>
            </div>
            <button onClick={() => setConfirmationOpen(true)} className="mt-7 flex min-h-[156px] w-full flex-col items-center justify-center border-2 border-[#ff7a5e] bg-[#d74328] p-6 text-center text-white shadow-[7px_7px_0_#8f2918] transition hover:-translate-y-0.5 hover:bg-[#c63a21] active:translate-y-0 active:shadow-[3px_3px_0_#8f2918]">
              <Siren size={46} weight="fill" />
              <span className="mt-3 font-display text-2xl font-black uppercase tracking-[-0.03em]">Raise {category} alert</span>
              <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em]">Tap once · confirmation follows</span>
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-[#acb0a4]">Nothing is sent from this screen. You will review the emergency details and confirm in the next step.</p>
          </div>
          <div className="panel p-5">
            <div className="flex items-center gap-3"><ShieldCheck size={22} weight="fill" className="text-[#567400]" /><h3 className="font-display font-extrabold">Your safety comes first</h3></div>
            <p className="mt-3 text-sm leading-6 text-[#62675d]">Do not stay in danger to complete this form. Use the nearest manual alarm, follow site evacuation signs, and call 112 when immediate public emergency help is needed.</p>
          </div>
        </aside>
      </div>
      {confirmationOpen && (
        <ConfirmAlertDialog
          category={category}
          zone={zone}
          location={location}
          detail={detail}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={handleConfirmAlert}
        />
      )}
    </div>
  );
}

function ConfirmAlertDialog({ category, zone, location, detail, onCancel, onConfirm }: { category: Category; zone: string; location: string; detail: string; onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const meta = categoryStyles[category];
  const Icon = meta.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-alert-title" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}>
      <section className="w-full max-w-[600px] border-2 border-[#171915] bg-[#f7f5ee] shadow-[10px_10px_0_#171915]">
        <div className="flex items-center justify-between border-b border-[#34372f] bg-[#171915] p-4 text-white sm:p-5">
          <div className="flex items-center gap-3"><div className={cn("grid h-11 w-11 place-items-center", meta.soft)}><Icon size={24} weight="fill" /></div><div><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#adb1a5]">Final confirmation</div><strong>Review emergency alert</strong></div></div>
          <button onClick={onCancel} aria-label="Cancel and close confirmation" className="grid h-11 w-11 place-items-center border border-[#4a4e45] hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4 border-l-4 border-[#d74328] bg-[#fee9e2] p-4 text-[#662113]">
            <Warning size={24} weight="fill" className="mt-0.5 shrink-0" />
            <div><h2 id="confirm-alert-title" className="font-display text-xl font-black">Are you sure this is a {categoryLabels[category].toLowerCase()}?</h2><p className="mt-1 text-sm leading-5">Confirm only when help or site response is genuinely needed. False or test alerts should use the planned drill process.</p></div>
          </div>
          <dl className="mt-6 grid gap-4 border-y border-[#cecdc5] py-5 sm:grid-cols-2">
            <Detail label="Emergency type" value={categoryLabels[category]} />
            <Detail label="Site zone" value={zone} />
            <Detail label="Location" value={location} />
            <Detail label="Your details" value={detail.trim() || "No additional detail provided"} />
          </dl>
          <div className="mt-5 flex items-start gap-3 bg-[#eceee6] p-4 text-sm leading-5 text-[#4e534a]"><ShieldCheck size={21} weight="fill" className="mt-0.5 shrink-0 text-[#567400]" /><span><strong>After confirmation:</strong> a trackable incident is created and appears in the pilot company dashboard. Public emergency services are not contacted by this pilot.</span></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={onCancel} className="button-secondary">No, go back</button>
            <button ref={confirmRef} onClick={onConfirm} className="button-danger"><Siren size={20} weight="fill" /> Yes, raise alert</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CompanyOverview({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const active = incidents.filter(isActive);
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
        <div className="flex flex-wrap items-center gap-2"><strong className="font-display text-lg tracking-[-0.02em]">{categoryLabels[incident.category]}</strong><StatusBadge status={incident.status} /></div>
        <div className="mt-1 truncate text-sm text-[#63685e]">{incident.zone} · {incident.worker}</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#888c82]">{incident.id} · active {formatElapsed(incident.createdAt)}</div>
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-[#3f433c]">Open command <ArrowRight size={17} /></div>
    </button>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const cls: Record<IncidentStatus, string> = { triggered: "bg-[#fee9e2] text-[#9f2d19]", acknowledged: "bg-[#fff0bd] text-[#735300]", dispatched: "bg-[#e8edda] text-[#4f6500]", on_scene: "bg-[#d9f4ec] text-[#086452]", resolved: "bg-[#e3e4df] text-[#50544c]" };
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

function MyIncidents({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const mine = incidents.filter((item) => item.workerId === "W-1042");
  return <div><PageHeading eyebrow="Worker history" title="My alerts" description="Follow the current response and review alerts you created. Only incidents linked to your worker ID appear here." /><section className="panel divide-y divide-[#d5d4cc] overflow-hidden">{mine.map((item) => <IncidentRow key={item.id} incident={item} onSelect={onSelect} />)}{mine.length === 0 && <EmptyState title="No alerts yet" body="Any alert you create will appear here with a live response timeline." />}</section></div>;
}

function SafetyCard() {
  return (
    <div><PageHeading eyebrow="Personal safety card" title="Ready before it matters." description="Your shift, site and emergency contacts are available even when the app is offline." />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="border-2 border-[#171915] bg-[#e9ff4a] p-6 shadow-[8px_8px_0_#171915] sm:p-8">
          <div className="flex justify-between gap-4"><div><div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">Fictional pilot identity</div><h2 className="mt-5 font-display text-4xl font-black tracking-[-0.05em]">Demo Worker 01</h2><p className="mt-2 text-sm font-semibold">Production operator · W-1042</p></div><div className="grid h-14 w-14 place-items-center bg-[#171915] text-xl font-black text-white">D1</div></div>
          <div className="mt-8 grid grid-cols-2 gap-5 border-t border-[#a9ba34] pt-5 text-sm"><div><div className="text-xs text-[#536000]">Site</div><strong>Pilot Plant Alpha</strong></div><div><div className="text-xs text-[#536000]">Shift</div><strong>A · 06:00–14:00</strong></div><div><div className="text-xs text-[#536000]">Muster point</div><strong>East car park</strong></div><div><div className="text-xs text-[#536000]">First aider</div><strong>Demo First Aider</strong></div></div>
        </section>
        <section className="panel p-6 sm:p-8"><h2 className="font-display text-2xl font-black tracking-[-0.04em]">Emergency essentials</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><SafetyStep number="01" title="Raise the local alarm" body="Use the nearest manual call point or shout a clear warning." /><SafetyStep number="02" title="Move to safety" body="Follow marked exits. Never return for belongings." /><SafetyStep number="03" title="Report what you know" body="Choose a category; details can wait until you are safe." /><SafetyStep number="04" title="Account at muster" body="Check in with your marshal at the east car park." /></div></section>
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

function TeamsPage() {
  const teams = [
    ["Emergency response team", "4 ready", "Demo Safety Lead", "East response bay", "ready"],
    ["On-site first aid", "2 on task", "Demo First Aider", "Clinic / mobile", "busy"],
    ["Plant security", "5 ready", "Demo Security Lead", "Gates & perimeter", "ready"],
    ["Fire tender crew", "Unavailable", "Demo Crew Lead", "Vehicle maintenance", "warn"],
  ] as const;
  return <div><PageHeading eyebrow="People, units and readiness" title="Know who can respond." description="Pilot roster for duty status, coordination owners and response coverage. Production will sync approved HR and access-control data." /><div className="grid gap-4 md:grid-cols-2">{teams.map(([name, status, lead, base, tone]) => <section key={name} className="panel p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center bg-[#20231e] text-[#e9ff4a]"><HardHat size={23} weight="fill" /></div><span className={cn("px-2.5 py-1 font-mono text-[9px] font-bold uppercase", tone === "ready" ? "bg-[#e3edc0] text-[#486000]" : tone === "busy" ? "bg-[#fff0bd] text-[#735300]" : "bg-[#fee9e2] text-[#9f2d19]")}>{status}</span></div><h2 className="mt-6 font-display text-xl font-black tracking-[-0.03em]">{name}</h2><div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#d6d5cd] pt-4 text-sm"><div><div className="text-xs text-[#85897f]">Team lead</div><strong>{lead}</strong></div><div><div className="text-xs text-[#85897f]">Base</div><strong>{base}</strong></div></div></section>)}</div></div>;
}

function AnalyticsPage({ incidents }: { incidents: Incident[] }) {
  const resolved = incidents.filter((item) => item.status === "resolved").length;
  return <div><PageHeading eyebrow="Pilot learning loop" title="Measure the response, not just the alarm." description="The metrics that matter: acknowledgement, mobilisation, arrival, resolution and follow-up actions." /><div className="grid gap-4 sm:grid-cols-3"><Metric label="Median acknowledgement" value="28s" detail="Pilot target: < 60s" accent="lime" /><Metric label="Median mobilisation" value="1m 14s" detail="Pilot target: < 2 min" accent="amber" /><Metric label="Resolved incidents" value={String(resolved)} detail="From current demo data" accent="dark" /></div><section className="panel mt-5 p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="eyebrow">Response performance</div><h2 className="mt-2 font-display text-2xl font-black">Last 7 days</h2></div><span className="self-start bg-[#eef0e9] px-3 py-2 text-xs font-bold">Pilot sample · 12 drills</span></div><div className="mt-8 grid h-56 grid-cols-7 items-end gap-3 border-b border-l border-[#babdb3] pl-3">{[58, 76, 45, 82, 63, 91, 71].map((height, index) => <div key={index} className="group relative flex h-full items-end"><div className="w-full bg-[#171915] transition-colors hover:bg-[#8da600]" style={{ height: `${height}%` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100">{Math.round(120 - height)}s</span></div></div>)}</div><div className="mt-3 grid grid-cols-7 gap-3 pl-3 text-center font-mono text-[9px] uppercase text-[#777c72]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div></section></div>;
}

function PilotSettings({ onReset }: { onReset: () => void }) {
  const integrations = [
    { name: "Shared incident database", state: "Required next", detail: "Supabase or equivalent with tenant isolation", icon: CloudCheck },
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

function IncidentDetail({ incident, role, onClose, onAdvance, onEscalate }: { incident: Incident; role: Role; onClose: () => void; onAdvance: () => void; onEscalate: () => void }) {
  useEffect(() => { const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [onClose]);
  const meta = categoryStyles[incident.category];
  const Icon = meta.icon;
  const nextStatus = statusOrder[statusOrder.indexOf(incident.status) + 1];
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/55 p-0 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-labelledby="incident-title" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="h-full w-full max-w-[620px] overflow-y-auto bg-[#f4f2eb] shadow-[-12px_0_40px_rgba(0,0,0,.3)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#34372f] bg-[#171915] p-4 text-white sm:p-5"><div className="flex items-center gap-3"><div className={cn("grid h-10 w-10 place-items-center", meta.soft)}><Icon size={22} weight="fill" /></div><div><div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#adb1a6]">Live incident command</div><strong className="text-sm">{incident.id}</strong></div></div><button onClick={onClose} aria-label="Close incident" className="grid h-11 w-11 place-items-center border border-[#464a42] transition hover:border-[#e9ff4a] hover:text-[#e9ff4a]"><X size={20} /></button></div>
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={incident.status} />{incident.escalated && <span className="bg-[#ece0f4] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#623a7e]">Control room requested</span>}</div>
          <h2 id="incident-title" className="mt-4 font-display text-4xl font-black tracking-[-0.05em] sm:text-5xl">{categoryLabels[incident.category]}</h2>
          <p className="mt-4 text-base leading-7 text-[#565b52]">{incident.description}</p>
          <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6 border-y border-[#cccbc4] py-6 text-sm"><Detail label="Facility" value={incident.facility} /><Detail label="Zone" value={incident.zone} /><Detail label="Reported by" value={`${incident.worker} · ${incident.workerId}`} /><Detail label="Active for" value={formatElapsed(incident.createdAt)} /><Detail label="People at risk" value={incident.headcount === null ? "Not confirmed" : String(incident.headcount)} /><Detail label="Location" value={incident.location} /></dl>
          {role !== "worker" && incident.status !== "resolved" && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {nextStatus && <button onClick={onAdvance} className="button-primary"><CheckCircle size={20} weight="fill" /> Mark {statusLabels[nextStatus]}</button>}
              {!incident.escalated && <button onClick={onEscalate} className="button-secondary"><Megaphone size={20} /> Request external help</button>}
            </div>
          )}
          {role !== "worker" && !incident.escalated && <p className="mt-3 text-xs leading-5 text-[#767b70]">“Request external help” adds the incident to this pilot’s control-room queue. It does not contact a public agency.</p>}
          <div className="mt-9"><div className="eyebrow">Immutable activity record</div><h3 className="mt-2 font-display text-2xl font-black">Incident timeline</h3><ol className="mt-6 space-y-0">{incident.timeline.map((entry, index) => <li key={entry.id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-6"><div className="relative"><span className={cn("relative z-10 grid h-7 w-7 place-items-center rounded-full border-2", index === incident.timeline.length - 1 ? "border-[#171915] bg-[#e9ff4a]" : "border-[#7b8075] bg-[#f4f2eb]")}><span className="h-1.5 w-1.5 rounded-full bg-[#171915]" /></span>{index < incident.timeline.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%+1px)] w-px bg-[#b6b9b0]" />}</div><div className="pb-1"><div className="flex flex-wrap justify-between gap-2"><strong className="font-display">{entry.label}</strong><time className="font-mono text-[9px] uppercase text-[#7b8076]">{new Date(entry.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p className="mt-1 text-sm leading-5 text-[#666b61]">{entry.detail}</p><div className="mt-2 text-[11px] font-semibold text-[#888c82]">By {entry.actor}</div></div></li>)}</ol></div>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[#85897f]">{label}</dt><dd className="mt-1 font-semibold leading-5">{value}</dd></div>; }

function EmptyState({ title, body }: { title: string; body: string }) { return <div className="p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center bg-[#eceee6]"><ListChecks size={24} /></div><h2 className="mt-4 font-display text-xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6b7066]">{body}</p></div>; }
