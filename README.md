# ZioGuard Pilot

ZioGuard is an installable industrial emergency-response pilot for workers, site response teams, company safety leaders, and authorized coordination rooms.

## Product validation

The idea is worth piloting. Its strongest value is not another panic button; it is the structured incident record connecting the first alert to acknowledgement, mobilization, arrival, resolution, and review.

The pilot should be positioned as **industrial incident coordination**, not as a replacement for 112 or an official police, fire, or ambulance dispatch system. Public-authority integration must remain disabled until the relevant agency approves the workflow, data sharing, service levels, and legal basis.

### Pilot hypotheses

1. A trained worker can raise the right alert in under 10 seconds.
2. A site coordinator acknowledges at least 95% of drill alerts within 60 seconds.
3. The alert carries a useful zone or location in at least 95% of drills.
4. The response team can keep one accurate incident timeline without parallel WhatsApp or paper logs.
5. Workers understand that ZioGuard supplements local alarms and 112; it does not replace them.

### Suggested pilot

- One company, one primary site, and one backup site.
- 30–60 workers across two shifts.
- Four trained coordinators: EHS, security, first aid, and shift lead.
- Three planned drills: medical, fire/smoke, and hazardous material.
- Two weeks of training and observation, then a four-week measured pilot.
- Success review using trigger time, acknowledgement time, dispatch time, arrival time, correct location, false-alert rate, notification delivery, and worker comprehension.

## What this build includes

- Worker emergency console with fire, hazmat, security, and medical categories.
- One-tap activation followed by an explicit detail review and confirmation to reduce accidental alerts.
- Optional site zone, device location, and incident detail.
- Worker safety card and personal incident history.
- Company command dashboard with active incidents, readiness, facility schematic, full incident register, teams, and response analytics.
- Incident command drawer with lifecycle actions and an immutable-style timeline.
- Separate control-room view with a regional queue and explicit dispatch boundary.
- Installable PWA manifest, offline application shell, mobile navigation, and responsive layouts.
- Persistent demo data in the browser so the pilot can be demonstrated without a backend.
- A Supabase migration foundation with tenant-aware roles, row-level security, guarded lifecycle functions, append-only events, and realtime publication.
- Accessibility basics: semantic structure, keyboard controls, focus states, reduced-motion support, contrast, and 44px minimum targets.

## Important pilot boundary

This preview is an interactive product pilot, not a live safety system.

- Incident data is stored only in the current browser using `localStorage`.
- No SMS, WhatsApp, voice call, n8n flow, public authority, or responder is contacted.
- Role switching is a demo control, not authentication.
- The schematic map and resource counts are sample data.
- Offline mode keeps the interface available but cannot deliver an alert to another device.

These limitations are deliberately visible in the interface so test users cannot mistake simulation for live dispatch.

## Production architecture after validation

1. **Identity and tenancy:** managed authentication, MFA for coordinators, organization/facility membership, server-verified role permissions, and tenant-isolated database policies.
2. **Incident service:** transactional PostgreSQL lifecycle state, append-only audit events, idempotency keys, server timestamps, and optimistic UI updates.
3. **Delivery service:** durable queue for SMS, voice, push, and approved WhatsApp templates; provider delivery receipts; exponential retry; dead-letter handling.
4. **Automation:** n8n may orchestrate the pilot, but every inbound/outbound webhook must be signed, replay-protected, idempotent, logged, and isolated from the system of record.
5. **Location:** site/zone codes by default, precise device location only with a documented purpose, explicit consent, minimal retention, and restricted access.
6. **Operations:** audit log, incident export, notification health, escalation policies, responder availability, drill mode, false-alert cancellation, and on-call ownership.
7. **Resilience:** multi-region recovery plan, tested backups, status monitoring, rate limits, abuse controls, and a documented manual fallback using alarms, radios, and 112.
8. **Governance:** privacy impact assessment, retention schedule, worker consultation, incident evidence policy, local legal review, and written agreements before authority data sharing.

## Local development

```bash
pnpm install
pnpm dev
```

## Verification

```bash
pnpm test
pnpm lint
pnpm build
```

The current build has four lifecycle unit tests and is configured for a Vercel static deployment.

See `SUPABASE_SETUP.md` for the safe database connection sequence. The remote schema is intentionally not applied until the intended Supabase project is authorized.
