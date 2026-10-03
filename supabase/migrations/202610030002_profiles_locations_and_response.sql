-- ZioGuard pilot: richer identities, indoor location layers, response teams,
-- device readiness, assignments, and notification delivery evidence.

create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.training_status as enum ('current', 'expiring', 'required');
create type public.responder_availability as enum ('available', 'busy', 'off_duty');
create type public.notification_state as enum ('queued', 'sent', 'delivered', 'failed', 'acknowledged');

alter table public.profiles
  add column avatar_url text,
  add column preferred_language text not null default 'English',
  add column account_status public.account_status not null default 'pending',
  add column last_seen_at timestamptz;

alter table public.memberships
  add column employee_id text,
  add column department text,
  add column shift_label text,
  add column emergency_role text,
  add column training_status public.training_status not null default 'required',
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null;

create unique index memberships_org_employee_unique
  on public.memberships (organization_id, employee_id)
  where employee_id is not null;

create table public.facility_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  code text not null check (char_length(code) between 1 and 40),
  floor_label text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  qr_token uuid not null default gen_random_uuid(),
  muster_point boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (facility_id, code),
  unique (qr_token)
);

alter table public.incidents
  add column zone_id uuid references public.facility_zones(id) on delete set null,
  add column location_source text check (location_source is null or location_source in ('profile', 'zone', 'device', 'qr', 'manual')),
  add column is_drill boolean not null default false;

create table public.response_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  capabilities public.incident_category[] not null default '{}',
  base_zone_id uuid references public.facility_zones(id) on delete set null,
  availability public.responder_availability not null default 'off_duty',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (facility_id, name)
);

create table public.response_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.response_teams(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  skills text[] not null default '{}',
  equipment text[] not null default '{}',
  certification_expires_at date,
  availability public.responder_availability not null default 'off_duty',
  last_check_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, membership_id)
);

create table public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.response_teams(id) on delete set null,
  responder_membership_id uuid references public.memberships(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  arrived_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  device_label text,
  pwa_installed boolean not null default false,
  notification_permission text check (notification_permission is null or notification_permission in ('default', 'granted', 'denied')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('in_app', 'push', 'sms', 'voice', 'email', 'whatsapp')),
  state public.notification_state not null default 'queued',
  provider_reference text,
  failure_reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index facility_zones_facility_active_idx on public.facility_zones (facility_id, active);
create index response_teams_facility_availability_idx on public.response_teams (facility_id, availability);
create index response_team_members_team_availability_idx on public.response_team_members (team_id, availability);
create index incident_assignments_incident_idx on public.incident_assignments (incident_id, created_at);
create index notification_deliveries_incident_state_idx on public.notification_deliveries (incident_id, state);

create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries
for each row execute function public.set_updated_at();

alter table public.facility_zones enable row level security;
alter table public.response_teams enable row level security;
alter table public.response_team_members enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.device_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy facility_zones_read_member on public.facility_zones for select to authenticated
using (public.has_org_role(organization_id));
create policy facility_zones_manage_admin on public.facility_zones for all to authenticated
using (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]))
with check (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]));

create policy response_teams_read_member on public.response_teams for select to authenticated
using (public.has_org_role(organization_id));
create policy response_teams_manage_admin on public.response_teams for all to authenticated
using (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]))
with check (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]));

create policy response_team_members_read_member on public.response_team_members for select to authenticated
using (public.has_org_role(organization_id));
create policy response_team_members_manage_admin on public.response_team_members for all to authenticated
using (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]))
with check (public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[]));

create policy incident_assignments_read_member on public.incident_assignments for select to authenticated
using (public.has_org_role(organization_id));
create policy incident_assignments_manage_response on public.incident_assignments for all to authenticated
using (public.has_org_role(organization_id, array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]))
with check (public.has_org_role(organization_id, array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]));

create policy device_subscriptions_manage_own on public.device_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notification_deliveries_read_operations on public.notification_deliveries for select to authenticated
using (public.has_org_role(organization_id, array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]));

create policy profiles_read_org_admin on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.memberships target_membership
    where target_membership.user_id = profiles.id
      and public.has_org_role(target_membership.organization_id, array['company_admin', 'system_admin']::public.membership_role[])
  )
);

alter publication supabase_realtime add table public.incident_assignments;
alter publication supabase_realtime add table public.notification_deliveries;
