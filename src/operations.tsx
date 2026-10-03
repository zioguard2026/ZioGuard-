import {
  BellRinging,
  Buildings,
  ClipboardText,
  Fire,
  FirstAid,
  HardHat,
  Plus,
  ShieldCheck,
  UploadSimple,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

type OperationsTab = "people" | "teams" | "facilities" | "plans" | "notifications" | "drills";

const tabs: { id: OperationsTab; label: string; icon: typeof UsersThree }[] = [
  { id: "people", label: "People", icon: UsersThree },
  { id: "teams", label: "Response teams", icon: HardHat },
  { id: "facilities", label: "Facilities", icon: Buildings },
  { id: "plans", label: "Response plans", icon: ClipboardText },
  { id: "notifications", label: "Notifications", icon: BellRinging },
  { id: "drills", label: "Drill center", icon: ShieldCheck },
];

export function OperationsManagement({ onToast }: { onToast: (message: string) => void }) {
  const [tab, setTab] = useState<OperationsTab>("people");
  return <div><div className="mb-7"><div className="eyebrow">Pilot operations management</div><h1 className="mt-2 font-display text-4xl font-black tracking-[-0.05em] sm:text-5xl">Build a response-ready site.</h1><p className="mt-3 max-w-3xl text-base leading-7 text-[#62675d]">Manage the people, places, playbooks, communication channels and drills that determine what happens after an alert.</p></div><div className="mb-5 flex gap-2 overflow-x-auto border-b border-[#bfc0b8] pb-3">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex min-h-11 shrink-0 items-center gap-2 border px-4 text-xs font-bold ${tab === item.id ? "border-[#171915] bg-[#171915] text-[#e9ff4a]" : "border-[#bfc0b8] bg-[#f7f5ee] hover:border-[#171915]"}`}><Icon size={18} weight={tab === item.id ? "fill" : "regular"} />{item.label}</button>; })}</div>{tab === "people" && <PeopleManager onToast={onToast} />}{tab === "teams" && <TeamManager onToast={onToast} />}{tab === "facilities" && <FacilityManager onToast={onToast} />}{tab === "plans" && <PlanManager onToast={onToast} />}{tab === "notifications" && <NotificationManager onToast={onToast} />}{tab === "drills" && <DrillManager onToast={onToast} />}</div>;
}

function SectionHeading({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-4 border-b border-[#d3d2ca] p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="font-display text-2xl font-black tracking-[-0.03em]">{title}</h2><p className="mt-1 text-sm text-[#686d63]">{detail}</p></div>{action}</div>;
}

function PeopleManager({ onToast }: { onToast: (message: string) => void }) {
  const [people, setPeople] = useState([
    { id: "W-1042", name: "Demo Worker 01", role: "Worker", assignment: "Production · Shift A", training: "Current", active: true },
    { id: "R-0201", name: "Demo Safety Lead", role: "Incident commander", assignment: "ERT-02 · Shift A", training: "Current", active: true },
    { id: "R-0314", name: "Demo First Aider", role: "Responder", assignment: "Clinic · Shift A", training: "Expires in 21 days", active: true },
    { id: "W-0871", name: "Demo Worker 02", role: "Worker", assignment: "Warehouse · Shift B", training: "Required", active: false },
  ]);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", role: "Worker" });
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => people.filter((person) => `${person.name} ${person.id} ${person.role}`.toLowerCase().includes(query.toLowerCase())), [people, query]);
  const handleInvite = () => {
    if (!invite.name.trim() || !invite.email.trim()) return;
    setPeople((current) => [...current, { id: `P-${String(current.length + 1).padStart(4, "0")}`, name: invite.name, role: invite.role, assignment: "Awaiting facility assignment", training: "Required", active: false }]);
    setInvite({ name: "", email: "", role: "Worker" });
    setInviteOpen(false);
    onToast("Pilot invitation prepared — connect the server invite function before sending");
  };
  const handleCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = (await file.text()).split(/\r?\n/).filter(Boolean).slice(1);
    onToast(`${rows.length} CSV rows validated for import`);
    event.target.value = "";
  };
  return <section className="panel overflow-hidden"><SectionHeading title="People and access" detail={`${people.filter((item) => item.active).length} active · ${people.filter((item) => item.training === "Required").length} training action`} action={<div className="flex flex-wrap gap-2"><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleCsv} className="hidden" /><button onClick={() => fileRef.current?.click()} className="button-secondary min-h-11 px-4"><UploadSimple size={18} /> Import CSV</button><button onClick={() => setInviteOpen((open) => !open)} className="button-primary min-h-11 px-4"><Plus size={18} /> Invite person</button></div>} />{inviteOpen && <div className="grid gap-3 border-b border-[#d3d2ca] bg-[#eceee6] p-5 sm:grid-cols-[1fr_1fr_180px_auto]"><input aria-label="Invitee name" className="field-input mt-0" value={invite.name} onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" /><input aria-label="Invitee email" type="email" className="field-input mt-0" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder="Work email" /><select aria-label="Invitee role" className="field-input mt-0" value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}><option>Worker</option><option>Responder</option><option>Company admin</option><option>Auditor</option></select><button onClick={handleInvite} className="button-primary min-h-12">Add</button></div>}<div className="p-4 sm:p-5"><input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} className="field-input mt-0" placeholder="Search by name, ID or role" /></div><div className="divide-y divide-[#d3d2ca]">{shown.map((person) => <div key={person.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><strong className="font-display">{person.name}</strong><div className="mt-1 text-xs text-[#757a70]">{person.id} · {person.role}</div></div><div className="text-sm"><div>{person.assignment}</div><span className={person.training === "Current" ? "text-[#567400]" : "text-[#9f6f00]"}>{person.training}</span></div><button onClick={() => { setPeople((current) => current.map((item) => item.id === person.id ? { ...item, active: !item.active } : item)); onToast(`${person.name} ${person.active ? "deactivated" : "activated"}`); }} className={`min-h-10 border px-3 text-xs font-bold ${person.active ? "border-[#8ba300] bg-[#e8edda] text-[#4f6500]" : "border-[#b7b9b1] bg-[#eee] text-[#666]"}`}>{person.active ? "Active" : "Inactive"}</button></div>)}</div></section>;
}

function TeamManager({ onToast }: { onToast: (message: string) => void }) {
  const [teams, setTeams] = useState([
    { name: "Emergency response team", capability: "Fire · Hazmat", lead: "Demo Safety Lead", base: "East response bay", status: "Available" },
    { name: "On-site first aid", capability: "Medical", lead: "Demo First Aider", base: "Site clinic", status: "Busy" },
    { name: "Plant security", capability: "Security", lead: "Demo Security Lead", base: "North gate", status: "Available" },
  ]);
  const [name, setName] = useState("");
  const handleAdd = () => { if (!name.trim()) return; setTeams((current) => [...current, { name, capability: "Configure capability", lead: "Assign lead", base: "Assign base", status: "Off duty" }]); setName(""); onToast("Response team created in the pilot workspace"); };
  return <section className="panel overflow-hidden"><SectionHeading title="Response teams" detail="Capabilities, readiness, leadership and staging locations" action={<div className="flex gap-2"><input aria-label="New team name" value={name} onChange={(event) => setName(event.target.value)} className="field-input mt-0 min-w-0" placeholder="New team name" /><button onClick={handleAdd} className="button-primary min-h-12 shrink-0"><Plus size={18} /> Create</button></div>} /><div className="grid gap-4 p-5 md:grid-cols-2">{teams.map((team) => <article key={team.name} className="border border-[#bfc0b8] bg-white p-5"><div className="flex justify-between gap-3"><div className="grid h-11 w-11 place-items-center bg-[#171915] text-[#e9ff4a]"><HardHat size={23} weight="fill" /></div><select aria-label={`${team.name} availability`} value={team.status} onChange={(event) => { setTeams((current) => current.map((item) => item.name === team.name ? { ...item, status: event.target.value } : item)); onToast(`${team.name} marked ${event.target.value.toLowerCase()}`); }} className="min-h-10 border border-[#aeb1a8] bg-[#f7f5ee] px-2 text-xs font-bold"><option>Available</option><option>Busy</option><option>Off duty</option></select></div><h3 className="mt-5 font-display text-xl font-black">{team.name}</h3><p className="mt-1 text-sm text-[#656a60]">{team.capability}</p><dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#d3d2ca] pt-4 text-xs"><div><dt className="text-[#85897f]">Team lead</dt><dd className="mt-1 font-bold">{team.lead}</dd></div><div><dt className="text-[#85897f]">Base</dt><dd className="mt-1 font-bold">{team.base}</dd></div></dl></article>)}</div></section>;
}

function FacilityManager({ onToast }: { onToast: (message: string) => void }) {
  const [zones, setZones] = useState(["Production Block B", "Warehouse aisle 7", "Chemical store", "North gate"]);
  const [newZone, setNewZone] = useState("");
  return <div className="grid gap-5 xl:grid-cols-[1fr_380px]"><section className="panel p-5 sm:p-6"><h2 className="font-display text-2xl font-black">Pilot Plant Alpha</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="field-label">Facility address<input className="field-input" defaultValue="Industrial Estate, Pilot District" /></label><label className="field-label">Facility emergency number<input className="field-input" type="tel" defaultValue="+91 90000 00112" /></label><label className="field-label">Operating hours<input className="field-input" defaultValue="24 hours · three shifts" /></label><label className="field-label">Primary muster point<input className="field-input" defaultValue="East car park" /></label><label className="field-label">First-aid location<input className="field-input" defaultValue="Admin block · ground floor" /></label><label className="field-label">Safety officer<input className="field-input" defaultValue="Demo Safety Lead" /></label></div><button onClick={() => onToast("Facility settings saved in the pilot workspace")} className="button-primary mt-6">Save facility</button></section><aside className="panel overflow-hidden"><SectionHeading title="Zones and buildings" detail={`${zones.length} active zones`} /><div className="divide-y divide-[#d3d2ca]">{zones.map((zone, index) => <div key={zone} className="flex items-center justify-between gap-3 p-4"><span className="text-sm font-bold">{zone}</span><span className="font-mono text-[9px] uppercase text-[#777c72]">Z-{String(index + 1).padStart(2, "0")}</span></div>)}</div><div className="flex gap-2 border-t border-[#d3d2ca] p-4"><input aria-label="New zone" value={newZone} onChange={(event) => setNewZone(event.target.value)} className="field-input mt-0 min-w-0" placeholder="Add a zone" /><button onClick={() => { if (!newZone.trim()) return; setZones((current) => [...current, newZone]); setNewZone(""); onToast("Zone added"); }} className="button-primary min-h-12 px-4"><Plus size={18} /></button></div></aside></div>;
}

function PlanManager({ onToast }: { onToast: (message: string) => void }) {
  const [plans, setPlans] = useState([
    { name: "Fire / Smoke", icon: Fire, first: "ERT + shift supervisor", timeout: 30, external: true },
    { name: "Chemical / Gas", icon: Warning, first: "Hazmat team + EHS", timeout: 25, external: true },
    { name: "Security Threat", icon: ShieldCheck, first: "Plant security", timeout: 20, external: true },
    { name: "Medical Emergency", icon: FirstAid, first: "On-site first aid", timeout: 20, external: true },
  ]);
  return <section className="panel overflow-hidden"><SectionHeading title="Response plans" detail="Configure the first notification, acknowledgement target and external-assistance permission" /><div className="divide-y divide-[#d3d2ca]">{plans.map((plan) => { const Icon = plan.icon; return <article key={plan.name} className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_180px_auto] sm:items-center"><div className="grid h-11 w-11 place-items-center bg-[#eceee6]"><Icon size={22} weight="fill" /></div><div><strong className="font-display">{plan.name}</strong><input aria-label={`${plan.name} first recipients`} value={plan.first} onChange={(event) => setPlans((current) => current.map((item) => item.name === plan.name ? { ...item, first: event.target.value } : item))} className="mt-2 w-full border-b border-[#aeb1a8] bg-transparent py-1 text-sm" /></div><label className="text-xs font-bold">Acknowledge within<div className="mt-2 flex items-center gap-2"><input type="number" min={10} max={300} value={plan.timeout} onChange={(event) => setPlans((current) => current.map((item) => item.name === plan.name ? { ...item, timeout: Number(event.target.value) } : item))} className="w-20 border border-[#aeb1a8] bg-white p-2 text-base" /> seconds</div></label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={plan.external} onChange={(event) => setPlans((current) => current.map((item) => item.name === plan.name ? { ...item, external: event.target.checked } : item))} className="h-5 w-5 accent-[#171915]" /> External help allowed</label></article>; })}</div><div className="border-t border-[#d3d2ca] p-5"><button onClick={() => onToast("Response plans saved in the pilot workspace")} className="button-primary">Save response plans</button></div></section>;
}

function NotificationManager({ onToast }: { onToast: (message: string) => void }) {
  const [deliveries, setDeliveries] = useState([
    { channel: "In-app and realtime", delivered: 12, failed: 0, state: "Connected" },
    { channel: "PWA push", delivered: 8, failed: 2, state: "Pilot setup" },
    { channel: "SMS", delivered: 0, failed: 0, state: "Not connected" },
    { channel: "Voice call", delivered: 0, failed: 0, state: "Not connected" },
    { channel: "WhatsApp", delivered: 0, failed: 0, state: "Approval required" },
  ]);
  const retry = () => { setDeliveries((current) => current.map((item) => item.failed ? { ...item, failed: 0, delivered: item.delivered + item.failed, state: "Retried in demo" } : item)); onToast("Failed pilot deliveries retried"); };
  return <section className="panel overflow-hidden"><SectionHeading title="Notification center" detail="Delivery evidence and channel readiness" action={<button onClick={retry} className="button-secondary min-h-11">Retry failed</button>} /><div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{deliveries.map((item) => <article key={item.channel} className="border border-[#bfc0b8] bg-white p-5"><div className="flex items-start justify-between gap-3"><BellRinging size={24} weight="fill" /><span className="bg-[#eceee6] px-2 py-1 text-[9px] font-bold uppercase">{item.state}</span></div><h3 className="mt-5 font-display text-lg font-black">{item.channel}</h3><div className="mt-4 flex gap-5 text-sm"><span><strong className="text-[#567400]">{item.delivered}</strong> delivered</span><span><strong className="text-[#9f2d19]">{item.failed}</strong> failed</span></div></article>)}</div><div className="border-t border-[#c5a24c] bg-[#fff0bd] p-5 text-sm leading-6 text-[#574000]">The pilot UI records intended delivery states. Connect a provider and verify signed delivery receipts before representing SMS, voice, or WhatsApp as operational.</div></section>;
}

function DrillManager({ onToast }: { onToast: (message: string) => void }) {
  const [drills, setDrills] = useState([
    { name: "Smoke at production line", date: "2026-10-08 10:30", participants: 24, status: "Scheduled" },
    { name: "Warehouse medical response", date: "2026-09-28 15:00", participants: 18, status: "Complete" },
  ]);
  const [scenario, setScenario] = useState("Chemical leak isolation");
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><section className="panel overflow-hidden"><SectionHeading title="Drill program" detail="Practice the full workflow without confusing a drill with a real incident" /><div className="divide-y divide-[#d3d2ca]">{drills.map((drill) => <article key={drill.name} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><strong className="font-display">{drill.name}</strong><div className="mt-1 text-xs text-[#74796e]">{drill.date} · {drill.participants} participants</div></div><span className={`justify-self-start px-2 py-1 font-mono text-[9px] font-bold uppercase ${drill.status === "Complete" ? "bg-[#e8edda] text-[#4f6500]" : "bg-[#fff0bd] text-[#735300]"}`}>{drill.status}</span>{drill.status === "Scheduled" && <button onClick={() => { setDrills((current) => current.map((item) => item.name === drill.name ? { ...item, status: "Complete" } : item)); onToast("Drill completed — report is ready for review"); }} className="button-secondary min-h-10 px-3">Run drill</button>}</article>)}</div></section><aside className="border-2 border-[#171915] bg-[#e9ff4a] p-5 shadow-[6px_6px_0_#171915]"><div className="font-mono text-[9px] font-bold uppercase tracking-[0.17em]">Schedule drill</div><h2 className="mt-2 font-display text-2xl font-black">Clearly marked. Measurable.</h2><label className="field-label mt-5">Scenario<input value={scenario} onChange={(event) => setScenario(event.target.value)} className="field-input bg-white" /></label><label className="field-label mt-4">Date and time<input type="datetime-local" className="field-input bg-white" /></label><label className="field-label mt-4">Participant group<select className="field-input bg-white"><option>Shift A · all workers</option><option>Response teams only</option><option>Warehouse personnel</option></select></label><button onClick={() => { setDrills((current) => [{ name: scenario, date: "Date to confirm", participants: 0, status: "Scheduled" }, ...current]); onToast("Drill scheduled in the pilot workspace"); }} className="button-secondary mt-5 w-full">Schedule drill</button><div className="mt-5 border border-[#a9ba34] bg-[#f5ffad] p-3 text-xs font-semibold leading-5">Every drill carries a permanent DRILL label and separate reporting so it cannot be mistaken for a live emergency.</div></aside></div>;
}
