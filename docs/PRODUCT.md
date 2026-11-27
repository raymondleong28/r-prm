# PRODUCT.md — R-PRM Feature & Capability Guide

**R-PRM** is an independent, self-hosted partner relationship management (PRM) application designed for a single installing organisation to manage its partner ecosystem, programs, revenue pipeline, commissions, payouts, enablement content, and dedicated partner portal.

---

## 1. Programs and Tiers
- **Tiered Partner Programs:** Create multiple programs (such as Reseller, Referral, or Strategic Alliances) with structured tier levels.
- **Tier Configuration:** Each tier defines its own commission rules, partner benefits, and entry/maintenance requirements (e.g. minimum sourced revenue, required certified personnel).
- **Lifecycle Controls:** Duplicate existing programs as templates or archive inactive programs.
- **Public Application Forms & Automated Emails:** Every program exposes a public application intake form (`/forms/apply/[programId]`). Automated email templates bind to key lifecycle triggers:
  - Application received acknowledgement
  - Application accepted (with single-use time-limited activation link)
  - Application rejected (with required reason and optional reapply date)

---

## 2. Commission Rules & Rewards Engine
- **Structured Rule Builder:** Commission rules are attached to program tiers and support:
  - **Triggers:** Paid transaction, deal won, lead accepted, lead converted.
  - **Value Types:** Cash (active computation); Coupon, Gift card, and Credit (stored as structured metadata; marked not yet configured for external issuer integration).
  - **Calculation Modes:** Percentage of transaction/deal value or fixed amount in integer minor units (cents).
  - **Duration & Schedules:** One-off rewards or recurring schedules with start month offset, total duration in months, and multi-step rate tiers (`rateSteps`).
  - **Governance Flags:** Optional manual validation requirement before payout eligibility, and automated clawback on transaction refund.
- **Reward Lifecycle:**
  - `Pending → Validated (Accepted) → In payout → Paid`
  - `Pending → Refused` (with mandatory refusal reason)
  - `Validated / Paid → Clawed back` (creates an immutable negative adjustment reward linked to the original record)

---

## 3. Payouts & Self-Invoicing
- **Reward Bundling:** Aggregate validated rewards per partner into settlement batches (`Payout`). Zero-reward payouts are refused.
- **Automated Schedules:** Configure monthly or quarterly payout generation subject to a minimum payout threshold.
- **Settlement Execution:** Record manual settlement references and mark batches as paid (`PAYOUT_DRIVER=manual`), with external payout provider drivers gated until configured.
- **Self-Invoicing:** Generate printable self-invoice statements for partners who have opted into self-invoicing.

---

## 4. Partners, Prospection & Onboarding
- **Partner Records & Team Members:** Track partner organisations, assigned program and tier, partner groups, and certifications. Manage partner team members with role assignments (`Manager`, `Sales Rep`, `Stakeholder`), designated main contact, and per-person portal access.
- **Prospection Pipeline:** Review incoming applications and either accept applicants as prospects (`Prospection` stages) or activate them immediately as active partners.
- **Onboarding Pipelines:** Assign explicit onboarding pipelines to each program. Onboarding stages support six structured action types:
  1. `View asset`
  2. `Read article`
  3. `Upload document`
  4. `Provide information`
  5. `Book meeting`
  6. `Opt-in/out from self-invoicing`
  Each action supports optional administrator validation before completion.

---

## 5. Leads, Deals, Customers & Transactions
- **Lead Management:** Partners submit leads in the portal or via their unique, rotatable public lead form link (`/forms/lead/[token]`). Admins can also distribute shared leads to partners for acceptance.
- **Deal Registration:** Configurable 10-stage deal pipeline with conflict detection (matching company name and email domain across leads, deals, and customers), deal expiration timers, automated reminder notifications, and resubmission controls.
- **Customers & Transactions:** Link customers and financial transactions to registered deals and partners. Support multi-currency entry converted to workspace base currency via dated exchange rates, stored in integer minor units.

---

## 6. Enablement Content
- **Assets Library:** Upload and organise enablement files with server-enforced access scoping (`Everyone`, `My team`, or `Some partners` filtered by chosen program tiers, partner groups, or individual partners).
- **Help Centre & News:** Publish structured help-centre articles by collection, announcements/news posts, and per-program partner dashboard layouts.

---

## 7. Partner Portal (`/p`)
- **Dedicated Experience:** Separate partner sign-in (`/p/login`), activation flow (`/p/activate`), and portal layout with no admin navigation chrome.
- **Portal Modules:** Home dashboard, leads, deals, rewards, payouts, onboarding checklist, assets, help centre, news, team management, company profile, and encrypted bank details (`AES-256-GCM` at rest).
- **Server-Side Isolation:** Partner users can only view or mutate records belonging to their own partner organisation, program, and tier, enforced by explicit allowlist serializers and program role permission matrices.

---

## 8. Workspace Administration
- **First-Run Setup (`/setup`):** Fresh installations start completely empty and guide the first administrator through workspace configuration and account creation.
- **Account Settings:** Configure workspace defaults, portal branding (name, logo, primary colour, portal domain), security policies (enforced MFA for coworkers and/or partners, SSO settings), partner/lead/deal/payout rules, custom properties across all 10 object types, CSV data import/export with dry-run preview, and hashed API access tokens.
- **Automation & Co-Selling:** Build scheduled workflows (`trigger → condition → action`), manage tasks and joint business plans, upload account lists to compute co-selling overlaps and collaborations, and inspect the immutable workspace audit log.
