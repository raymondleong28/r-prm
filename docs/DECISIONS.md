# DECISIONS.md — Architecture Decisions & Assumptions Log

1. **Sole Writer & Branch Policy (§1.1):**
   - One AI coding agent writes code at a time on branch `develop`. `main` is updated only by Ray after review.
2. **Preset Reward Cleanup:**
   - Ray approved removal of the accidental `"SGD 1,000 Quarterly Quota Accelerator Bonus"` preset reward from Silver Tier of `prog-strategic`. It has been removed from demo seed scripts with an immutable `DELETE` entry format in `AuditLog`.
3. **Database Engine — PostgreSQL 16:**
   - R-PRM uses PostgreSQL 16 (`provider = "postgresql"` in `prisma/schema.prisma`) with committed Prisma migrations (`npx prisma migrate deploy`). Fresh databases start completely empty after migrations.
4. **Partner-Facing Explicit Field Allowlists:**
   - Partner sessions pass through explicit allowlist serializers in `src/lib/partnerSerializer.ts`. Partner users never receive raw `metadataJson`, `awardedPartners`, email template subjects, other partners' names, or coworker-only `account_settings` fields (SSO, MFA policy, validation strategy, conflict detection, deal expiry, payout schedule/threshold).
5. **ASSUMPTION — Asset Scoping Combination Logic:**
   - When an asset's `"Who has access"` is set to `"Some partners"`, the three pickers (`programLevels`, `groups`, `partnerIds`) are evaluated with **OR** logic (an authenticated partner can access the asset if they match any configured picker).
6. **Application Acceptance Modes:**
   - Partner application review supports two acceptance modes:
     1. **Accept as Prospect:** Creates/updates the partner in the `Prospection` pipeline (`prospectionStage: "New"`, `portalAccess: false`).
     2. **Accept as Active Partner:** Activates the partner (`status: "Active"`, `portalAccess: true`), generates a time-limited single-use activation token, and sends the assigned `"Notify accepted partner"` email template.
   - Rejecting an application requires a rejection reason (and optional `reapplyAfterDate`).
7. **ASSUMPTION — Bank Details Collection Timing:**
   - Public partner applications (`/forms/apply/[programId]`) do NOT collect sensitive bank details at initial application; bank payout details are collected inside the Partner Portal after acceptance (or via the `Opt-in/out from self-invoicing` / `Provide information` onboarding action) and encrypted at rest using AES-256-GCM.
8. **DESIGN DECISION — Explicit Pipeline-to-Program Binding (F8):**
   - Each Program explicitly specifies its `onboardingPipelineId` (or an Onboarding Pipeline explicitly lists `assignedProgramIds`). Starting onboarding or accepting an application requires a valid program and uses its explicitly assigned onboarding pipeline without name-based heuristics or silent fallback to the first program.
9. **OPEN — Non-Cash Value Type Configs:**
   - `valueType` supports `Cash`, `Coupon`, `Gift card`, and `Credit`. `Cash` computes numeric percentage or fixed payouts in integer minor units; `Coupon`, `Gift card`, and `Credit` store structured voucher/credit metadata and are flagged for future issuer integration.
