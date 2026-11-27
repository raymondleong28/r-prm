# DATA-SAFETY.md — Data Safety & Integrity Policy

1. **No Unapproved Destructive Resets (§1.4):**
   - No automated script, build step, or agent test may truncate or reset an existing database without Ray's explicit approval.
   - The UI `Account Settings → Account data → Reset data` button is gated behind an explicit typed confirmation (`RESET`) and logs to the Audit Log.
2. **Computed Facts Only:**
   - Every KPI on the Dashboard, Partner directory, Partner detail KPI strip, and Account Mapping 3×3 matrix is computed dynamically from underlying records (`leads`, `deals`, `transactions`, `rewards`, `accounts`).
3. **Honest Lookup States:**
   - Every lookup endpoint and detail page distinguishes between:
     - `found` (renders record)
     - `not_found` (renders explicit Not Found state with link back)
     - `error` / `could_not_check` (renders explicit error banner with reason, never disguised as `0` or empty array).
4. **Integer Minor Units for Money (§1.4 & F6):**
   - All monetary values are stored and calculated as integer minor units (cents) paired with an explicit currency code—never floating-point numbers.
5. **Synthetic Demo Data Only:**
   - A fresh database starts completely empty after `npx prisma migrate deploy`. Optional demo data (`npm run demo:seed`) uses 100% invented names (such as the fictional "R-Cloud" company and `example.com` addresses) and refuses to run in production or when non-demo data is present.
