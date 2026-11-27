# R-PRM — Implementation Progress & Capability Overview

## Completed Platform Capabilities

- [x] **Foundation, PostgreSQL Schema, First-Run Setup & Global Shell**
  - Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma 5 on PostgreSQL 16
  - First-run `/setup` wizard for empty databases (protected by `SETUP_TOKEN` in production) and opt-in synthetic demo dataset (`npm run demo:seed`)
  - Workspace branding (name, logo, primary colour, portal domain) driven from workspace settings
  - Home Dashboard (`/dashboard`) with 8 active widgets, 12-month stacked transaction bar chart, reward validation table, and widget customization drawer.
- [x] **Partners Suite & Partner Programs**
  - Partners Directory (`/partners/views/all`) & Partner Detail (`/partners/[id]`) with partner portal impersonation, level customization, onboarding progress, rewards, rotatable lead form links, and certifications
  - Partner Team Members (`/team-members/views/all`)
  - Partner Prospection Kanban (`/partner-prospection/views/all`)
  - Partner Onboarding Kanban (`/partner-onboarding/[id]`) with explicit program-to-pipeline assignment and 6 stage action types
  - Partner Programs (`/programs/views/all`) & Program Detail (`/programs/[id]`) with Tier Level Rewards/Benefits/Requirements builders, Tracking Links, and Role Permissions Matrix (`Manager`, `Sales Rep`, `Stakeholder`).
- [x] **Revenue Pipeline — Leads, Deals, Customers, Tasks & Business Plans**
  - Leads (`/leads/views/all`) & Lead Detail (`/leads/[id]`) with 1-click **`Convert to deal`** and rotatable per-partner lead submission forms (`/forms/lead/[token]`)
  - Deals (`/deals/views/all`) with **10-Stage Kanban Board** & **16-Column Table View**, 3-Step `Register deal` wizard, Deal Detail (`/deals/[id]`), Customer association, and automatic commission reward generation
  - Customers (`/customers/views/all`), Tasks (`/tasks/views/all`), and Business Plans (`/business-plans/views/all`).
- [x] **Financials (Integer Minor Units) & Account Mapping**
  - Transactions (`/transactions/views/all`), Rewards (`/rewards/views/all`), and Payouts (`/payouts/views/all`) stored and computed in integer minor units (cents)
  - Account Mapping Overview (`/account-mapping-overview` 3×3 Overlap Matrix), Accounts (`/accounts/views/all`), Overlaps (`/overlaps/views/all`), Collaborations (`/collaborations/views/all`), and Data Sources (`/data-sources`).
- [x] **Manage Hub, Account Settings, User Preferences & Help Center**
  - Manage Hub (`/manage`) covering `Assets`, `Certifications`, `Email setup`, `Email templates`, `Groups`, `Help Center`, `Integrations`, `News`, `Partner dashboards`, `Partner directories`, `Partner onboarding`, `Products`, `Team`, and `Workflows`
  - Account Settings (`/account` & `/account/[tab]`) across `Account defaults`, `Partner portal`, `Directories`, `Security`, `Partner settings`, `Lead settings`, `Deal settings`, `Payout settings`, `Properties`, `Account data`, `Integration`, and `Audit trail`
  - User Preferences (`/settings` & `/settings/[tab]`) across `Profile`, `Security`, `Notifications`, `Calendar`, and `Connected apps`
  - Help Center (`/help`).
