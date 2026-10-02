create extension if not exists pgcrypto;

create type public.membership_role as enum (
  'worker',
  'responder',
  'company_admin',
  'control_room',
  'system_admin'
);

create type public.incident_category as enum ('fire', 'hazmat', 'security', 'medical');
create type public.incident_status as enum ('triggered', 'acknowledged', 'dispatched', 'on_scene', 'resolved', 'cancelled');
create type public.incident_severity as enum ('medium', 'high', 'critical');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 160),
  address_label text,
  emergency_number text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  facility_id uuid references public.facilities(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create sequence public.incident_reference_seq start 1000;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  category public.incident_category not null,
  severity public.incident_severity not null,
  status public.incident_status not null default 'triggered',
  zone text not null check (char_length(zone) between 2 and 160),
  location_label text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_accuracy_m integer check (location_accuracy_m is null or location_accuracy_m >= 0),
  description text not null default '' check (char_length(description) <= 1000),
  people_at_risk integer check (people_at_risk is null or people_at_risk >= 0),
  external_assistance_requested boolean not null default false,
  acknowledged_at timestamptz,
  dispatched_at timestamptz,
  on_scene_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_type text not null check (event_type in ('triggered', 'acknowledged', 'dispatched', 'on_scene', 'resolved', 'cancelled', 'escalated', 'note')),
  label text not null check (char_length(label) between 2 and 180),
  detail text not null default '' check (char_length(detail) <= 2000),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text not null check (char_length(actor_label) between 2 and 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index incidents_org_status_created_idx on public.incidents (organization_id, status, created_at desc);
create index incidents_facility_created_idx on public.incidents (facility_id, created_at desc);
create index incident_events_incident_created_idx on public.incident_events (incident_id, created_at asc);
create index memberships_user_active_idx on public.memberships (user_id, active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger incidents_set_updated_at before update on public.incidents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'ZioGuard user'));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_org_role(target_org uuid, allowed_roles public.membership_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.active
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

revoke all on function public.has_org_role(uuid, public.membership_role[]) from public;
grant execute on function public.has_org_role(uuid, public.membership_role[]) to authenticated;

create or replace function public.make_incident_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'ZG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.incident_reference_seq')::text, 6, '0');
$$;

create or replace function public.create_incident(
  target_facility uuid,
  incident_category public.incident_category,
  incident_severity public.incident_severity,
  incident_zone text,
  incident_description text default '',
  incident_location_label text default null,
  incident_latitude numeric default null,
  incident_longitude numeric default null,
  incident_accuracy_m integer default null
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  actor_name text;
  created_incident public.incidents;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select f.organization_id into target_org
  from public.facilities f
  where f.id = target_facility and f.active;

  if target_org is null then raise exception 'Facility not found or inactive'; end if;
  if not public.has_org_role(target_org, array['worker', 'responder', 'company_admin', 'system_admin']::public.membership_role[]) then
    raise exception 'Not authorized for this facility';
  end if;

  select p.display_name into actor_name from public.profiles p where p.id = auth.uid();

  insert into public.incidents (
    reference, organization_id, facility_id, created_by, category, severity, zone,
    description, location_label, latitude, longitude, location_accuracy_m
  ) values (
    public.make_incident_reference(), target_org, target_facility, auth.uid(), incident_category,
    incident_severity, trim(incident_zone), left(coalesce(incident_description, ''), 1000),
    incident_location_label, incident_latitude, incident_longitude, incident_accuracy_m
  ) returning * into created_incident;

  insert into public.incident_events (
    incident_id, organization_id, event_type, label, detail, actor_user_id, actor_label
  ) values (
    created_incident.id, target_org, 'triggered', 'Emergency alert triggered',
    'Incident created from the authenticated worker application.', auth.uid(), actor_name
  );

  return created_incident;
end;
$$;

create or replace function public.transition_incident(
  target_incident uuid,
  next_status public.incident_status,
  event_detail text default ''
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_incident public.incidents;
  actor_name text;
begin
  select * into current_incident from public.incidents where id = target_incident for update;
  if current_incident.id is null then raise exception 'Incident not found'; end if;
  if not public.has_org_role(current_incident.organization_id, array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]) then
    raise exception 'Not authorized to transition this incident';
  end if;

  if not (
    (current_incident.status = 'triggered' and next_status in ('acknowledged', 'cancelled')) or
    (current_incident.status = 'acknowledged' and next_status in ('dispatched', 'cancelled')) or
    (current_incident.status = 'dispatched' and next_status = 'on_scene') or
    (current_incident.status = 'on_scene' and next_status = 'resolved')
  ) then raise exception 'Invalid incident transition from % to %', current_incident.status, next_status; end if;

  select p.display_name into actor_name from public.profiles p where p.id = auth.uid();

  update public.incidents set
    status = next_status,
    acknowledged_at = case when next_status = 'acknowledged' then now() else acknowledged_at end,
    dispatched_at = case when next_status = 'dispatched' then now() else dispatched_at end,
    on_scene_at = case when next_status = 'on_scene' then now() else on_scene_at end,
    resolved_at = case when next_status in ('resolved', 'cancelled') then now() else resolved_at end,
    version = version + 1
  where id = target_incident
  returning * into current_incident;

  insert into public.incident_events (
    incident_id, organization_id, event_type, label, detail, actor_user_id, actor_label
  ) values (
    current_incident.id, current_incident.organization_id, next_status::text,
    initcap(replace(next_status::text, '_', ' ')), left(coalesce(event_detail, ''), 2000),
    auth.uid(), actor_name
  );

  return current_incident;
end;
$$;

create or replace function public.request_external_assistance(target_incident uuid, request_detail text default '')
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_incident public.incidents;
  actor_name text;
begin
  select * into current_incident from public.incidents where id = target_incident for update;
  if current_incident.id is null then raise exception 'Incident not found'; end if;
  if not public.has_org_role(current_incident.organization_id, array['company_admin', 'control_room', 'system_admin']::public.membership_role[]) then
    raise exception 'Not authorized to request external assistance';
  end if;
  if current_incident.external_assistance_requested then return current_incident; end if;

  select p.display_name into actor_name from public.profiles p where p.id = auth.uid();
  update public.incidents set external_assistance_requested = true, version = version + 1
  where id = target_incident returning * into current_incident;

  insert into public.incident_events (
    incident_id, organization_id, event_type, label, detail, actor_user_id, actor_label
  ) values (
    current_incident.id, current_incident.organization_id, 'escalated', 'External assistance requested',
    left(coalesce(request_detail, ''), 2000), auth.uid(), actor_name
  );
  return current_incident;
end;
$$;

revoke all on function public.create_incident(uuid, public.incident_category, public.incident_severity, text, text, text, numeric, numeric, integer) from public;
revoke all on function public.transition_incident(uuid, public.incident_status, text) from public;
revoke all on function public.request_external_assistance(uuid, text) from public;
grant execute on function public.create_incident(uuid, public.incident_category, public.incident_severity, text, text, text, numeric, numeric, integer) to authenticated;
grant execute on function public.transition_incident(uuid, public.incident_status, text) to authenticated;
grant execute on function public.request_external_assistance(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.facilities enable row level security;
alter table public.memberships enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy organizations_read_member on public.organizations for select to authenticated using (public.has_org_role(id));
create policy facilities_read_member on public.facilities for select to authenticated using (public.has_org_role(organization_id));
create policy memberships_read_authorized on public.memberships for select to authenticated using (
  user_id = auth.uid() or public.has_org_role(organization_id, array['company_admin', 'system_admin']::public.membership_role[])
);
create policy incidents_read_member on public.incidents for select to authenticated using (public.has_org_role(organization_id));
create policy events_read_member on public.incident_events for select to authenticated using (public.has_org_role(organization_id));

alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.incident_events;
