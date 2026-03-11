# NeuraOS Beta Gate

This checklist defines the minimum quality bar before a pilot release.

## 1) Automated gate (must be green)

Run:

```bash
npm run beta:gate
```

Quick local pre-check:

```bash
npm run beta:gate:quick
```

Automated gate includes:
- lint
- unit tests
- production build
- required/recommended environment variable checks

## 2) Manual critical flows (must be validated)

Validate with a real tenant admin account:

1. Login and RBAC
- Admin can access all expected admin routes.
- Employee account cannot access restricted screens.

2. Import Center
- Upload CSV: preview is generated, warnings are understandable, apply succeeds.
- Upload image/PDF: preview is generated or explicit warning is shown, no crash.

3. Sales flow
- Create quote.
- Convert quote to sales order.
- Verify stock movement and updated analytics.

4. Purchase flow
- Create purchase order.
- Receive goods.
- Verify stock increase and updated analytics.

5. AI flow
- Web copilot responds with tenant-scoped data only.
- Telegram/WhatsApp connector handles one message and one document upload.

6. Billing flow
- Checkout starts.
- Webhook updates subscription status correctly.
- Upgrade/downgrade does not break tenant access rules.

## 3) Pilot release KPI targets

- Import apply success rate >= 95%
- No P0/P1 bug in 14 consecutive days
- Time-to-first-value <= 30 min (new tenant)
- p95 critical API routes under agreed threshold
- Zero cross-tenant data leak

## 4) Release decision

Release only if:
- Automated gate is green
- All manual critical flows pass
- No unresolved security blocker
