# DOMAIN.md — R-PRM Domain Objects, Lifecycles & State Machines

## 1. Core Entities
- **Program (`Program`):** Partner program containing tiered `levels`, `automatedEmails` template bindings, `permissions` matrix (`Manager`, `SalesRep`, `Stakeholder`), and explicit `onboardingPipelineId`.
- **Partner (`Partner`):** Partner organisation linked to a `Program`, `qualifyingLevel`, `groupName`, `prospectionStage` (`New | Onboarding | Active`), `onboardingStage`, hashed `leadFormTokenHash`, encrypted `bankDetailsJson`, and `selfInvoicing` flag. KPIs are computed live from `Lead`, `Deal`, `Transaction`, and `Reward` records.
- **Deal (`Deal`):** 10 pipeline stages:
  1. `To Work On`
  2. `Appointment Scheduled`
  3. `Holding`
  4. `Discovery Stage`
  5. `Presentation Stage`
  6. `Quotation Stage`
  7. `Negotiation Stage`
  8. `Closing Stage`
  9. `Closed Won`
  10. `Closed Lost`
- **Reward (`Reward`):** Commission generated from a structured Program Level Rule, with amounts stored in integer minor units (cents).
  - Lifecycle: `Pending → Validated (Accepted) → In payout → Paid`
  - Rejection: `Pending → Refused` (with required `refusalReason`)
  - Reversal: `Validated / Paid → Clawed back` (creates a linked negative adjustment record, preserving immutable history).
- **Payout (`Payout`):** Settlement batch aggregating `Validated` rewards for a partner in integer minor units. Supports **Self-Invoicing** statement generation.
- **AuditLog (`AuditLog`):** Immutable record of `actor`, `actorRole`, `action`, `objectType`, `objectId`, `summary`, and `createdAt`.
