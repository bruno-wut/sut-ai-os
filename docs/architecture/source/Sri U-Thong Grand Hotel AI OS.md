Sri U-Thong Grand Hotel AI Operating System
===========================================

Final Architecture and Product Definition
-----------------------------------------

**Document status:** Canonical architecture charter\
**Primary implementation environment:** Codex\
**Platform ownership:** Sri U-Thong Grand Hotel\
**Operating principle:** Hotel-owned infrastructure, hotel-owned data, hotel-defined policy

* * * * *

1\. Executive Definition
========================

Sri U-Thong Grand Hotel is building an **owned, AI-native Hotel Commercial Operating System**.

The system connects the hotel's:

-   public commercial website

-   direct booking engine

-   booking and room-availability database

-   staff operational dashboard

-   payment and notification services

-   search and content growth activities

-   technical reliability monitoring

-   commercial decision support

-   controlled AI automation

The platform continuously collects signals from the hotel's digital operations, analyzes what those signals mean, identifies problems and opportunities, recommends or implements appropriate responses, verifies the results, and records every action in an auditable control system.

The clearest product definition is:

> **An AI-native Hotel Commercial Operating System that helps Sri U-Thong Grand Hotel increase direct bookings, improve digital operations, detect problems early, and automate low-risk work without surrendering control of pricing, inventory, payments, guest data, or financial decisions.**

It is not merely:

-   a hotel website

-   an Internet Booking Engine

-   an AI chatbot

-   an SEO automation tool

-   a staff dashboard

-   an autonomous coding agent

It is the governed operating layer connecting all of these systems.

* * * * *

2\. Strategic Objective
=======================

The AI Operating System exists to produce six primary business outcomes.

2.1 Increase direct revenue
---------------------------

Reduce dependence on OTAs and external vendors by improving:

-   organic search acquisition

-   direct booking conversion

-   corporate and government bookings

-   wedding and event enquiries

-   localized campaigns

-   package and promotion development

-   repeat guest communication

-   commercial decision support

2.2 Protect booking reliability
-------------------------------

Detect, investigate, and respond to:

-   failed checkouts

-   abandoned booking holds

-   payment webhook problems

-   booking concurrency conflicts

-   availability inconsistencies

-   deployment regressions

-   staff synchronization errors

-   transactional email failures

2.3 Improve search visibility
-----------------------------

Continuously analyze:

-   Google Search Console performance

-   landing-page engagement

-   conversion by search query

-   local Thai and English search demand

-   content gaps

-   weak metadata

-   declining pages

-   internal linking opportunities

-   technical SEO

-   AI answer-engine visibility

The system should select the most appropriate intervention rather than automatically producing new content.

Possible interventions include:

-   no action

-   metadata improvement

-   existing-page enhancement

-   internal-link improvement

-   technical SEO repair

-   new localized article

-   new commercial landing page

-   structured-data improvement

2.4 Reduce repetitive operational work
--------------------------------------

Automate tasks such as:

-   technical monitoring

-   issue diagnosis

-   safe code repairs

-   content validation

-   SEO analysis

-   localized content drafting

-   metadata optimization

-   performance reporting

-   incident summarization

-   campaign preparation

-   executive briefing generation

2.5 Improve management visibility
---------------------------------

Provide one command center for:

-   bookings and holds

-   direct conversion

-   search performance

-   website demand

-   payment health

-   deployment health

-   system incidents

-   AI recommendations

-   autonomous actions

-   pending approvals

-   completed interventions

-   measurable outcomes

2.6 Preserve executive control
------------------------------

AI may:

-   analyze

-   diagnose

-   recommend

-   draft

-   simulate

-   create previews

-   modify approved repository areas

-   run approved verification commands

-   execute safe and reversible actions

AI must not independently control:

-   room prices

-   room inventory

-   refunds

-   payment credentials

-   financial ledgers

-   production database migrations

-   RLS policies

-   sensitive guest-data exports

-   destructive booking changes

-   legally consequential data processing

* * * * *

3\. Existing Digital Foundation
===============================

The AI Operating System is built on top of the hotel's existing owned commercial infrastructure.

3.1 Astro Commercial Storefront
-------------------------------

**Domain:** `sriuthonghotels.com`\
**Hosting:** Cloudflare Pages

Responsibilities:

-   hotel marketing

-   room and venue presentation

-   promotions

-   Thai and English content

-   local destination content

-   wedding and event pages

-   search landing pages

-   organic traffic acquisition

-   handoff into direct booking

The Astro storefront remains static-first and optimized for speed, search visibility, resilience, and low operating cost.

3.2 Next.js Internet Booking Engine
-----------------------------------

**Domain:** `book.sriuthonghotels.com`\
**Hosting:** Cloudflare Workers through OpenNext

Responsibilities:

-   availability search

-   direct booking journey

-   booking holds

-   guest details

-   checkout

-   payment initiation

-   booking confirmation

-   staff management interfaces

3.3 Supabase Operational Database
---------------------------------

Responsibilities:

-   PostgreSQL business data

-   booking and room records

-   atomic booking holds

-   Tetris room-allocation logic

-   Row-Level Security

-   staff permissions

-   operational audit records

-   AI control-plane records

-   Thai PDPA retention workflows

3.4 Payment and Communication Services
--------------------------------------

Responsibilities:

-   Stripe payment processing

-   Opn payment processing

-   payment webhook verification

-   Resend transactional email

-   LINE management notifications

-   executive approvals and alerts

3.5 GitHub and Cloudflare Deployment
------------------------------------

Responsibilities:

-   code source of truth

-   content source of truth

-   CI validation

-   pull-request governance

-   Cloudflare deployment

-   version history

-   rollback capability

* * * * *

4\. The Platform Contains Six Connected Products
================================================

The final system should be understood as six connected products rather than one monolithic application.

A. Direct Commerce Platform
---------------------------

The customer-facing system for acquiring visitors and converting them into direct bookings.

Includes:

-   Astro storefront

-   localized landing pages

-   bilingual hotel content

-   room and venue pages

-   booking engine

-   checkout

-   payments

-   guest confirmations

B. Hotel Operations Platform
----------------------------

The staff-facing system for managing bookings and operational exceptions.

Includes:

-   booking ledger

-   Tetris room assignment grid

-   booking holds

-   payment states

-   manual PMS synchronization

-   booking exception handling

-   operational alerts

-   incident response

It should not initially be described as a complete PMS replacement unless it genuinely supports the full scope of hotel property management.

C. Growth Intelligence Platform
-------------------------------

The commercial intelligence system for identifying demand and improving acquisition.

Includes:

-   Google Search Console analysis

-   GA4 or first-party analytics

-   landing-page conversion analysis

-   search opportunity detection

-   local-intent research

-   content-gap analysis

-   competitor observations

-   corporate and government demand indicators

-   campaign recommendations

-   AEO visibility research

D. Reliability and Engineering Platform
---------------------------------------

The technical intelligence system for maintaining platform quality.

Includes:

-   application-error monitoring

-   payment-failure analysis

-   booking funnel anomalies

-   webhook monitoring

-   deployment regression detection

-   Core Web Vitals analysis

-   build and schema failures

-   safe code repairs

-   preview deployment verification

-   rollback automation

E. AI Intelligence Platform
---------------------------

The reasoning layer that interprets operational and commercial evidence.

It performs:

-   anomaly investigation

-   evidence correlation

-   root-cause hypothesis generation

-   SEO opportunity classification

-   intervention selection

-   confidence assessment

-   content planning

-   repair planning

-   commercial proposal generation

-   outcome interpretation

This is the cognitive layer of the system.

F. AI Governance and Orchestration Platform
-------------------------------------------

The control layer that governs every AI action.

It determines:

-   which signals should be processed

-   which tools the AI may access

-   whether an action is allowed

-   whether human approval is required

-   which executor performs the action

-   how the result must be verified

-   how the action is audited

-   whether rollback is required

This is the operational core of the AI Operating System.

* * * * *

5\. Final Operating Lifecycle
=============================

The complete lifecycle is:

Observe → Measure → Understand → Decide → Authorize → Execute → Verify → Learn → Surface
----------------------------------------------------------------------------------------

5.1 Observe
-----------

Collect signals from:

-   Cloudflare

-   Supabase

-   Stripe

-   Opn

-   Resend

-   GitHub

-   booking activity

-   Google Search Console

-   analytics

-   browser errors

-   performance monitoring

-   approved competitor sources

5.2 Measure
-----------

Use deterministic analytics before invoking AI.

Calculate:

-   current metric

-   historical baseline

-   percentage movement

-   sample size

-   affected segment

-   anomaly duration

-   confidence

-   correlated deployments

-   correlated campaigns

-   possible seasonality

AI should not be asked to discover basic mathematical anomalies from uncontrolled raw data.

5.3 Understand
--------------

The AI Intelligence Platform examines prepared evidence.

It determines:

-   what changed

-   why it may have changed

-   which systems are affected

-   whether the evidence is sufficient

-   whether the movement is normal

-   whether more information is required

-   which intervention is most appropriate

5.4 Decide
----------

The AI produces a structured action plan.

Possible decisions include:

-   take no action

-   continue monitoring

-   gather more evidence

-   prepare a recommendation

-   create a pull request

-   create a content preview

-   initiate a safe repair

-   escalate an incident

-   request executive approval

-   block the action

5.5 Authorize
-------------

The deterministic policy engine evaluates:

-   data sensitivity

-   action risk

-   affected system

-   allowed repository paths

-   allowed commands

-   approval requirements

-   production-write permissions

-   staff role requirements

-   rollback availability

The AI model cannot override this decision.

5.6 Execute
-----------

A constrained executor performs the approved operation.

Executors may include:

-   Codex Engineering Executor

-   Codex Content Executor

-   SEO Analysis Executor

-   Deployment Executor

-   Verification Executor

-   LINE Notification Executor

-   Reporting Executor

-   Commercial Proposal Executor

5.7 Verify
----------

Every action must be verified technically and, where applicable, commercially.

Technical verification may include:

-   lint

-   typecheck

-   unit tests

-   integration tests

-   Astro or Next.js build

-   Zod schema validation

-   Playwright tests

-   webhook replay

-   preview deployment

-   Lighthouse testing

-   production health check

Commercial verification may include:

-   conversion recovery

-   payment error reduction

-   search click improvement

-   CTR improvement

-   ranking movement

-   booking sessions

-   completed bookings

-   revenue contribution

-   reduction in staff intervention

5.8 Learn
---------

The system records the final outcome as:

-   successful

-   partially successful

-   neutral

-   failed

-   rolled back

-   inconclusive

This history informs future recommendations, but past AI output never becomes unquestioned truth.

5.9 Surface
-----------

Results are presented through:

-   Next.js Staff OS

-   LINE alerts

-   approval messages

-   executive email briefings

-   incident timelines

-   SEO reports

-   orchestration audit views

* * * * *

6\. Central AI Orchestrator
===========================

The Central AI Orchestrator is a hybrid control plane, not a single all-powerful AI agent.

It contains the following independent layers.

6.1 Signal Ingestion Layer
--------------------------

Receives and normalizes events such as:

-   checkout completion declined

-   payment webhook failed

-   booking hold conflicts increased

-   search impressions declined

-   CTR declined

-   page performance regressed

-   content schema failed

-   deployment failed

-   competitor rate changed

-   executive approval was submitted

Every event receives:

-   event ID

-   correlation ID

-   source

-   environment

-   timestamp

-   event type

-   severity

-   affected property

-   evidence

-   deduplication key

6.2 Deterministic Analytics Layer
---------------------------------

Calculates objective facts before AI reasoning.

Responsibilities:

-   anomaly detection

-   funnel calculations

-   trend comparisons

-   segment analysis

-   minimum-volume thresholds

-   statistical confidence

-   deployment correlation

-   seasonal comparisons

-   duplicate-event suppression

6.3 AI Intelligence Layer
-------------------------

Interprets the evidence and creates a structured response.

Responsibilities:

-   root-cause analysis

-   hypothesis ranking

-   SEO intent analysis

-   intervention selection

-   technical repair planning

-   content brief generation

-   bilingual content review

-   commercial proposal generation

-   confidence estimation

-   explanation generation

All machine-consumed outputs should conform to controlled schemas.

6.4 Deterministic Policy Engine
-------------------------------

Applies rules that AI cannot change or ignore.

Examples:

-   production pricing changes require executive approval

-   raw guest PII cannot be sent to external models

-   production migrations cannot be run autonomously

-   content agents cannot access payment credentials

-   only approved paths may be modified

-   only allowlisted commands may run

-   every action must create an audit record

-   Tier 2 approval must expire

-   the approving user must be authenticated

-   AI cannot change its own policy

`AGENTS.md`, `CLAUDE.md`, and prompt instructions guide agent behavior, but they are not sufficient security controls.

Real enforcement must use:

-   scoped credentials

-   server-side authorization

-   Supabase RLS

-   service-role separation

-   command allowlists

-   path restrictions

-   GitHub branch protection

-   protected environments

-   required CI checks

-   authenticated approval records

-   separate staging and production environments

6.5 Durable Workflow Engine
---------------------------

Tracks each operation as a state machine.

Canonical workflow:

```
Detected
→ Measuring
→ Investigating
→ Planning
→ Policy Check
→ Awaiting Approval
→ Executing
→ Verifying
→ Monitoring Outcome
→ Completed
```

Alternative terminal states:

```
Rejected
Blocked
Failed
Cancelled
Expired
Rolling Back
Rolled Back
Inconclusive
```

The workflow engine must support:

-   retries

-   timeouts

-   durable waits

-   deduplication

-   idempotency

-   cancellation

-   dead-letter handling

-   approval pauses

-   rollback

-   recovery after interruption

6.6 Tool Execution Layer
------------------------

Each executor receives only the permissions and data needed for its task.

The executor cannot expand its own scope.

6.7 Audit and Outcome Layer
---------------------------

Records:

-   triggering event

-   input evidence

-   AI model and version

-   prompt or playbook version

-   AI diagnosis

-   policy decision

-   proposed action

-   approval decision

-   files modified

-   commands executed

-   tests performed

-   deployment result

-   rollback result

-   KPI before

-   KPI after

-   final outcome

* * * * *

7\. Two Primary AI Automation Engines
=====================================

7.1 Operational Intelligence and Self-Healing Engine
----------------------------------------------------

This engine analyzes hotel and application data, identifies technical or operational problems, and initiates controlled remediation.

### Inputs

-   booking funnel data

-   hold creation and expiration

-   payment initiation and completion

-   Stripe and Opn webhook results

-   Supabase RPC errors

-   Tetris concurrency conflicts

-   Cloudflare Worker errors

-   browser and Next.js errors

-   deployment history

-   Core Web Vitals

-   transactional email failures

-   conversion by device and source

### Responsibilities

-   identify abnormal behavior

-   correlate incidents with deployments

-   distinguish technical errors from traffic-quality changes

-   generate root-cause hypotheses

-   recommend mitigation

-   dispatch Codex for safe repairs

-   alert staff during booking-impacting incidents

-   monitor recovery

-   initiate rollback where authorized

### Example

```
Signal:
Mobile checkout completion falls 34%.

Measurement:
Desktop remains normal.
Errors begin shortly after a deployment.
Mobile callback logs show missing session parameters.

AI diagnosis:
Probable mobile payment-return regression.

Policy:
Tier 1 repository repair allowed.
Production deployment still requires verification.

Codex:
Repairs approved files and adds regression tests.

Verification:
Typecheck, tests, build, mobile Playwright checkout and preview pass.

Outcome:
Conversion monitored until the metric returns to its expected range.
```

7.2 SEO and Content Growth Engine
---------------------------------

This engine analyzes organic performance and selects the intervention most likely to improve qualified traffic and direct bookings.

### Inputs

-   Google Search Console queries

-   Google Search Console pages

-   clicks

-   impressions

-   CTR

-   average position

-   device and country

-   landing-page engagement

-   booking conversion

-   existing content inventory

-   page metadata

-   internal links

-   structured data

-   sitemap and index state

-   page performance

-   local-intent research

-   approved competitor observations

-   Thai and English content coverage

### Available interventions

#### No action

Used when:

-   movement is within normal variation

-   search volume is insufficient

-   the observation period is too short

-   seasonality explains the change

-   the evidence is inconclusive

#### Metadata improvement

Used when:

-   impressions are healthy

-   rankings are relatively stable

-   CTR is weak

-   page intent already matches the query

-   title or description presentation can improve

#### Existing-page improvement

Used when:

-   a relevant page already ranks

-   content is outdated or incomplete

-   internal linking is weak

-   competing pages cover the intent better

-   Thai and English versions are inconsistent

#### New localized article

Used when:

-   genuine informational intent exists

-   no current page serves it

-   the hotel can provide useful local expertise

-   the article connects naturally to accommodation, meetings, weddings, or events

-   the new content will not create cannibalization

#### New commercial landing page

Used when search intent is transactional rather than informational.

Examples:

-   meeting room in Suphanburi

-   wedding venue Suphanburi

-   government group accommodation

-   seminar package Suphanburi

-   corporate hotel rate

-   accommodation near a major event

#### Technical SEO repair

Used for:

-   missing canonical tags

-   broken hreflang

-   incorrect structured data

-   sitemap problems

-   internal-link failures

-   indexability issues

-   rendering or performance regressions

### SEO operating loop

```
Collect search and conversion data
→ Detect opportunity
→ Inspect existing content
→ Analyze search intent
→ Select intervention
→ Produce evidence-backed brief
→ Apply policy
→ Dispatch Codex
→ Validate and preview
→ Publish or request approval
→ Measure results over defined periods
```

### SEO outcome windows

Recommended measurement periods:

-   14 days

-   28 days

-   56 days

Track:

-   clicks

-   impressions

-   CTR

-   average position

-   organic landing sessions

-   booking-engine transitions

-   completed bookings

-   attributed revenue where sufficiently reliable

The system must not become an uncontrolled content-production engine.

Its objective is not to publish more content.

Its objective is to publish or improve the **right asset for the identified commercial intent**.

* * * * *

8\. Final Autonomy Model
========================

The system uses four autonomy levels.

Tier 0 --- Observe and Recommend
------------------------------

The system may:

-   analyze

-   diagnose

-   report

-   draft

-   simulate

-   create previews

-   create proposed changes

It may not alter production.

All new playbooks should begin in Tier 0 or shadow mode.

Tier 1 --- Autonomous and Reversible
----------------------------------

The system may execute actions that are:

-   low risk

-   reversible

-   narrowly scoped

-   deterministic

-   validated

-   covered by rollback

-   free of sensitive production-data exposure

Examples:

-   repairing broken metadata

-   fixing internal links

-   correcting Markdown frontmatter

-   resolving content schema errors

-   adding missing image dimensions

-   regenerating reports

-   creating pull requests

-   merging explicitly approved low-risk change classes

-   rolling back failed static deployments

A Tier 1 playbook should only gain autonomous privileges after demonstrating reliable performance.

Tier 2 --- Human Approval Required
--------------------------------

The system may analyze, recommend, draft, test, and prepare the action, but cannot activate it without an authorized human.

Examples:

-   room prices

-   packages

-   promotions

-   inventory controls

-   corporate proposals

-   public claims with uncertain facts

-   major website redesigns

-   booking-journey changes

-   guest communications with financial consequences

-   deployment of higher-risk application changes

Approvals must be:

-   authenticated

-   attributable

-   time-limited

-   idempotent

-   recorded

-   revocable before execution

Tier 3 --- Prohibited or Specialist-Only
--------------------------------------

The AI may not execute:

-   production schema migrations

-   destructive booking changes

-   financial-record deletion

-   refund decisions

-   unrestricted production SQL

-   payment credential changes

-   RLS modifications

-   bulk guest-data exports

-   removal of audit records

-   changes to its own authorization policy

-   privilege escalation

* * * * *

9\. Technology Architecture
===========================

The recommended core stack is:

Interface
---------

-   existing Next.js Staff OS

-   shadcn/ui

-   server-side data tables

-   charting library

-   Supabase client and server libraries

-   Zod

-   React Hook Form

Identity and Authorization
--------------------------

-   Supabase Auth

-   multifactor authentication for management

-   Supabase RLS

-   application-level staff roles

-   role-based approval permissions

Operational and Control Data
----------------------------

-   Supabase PostgreSQL

-   Supabase Realtime for selected live states

-   database views for approved analytics

-   `pgvector` only where semantic content retrieval is useful

Signal Ingestion
----------------

-   Cloudflare Workers

-   signed webhook verification

-   Zod event normalization

-   idempotency validation

Event Delivery
--------------

-   Cloudflare Queues

-   main event queue

-   retry handling

-   dead-letter queue

Durable Orchestration
---------------------

-   Cloudflare Workflows

-   workflow state

-   retries

-   durable waits

-   approval pauses

-   cancellation

-   rollback coordination

AI Intelligence
---------------

-   model-provider abstraction

-   structured AI outputs

-   controlled tool calling

-   read-only analytics tools

-   evidence-based prompts

-   Thai and English language routing

Repository Execution
--------------------

-   Codex CLI or SDK

-   GitHub Actions

-   private GitHub App

-   temporary isolated runner

-   branch creation

-   pull-request creation

-   CI check reporting

Repository Governance
---------------------

-   protected branches

-   required checks

-   protected deployment environments

-   separate staging and production secrets

-   path restrictions

-   command allowlists

-   CODEOWNERS where appropriate

Observability
-------------

-   Cloudflare Workers Observability

-   structured logs

-   trace IDs

-   correlation IDs

-   optional Sentry for browser and application errors

Artifact Storage
----------------

-   GitHub for code and content

-   Supabase for control records

-   Cloudflare R2 for large reports, screenshots, traces, and test artifacts

Communication
-------------

-   LINE Messaging API

-   Resend

-   Staff OS notifications

* * * * *

10\. Codex's Role
=================

Codex is the principal implementation and repository-execution agent.

Codex is used to:

-   build the AI Operating System

-   inspect the repository

-   implement orchestrator services

-   create dashboard views

-   write tests

-   implement analytics

-   create content

-   improve metadata

-   repair code

-   run approved commands

-   create branches and pull requests

-   prepare deployment changes

Codex is not:

-   the source of truth

-   the policy engine

-   the scheduler

-   the workflow database

-   the approval authority

-   the pricing authority

-   the payment authority

-   the production database administrator

The governing principle is:

> **Codex implements the action; the AI Intelligence Layer explains the action; the Policy Engine authorizes the action; the Workflow Engine controls the action.**

* * * * *

11\. Codex Execution Architecture
=================================

Codex should run in a constrained temporary execution environment.

```
Cloudflare Workflow
        │
        ▼
Private GitHub App
        │
        ▼
GitHub Actions Runner
        │
        ├── Clone repository
        ├── Load task envelope
        ├── Run Codex
        ├── Modify allowed paths
        ├── Run approved validation
        ├── Generate structured result
        ├── Push branch
        └── Open pull request
```

Codex task envelope
-------------------

Every task should specify:

-   workflow ID

-   playbook ID

-   objective

-   evidence

-   repository

-   base branch

-   allowed paths

-   forbidden paths

-   allowed commands

-   required tests

-   production-write permission

-   pull-request requirement

-   output schema

-   risk level

-   rollback expectations

Example:

```
{
  "runId": "run_01H...",
  "playbook": "seo-metadata-optimization",
  "objective": "Improve search presentation for the Suphanburi wedding venue page.",
  "evidence": {
    "impressions": 4200,
    "ctr": 0.012,
    "averagePosition": 5.8
  },
  "allowedPaths": [
    "apps/storefront/src/pages/weddings/**",
    "apps/storefront/src/content/**"
  ],
  "forbiddenPaths": [
    "supabase/migrations/**",
    "apps/ibe/src/payments/**",
    "apps/ibe/src/inventory/**"
  ],
  "allowedCommands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test",
    "npm run build"
  ],
  "requiredChecks": [
    "content-schema",
    "lint",
    "typecheck",
    "build"
  ],
  "productionWriteAllowed": false,
  "createPullRequest": true
}
```

Codex must return a structured result containing:

-   status

-   summary

-   files changed

-   commands run

-   checks passed

-   checks failed

-   unresolved risks

-   pull-request reference

-   recommended verification

-   rollback notes

* * * * *

12\. Next.js Staff OS Command Center
====================================

The Staff OS is the human control interface for the AI Operating System.

12.1 Master Command Center
--------------------------

**Route:**

```
/staff/growth/orchestrator
```

Displays:

-   active workflows

-   pending approvals

-   open incidents

-   failed steps

-   autonomous actions

-   deployments

-   system health

-   AI and API usage

-   current kill-switch status

-   recent commercial outcomes

12.2 Signal and Event Inbox
---------------------------

**Route:**

```
/staff/growth/orchestrator/events
```

Displays:

-   source

-   event type

-   severity

-   timestamp

-   affected system

-   evidence

-   confidence

-   duplicate status

-   related workflow

-   current state

Actions:

-   inspect

-   dismiss

-   mark duplicate

-   start playbook

-   escalate

-   attach evidence

12.3 Workflow Runs
------------------

**Route:**

```
/staff/growth/orchestrator/runs
```

Displays a step-by-step timeline:

```
Detected
✓ Measured
✓ Investigated
✓ Policy checked
✓ Codex dispatched
✓ Build verified
● Monitoring business outcome
```

Each step should show:

-   input

-   output

-   duration

-   retry count

-   model used

-   executor used

-   cost

-   logs

-   evidence

-   failure details

-   rollback availability

12.4 AI Insights
----------------

**Route:**

```
/staff/ai/insights
```

Displays:

-   detected problem or opportunity

-   affected KPI

-   AI explanation

-   ranked hypotheses

-   supporting evidence

-   confidence

-   recommended intervention

-   autonomy tier

-   expected outcome

-   associated action

12.5 SEO Command Center
-----------------------

**Route:**

```
/staff/growth/seo
```

Displays:

-   gaining queries

-   declining queries

-   high-impression, low-CTR queries

-   pages approaching page-one positions

-   content gaps

-   topic cannibalization

-   weak metadata

-   technical SEO problems

-   proposed articles

-   proposed landing pages

-   active SEO experiments

-   performance after implementation

-   booking contribution

12.6 Approval Queue
-------------------

**Route:**

```
/staff/growth/orchestrator/approvals
```

Each proposal should include:

-   proposed action

-   reason

-   triggering signal

-   evidence

-   AI confidence

-   expected commercial impact

-   operational risk

-   exact change or diff

-   expiry

-   rollback plan

-   requesting playbook

-   required approver role

Available actions:

-   approve

-   reject

-   request revision

-   delegate

-   schedule

-   expire

LINE should notify management and direct them to a secure authenticated approval flow.

A LINE button must not independently mutate privileged production state.

12.7 Incident Center
--------------------

**Route:**

```
/staff/growth/orchestrator/incidents
```

Incident lifecycle:

```
Detected
→ Investigating
→ Mitigating
→ Monitoring
→ Resolved
```

Displays:

-   severity

-   affected system

-   masked booking references

-   business impact

-   first occurrence

-   probable cause

-   correlated deployment

-   mitigation

-   owner

-   timeline

-   final root-cause analysis

12.8 Playbook Registry
----------------------

**Route:**

```
/staff/growth/orchestrator/playbooks
```

Each playbook includes:

-   name

-   version

-   owner

-   trigger

-   evidence requirements

-   autonomy tier

-   permitted tools

-   permitted paths

-   required checks

-   approval policy

-   retry policy

-   rollback policy

-   shadow-mode status

-   historical success rate

-   historical rollback rate

Controls:

-   enable

-   disable

-   run manually

-   run in shadow mode

-   modify thresholds

-   promote autonomy

-   demote autonomy

-   revert version

12.9 Executor Registry
----------------------

**Route:**

```
/staff/growth/orchestrator/executors
```

Displays:

-   executor name

-   purpose

-   allowed operations

-   repository permissions

-   credentials scope

-   last execution

-   health

-   success rate

-   average duration

-   usage cost

-   current version

12.10 Audit Explorer
--------------------

**Route:**

```
/staff/growth/orchestrator/audit
```

Searchable by:

-   workflow

-   event

-   booking reference

-   staff member

-   model

-   executor

-   playbook

-   pull request

-   deployment

-   approval

-   file path

-   date

-   incident

12.11 Learning and Outcomes Register
------------------------------------

**Route:**

```
/staff/ai/outcomes
```

Displays:

-   intervention

-   original hypothesis

-   KPI before

-   KPI after

-   technical result

-   commercial result

-   final classification

-   lessons

-   future recommendation

* * * * *

13\. Control-Plane Data Model
=============================

The control system should use connected tables rather than a single oversized event table.

Recommended entities:

```
system_events
metric_snapshots
workflow_runs
workflow_steps
workflow_events
ai_analysis_runs
ai_hypotheses
action_proposals
approval_requests
approval_decisions
agent_runs
tool_executions
verification_results
incidents
incident_updates
deployments
audit_entries
notification_deliveries
playbook_definitions
playbook_versions
policy_definitions
artifact_references
outcome_measurements
```

Core relationships:

```
System Event
    └── Workflow Run
          ├── AI Analysis
          │      └── Hypotheses
          ├── Action Proposal
          │      └── Approval Request
          │             └── Approval Decision
          ├── Agent Run
          │      └── Tool Executions
          ├── Verification Results
          ├── Deployment
          ├── Outcome Measurements
          └── Audit Entries
```

Every operational record should include:

-   ID

-   correlation ID

-   property ID

-   environment

-   source

-   status

-   severity

-   created timestamp

-   creator

-   metadata

-   data-classification level

* * * * *

14\. Source-of-Truth Boundaries
===============================

GitHub
------

Source of truth for:

-   application code

-   website content

-   schemas

-   tests

-   policies

-   prompts

-   playbook definitions

-   agent instructions

-   version history

Supabase
--------

Source of truth for:

-   bookings

-   holds

-   inventory state

-   staff identity and roles

-   approvals

-   incidents

-   normalized business events

-   workflow summaries

-   AI action records

-   outcome records

Payment Providers
-----------------

Source of truth for:

-   payment authorization

-   capture

-   settlement

-   refund state

-   disputes

Cloudflare
----------

Source of truth for:

-   active application versions

-   edge runtime health

-   deployment state

-   edge telemetry

-   queue and workflow execution state

Google Search Console and Analytics
-----------------------------------

Source of truth for their respective measured search and traffic data, subject to their reporting limits.

AI Models
---------

AI outputs are never a source of truth.

They are:

-   interpretations

-   hypotheses

-   classifications

-   drafts

-   plans

-   recommendations

Every consequential AI conclusion must be checked against authoritative systems.

* * * * *

15\. Model Strategy
===================

The AI Operating System should remain provider-independent.

Models may be routed according to:

-   task type

-   data sensitivity

-   Thai-language quality

-   reasoning quality

-   coding ability

-   latency

-   cost

-   grounding requirements

-   structured-output reliability

Potential roles include:

OpenAI models
-------------

-   operational analysis

-   structured decision plans

-   tool-based reasoning

-   Codex implementation

-   code review

-   technical repairs

Claude models
-------------

-   nuanced hospitality copy

-   Quiet Ledger brand voice

-   Thai and English transcreation

-   long-form editorial review

Gemini models
-------------

-   search-grounded research

-   local event research

-   fresh web context

-   competitor and destination research

Local or private models
-----------------------

-   sensitive offline classification

-   schema checks

-   data preprocessing

-   privacy-first internal processing

The core of the system is not a particular model.

The core is:

-   data

-   policy

-   workflow

-   permissions

-   verification

-   auditability

-   measurable outcomes

* * * * *

16\. Initial Execution Playbooks
================================

16.1 Checkout Conversion Anomaly
--------------------------------

**Initial autonomy:** Tier 0 diagnostics

Detect:

-   abnormal checkout completion decline

-   payment failure spike

-   device-specific regression

-   booking hold abandonment

Respond:

-   gather funnel evidence

-   correlate deployments

-   identify probable cause

-   alert staff

-   prepare repair task

-   dispatch Codex where allowed

-   verify recovery

16.2 Content Schema Repair
--------------------------

**Initial autonomy:** Tier 1

Detect:

-   invalid Markdown frontmatter

-   Zod schema failure

-   broken internal content references

-   missing required assets

Respond:

-   repair allowed content files

-   run schema validation

-   build Astro site

-   create pull request or merge within proven policy

16.3 SEO Opportunity Analysis
-----------------------------

**Initial autonomy:** Tier 0

Detect:

-   declining query

-   low CTR

-   page approaching page one

-   commercial content gap

-   weak landing-page conversion

Respond:

-   analyze intent

-   inspect existing content

-   choose intervention

-   prepare content brief

-   create preview or pull request

16.4 Metadata Optimization
--------------------------

**Initial autonomy:** Tier 1 after shadow testing

Detect:

-   high impressions

-   stable position

-   weak CTR

-   page-intent alignment

Respond:

-   improve title and description

-   verify H1 consistency

-   maintain factual accuracy

-   run build

-   measure CTR outcome

16.5 Core Web Vitals Regression
-------------------------------

**Initial autonomy:** Tier 0 or constrained Tier 1

Detect:

-   LCP, CLS, or INP regression

-   page-specific performance issue

Respond:

-   identify probable cause

-   inspect asset loading

-   create scoped optimization

-   run preview performance test

-   compare before and after

-   deploy only when improvement is demonstrated

16.6 Payment Webhook Incident
-----------------------------

**Initial autonomy:** Tier 0 diagnostics with emergency escalation

Detect:

-   repeated webhook failure

-   signature rejection

-   latency increase

-   booking/payment reconciliation issue

Respond:

-   correlate affected transactions

-   mask guest details

-   alert staff

-   provide manual recovery guidance

-   prepare technical remediation

16.7 Competitor Rate Proposal
-----------------------------

**Autonomy:** Tier 2

Detect:

-   material observed rate movement

-   relevant market-period change

Respond:

-   analyze occupancy and booking pace

-   estimate margin impact

-   create package or rate proposal

-   send authenticated approval request

-   apply only through validated pricing services after approval

* * * * *

17\. Security and Governance Requirements
=========================================

Required from the first implementation phase:

-   Supabase RLS

-   MFA for management

-   separate staff roles

-   separate executor identities

-   private GitHub App

-   short-lived repository credentials

-   staging and production separation

-   branch protection

-   required CI checks

-   protected deployment environments

-   command allowlists

-   repository path allowlists

-   signed webhook validation

-   idempotency keys

-   correlation IDs

-   PII masking

-   audit attribution

-   approval expiry

-   emergency kill switches

-   rollback procedures

Emergency controls
------------------

The Staff OS must support:

-   observe-only mode

-   disable all autonomous actions

-   disable one playbook

-   disable one executor

-   pause Codex dispatch

-   reject pending actions

-   pause outbound notifications

-   revoke GitHub access

-   stop production deployment

-   initiate rollback

* * * * *

18\. Important Product Boundaries
=================================

The platform should not initially attempt to become:

-   a full replacement for every PMS function

-   a fully autonomous revenue-management system

-   an unrestricted natural-language SQL interface

-   a visitor-identification surveillance system

-   an automatic content farm

-   a single all-powerful AI agent

-   a platform dependent on one model vendor

The "Ask AI Ops" interface should query:

-   approved read-only views

-   masked data

-   query templates

-   role-controlled datasets

-   row-limited results

It should not generate unrestricted production SQL.

Corporate or government network signals should be treated as uncertain organizational indicators, not proof of individual identity or intent.

AEO monitoring should be treated as sampled visibility research, not a precise ranking system equivalent to Google Search Console.

* * * * *

19\. Recommended Repository Structure
=====================================

```
/
├── AGENTS.md
├── apps/
│   ├── storefront/
│   ├── ibe/
│   └── staff-os/
├── services/
│   ├── signal-ingestion/
│   ├── orchestrator/
│   ├── github-app/
│   ├── line-bot/
│   ├── analytics/
│   └── verification/
├── packages/
│   ├── event-contracts/
│   ├── workflow-contracts/
│   ├── policy-engine/
│   ├── model-router/
│   ├── analytics-sdk/
│   ├── audit-sdk/
│   ├── supabase-client/
│   └── staff-ui/
├── playbooks/
│   ├── checkout-anomaly/
│   ├── content-schema-repair/
│   ├── seo-opportunity/
│   ├── metadata-optimization/
│   ├── cwv-regression/
│   ├── payment-webhook-incident/
│   └── competitor-rate-proposal/
├── policies/
│   ├── autonomy-policy.yaml
│   ├── data-classification.yaml
│   ├── command-allowlist.yaml
│   └── repository-path-policy.yaml
├── schemas/
│   ├── system-event.schema.json
│   ├── ai-analysis.schema.json
│   ├── action-proposal.schema.json
│   └── agent-result.schema.json
├── scripts/
│   ├── agent/
│   ├── analytics/
│   ├── verify/
│   └── deploy/
└── docs/
    ├── architecture/
    ├── decisions/
    ├── playbooks/
    ├── incidents/
    └── runbooks/
```

* * * * *

20\. Recommended Build Sequence
===============================

Phase 1 --- Trusted Control Foundation
------------------------------------

Build:

-   normalized event contracts

-   control-plane tables

-   correlation IDs

-   policy definitions

-   autonomy classifications

-   audit records

-   staff roles

-   MFA

-   orchestrator dashboard

-   playbook registry

-   kill switches

Operate in observe-only mode.

Phase 2 --- Intelligence and Executive Reporting
----------------------------------------------

Build:

-   deterministic analytics

-   AI analysis schemas

-   checkout anomaly reports

-   SEO opportunity reports

-   weekly executive briefing

-   reliability summaries

-   booking and conversion trends

-   AI Insights dashboard

No autonomous production changes.

Phase 3 --- Durable Event and Workflow Layer
------------------------------------------

Build:

-   Cloudflare ingestion Workers

-   Cloudflare Queues

-   dead-letter handling

-   Cloudflare Workflows

-   retries

-   approval waits

-   cancellation

-   workflow timelines

Phase 4 --- Codex Execution Platform
----------------------------------

Build:

-   private GitHub App

-   GitHub Actions executor

-   Codex task envelopes

-   structured Codex results

-   branch and pull-request creation

-   CI check reporting

-   approved command execution

First autonomous playbook:

-   content schema repair

Phase 5 --- Independent Verification
----------------------------------

Build:

-   lint

-   typecheck

-   unit tests

-   integration tests

-   Playwright

-   preview deployments

-   webhook replay

-   performance comparison

-   post-deployment monitoring

-   rollback automation

Phase 6 --- SEO Growth Automation
-------------------------------

Build:

-   GSC ingestion

-   search opportunity scoring

-   content inventory

-   cannibalization checks

-   metadata recommendations

-   page-improvement recommendations

-   localized content briefs

-   Thai and English review

-   SEO outcome measurement

Begin with previews and pull requests.

Phase 7 --- Human-Gated Commercial Intelligence
---------------------------------------------

Build:

-   approval queue

-   secure LINE notifications

-   approval expiry

-   MFA enforcement

-   competitor-rate proposals

-   package recommendations

-   corporate campaign drafts

-   authenticated execution

Phase 8 --- Proven Autonomous Operations
--------------------------------------

Promote selected playbooks only after they demonstrate:

-   high success rate

-   low rollback rate

-   reliable factual accuracy

-   stable technical verification

-   measurable business benefit

-   no policy violations

* * * * *

21\. Canonical Architecture
===========================

```
CUSTOMERS AND STAFF
        │
        ├── Astro Commercial Storefront
        ├── Next.js Booking Engine
        └── Next.js Staff OS
                    │
                    ▼
         HOTEL COMMERCE AND OPERATIONS CORE
     Supabase + Tetris Holds + Payments + Notifications
                    │
                    ▼
             MULTI-SOURCE SIGNAL LAYER
 Search / Traffic / Booking / Payment / Reliability / Market
                    │
                    ▼
          DETERMINISTIC ANALYTICS LAYER
 Baselines / Funnels / Trends / Segments / Anomaly Detection
                    │
                    ▼
             AI INTELLIGENCE LAYER
 Investigate / Explain / Hypothesize / Select Intervention
                    │
                    ▼
          POLICY AND AUTONOMY CONTROL
       Tier 0 / Tier 1 / Tier 2 / Tier 3
                    │
                    ▼
            DURABLE WORKFLOW ENGINE
 Retry / Wait / Approve / Execute / Cancel / Roll Back
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
      Codex       Human      Blocked
     Executor    Approval    Actions
         │          │
         └──────────┴──────────┐
                               ▼
                  INDEPENDENT VERIFICATION
             Tests / Preview / Health / KPI Outcome
                               │
                               ▼
                   AUDIT AND LEARNING SYSTEM
                               │
                               ▼
              STAFF OS / LINE / EXECUTIVE BRIEF
```

* * * * *

22\. Final Product Statement
============================

Sri U-Thong Grand Hotel is building an **AI-native Hotel Commercial Operating System** on top of its owned direct-booking infrastructure.

The system unifies:

-   hotel commerce

-   booking operations

-   growth intelligence

-   SEO improvement

-   technical reliability

-   AI-assisted engineering

-   commercial decision support

-   executive governance

It continuously observes operational and commercial signals, measures abnormal or promising changes, uses AI to interpret the evidence, selects the most appropriate intervention, applies deterministic authorization policies, dispatches constrained executors such as Codex, verifies the technical and business results, and maintains a complete audit and learning history.

Its purpose is not simply to automate tasks.

Its purpose is to create a controlled improvement loop for the hotel:

> **Detect what matters, understand why it matters, take the safest useful action, prove whether it worked, and give management complete visibility and control.**

The defining advantage of the Sri U-Thong Grand Hotel AI Operating System is:

> **Controlled intelligence and automation built on hotel-owned infrastructure, hotel-owned data, hotel-owned commercial channels, and hotel-defined policy.**