# ZioGuard pilot functionality and testing guide

Last verified locally: 2026-10-03 (Asia/Calcutta)

## 1. Current product boundary

ZioGuard currently combines two implementation levels:

1. **Connected:** Supabase email/password authentication, active profiles, organization/facility memberships, and role-based workspace routing.
2. **Demonstration:** incidents, acknowledgements, dispatch, attachments, notifications, dashboards, maps, analytics, configuration, and escalation are interactive browser-local simulations.

It is suitable for an investor walkthrough and controlled usability testing. It is not yet a live emergency dispatch system and does not contact police, fire, ambulance, SMS, WhatsApp, voice providers, or 112 automatically.

## 2. Pilot personas

| Persona | Database role | Landing workspace | Purpose |
| --- | --- | --- | --- |
| Pilot Client | `worker` | Emergency | Raise an alert, immediately return home, and review status separately |
| Pilot Administrator | `company_admin` | Company command | Coordinate, progress, escalate, configure, and review |
| Police Control Operator | `control_room` | Regional view | Review escalations and regional resource context |

All three profiles are active and assigned to **ZioGuard Pilot Organization → ZioGuard Pilot Facility**.

Credentials are deliberately not stored in Git or this guide. Rotate the initially shared passwords before a demonstration is recorded or shared.

## 3. Demonstrated response flow

```text
Client chooses one of four emergencies
  → confirmation sheet gathers zone, GPS/facility location, detail, voice note
  → client confirms
  → browser creates incident and returns the client to the four emergency choices
  → a compact success receipt provides the incident ID and a My incidents shortcut
  → demo acknowledgement and dispatch continue in the background
  → administrator reviews, adds command notes, advances status, or requests external help
  → the police/control room sees company activity, dispatches a simulated unit, and reviews communication activity
  → incident can progress to on scene and resolved
  → analytics, company history, and CSV export reflect the browser-local record
```

### Critical testing constraint

The incident store is currently `localStorage`, not Supabase. Therefore:

- Test the client, administrator, and police sequence **in the same browser profile** by signing out and signing in as the next persona.
- A different browser, private window, device, or phone will have a different incident dataset.
- Simultaneous multi-device updates and Supabase Realtime are not implemented yet.
- Voice notes and photo/audio attachments remain only in memory and are intentionally removed from persistent browser storage.

## 4. Authentication test

Set this in `.env.local` and restart the development server:

```env
NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=true
```

Test each persona separately:

1. Open the application while signed out.
2. Confirm the intro page explains the worker, company-admin, and control-room workspaces.
3. Select **Continue to sign in** and confirm there is no public registration option.
4. Enter an incorrect password; expect the generic access error.
5. Sign in with the client account; expect **Emergency** and worker-only navigation.
6. Confirm the role switcher is absent.
7. Refresh the page; expect the session and assigned workspace to remain.
8. Sign out using the desktop sidebar and repeat using the mobile header.
9. Sign in with the administrator; expect **Company command**.
10. Sign in with the police account; expect **Regional view**.
11. Confirm neither privileged account can switch itself into another role.

Expected security behavior:

- Inactive, suspended, or membership-less users stop at **Assignment required**.
- The UI role is derived from the active Supabase membership.
- UI routing is not the security boundary; Supabase RLS and reviewed RPCs must remain enabled.

## 5. Client/worker emergency test

### Emergency selection

1. Sign in as the client persona.
2. Confirm only these four large options are present:
   - FIRE
   - HAZMAT
   - SECURITY
   - AMBULANCE
3. Confirm there is no separate giant red alert button.
4. Tap a category; expect the confirmation sheet immediately.
5. Press **Go back**; confirm no incident is created.

### Confirmation sheet

Verify it displays:

- authenticated worker name and employee ID;
- organization, facility, department, and shift;
- selected operational zone;
- device or facility location source;
- GPS accuracy when available;
- intended recipients;
- optional 240-character detail;
- optional voice recording, limited to 20 seconds;
- explicit warning that public authorities are not contacted.

Location cases:

1. Allow location permission; expect coordinates and an accuracy value.
2. Deny permission; expect the registered-facility fallback and no blocked alert.
3. Select **Use facility location**; expect the facility label.
4. Select **Refresh GPS**; expect a new device request.

Voice cases:

1. Allow microphone permission, record, stop, and play the preview.
2. Deny microphone permission; expect a non-blocking message and continued alert access.
3. Leave voice blank; confirmation must still work.

### Incident confirmation and home return

1. Add a short detail and press **Confirm and alert team**.
2. Expect the confirmation sheet to close immediately and the four emergency choices to remain available.
3. Expect a compact **Alert sent** receipt with a generated `ZG-YYYY-NNNNNN` incident ID.
4. Confirm another emergency can be started immediately; the worker is not trapped on a live-tracker page.
5. Select **View My incidents** and open the new record to inspect delivery state, timeline, location, response status, and safety guidance.
6. At about 4.2 seconds, expect the background demo acknowledgement and an assigned response team.
7. At about 9 seconds, expect **Team dispatched** in My incidents.
8. Test **Call 112** on a suitable mobile test device; desktop systems may only open a compatible calling application.

### False-alert handling

1. Open the incident from **My incidents**, then press **Report false alert**.
2. Press **Keep incident open**; expect no change.
3. Reopen and press **Confirm false alert**.
4. Expect status **False alert closed** and a retained timeline entry.

### Worker navigation

- **My incidents:** test All, Active, Previous, and Drills filters.
- **Safety card:** verify facility, shift, zone, muster point, first aid, chemical guidance, facility call, and 112 actions.
- **Profile:** verify authenticated organization and facility; profile edits currently remain browser-local rather than updating Supabase.

## 6. Administrator/company-command test

Use the same browser profile so it can read the incident created during the client test.

1. Sign out from the client account and sign in as the administrator.
2. Confirm landing page **Company command**.
3. Verify active-incident, acknowledgement, external-request, and team-readiness metrics.
4. Verify the action-required panel and oldest-incident shortcut.
5. Open an incident and confirm:
   - category, severity/status, facility, zone, worker, elapsed time, location;
   - incident commander and response team;
   - intended notification recipients;
   - attachments and complete timeline.
6. Add an internal command note; expect a new timeline entry.
7. Use the lifecycle action repeatedly to test:
   - Triggered → Acknowledged
   - Acknowledged → Team dispatched
   - Team dispatched → Team on scene
   - Team on scene → Resolved
8. On an un-escalated incident, select **Request external help**.
9. Confirm the incident receives the control-room label and remains clearly described as a pilot request.

### Administrator navigation

- **Incidents:** test All, Active, and Resolved filters.
- **People & units:** test People, Response teams, Facilities, Response plans, Notifications, and Drills tabs.
- **People:** search, prepare an invite, activate/deactivate a sample user, and validate a CSV. No real invite is sent.
- **Response teams:** create a sample team and change availability.
- **Facilities:** edit pilot facility/contact values and create sample zones.
- **Response plans:** change first recipients, acknowledgement targets, and external-help settings.
- **Notifications:** test the simulated failed-delivery retry.
- **Drills:** schedule and complete a sample drill.
- **Response review:** inspect acknowledgement, assignment, arrival, delivery, unresolved, escalation, false-alert, and drill metrics. Displayed performance numbers are demonstration values.
- **Pilot setup:** confirm the Supabase schema-readiness card, integration boundaries, and sample-data reset.
- **Demo controller:** start any scenario, enable Drill mode, open the latest incident, and reset the demonstration.

Management changes in this workspace are local/in-memory pilot interactions. They do not yet update the corresponding Supabase tables.

## 7. Police/control-room test

Use the same browser profile after creating incidents as the worker. External escalation is not required for an active alert to appear in the control-room view.

1. Sign out and sign in as the police persona.
2. Confirm landing page **Regional view**.
3. Verify all active company incidents appear in the regional coordination queue.
4. Open **All companies**, search a company, and inspect its active, resolved, and total incident counts.
5. Open **Dispatch desk**, select an incident, confirm the category-based recommended unit, and assign it.
6. Confirm the incident timeline records the simulated dispatch assignment.
7. Review the inbound/outbound AI voice, SMS, and callback activity preview.
8. Confirm the visible boundary stating that no real AI call or Twilio message is sent.
9. Open **History & CSV**, search closed records, review response time and assigned unit, and download the CSV.
10. Open **Resources** and verify the sample fire, medical, and police resource cards.
11. Confirm the visible warning that resource counts are planning samples and not confirmed public capacity.

No action in this workspace currently dispatches or messages a public authority.

## 8. Offline and PWA test

1. Test on `localhost` or HTTPS so service workers, location, microphone, and installation APIs are available.
2. Select **Install pilot app** or use the browser's install/add-to-home-screen command.
3. Reload once online so the application shell is cached.
4. Disconnect the network and reopen the installed app.
5. Confirm the interface and safety card load.
6. Confirm an offline warning appears and emergency category buttons are disabled.
7. Confirm the app never reports an offline alert as delivered.
8. Restore the network and confirm the controls become available.

## 9. Responsive and accessibility test

Test at approximately 390 px, tablet width, and desktop width:

- no horizontal overflow;
- four emergency choices remain large and readable;
- confirmation sheet remains scrollable;
- bottom mobile navigation does not cover actions;
- desktop sidebar remains usable;
- visible keyboard focus;
- Escape closes dialogs when recording is not active;
- dialog headings and buttons have accessible labels;
- minimum touch targets remain comfortable;
- reduced-motion operating-system preference is respected.

Also test with keyboard only and at 200% browser zoom.

## 10. Database hardening verification

The persona screenshot confirms profile and membership provisioning. It does **not** prove migration 003 was applied. Run this in the Supabase SQL Editor:

```sql
select policyname, permissive, cmd
from pg_policies
where schemaname = 'public'
  and policyname in (
    'incidents_read_role_scope',
    'incident_events_read_role_scope',
    'incident_assignments_read_role_scope',
    'response_team_members_read_role_scope'
  )
order by policyname;

select
  has_table_privilege('authenticated', 'public.incidents', 'UPDATE') as can_directly_update_incidents,
  has_table_privilege('authenticated', 'public.incident_events', 'INSERT') as can_directly_insert_events,
  has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE') as can_change_own_account_status;
```

Expected:

- four policy rows, each marked `RESTRICTIVE`;
- all three privilege checks return `false`.

Before external testing, also disable project-wide signup, disable anonymous sign-in, configure a strong password policy, and rotate the three initially shared passwords.

## 11. Automated local verification

From the project root:

```bash
pnpm install
pnpm test
pnpm lint
pnpm build
```

For npm users, run `npm run dev` during development. After `npm run build`, use `npm start` to preview the generated production build at `http://localhost:4173`.

Current evidence on 2026-10-03:

- lifecycle, approved-label, and control-room dispatch tests: 7 passed;
- ESLint: passed;
- TypeScript production compilation: passed;
- Vite production build: passed;
- 4,608 modules transformed successfully;
- browser/manual visual verification was not performed for this change set.

## 12. Investor demonstration script

Recommended five-minute sequence:

1. Client logs in and selects FIRE.
2. Show identity, zone, GPS/facility fallback, recipients, optional detail, and confirmation.
3. Confirm and show the immediate return to the four emergency choices; use **My incidents** to show the background acknowledgement, dispatch, safety instructions, and timeline.
4. Sign out and enter the administrator workspace in the same browser.
5. Open the organization-scoped incident, add a note, and show the response lifecycle.
6. Sign out and enter the police workspace in the same browser.
7. Show the all-company view, dispatch a suitable unit, and explain the simulated voice/SMS audit trail.
8. Show historical response times and download the CSV.
9. Return to the administrator's response review and explain which metrics will become measured pilot evidence.
10. Close by showing Pilot setup and stating which integrations are connected versus planned.

Never describe the current simulation as live dispatch, realtime multi-device coordination, or confirmed notification delivery.

## 13. Pass criteria for this build

The investor/demo build passes when:

- all three accounts authenticate and route to the correct workspace;
- role switching is unavailable after login;
- worker emergency confirmation, fallback location, immediate home return, and My incidents status access work;
- incident simulation progresses without UI errors;
- company-scoped command views, status changes, control-room dispatch, history, and CSV export work in one browser profile;
- offline mode cannot claim delivery;
- sign-out works on mobile and desktop;
- tests, lint, and production build pass;
- the interface always identifies the pilot/public-dispatch boundary.

It is not ready for a live operational pilot until Supabase incident persistence, Realtime, real notification receipts, private attachment storage, responder dispatch, monitoring, backups, MFA, jurisdiction rules, and governance approvals are complete.
