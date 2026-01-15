# Therapy Intake System - Complete Design Document

**Version:** 1.0
**Date:** January 14, 2026
**Project:** Automated Therapy Practice Intake System

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Technology Stack](#3-technology-stack)
4. [MCP Server Configuration](#4-mcp-server-configuration)
5. [Application Architecture](#5-application-architecture)
6. [Data Model](#6-data-model)
7. [Workflow Implementations](#7-workflow-implementations)
8. [User Interface Design](#8-user-interface-design)
9. [Security & Compliance](#9-security--compliance)
10. [Integration Details](#10-integration-details)
11. [Implementation Phases](#11-implementation-phases)
12. [Gap Analysis & Recommendations](#12-gap-analysis--recommendations)
13. [Verification Plan](#13-verification-plan)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

This document outlines the complete technical design for an automated therapy practice intake system. The system manages potential clients from initial website inquiry through scheduling, automating email outreach, follow-ups, and clinician matching.

### Key Features
- Automated form processing from Google Forms
- Intelligent client evaluation and routing
- Email template system with preview and send
- Real-time inbox monitoring for client replies
- Clinician matching algorithm based on insurance and availability
- Scheduling integration with Google Calendar
- Simple Practice sync helper
- Full audit logging for HIPAA compliance

### Confirmed Requirements
| Requirement | Decision |
|-------------|----------|
| Form Source | Google Forms → Google Sheets |
| User Roles | Admin + Intake Coordinator(s) |
| Email Sender | General practice inbox |
| Follow-up Intervals | Configurable via admin UI |
| Real-time Updates | Yes - WebSocket/SSE |
| Paperwork Workflow | Deferred to post-MVP |

---

## 2. System Overview

### High-Level Architecture

```
┌──────────────────┐
│   Google Form    │  (Website intake form)
│   (Website)      │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE SHEETS (Data Layer)                           │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Clients    │ │Communications│ │ Clinicians  │ │ Templates   │          │
│  └─────────────┘ └──────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐                          │
│  │ Availability│ │  AuditLog    │ │  Criteria   │                          │
│  └─────────────┘ └──────────────┘ └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APPLICATION                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Routes                                   │   │
│  │  /auth  /clients  /emails  /clinicians  /scheduling  /webhooks      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Services Layer                               │   │
│  │  EvaluationService  EmailService  MatchingService  SchedulingService │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         React Dashboard                              │   │
│  │  ClientTable  EmailPreview  CommunicationChain  AvailabilityPicker   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Gmail API  │      │Calendar API │      │Simple Practice│
│  (Send/Recv)│      │(Availability)│      │  (Manual)    │
└─────────────┘      └─────────────┘      └─────────────┘
```

### Workflow Summary

| Workflow | Name | Description |
|----------|------|-------------|
| A | Form Processing | Capture form → evaluate → route |
| B | Initial Outreach | Generate email → preview → send |
| C | Follow-Ups | Track responses → auto follow-up |
| D | Response Handling | Detect replies → categorize → route |
| E | Scheduling | Match clinician → book → sync to SP |
| R | Referrals | Generate referral → send → close |

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 14+ (App Router) | React framework with API routes |
| Language | TypeScript | Type safety |
| Auth | NextAuth.js + Google OAuth 2.0 | Authentication with Google Workspace |
| Styling | Tailwind CSS + shadcn/ui | UI components |
| State | Zustand + TanStack Query | Client & server state management |
| Data | Google Sheets API | Primary data store |
| Email | Gmail API + Pub/Sub | Send/receive email, push notifications |
| Calendar | Google Calendar API | Clinician availability |
| Testing | Playwright MCP | End-to-end testing |
| Docs | Context7 MCP | Up-to-date documentation |
| Hosting | Vercel | Deployment (HIPAA option available) |

---

## 4. MCP Server Configuration

### Context7 MCP (Documentation)
Provides up-to-date, version-specific documentation for libraries.

```bash
# Add to Claude Code
claude mcp add context7 npx @upstash/context7-mcp@latest
```

**Usage:** Include "use context7" in prompts to fetch current docs.

### Playwright MCP (Testing)
Browser automation for E2E testing.

```bash
# Add to Claude Code
claude mcp add playwright npx @playwright/mcp@latest

# Pre-install browsers (required)
npx playwright install
npx playwright install-deps
```

**Configuration options:**
- `--browser`: chromium, firefox, webkit
- `--headless`: Run without UI
- `--isolated`: In-memory browser profile

---

## 5. Application Architecture

### Folder Structure

```
/intake-system
├── .env.local                    # Environment variables (never commit)
├── .env.example                  # Template for environment variables
├── next.config.js
├── package.json
├── tsconfig.json
├── middleware.ts                 # Auth protection, rate limiting
│
├── /app                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Dashboard redirect
│   ├── globals.css
│   │
│   ├── /api                     # API Routes
│   │   ├── /auth
│   │   │   └── [...nextauth]
│   │   │       └── route.ts    # NextAuth.js configuration
│   │   │
│   │   ├── /webhooks
│   │   │   ├── /gmail
│   │   │   │   └── route.ts    # Gmail Pub/Sub push endpoint
│   │   │   └── /form-submission
│   │   │       └── route.ts    # Google Forms new row detection
│   │   │
│   │   ├── /clients
│   │   │   ├── route.ts        # GET all, POST new
│   │   │   ├── /[id]
│   │   │   │   ├── route.ts    # GET, PATCH, DELETE individual
│   │   │   │   └── /emails
│   │   │   │       └── route.ts # GET communication chain
│   │   │   └── /evaluate
│   │   │       └── route.ts    # POST criteria evaluation
│   │   │
│   │   ├── /emails
│   │   │   ├── /generate
│   │   │   │   └── route.ts    # POST generate email from template
│   │   │   ├── /send
│   │   │   │   └── route.ts    # POST send email via Gmail
│   │   │   ├── /templates
│   │   │   │   └── route.ts    # GET/POST email templates
│   │   │   └── /inbox
│   │   │       └── route.ts    # GET inbox messages
│   │   │
│   │   ├── /clinicians
│   │   │   ├── route.ts        # GET all clinicians
│   │   │   ├── /[id]
│   │   │   │   └── route.ts    # GET individual
│   │   │   └── /availability
│   │   │       └── route.ts    # GET/POST availability slots
│   │   │
│   │   ├── /scheduling
│   │   │   ├── /match
│   │   │   │   └── route.ts    # POST clinician matching
│   │   │   ├── /book
│   │   │   │   └── route.ts    # POST create appointment
│   │   │   └── /simple-practice
│   │   │       └── route.ts    # POST generate SP data
│   │   │
│   │   ├── /settings
│   │   │   └── route.ts        # GET/POST system settings
│   │   │
│   │   └── /cron
│   │       ├── /follow-ups
│   │       │   └── route.ts    # Scheduled follow-up check
│   │       └── /gmail-watch-renew
│   │           └── route.ts    # Renew Gmail watch (weekly)
│   │
│   ├── /(auth)                  # Auth route group
│   │   ├── /login
│   │   │   └── page.tsx
│   │   └── /logout
│   │       └── page.tsx
│   │
│   └── /(dashboard)             # Protected dashboard routes
│       ├── layout.tsx           # Dashboard layout with sidebar
│       ├── /page.tsx            # Dashboard overview
│       │
│       ├── /inbox
│       │   ├── page.tsx         # New submissions view
│       │   └── /[id]
│       │       └── page.tsx     # Individual submission detail
│       │
│       ├── /clients
│       │   ├── page.tsx         # All clients table
│       │   ├── /[id]
│       │   │   └── page.tsx     # Client detail/communication
│       │   └── /referrals
│       │       └── page.tsx     # Referrals table
│       │
│       ├── /outreach
│       │   ├── page.tsx         # Pending outreach queue
│       │   └── /follow-ups
│       │       └── page.tsx     # Follow-up management
│       │
│       ├── /scheduling
│       │   ├── page.tsx         # Ready to schedule queue
│       │   └── /scheduled
│       │       └── page.tsx     # Scheduled clients
│       │
│       ├── /clinicians
│       │   ├── page.tsx         # Clinician management
│       │   └── /[id]
│       │       └── page.tsx     # Individual clinician
│       │
│       ├── /templates
│       │   └── page.tsx         # Email template management
│       │
│       └── /settings
│           └── page.tsx         # System settings (admin only)
│
├── /components
│   ├── /ui                      # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   └── ...
│   │
│   ├── /layout
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   └── UserMenu.tsx
│   │
│   ├── /clients
│   │   ├── ClientTable.tsx
│   │   ├── ClientRow.tsx
│   │   ├── ClientDetail.tsx
│   │   ├── ClientStatusBadge.tsx
│   │   ├── CommunicationChain.tsx
│   │   └── EvaluationPanel.tsx
│   │
│   ├── /emails
│   │   ├── EmailPreviewModal.tsx
│   │   ├── EmailEditor.tsx
│   │   ├── EmailTemplateSelector.tsx
│   │   ├── EmailThread.tsx
│   │   └── SendButton.tsx
│   │
│   ├── /scheduling
│   │   ├── AvailabilityPicker.tsx
│   │   ├── ClinicianMatcher.tsx
│   │   ├── TimeSlotSelector.tsx
│   │   ├── BookingForm.tsx
│   │   └── SimplePracticeSync.tsx
│   │
│   └── /dashboard
│       ├── StatsCards.tsx
│       ├── RecentActivity.tsx
│       ├── PendingActions.tsx
│       └── QuickActions.tsx
│
├── /lib
│   ├── /api
│   │   ├── google-sheets.ts     # Sheets API client
│   │   ├── gmail.ts             # Gmail API client
│   │   ├── google-calendar.ts   # Calendar API client
│   │   └── simple-practice.ts   # SP helper functions
│   │
│   ├── /auth
│   │   ├── auth-options.ts      # NextAuth configuration
│   │   └── session.ts           # Session utilities
│   │
│   ├── /services
│   │   ├── client-service.ts    # Client business logic
│   │   ├── email-service.ts     # Email generation/sending
│   │   ├── evaluation-service.ts # Criteria checking
│   │   ├── matching-service.ts  # Clinician matching
│   │   ├── scheduling-service.ts # Booking logic
│   │   └── sync-service.ts      # Data synchronization
│   │
│   ├── /templates
│   │   ├── template-engine.ts   # Email template rendering
│   │   └── /defaults
│   │       ├── initial-outreach.ts
│   │       ├── follow-up-1.ts
│   │       ├── follow-up-2.ts
│   │       ├── additional-times.ts
│   │       ├── questions-response.ts
│   │       └── referral.ts
│   │
│   ├── /utils
│   │   ├── date-utils.ts        # Follow-up calculations
│   │   ├── encryption.ts        # Data encryption helpers
│   │   ├── audit-log.ts         # Audit trail utilities
│   │   └── validators.ts        # Input validation
│   │
│   └── /constants
│       ├── statuses.ts          # Client status constants
│       ├── insurance.ts         # Insurance panel data
│       └── criteria.ts          # Evaluation criteria
│
├── /hooks
│   ├── useClients.ts
│   ├── useEmail.ts
│   ├── useClinicians.ts
│   ├── useAvailability.ts
│   └── useRealTimeSync.ts
│
├── /types
│   ├── client.ts
│   ├── clinician.ts
│   ├── email.ts
│   ├── appointment.ts
│   ├── sheets.ts
│   └── api.ts
│
├── /stores                      # Zustand stores
│   ├── client-store.ts
│   ├── ui-store.ts
│   └── notification-store.ts
│
└── /tests
    ├── /e2e                     # Playwright tests
    │   ├── intake-flow.spec.ts
    │   ├── outreach.spec.ts
    │   └── scheduling.spec.ts
    └── /unit
        ├── evaluation.test.ts
        └── matching.test.ts
```

---

## 6. Data Model

### Sheet 1: Clients (Main)

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID, auto-generated |
| createdAt | datetime | Submission timestamp |
| updatedAt | datetime | Last modification |
| **status** | enum | Client workflow status |
| source | string | "google_form" / "manual" |
| firstName | string | Client first name |
| lastName | string | Client last name |
| email | string | Client email |
| phone | string | Client phone |
| dateOfBirth | date | DOB (encrypted) |
| insuranceProvider | string | Insurance company |
| insuranceMemberId | string | Member ID (encrypted) |
| preferredTimes | string[] | JSON array of preferences |
| requestedClinician | string | Clinician ID if specified |
| assignedClinician | string | Matched clinician ID |
| presentingConcerns | text | Form response text |
| evaluationScore | number | Criteria check score |
| evaluationNotes | text | Auto-generated notes |
| referralReason | string | If routed to referral |
| initialOutreachDate | datetime | First email sent |
| followUp1Date | datetime | 1st follow-up sent |
| followUp2Date | datetime | 2nd follow-up sent |
| nextFollowUpDue | date | Calculated due date |
| scheduledDate | datetime | Appointment date |
| simplePracticeId | string | SP client ID |
| paperworkComplete | boolean | Simple status flag |
| closedDate | datetime | When closed |
| closedReason | string | Closure reason |

### Client Status Values

```typescript
enum ClientStatus {
  NEW = 'new',                           // Just submitted
  EVALUATING = 'evaluating',             // Under review
  PENDING_OUTREACH = 'pending_outreach', // Ready for initial email
  OUTREACH_SENT = 'outreach_sent',       // Initial email sent
  FOLLOW_UP_1 = 'follow_up_1',           // 1st follow-up sent
  FOLLOW_UP_2 = 'follow_up_2',           // 2nd follow-up sent
  REPLIED = 'replied',                   // Client responded
  READY_TO_SCHEDULE = 'ready_to_schedule',
  SCHEDULED = 'scheduled',               // Appointment booked
  PAPERWORK_PENDING = 'paperwork_pending',
  ACTIVE = 'active',                     // Fully onboarded
  CLOSED_NO_CONTACT = 'closed_no_contact',
  CLOSED_REFERRAL = 'closed_referral',
  CLOSED_OTHER = 'closed_other'
}
```

### Sheet 2: Communications

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| clientId | string | FK to Clients |
| timestamp | datetime | When sent/received |
| direction | enum | "inbound" / "outbound" |
| type | enum | Email type category |
| gmailMessageId | string | Gmail API message ID |
| gmailThreadId | string | Gmail thread ID |
| subject | string | Email subject |
| bodyPreview | text | First 500 chars |
| fullBody | text | Complete email body |
| sentBy | string | User ID who sent |

### Sheet 3: Clinicians

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| firstName | string | |
| lastName | string | |
| email | string | |
| calendarId | string | Google Calendar ID |
| simplePracticeId | string | SP clinician ID |
| insurancePanels | string[] | JSON array of accepted insurance |
| specialties | string[] | JSON array of specialties |
| newClientCapacity | number | Current capacity |
| isAcceptingNew | boolean | Currently accepting |
| defaultSessionLength | number | Minutes |

### Sheet 4: Availability

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| clinicianId | string | FK to Clinicians |
| dayOfWeek | number | 0-6 (Sunday-Saturday) |
| startTime | time | HH:MM format |
| endTime | time | HH:MM format |
| isRecurring | boolean | Weekly recurring |
| specificDate | date | For one-off availability |
| isBooked | boolean | Slot taken |
| bookedClientId | string | FK to Clients if booked |

### Sheet 5: EmailTemplates

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| name | string | Template identifier |
| type | enum | Template type |
| subject | string | Subject with {{variables}} |
| body | text | Body with {{variables}} |
| isActive | boolean | Currently in use |
| updatedAt | datetime | Last modified |
| updatedBy | string | User who modified |

### Sheet 6: AuditLog

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| timestamp | datetime | When action occurred |
| userId | string | Who performed action |
| userEmail | string | User email |
| action | string | Action type |
| entityType | string | "client" / "clinician" / etc |
| entityId | string | ID of affected entity |
| previousValue | text | JSON of previous state |
| newValue | text | JSON of new state |
| ipAddress | string | User IP |

### Sheet 7: EvaluationCriteria

| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| name | string | Criteria name |
| type | enum | "keyword" / "field_condition" |
| field | string | Form field to check |
| operator | enum | "contains" / "equals" / "matches_regex" |
| value | string | Value to match |
| action | enum | "flag_referral" / "flag_priority" / "score_adjust" |
| weight | number | Score adjustment |
| isActive | boolean | Currently active |

### Sheet 8: Settings

| Column | Type | Description |
|--------|------|-------------|
| key | string | Setting name |
| value | string | Setting value |
| updatedAt | datetime | Last modified |
| updatedBy | string | User who modified |

---

## 7. Workflow Implementations

### Workflow A: Form Processing

**Trigger:** New row in Google Form responses sheet

**Steps:**
1. Detect new form submission (poll or Apps Script trigger)
2. Create client record in Clients sheet with status `NEW`
3. Run evaluation service:
   - Check against EvaluationCriteria rules
   - Calculate score based on keyword matches
   - Flag any referral triggers
4. Route based on evaluation:
   - No referral flags → status `PENDING_OUTREACH`
   - Referral flags → show in Referrals queue

**API Endpoint:** `POST /api/webhooks/form-submission`

### Workflow B: Initial Outreach

**Trigger:** User clicks "Generate Email" for client with `PENDING_OUTREACH`

**Steps:**
1. Load client data from Sheets
2. Run clinician matching algorithm:
   - Filter by accepted insurance
   - Filter by availability matching preferences
   - Sort by capacity/priority
3. Generate available time slots from matched clinician's calendar
4. Render email template with:
   - Client name
   - Matched clinician name
   - Top 3-5 availability slots
5. Display preview modal for editing
6. On "Send":
   - Send via Gmail API
   - Log to Communications sheet
   - Update client status to `OUTREACH_SENT`
   - Calculate and set `nextFollowUpDue`

**API Endpoints:**
- `POST /api/emails/generate`
- `POST /api/emails/send`

### Workflow C: Follow-Ups

**Trigger:** Cron job (daily) or manual queue review

**Steps:**
1. Query clients where:
   - Status is `OUTREACH_SENT`, `FOLLOW_UP_1`, or `FOLLOW_UP_2`
   - `nextFollowUpDue` is today or past
2. For each client in queue:
   - Generate appropriate follow-up email
   - Display in follow-up queue with Preview/Send actions
3. On send:
   - Log to Communications
   - Update status to next follow-up state
   - Calculate new `nextFollowUpDue`
4. After `FOLLOW_UP_2` with no response:
   - Update status to `CLOSED_NO_CONTACT`

**API Endpoint:** `GET /api/cron/follow-ups`

### Workflow D: Response Handling

**Trigger:** Gmail Pub/Sub push notification

**Steps:**
1. Receive push notification at `/api/webhooks/gmail`
2. Fetch new message details from Gmail API
3. Match to existing client by:
   - Email address match
   - Gmail thread ID match
4. If matched:
   - Add to Communications sheet
   - Update client status to `REPLIED`
   - Show reply indicator in dashboard
5. User reviews reply and categorizes:
   - "Ready to Schedule" → status `READY_TO_SCHEDULE`
   - "Needs More Times" → generate additional times email
   - "Has Questions" → generate response email

**API Endpoint:** `POST /api/webhooks/gmail`

### Workflow E: Scheduling

**Trigger:** User clicks "Schedule" for client with `READY_TO_SCHEDULE`

**Steps:**
1. Display booking form with:
   - Client info summary
   - Assigned clinician (or select)
   - Available time slots
   - Recurrence options
2. On confirm:
   - Create Google Calendar event
   - Remove slot from availability pool
   - Update client status to `SCHEDULED`
   - Send confirmation email to client
   - Send notification email to clinician
3. Generate Simple Practice data:
   - Format required fields
   - Display "Copy to SP" button
   - Show checklist of SP steps
4. Mark as synced when confirmed

**API Endpoints:**
- `POST /api/scheduling/book`
- `POST /api/scheduling/simple-practice`

### Workflow R: Referrals

**Trigger:** Client flagged for referral in evaluation

**Steps:**
1. Display in Referrals queue with referral reason
2. User generates referral email from template
3. Preview and edit if needed
4. On send:
   - Send via Gmail API
   - Log to Communications
   - Update status to `CLOSED_REFERRAL`

---

## 8. User Interface Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Logo | Therapy Intake System          [Notifications] [User Menu] │
├──────────────┬──────────────────────────────────────────────────────────────┤
│              │                                                              │
│   SIDEBAR    │                    MAIN CONTENT AREA                         │
│              │                                                              │
│  ┌─────────┐ │  ┌─────────────────────────────────────────────────────────┐ │
│  │ Inbox   │ │  │  DASHBOARD (Overview)                                   │ │
│  │ (new)   │ │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  ├─────────┤ │  │  │ New: 5   │ │Outreach:8│ │Follow-up:3│ │Schedule:2│   │ │
│  │ Clients │ │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  │         │ │  └─────────────────────────────────────────────────────────┘ │
│  ├─────────┤ │                                                              │
│  │Outreach │ │  ┌─────────────────────────────────────────────────────────┐ │
│  │         │ │  │  PENDING ACTIONS TABLE                                  │ │
│  ├─────────┤ │  │  ┌────────┬────────┬──────────┬───────────────────────┐ │ │
│  │Schedule │ │  │  │ Client │ Status │ Due Date │ Actions               │ │ │
│  │         │ │  │  ├────────┼────────┼──────────┼───────────────────────┤ │ │
│  ├─────────┤ │  │  │ Jane D │ New    │ Today    │ [Evaluate] [Preview]  │ │ │
│  │Referrals│ │  │  │ John S │ F/U 1  │ Overdue  │ [Preview] [Send]      │ │ │
│  │         │ │  │  │ Mary K │ Ready  │ -        │ [Schedule]            │ │ │
│  ├─────────┤ │  │  └────────┴────────┴──────────┴───────────────────────┘ │ │
│  │Clinician│ │  └─────────────────────────────────────────────────────────┘ │
│  │         │ │                                                              │
│  ├─────────┤ │  ┌─────────────────────────────────────────────────────────┐ │
│  │Templates│ │  │  RECENT ACTIVITY FEED (Real-time)                       │ │
│  │         │ │  │  • New form submission from "Alex B" - 2 min ago        │ │
│  ├─────────┤ │  │  • Reply received from "Jane D" - 15 min ago            │ │
│  │Settings │ │  │  • Email sent to "Sam P" - 1 hour ago                   │ │
│  │ (admin) │ │  └─────────────────────────────────────────────────────────┘ │
│  └─────────┘ │                                                              │
│              │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### Client Detail View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Clients                              [Edit] [Archive] [Schedule] │
├─────────────────────────────────────────────────────────────────────────────┤
│  CLIENT INFO CARD                    │  COMMUNICATION CHAIN                 │
│  ┌─────────────────────────────────┐ │  ┌─────────────────────────────────┐ │
│  │ Jane Doe                        │ │  │ ▼ Initial Outreach (Jan 10)    │ │
│  │ jane@email.com | 555-1234       │ │  │   Subject: Appointment Options │ │
│  │ Insurance: Blue Cross           │ │  │   [View Full Email]            │ │
│  │ Preferred: Evenings, Weekends   │ │  ├─────────────────────────────────┤ │
│  │ Status: REPLIED                 │ │  │ ◀ Client Reply (Jan 12)        │ │
│  │ Assigned: Dr. Smith             │ │  │   "Tuesday works for me..."    │ │
│  └─────────────────────────────────┘ │  │   [View Full Email]            │ │
│                                      │  ├─────────────────────────────────┤ │
│  EVALUATION RESULTS                  │  │ ▼ Response Sent (Jan 12)       │ │
│  ┌─────────────────────────────────┐ │  │   "Great! Confirming Tues..."  │ │
│  │ Score: 85 - Potential Client    │ │  └─────────────────────────────────┘ │
│  │ Insurance: ✓ Accepted           │ │                                      │
│  │ Keywords: No flags              │ │  [Generate Reply] [View in Gmail]   │
│  └─────────────────────────────────┘ │                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Email Preview Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Preview Email                                                      [Close] │
├─────────────────────────────────────────────────────────────────────────────┤
│  To: jane@email.com                                                         │
│  From: intake@therapypractice.com                                           │
│  Subject: [Editable] Appointment Availability at Therapy Practice           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Dear Jane,                                                                 │
│                                                                             │
│  Thank you for reaching out to Therapy Practice. Based on your preferences, │
│  Dr. Smith has the following availability:                                  │
│                                                                             │
│  • Tuesday, Jan 15 at 6:00 PM                                              │
│  • Wednesday, Jan 16 at 7:00 PM                                            │
│  • Saturday, Jan 19 at 10:00 AM                                            │
│                                                                             │
│  [Edit Email Body]                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                              [Cancel]  [Send Email →]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Settings Page (Admin)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Settings                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Follow-Up Intervals] [Email Templates] [Referral Rules] [Clinicians]      │
├─────────────────────────────────────────────────────────────────────────────┤
│  FOLLOW-UP INTERVALS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1st Follow-up after: [3] business days                              │   │
│  │ 2nd Follow-up after: [5] business days                              │   │
│  │ Auto-close after:    [7] business days                              │   │
│  │                                                     [Save Changes]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  REFERRAL RULES                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Rule 1: If "concerns" contains "crisis" → Flag Referral             │   │
│  │ Rule 2: If "concerns" contains "suicidal" → Flag Referral           │   │
│  │ Rule 3: If "insurance" = "None" → Score -10                         │   │
│  │                                                        [Add Rule]    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Security & Compliance

### HIPAA-Adjacent Security Measures

| Requirement | Implementation |
|-------------|----------------|
| Access Controls | NextAuth.js + role-based middleware |
| Audit Controls | AuditLog sheet + all actions logged |
| Integrity Controls | Encrypted fields + version history |
| Transmission Security | HTTPS only + TLS 1.2+ |
| BAA Requirement | Must sign Google Workspace BAA |
| Data Retention | Configurable policies in settings |

### Encryption Implementation

```typescript
// /lib/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Fields to encrypt:
// - dateOfBirth
// - insuranceMemberId
// - phone (optional)
// - Full email body content with PHI

export function encryptPII(data: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  // ... encryption logic
  return encryptedData;
}

export function decryptPII(encryptedData: string): string {
  // ... decryption logic
}
```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| Admin | Full access: settings, templates, clinicians, all clients |
| Intake Coordinator | Clients, emails, scheduling - no settings access |

### Environment Variables

```env
# .env.local (NEVER commit)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=random-32-char-string
NEXTAUTH_URL=http://localhost:3000

ENCRYPTION_KEY=64-char-hex-string-for-aes-256

GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
GMAIL_PUBSUB_TOPIC=projects/your-project/topics/gmail-push

ALLOWED_DOMAIN=yourpractice.com
```

### Audit Logging

All of these actions are logged:
- Client record viewed
- Client data modified
- Email sent
- Email viewed
- Availability accessed
- Schedule created
- Settings changed
- Login/logout

---

## 10. Integration Details

### Google OAuth Scopes Required

```typescript
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
];
```

### Gmail Pub/Sub Setup

1. Create topic in Google Cloud Console
2. Create subscription with push endpoint
3. Grant Gmail publish permissions
4. Call `users.watch()` to start notifications
5. Renew watch weekly via cron job

### Google Calendar Integration

- Read clinician calendars for availability
- Create events for booked appointments
- Handle conflicts and busy times
- Support for recurring appointments

### Simple Practice (Manual Helper)

Since Simple Practice lacks a public API:

```typescript
// Generate formatted data for copy/paste
function generateSPClientData(client: Client): SPFormData {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    dateOfBirth: formatDate(client.dateOfBirth),
    phone: client.phone,
    // Additional fields as needed
  };
}
```

UI provides:
- "Copy to Simple Practice" button
- Formatted data display
- Checklist of SP steps
- "Mark as Synced" confirmation

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Project setup and configuration
- Authentication working
- Basic data layer connected

**Tasks:**
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Set up Google Cloud Console project
- [ ] Configure OAuth credentials and consent screen
- [ ] Implement NextAuth.js with Google provider
- [ ] Create Google Sheets with all data models
- [ ] Build Sheets API client library
- [ ] Create basic dashboard layout

**Deliverables:**
- Login working with Google OAuth
- Can read/write to Google Sheets
- Basic navigation structure

### Phase 2: Core Workflows (Week 3-4)

**Goals:**
- Client management working
- Form processing implemented
- Email generation functional

**Tasks:**
- [ ] Build ClientTable component
- [ ] Implement client CRUD operations
- [ ] Create form submission detection
- [ ] Build evaluation criteria engine
- [ ] Implement email template system
- [ ] Create EmailPreviewModal component
- [ ] Add client status management

**Deliverables:**
- New form submissions appear in dashboard
- Can evaluate and route clients
- Can preview generated emails

### Phase 3: Email Integration (Week 5-6)

**Goals:**
- Full email send/receive working
- Communication chain visible

**Tasks:**
- [ ] Implement Gmail API send functionality
- [ ] Set up Gmail Pub/Sub push notifications
- [ ] Build reply detection and matching
- [ ] Create CommunicationChain component
- [ ] Implement follow-up queue
- [ ] Add real-time dashboard updates

**Deliverables:**
- Can send emails from dashboard
- Replies automatically detected
- Communication history visible

### Phase 4: Scheduling (Week 7-8)

**Goals:**
- Clinician matching working
- Appointments bookable
- SP helper functional

**Tasks:**
- [ ] Build clinician management UI
- [ ] Implement availability system
- [ ] Create matching algorithm
- [ ] Integrate Google Calendar
- [ ] Build BookingForm component
- [ ] Create Simple Practice helper
- [ ] Add clinician notifications

**Deliverables:**
- Can match clients to clinicians
- Can book appointments
- Calendar events created

### Phase 5: Polish & Security (Week 9-10)

**Goals:**
- Full audit logging
- Role-based access
- E2E tests passing

**Tasks:**
- [ ] Implement comprehensive audit logging
- [ ] Add field encryption for PHI
- [ ] Build role-based access control
- [ ] Create admin settings page
- [ ] Write Playwright E2E tests
- [ ] Performance optimization
- [ ] Documentation

**Deliverables:**
- All actions logged
- Sensitive data encrypted
- Tests passing
- Production ready

---

## 12. Gap Analysis & Recommendations

### Identified Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Simple Practice lacks API | Cannot auto-sync clients | Manual copy/paste helper for MVP; explore browser automation later |
| Google Sheets for PHI | Limited audit/permission controls | Acceptable for MVP with encryption; plan database migration for scale |
| Paperwork workflow undefined | Cannot implement Workflow F | Deferred to post-MVP; simple status field for now |
| Response classification | Requires manual categorization | Manual for MVP; add AI-assisted categorization later |

### Recommendations

1. **Start with Google Cloud Console setup** - Create project, enable APIs, configure OAuth consent screen before coding

2. **Use Google Workspace (not personal Gmail)** - Required for BAA signing and HIPAA compliance

3. **Implement audit logging from day one** - Easier than retrofitting for compliance

4. **Design templates first** - Get email content approved before building the template engine

5. **Consider Vercel's HIPAA option** - If handling PHI at scale, Vercel offers HIPAA-compliant hosting

### Future Enhancements (Post-MVP)

- AI-powered response categorization (schedule/questions/more times)
- SMS notifications for urgent follow-ups
- Advanced reporting and analytics dashboard
- Simple Practice browser automation
- Multi-practice/multi-location support
- Patient portal for self-scheduling

---

## 13. Verification Plan

### Testing Strategy

**Unit Tests:**
- Evaluation service criteria matching
- Matching algorithm scoring
- Date calculation utilities
- Encryption/decryption functions

**Integration Tests:**
- Google Sheets API operations
- Gmail API send/receive
- Calendar API integration
- Authentication flow

**E2E Tests (Playwright MCP):**
- Full intake flow: form → outreach → reply → schedule
- Follow-up sequence timing
- Referral routing
- Email preview and send
- Settings configuration

### Manual Verification Checklist

- [ ] Form submission creates client in Sheets
- [ ] Evaluation correctly routes clients
- [ ] Email preview shows correct data
- [ ] Gmail send works and logs timestamp
- [ ] Inbox replies are detected and matched
- [ ] Clinician availability shows correctly
- [ ] Calendar events created on booking
- [ ] Audit log captures all actions
- [ ] Encryption working for sensitive fields
- [ ] Role-based access enforced

---

## 14. Appendix

### Pending Information Needed

| Item | Status | Notes |
|------|--------|-------|
| Google Form fields | Waiting | User will share field list |
| Referral criteria rules | Waiting | User will specify custom rules |
| Insurance panel list | Waiting | User will provide per-clinician |
| Simple Practice required fields | TBD | User checking SP requirements |

### Next Steps After Plan Approval

1. **You provide**: Google Form field list, insurance panels, referral criteria
2. **I will**: Set up MCP servers (Context7, Playwright)
3. **I will**: Initialize Next.js project with full folder structure
4. **I will**: Configure Google Cloud Console and OAuth
5. **I will**: Begin Phase 1 implementation (Foundation)

### Reference Links

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Gmail API](https://developers.google.com/gmail/api)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Context7 MCP](https://github.com/upstash/context7)
