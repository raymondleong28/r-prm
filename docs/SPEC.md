# SPEC.md — R-PRM Technical Specification

## 1. Objective
Deliver **R-PRM** as an independent, self-hosted partner relationship management application for a single installing organisation. Every admin view, partner-portal view, configuration setting, public intake form, detail page, and scheduled workflow computes its figures from database records, enforces role and tenant scoping on the server, logs an audit trail, and persists state in PostgreSQL 16.

## 2. Core Technical Requirements
- **Computed Metrics Only:** Dashboard widgets, top partner rankings, and partner detail KPIs (`submittedLeads365d`, `registeredDeals365d`, `sourcedRevenue365d`, `influencedRev365d`, `pendingRewardsAll`) are computed dynamically from live `Lead`, `Deal`, `Transaction`, and `Reward` records.
- **Integer Minor Units for Money:** All monetary columns in PostgreSQL and calculation engines use integer minor units (cents) with an explicit currency code.
- **Structured Commission & Reward Engine:**
  - Program tier levels store structured reward rules (`trigger`, `conditions`, `valueType`, `amountMode`, `rateOrAmount`, `currency`, `duration`, `startOffsetMonths`, `durationMonths`, `rateSteps`, `requiresValidation`, `clawbackOnRefund`).
  - Rule Builder UI modal on the Program Levels tab supports creating, editing, and deleting rules with confirmation.
  - Idempotent reward generation linked to source transaction/deal and rule.
  - Full reward lifecycle: `Pending → Validated (Accepted) → In payout → Paid`, `Pending → Refused (with reason)`, `Validated/Paid → Clawed back` (creates a negative adjustment record).
  - Multi-currency transactions and rewards store original amount in minor units, currency, base amount in minor units, exchange rate, exchange rate date, and source.
- **Server-Side Asset & Content Scoping:**
  - Assets support `"Who has access"`: `My team`, `Everyone`, or `Some partners` (Program Levels, Groups, Individual Partners combined via `OR`).
  - Partner Portal endpoints filter assets server-side so a partner only sees assets matching their program, level, group, or partner ID.
- **Account Settings & Governance:**
  - Dedicated settings tabs for `Account defaults`, `Partner portal`, `Directories`, `Security`, `Partner settings`, `Lead settings`, `Deal settings`, `Payout settings`, `Properties`, `Account data`, `Integration`, and `Audit trail`.
  - `Account data → Reset data` requires typed confirmation (`RESET`).
  - `Integration → API Access Tokens` displays the raw token once at creation and stores only a hashed/masked token with revocation support.
- **Onboarding Pipelines & 6 Action Types:**
  - Explicit program-to-pipeline assignment (`onboardingPipelineId`). Missing program assignment returns an explicit error rather than falling back by name or default index.
  - Onboarding pipeline stages support all 6 action types: `View asset`, `Read article`, `Upload document`, `Provide information`, `Book meeting`, and `Opt-in/out from self-invoicing`, with optional admin validation gating.
- **Automated Emails & Activation Tokens:**
  - Each program trigger (`Acknowledge partner signup`, `Notify accepted partner`, `Notify rejected partner`) binds to a specific email template and generates single-use, SHA-256 hashed activation tokens at send time.
- **Authentication, MFA, Lockout & Partner Portal:**
  - Separate Coworker (`/login`) and Partner (`/p/login`) authentication flows, database-backed login lockout counters, enforced TOTP MFA when required by workspace policy, server-side role checks, Audit Log table (`/api/audit`), and standalone Partner Portal at `/p`.
- **Account Mapping Overlaps:**
  - Overlaps are computed dynamically by matching normalized company name and domain across internal CRM accounts and partner account lists.
- **REST Resource APIs & Detail Views:**
  - Resource routes (`/api/partners`, `/api/programs`, `/api/leads`, `/api/deals`, `/api/customers`, `/api/transactions`, `/api/rewards`, `/api/payouts`, `/api/tasks`, `/api/assets`, `/api/audit`, `/api/auth`, `/api/setup`).
  - Detail views (`/customers/[id]`, `/transactions/[id]`, `/tasks/[id]`, `/payouts/[id]`, `/rewards/[id]`, `/business-plans/[id]`, `/accounts/[id]`, `/collaborations/[id]`, `/team-members/[id]`) plus `/forms/lead/[uuid]` and `/forms/apply/[programId]`.

## 3. Non-Goals
- Multi-tenant SaaS billing, subscription management, or vendor super-admin screens.
