# ZioGuard pilot implementation tracker

Last updated: 2026-10-03 (Asia/Calcutta)

This is the living handoff document for product scope, implementation status, verification evidence, external setup, and the next safe development steps.

## Current product state

ZioGuard is an installable investor and pilot demonstration for industrial incident coordination. It demonstrates the structured chain from worker report to company acknowledgement, team dispatch, escalation, resolution, and review. It is not connected to public emergency dispatch.

## Completed product work

### Worker emergency flow

- [x] Removed the separate large red alert button.
- [x] Four direct emergency choices: fire/smoke, chemical/gas, security threat, and medical emergency.
- [x] Category tap opens a mobile confirmation sheet immediately.
- [x] Confirmation displays worker, organization, facility, shift, zone, location source, accuracy, and intended recipients.
- [x] Optional text detail.
- [x] Working 20-second microphone recording with local preview.
- [x] GPS request with accuracy display.
- [x] Registered-facility fallback when GPS is denied, unavailable, or unsuitable.
- [x] Offline alerts are blocked from falsely appearing delivered.
- [x] Haptic feedback where supported.
- [x] Explicit pilot/public-dispatch boundary.

### Active worker response

- [x] Incident ID and delivery confirmation.
- [x] Live acknowledgement countdown.
- [x] Current status and progress rail.
- [x] Assigned response team.
- [x] Category-specific safety instructions.
- [x] Worker-visible timeline.
- [x] Add a text update.
- [x] Add a photo when safe.
- [x] Add an audio update through the device capture flow.
- [x] Call facility emergency number.
- [x] Call 112.
- [x] Report a false alert through a confirmation step.
- [x] False alert remains in the incident audit trail.
- [x] Investor simulation automatically demonstrates acknowledgement and dispatch.

### Worker account and safety experience

- [x] Editable pilot profile.
- [x] Name, employee ID, phone, organization, facility, department, shift, work zone, language, role, training, account, and push/PWA state.
- [x] Authenticated identity overrides locally editable organizational identity fields when Auth is required.
- [x] Personal incident filters for active, previous, and drill records.
- [x] Outcome and review state shown in worker history.
- [x] Facility-personalized safety card.
- [x] Muster point, emergency number, first-aid location, safety officer, and chemical-exposure instructions.
- [x] Offline-ready safety guidance label.
- [x] Authenticated sign-out.

### Company command experience

- [x] Active-incident priority queue.
- [x] Action-required panel for unacknowledged incidents.
- [x] Facility schematic and resource readiness.
- [x] Incident status, worker, severity, location, elapsed time, and people-at-risk information.
- [x] Incident commander and assigned-team summary.
- [x] Intended notification recipients and demo delivery receipts.
- [x] Incident attachments.
- [x] Immutable command notes.
- [x] External-assistance request with explicit simulation boundary.
- [x] Resolution and post-incident review status.

### Interactive management workspace

- [x] People search, local invite preparation, activation/deactivation, and CSV validation.
- [x] Response-team creation and availability controls.
- [x] Facility details and emergency contact configuration.
- [x] Zone creation and zone identifiers.
- [x] Per-category response-plan recipients, acknowledgement targets, and external-help permission.
- [x] Notification center with channel state, delivered/failed counts, and pilot retry action.
- [x] Drill scheduling and run completion.
- [x] Permanent DRILL labeling and separate drill reporting.

These management actions currently operate as persistent or in-session pilot interactions. Server-side invite delivery, database writes, notification providers, and file storage still require the connected implementation described below.

### Investor demonstration and analytics

- [x] Dedicated company Demo Controller.
- [x] Fire, hazmat, medical, and security scenarios.
- [x] Drill-mode switch.
- [x] Reset demonstration.
- [x] Open latest incident.
- [x] Guided five-step story.
- [x] Acknowledgement, assignment, arrival, delivery, unresolved, escalation, false-alert, and drill metrics.
- [x] Investor narrative explicitly marked as drill/demo evidence.

### PWA and accessibility

- [x] Installable manifest and service worker.
- [x] Mobile and desktop navigation.
- [x] Minimum touch-target intent.
- [x] Keyboard-accessible dialogs and Escape handling.
- [x] Visible focus states.
- [x] Reduced-motion support.
- [x] Semantic status and dialog labels.

## Supabase database state

### Applied by project owner

- [x] `202610030001_zioguard_pilot.sql`
- [x] `202610030002_profiles_locations_and_response.sql`

### Read-only verification on 2026-10-03

- [x] Auth health: HTTP 200.
- [x] `incidents`: HTTP 200.
- [x] `facility_zones`: HTTP 200.
- [x] `response_teams`: HTTP 200.
- [x] `device_subscriptions`: HTTP 200.
- [x] `notification_deliveries`: HTTP 200.

No credentials or key values were printed or committed during verification.

## Supabase Auth implementation

- [x] Official `@supabase/supabase-js` browser client installed.
- [x] Session persistence, refresh, and callback detection configured.
- [x] Simple email-and-password sign-in for the controlled pilot.
- [x] No sign-up path in the application.
- [x] Generic failed-login response to reduce account discovery.
- [x] Session listener and authenticated identity loading.
- [x] Profile, organization, facility, and active membership lookup.
- [x] Deterministic highest-authority membership selection for the simple pilot.
- [x] Pending/inactive profile or missing membership stops at Assignment required.
- [x] Authenticated membership locks the user to its application workspace.
- [x] Worker, responder, company-admin, control-room, and system-admin role mapping.
- [x] Demo remains available while Auth is optional.
- [x] Auth can be enabled with `NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=true`.
- [x] Detailed setup guide: `SUPABASE_AUTH_SETUP.md`.
- [x] Desktop and mobile account identity/sign-out controls for every authenticated role.
- [x] Photos and voice notes excluded from browser persistence.

### Public Auth settings observed on 2026-10-03

- [x] Email provider enabled.
- [x] Email auto-confirm disabled.
- [x] Phone provider disabled.
- [ ] Project-wide open sign-up is still enabled (`disable_signup=false`). The application itself prevents unknown-email creation, but the dashboard setting should also be disabled for defense in depth before pilot use.

## Simple three-account control-room setup

- [x] Application login changed to email and password.
- [x] Individual account and sign-out navigation added.
- [ ] Apply `202610030003_pilot_security_hardening.sql`.
- [ ] Disable project-wide new-user signup; it was observed enabled on 2026-10-03.
- [ ] Remove any service-role/secret key from the frontend `.env.local`.
- [ ] Configure the strong password policy.
- [ ] Create three separately named Auth users.
- [ ] Mark all three profiles active.
- [ ] Create three active `control_room` memberships.
- [ ] Test each login and sign-out while Auth remains optional.
- [ ] Set `NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=true` locally and in Vercel.

Follow `SUPABASE_AUTH_SETUP.md` in order. Do not enable Auth enforcement before the first working membership exists.

## Security hardening prepared in migration 003

- [x] Worker incident reads limited to incidents created by that worker.
- [x] Operational roles retain organization-scoped incident access.
- [x] Worker/responder incident creation limited to their assigned facility.
- [x] Browser clients prevented from directly changing incidents and audit events.
- [x] Profile account status and authoritative identity/activity fields protected from self-update.
- [x] Suspended profiles and inactive organizations rejected by the shared RLS role helper.
- [x] Response-team member details restricted to operational roles.
- [ ] Migration must still be applied and verified in the hosted Supabase project.

The application role lock is a navigation safeguard; RLS and audited RPCs are the authorization boundary.

## Connected backend work still required

- [ ] Replace local incident creation with the `create_incident` RPC.
- [ ] Replace demo status timers with authenticated responder transitions.
- [ ] Subscribe to incident, event, assignment, and delivery changes through Supabase Realtime.
- [ ] Persist profile edits through authenticated database operations.
- [ ] Implement a protected server or Edge Function for invitations.
- [ ] Upload photos and voice notes to a private Supabase Storage bucket.
- [ ] Add signed download URLs and attachment retention rules.
- [ ] Connect Web Push and store real delivery receipts.
- [ ] Connect optional test SMS/voice providers.
- [ ] Add retry queue, idempotency keys, and dead-letter handling.
- [ ] Enforce MFA AAL in RLS for privileged mutations.
- [ ] Add server-side audit records for administration changes.
- [ ] Replace single-membership auto-selection with an explicit workspace selector for approved multi-organization users.
- [ ] Add jurisdiction/control-room authority tables and incident-sharing rules.
- [ ] Add self-service password recovery and forced first-login password change.
- [ ] Add session timeout, account lockout review, and privileged reauthentication.

## Deep module and operational gap review

### Required before a real multi-user pilot (P0)

- [ ] Shared Supabase incident creation, reads, and Realtime updates; current incident activity is still local demo state.
- [ ] Server-side idempotency for duplicate taps/retries and an immutable event audit trail.
- [ ] Real notification delivery, acknowledgement, retries, and dead-letter handling.
- [ ] On-call responder roster, dispatch acceptance, arrival, reassignment, and unavailable-unit handling.
- [ ] Private attachment storage, content validation, signed URLs, and retention/deletion rules.
- [ ] Control-room jurisdiction and minimum-necessary data sharing approved in writing.
- [ ] Monitoring for failed alerts, delayed acknowledgements, provider downtime, and database errors.
- [ ] Tested manual fallback: site alarm, radio, facility phone, and 112 when the app/network fails.
- [ ] Backup/restore drill and documented incident-recovery runbook.
- [ ] Real-device accessibility and poor-network drill with workers and responders.

### Needed for an operationally credible pilot (P1)

- [ ] Facility maps, exits, muster points, hazardous stores, equipment, and QR/NFC zone check-in.
- [ ] Shift handover, responder skills/certification expiry, equipment readiness, and escalation schedules.
- [ ] Incident commander, structured situation reports, people-at-risk updates, and closure approval.
- [ ] False-alert review, drill separation, post-incident actions, owners, deadlines, and evidence export.
- [ ] Search, filters, saved views, and role-specific notification preferences.
- [ ] Consent notices, privacy impact assessment, retention schedule, and subject-access process.
- [ ] Security logs for sign-in, permission, membership, export, and sensitive-record access.
- [ ] Rate limiting and abuse detection for sign-in, incident creation, notes, media, and notification retries.

### Investor evidence and scale readiness (P2)

- [ ] Drill scorecard with acknowledgement, dispatch, arrival, resolution, and unresolved-action timings.
- [ ] Facility readiness report and training/compliance coverage.
- [ ] Pilot feedback capture by role and release/version traceability.
- [ ] Multi-language emergency instructions validated by native speakers.
- [ ] Offline queue with an explicit unsent state; never claim delivery before server receipt.
- [ ] Approved reporting, export, and API integration strategy.

## Safety and governance gates

- [ ] Written pilot emergency procedure and manual fallback.
- [ ] Privacy impact assessment for worker identity and location.
- [ ] Location and attachment retention schedule.
- [ ] Worker consultation and consent language.
- [ ] Incident evidence-access policy.
- [ ] Signed agreements before any authority/control-room data sharing.
- [ ] No automatic public-authority dispatch until formally approved and tested.
- [ ] Real-device drill across online, poor-network, offline, denied-GPS, and expired-session conditions.

## Verification record

### 2026-10-03

- Automated lifecycle tests: 5 passed.
- ESLint: passed after Auth/operations integration.
- TypeScript production compilation: passed.
- Vite production build: passed.
- Production dependency advisory audit: no known vulnerabilities reported.
- Tracked-file secret-pattern scan: no Supabase secret/service-role/JWT pattern found outside package integrity data.
- `.env.local`: confirmed ignored by Git; local service credentials still need removal from the frontend workspace.
- Security migration 003: prepared and reviewed locally, but not yet applied or remotely verified.
- Supabase public schema checks: passed.
- Supabase Auth health: passed.
- Browser/manual visual verification: not performed in this change set.

## Next recommended execution sequence

1. Apply security migration 003 and disable project-wide signup.
2. Create and verify the three individual control-room accounts.
3. Enable Auth locally and test login, role lock, mobile navigation, and sign-out.
4. Connect worker incident RPC creation and shared incident reads.
5. Connect realtime company/responder/control-room updates.
6. Add private attachment storage and real notification receipts.
7. Run a five-user internal drill including failure and fallback cases.
8. Correct usability and operational issues from the drill.
9. Deploy to the intended Vercel account and repeat security checks.
10. Run the investor demonstration with recorded drill evidence.
