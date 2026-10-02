# Supabase handoff

The database foundation is ready in `supabase/migrations/202610030001_zioguard_pilot.sql`. It has not been applied to a remote project because no target Supabase project has been authorized in this workspace.

## What the migration provides

- Organizations and facilities for tenant isolation.
- Auth-backed user profiles and organization memberships.
- Worker, responder, company-admin, control-room, and system-admin roles.
- Incidents with guarded lifecycle timestamps and optimistic versioning.
- Append-only incident events for an auditable timeline.
- Authenticated RPCs for incident creation, lifecycle transitions, and external-assistance requests.
- Row-level security with no anonymous incident access or mutation.
- Realtime publication for incident and timeline updates.

## Connect the pilot

1. Create or select the intended Supabase project.
2. Apply the migration through the Supabase CLI or SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anonymous key.
4. Configure allowed authentication URLs for the new Vercel domain.
5. Seed one organization, facility, company administrator, worker, and responder membership.
6. Connect the frontend to Supabase Auth and the three RPCs.
7. Test worker isolation, cross-organization denial, lifecycle ordering, duplicate submissions, reconnect behavior, and realtime updates before a live drill.

Do not add a service-role key to the browser application. Do not enable anonymous insert/update policies for convenience.
