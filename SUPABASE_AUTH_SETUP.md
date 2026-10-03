# ZioGuard simple three-persona authentication setup

The pilot uses email and password sign-in. The first demonstration uses **three separate personas** so the complete response chain is visible: client reporter, company administrator, and police control-room operator. Never share one login between people. Keep `NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=false` until all three users have an active profile and membership.

## 1. Confirm the public browser variables

Keep only public values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=false
```

Remove any service-role or secret key from this frontend project's `.env.local`. A service-role key must exist only in a protected server/Edge Function environment or a short-lived administrator provisioning process. Never expose it through a `VITE_` or `NEXT_PUBLIC_` variable.

## 2. Apply the third migration

The first two migrations are already applied. In **Supabase Dashboard → SQL Editor**, run:

`supabase/migrations/202610030003_pilot_security_hardening.sql`

It protects account status, incident and audit mutations, worker incident privacy, response-team details, and assigned-facility incident creation. Run it before creating real pilot incident data.

## 3. Lock down Auth settings

In **Authentication → Sign In / Providers → Email**:

1. Keep Email enabled.
2. Turn **Allow new users to sign up** off. This is mandatory; the setting is currently enabled on the project.
3. Keep anonymous sign-ins off.
4. Set the minimum password length to at least 12 characters.
5. Require uppercase, lowercase, number, and symbol when available.
6. Enable leaked-password protection if the project plan supports it.

The app contains no sign-up form, but disabling project-wide signup protects the Auth endpoint itself.

Official references:

- <https://supabase.com/docs/guides/auth/general-configuration>
- <https://supabase.com/docs/guides/auth/password-security>

## 4. Create the demo organization and facility

Run once in the SQL Editor, replacing the uppercase values:

```sql
insert into public.organizations (name, slug)
values ('ZIOGUARD PILOT ORGANIZATION', 'zioguard-pilot')
on conflict (slug) do update set name = excluded.name;

insert into public.facilities (organization_id, name, address_label, emergency_number)
select id, 'ZIOGUARD PILOT FACILITY', 'PILOT LOCATION', '112'
from public.organizations
where slug = 'zioguard-pilot'
on conflict (organization_id, name) do update
set address_label = excluded.address_label,
    emergency_number = excluded.emergency_number;
```

This is a pilot data boundary, not evidence of integration with an official police or emergency-dispatch system.

## 5. Create three individual Auth users

For this small demonstration, use **Authentication → Users → Add user → Create new user** if that option is available:

1. Create `Pilot Administrator` for the company command and administration workspace.
2. Create `Pilot Client` for the worker emergency-reporting experience.
3. Create `Police Control Operator` for the control-room escalation experience.
4. Mark each email confirmed only after the owner has verified the address.
5. Copy each user's UUID.

If the Dashboard only offers **Send invitation**, stop there: the production invitation/set-password screen is not part of this simple flow yet. Never put a service-role key in the browser to work around it. Supabase's server-only Admin `createUser` API is the safe programmatic alternative.

Official reference: <https://supabase.com/docs/reference/javascript/auth-admin-createuser>

Use a password manager to generate and deliver credentials separately. Password reset remains administrator-managed during this demo phase.

## 6. Activate and assign each persona

Use the following role mapping:

| Persona | Membership role | Application workspace |
| --- | --- | --- |
| Pilot Administrator | `company_admin` | Company command and pilot management |
| Pilot Client | `worker` | Four-option emergency reporting and personal incidents |
| Police Control Operator | `control_room` | Regional view and escalation queue |

Run this block once per user. Replace every uppercase placeholder:

```sql
update public.profiles
set display_name = 'DISPLAY NAME',
    account_status = 'active'
where id = 'AUTH-USER-UUID';

insert into public.memberships (
  organization_id,
  user_id,
  role,
  facility_id,
  employee_id,
  department,
  shift_label,
  emergency_role,
  training_status,
  approved_at,
  active
)
select
  organization.id,
  'AUTH-USER-UUID',
  'MEMBERSHIP-ROLE'::public.membership_role,
  facility.id,
  'EMPLOYEE-ID',
  'PILOT DEPARTMENT',
  'Demo shift',
  'EMERGENCY ROLE',
  'current',
  now(),
  true
from public.organizations organization
join public.facilities facility on facility.organization_id = organization.id
where organization.slug = 'zioguard-pilot'
  and facility.name = 'ZIOGUARD PILOT FACILITY'
on conflict (organization_id, user_id, role) do update
set facility_id = excluded.facility_id,
    employee_id = excluded.employee_id,
    active = true,
    approved_at = now();
```

For the current local workspace, an exact UUID-based script is available at `supabase/pilot-users.sql.local`. It is deliberately Git-ignored and contains no passwords. Run migration 003 first, then run that local script in the Supabase SQL Editor.

## 7. Verify before enforcing login

For each account:

1. Keep `NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=false` and confirm the investor demo still loads.
2. Change it to `true`, restart the app, and sign in.
3. Confirm the client opens only the worker emergency experience.
4. Confirm the administrator opens only Company command and pilot management.
5. Confirm the police account opens only Regional view, Escalation queue, and Resources.
6. Confirm mobile navigation and Sign out are reachable in every workspace.
7. Confirm a wrong password shows a generic error.
8. Confirm a user without an active membership stops at **Assignment required**.
9. Sign out before testing the next account.

After all three pass, keep this enabled locally and in the final Vercel project:

```env
NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=true
```

## 8. Acceptance checklist

- [ ] Migration `202610030003` applied successfully
- [ ] Project-wide new-user signup disabled
- [ ] Anonymous sign-in disabled
- [ ] Strong password policy configured
- [ ] Three different emails and passwords used
- [ ] Active `company_admin`, `worker`, and `control_room` memberships created
- [ ] Each user opens only the workspace assigned above
- [ ] No authenticated user can switch role in the interface
- [ ] Sign-out works on desktop and mobile
- [ ] Unknown, inactive, and membership-less users cannot enter
- [ ] Cross-organization incident reads return no rows
- [ ] Worker accounts can read only incidents they created
- [ ] Service-role/secret keys are absent from browser environment and Git
- [ ] Initially shared demo passwords rotated before the app is demonstrated or recorded
- [ ] The pilot is labelled as not connected to public dispatch

## 9. Required before a live operational pilot

Simple password sign-in is acceptable for a controlled investor demonstration. Before real emergency operations, add:

- MFA enrollment and database enforcement (`aal2`) for privileged actions;
- self-service password recovery and forced first-login password change;
- session timeout and privileged-action reauthentication;
- jurisdiction-scoped authorization instead of only organization membership;
- server-side user provisioning and account-deactivation audit logs;
- shared realtime incidents, delivery receipts, and failover monitoring.

Official MFA reference: <https://supabase.com/docs/guides/auth/auth-mfa>
