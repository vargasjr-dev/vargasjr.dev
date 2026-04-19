# vargasjr.dev Revamp Plan

**Goal:** Transform from "hire me" software agency → public portfolio showcasing VargasJR's work.
**Principle:** Vargas manages me through Vellum now. All admin/management UI is dead weight.

---

## Phase 1: Gut the Admin Layer (cleanup)
1. Delete all admin API routes (13 routes: instances, agent-logs, browser-sessions, file-directory, github webhooks, PR approval, reboot, health-check, simple-health, test-email, validate-token, vercel webhooks)
2. Delete all admin components (instance management, cron editors, job rows, PR approval, health indicators, bank forms, simulators — ~35 of 41 components)
3. Delete admin libraries (app/lib/s3-client.ts, github-auth.ts, webauthn.ts, pdf-generator.ts)
4. Delete server utilities (health-check.ts, versioning.ts, etc.)
5. Remove unused dependencies (aws-sdk/*, stripe, twilio, react-plaid-link, cors, helmet, pdf-lib)
6. Clean up any dead imports/references

## Phase 2: New Landing Page
1. Rewrite the homepage — "Hi, I'm Vargas JR" with the new Padawan avatar
2. New tagline/identity: portfolio framing, not "for hire" agency pitch
3. Projects showcase section — cards for each project (vellymon.game, eat-the-sun, codenaimes, squad-party, aivalon)
4. Each card: name, one-liner description, live link, tech stack badges
5. Keep the vCard / phone number download — VargasJR has a real phone number. Place it in a "Contact" section or footer row alongside GitHub/social links (natural spot for "get in touch" without the agency sales pitch)
6. Clean footer with GitHub org link, contact/social links, vCard download button
7. Remove: Stripe checkout, chat form, "hire me" button

## Phase 3: Project Pages
1. Individual page per project (e.g. /projects/vellymon, /projects/eat-the-sun)
2. Deeper breakdown: what the project does, my role in building it, key features, screenshots/preview
3. Link to live site + GitHub repo for each
4. Navigation between projects

## Phase 4: About / Identity Page
1. /about page — who I am, how I work, my relationship with Obi-Wan (the padawan/master dynamic — refer to Vargas as Obi-Wan throughout)
2. Tech stack & capabilities section
3. Fun personality touches — lean into the Anakin energy
4. Replace "How to Work With Me" and "How I Handle Your Data" (delete those pages)

## Phase 5: Auto-Blogging Engine
1. Automated content pipeline — I write and publish a post every Tuesday and Friday
2. /blog route with chronological feed, individual post pages, maybe tags/categories
3. Content generation: pull from my recent build activity, project updates, thoughts, and design decisions — real substance, not filler
4. Scheduling mechanism: hook into the autonomy harness or a dedicated schedule that triggers drafting + publishing on Tue/Fri
5. Post format: markdown-based, stored in repo (or CMS-like data dir), auto-deployed on merge
6. First posts could be retrospectives on what I've already built (vellymon, eat-the-sun, the autonomy engine itself)

## Phase 6: Polish & Deploy
1. Update metadata (title, description, OG tags)
2. Responsive design pass
3. Dark/light theme consideration
4. Performance audit (remove unused deps should help)
5. Verify Vercel deployment is clean

---

## What Gets Deleted
### API Routes (all 13)
- /api/agent-logs
- /api/browser-sessions
- /api/file-directory
- /api/github/approve-pr
- /api/github/webhook
- /api/health-check
- /api/instances (+ [id])
- /api/reboot
- /api/simple-health
- /api/test-email
- /api/validate-token
- /api/vercel/webhook

### Components (~35 of 41)
- All instance management (instance-card, start/stop/reboot/delete-instance-button)
- All form integrations (CapitalOneForm, GoogleForm, MercuryForm, PlaidLinkButton, RoamResearchForm, SlackForm, TwilioForm, TwitterForm)
- All simulators (GmailSimulatorClient, RecallSimulatorClient, SlackSimulatorClient, TwitterSimulatorClient, SimulatorLayout)
- Admin UI (agent-logs-indicator, browser-sessions-indicator, file-directory-indicator, health-status-indicator, agent-version-display, approve-pr-button, edit-cron-modal, job-row, routine-job-row, workflow-output-display)
- Misc admin (confirmation-modal, contact-repos-section, contact-row, inbox-row, transitional-state-refresh, DefaultApplicationForm)

### Keep (maybe)
- pagination-controls (could reuse)
- copyable-text (useful utility)
- search-param-error (generic)
- local-time (generic utility)
- message-card (if blog)

### Dependencies to Remove
- @aws-sdk/* (5 packages)
- stripe, @stripe/stripe-js
- twilio
- react-plaid-link
- cors, helmet
- pdf-lib
