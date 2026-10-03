-- ZioGuard pilot security hardening.
-- Apply after 202610030001 and 202610030002.

-- Browser clients may update only non-authoritative profile fields. Account
-- status, legal/display identity, and activity timestamps remain server/admin
-- controlled.
revoke update on table public.profiles from authenticated;
grant update (phone, avatar_url, preferred_language)
  on table public.profiles to authenticated;

-- Every existing RLS policy and incident RPC relies on this helper. Include
-- profile and organization state so a suspended user cannot bypass the UI with
-- a previously issued session while an active membership row still exists.
create or replace function public.has_org_role(
  target_org uuid,
  allowed_roles public.membership_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = target_org
      and membership.user_id = auth.uid()
      and membership.active
      and profile.account_status = 'active'
      and organization.active
      and (allowed_roles is null or membership.role = any(allowed_roles))
  );
$$;

revoke all on function public.has_org_role(uuid, public.membership_role[]) from public;
grant execute on function public.has_org_role(uuid, public.membership_role[]) to authenticated;

-- All incident lifecycle changes must pass through reviewed security-definer
-- RPCs so validation and audit events cannot be bypassed.
revoke insert, update, delete on table public.incidents from authenticated;
revoke insert, update, delete on table public.incident_events from authenticated;
revoke insert, update, delete on table public.incident_assignments from authenticated;

-- The original member-read policies remain the permissive organization
-- boundary. These restrictive policies add the role/ownership boundary.
create policy incidents_read_role_scope on public.incidents
as restrictive for select to authenticated
using (
  created_by = auth.uid()
  or public.has_org_role(
    organization_id,
    array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]
  )
);

create policy incident_events_read_role_scope on public.incident_events
as restrictive for select to authenticated
using (
  public.has_org_role(
    organization_id,
    array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]
  )
  or exists (
    select 1
    from public.incidents incident
    where incident.id = incident_events.incident_id
      and incident.created_by = auth.uid()
  )
);

create policy incident_assignments_read_role_scope on public.incident_assignments
as restrictive for select to authenticated
using (
  public.has_org_role(
    organization_id,
    array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]
  )
  or exists (
    select 1
    from public.incidents incident
    where incident.id = incident_assignments.incident_id
      and incident.created_by = auth.uid()
  )
);

create policy response_team_members_read_role_scope on public.response_team_members
as restrictive for select to authenticated
using (
  public.has_org_role(
    organization_id,
    array['responder', 'company_admin', 'control_room', 'system_admin']::public.membership_role[]
  )
);

-- Replace the incident RPC so a worker or responder can create an incident
-- only at the facility explicitly assigned to that membership. Organization
-- administrators retain organization-wide access.
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

  select facility.organization_id into target_org
  from public.facilities facility
  where facility.id = target_facility and facility.active;

  if target_org is null then raise exception 'Facility not found or inactive'; end if;

  if not exists (
    select 1
    from public.memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = target_org
      and membership.user_id = auth.uid()
      and membership.active
      and profile.account_status = 'active'
      and organization.active
      and (
        membership.role in ('company_admin', 'system_admin')
        or (
          membership.role in ('worker', 'responder')
          and membership.facility_id = target_facility
        )
      )
  ) then
    raise exception 'Not authorized for this facility';
  end if;

  if char_length(trim(coalesce(incident_zone, ''))) < 2 then
    raise exception 'A valid incident zone is required';
  end if;

  select profile.display_name into actor_name
  from public.profiles profile
  where profile.id = auth.uid() and profile.account_status = 'active';

  if actor_name is null then raise exception 'Active profile required'; end if;

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

revoke all on function public.create_incident(
  uuid, public.incident_category, public.incident_severity, text, text, text, numeric, numeric, integer
) from public;
grant execute on function public.create_incident(
  uuid, public.incident_category, public.incident_severity, text, text, text, numeric, numeric, integer
) to authenticated;
