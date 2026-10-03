import { Buildings, LockKey, ShieldCheck, SignIn, SignOut, UsersThree, Warning } from "@phosphor-icons/react";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase, supabaseAuthRequired, supabaseConfigured } from "./supabase";

export type AuthMembershipRole = "worker" | "responder" | "company_admin" | "control_room" | "system_admin";

export interface AuthIdentity {
  displayName: string;
  phone: string;
  employeeId: string;
  organization: string;
  facility: string;
  department: string;
  shift: string;
  emergencyRole: string;
  preferredLanguage: string;
  role: AuthMembershipRole;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  identity: AuthIdentity | null;
  loading: boolean;
  required: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, identity: null, loading: false, required: false, configured: false, signOut: async () => undefined });

async function loadIdentity(user: User): Promise<AuthIdentity | null> {
  if (!supabase) return null;
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name, phone, preferred_language, account_status").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("employee_id, department, shift_label, emergency_role, role, organization_id, facility_id").eq("user_id", user.id).eq("active", true),
  ]);
  const rolePriority: Record<AuthMembershipRole, number> = { system_admin: 5, control_room: 4, company_admin: 3, responder: 2, worker: 1 };
  const membership = memberships
    ?.slice()
    .sort((left, right) => (
      rolePriority[right.role as AuthMembershipRole] - rolePriority[left.role as AuthMembershipRole]
      || left.organization_id.localeCompare(right.organization_id)
    ))[0];
  if (!membership || profile?.account_status !== "active") return null;
  const [{ data: organization }, { data: facility }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", membership.organization_id).maybeSingle(),
    membership.facility_id ? supabase.from("facilities").select("name").eq("id", membership.facility_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    displayName: profile?.display_name ?? user.user_metadata.display_name ?? user.email ?? "ZioGuard user",
    phone: profile?.phone ?? user.phone ?? "",
    employeeId: membership.employee_id ?? "Pending assignment",
    organization: organization?.name ?? "Pending organization",
    facility: facility?.name ?? "All assigned facilities",
    department: membership.department ?? "Not assigned",
    shift: membership.shift_label ?? "Not assigned",
    emergencyRole: membership.emergency_role ?? membership.role.replaceAll("_", " "),
    preferredLanguage: profile?.preferred_language ?? "English",
    role: membership.role as AuthMembershipRole,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setIdentity(nextSession?.user ? await loadIdentity(nextSession.user) : null);
      if (active) setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => applySession(nextSession), 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user: session?.user ?? null, session, identity, loading, required: supabaseAuthRequired, configured: supabaseConfigured, signOut }}>{children}</AuthContext.Provider>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.required) return children;
  if (!auth.configured) return <AuthConfigurationMissing />;
  if (auth.loading) return <AuthLoading />;
  if (!auth.session) return <PasswordSignIn />;
  if (!auth.identity) return <MembershipPending email={auth.user?.email ?? "your account"} onSignOut={auth.signOut} />;
  return children;
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-[#171915] p-4 text-[#171915]"><section className="w-full max-w-md border-2 border-[#171915] bg-[#f7f5ee] p-6 shadow-[10px_10px_0_#e9ff4a] sm:p-8"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center bg-[#e9ff4a] font-display text-xl font-black">Z</div><div><div className="font-display text-xl font-black">ZioGuard</div><div className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#6f746a]">Authorized access</div></div></div>{children}</section></main>;
}

function AuthLoading() {
  return <AuthShell><div className="mt-8 flex items-center gap-3 border border-[#c9c8c0] bg-white p-4"><span className="h-3 w-3 animate-pulse rounded-full bg-[#7d9e00]" /><strong>Checking secure session…</strong></div></AuthShell>;
}

function AuthConfigurationMissing() {
  return <AuthShell><div className="mt-8 flex items-start gap-3 border-l-4 border-[#d74328] bg-[#fee9e2] p-4"><Warning size={23} weight="fill" className="shrink-0 text-[#9f2d19]" /><div><strong>Authentication configuration is incomplete</strong><p className="mt-1 text-sm leading-5">Add the public Supabase URL and publishable key, or set the authentication requirement back to false.</p></div></div></AuthShell>;
}

function PasswordSignIn() {
  const [introVisible, setIntroVisible] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError("The email or password is incorrect, or this account is not ready for access.");
  };

  if (introVisible) {
    return <AuthShell><div className="mt-8"><ShieldCheck size={32} weight="fill" /><h1 className="mt-4 font-display text-4xl font-black tracking-[-0.05em]">One emergency. One coordinated response.</h1><p className="mt-3 text-sm leading-6 text-[#62675d]">ZioGuard connects the reporting worker, company response desk, and authorized control room through role-specific workspaces.</p></div><div className="mt-7 grid gap-3"><div className="flex items-center gap-3 border border-[#c9c8c0] bg-white p-4"><UsersThree size={24} weight="fill" /><div><strong className="block">Worker / Client</strong><span className="text-xs text-[#6f746a]">Raise FIRE, HAZMAT, SECURITY, or AMBULANCE alerts.</span></div></div><div className="flex items-center gap-3 border border-[#c9c8c0] bg-white p-4"><Buildings size={24} weight="fill" /><div><strong className="block">Company Admin</strong><span className="text-xs text-[#6f746a]">Acknowledge, coordinate, monitor, and review.</span></div></div><div className="flex items-center gap-3 border border-[#c9c8c0] bg-white p-4"><ShieldCheck size={24} weight="fill" /><div><strong className="block">Police / Control Room</strong><span className="text-xs text-[#6f746a]">Monitor companies, dispatch units, and track resolution.</span></div></div></div><button onClick={() => setIntroVisible(false)} className="button-primary mt-7 w-full"><SignIn size={20} weight="bold" /> Continue to sign in</button><p className="mt-5 text-xs leading-5 text-[#74796e]">Pilot platform · not connected to public emergency dispatch. For immediate danger, use the local alarm and call 112.</p></AuthShell>;
  }

  return <AuthShell><button type="button" onClick={() => setIntroVisible(true)} className="mt-7 min-h-11 text-sm font-bold underline decoration-2 underline-offset-4">← Back to introduction</button><div className="mt-5"><LockKey size={30} weight="fill" /><h1 className="mt-4 font-display text-3xl font-black tracking-[-0.04em]">Sign in to ZioGuard</h1><p className="mt-2 text-sm leading-6 text-[#62675d]">Use your individually assigned pilot account. Public registration is not available.</p></div><form onSubmit={handleSignIn} className="mt-7 space-y-5"><label className="field-label">Work email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" placeholder="name@organization.com" /></label><label className="field-label">Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-input" placeholder="Enter your password" /></label><button disabled={busy || password.length < 8} className="button-primary w-full"><SignIn size={20} weight="bold" />{busy ? "Checking access…" : "Sign in securely"}</button></form>{error && <div role="alert" className="mt-5 border border-[#d74328] bg-[#fee9e2] p-3 text-sm font-semibold text-[#8b2918]">{error}</div>}<p className="mt-4 text-xs leading-5 text-[#74796e]">For this controlled pilot, password resets are handled by the designated administrator. Never share a login.</p><p className="mt-3 text-xs leading-5 text-[#74796e]">Emergency access must never depend only on this application. Use the local alarm or call 112 for immediate public emergency assistance.</p></AuthShell>;
}

function MembershipPending({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return <AuthShell><div className="mt-8"><Warning size={30} weight="fill" className="text-[#c38b00]" /><h1 className="mt-4 font-display text-3xl font-black">Assignment required</h1><p className="mt-3 text-sm leading-6 text-[#62675d]">{email} is authenticated, but no active organization membership was found. Ask a company administrator to approve the account and assign a facility.</p><button onClick={onSignOut} className="button-secondary mt-6 w-full"><SignOut size={19} /> Sign out</button></div></AuthShell>;
}
