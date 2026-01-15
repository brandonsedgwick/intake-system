# Group Practice Intake System Requirements

## Overview
This document outlines the functional requirements for an automated intake system for a group practice. The system manages client inquiries from initial website form submission through scheduling and onboarding.

---

## 1. Website Form Processing (Workflow A)

### 1.1 Form Submission Capture
- System must capture all website form submissions
- Form data must automatically translate/sync to Google Sheets
- Submissions must trigger email notifications to the intake inbox

### 1.2 Form Review & Evaluation
- System must provide form review interface
- Automated criteria checking for:
  - Field conditions validation
  - Keyword analysis in form responses
- System must categorize submissions as:
  - **Potential Client** → route to outreach workflow
  - **Referral Needed** → route to referral workflow
- Maintain separate tracking sheets for potential clients and referrals

---

## 2. Initial Client Outreach (Workflow B)

### 2.1 Email Generation
- Auto-generate personalized outreach emails based on:
  - Specific clinician requests (if specified)
  - Insurance requirements
  - Preferred appointment times
- Clinician selection algorithm for matching availability

### 2.2 Availability Management
- "Availability" button/function for clinician time slot selection
- Sorting algorithm for optimal time offerings

### 2.3 Email Preview & Send
- Preview button functionality in table view
- Verify correct information before sending
- Send button functionality in table view
- Timestamp logging upon successful send
- Automatic follow-up date calculation

---

## 3. Follow-Up Outreach (Workflow C)

### 3.1 Inbox Monitoring
- Check intake inbox for client replies
- Detect no-reply scenarios

### 3.2 Follow-Up Sequence (No Response Path)
- **1st Follow-Up:**
  - Generate follow-up email
  - Preview and send functionality
  - Timestamp and calculate next follow-up date
- **2nd Follow-Up:**
  - Generate second follow-up email
  - Preview and send functionality
  - Timestamp and calculate next follow-up date
- **Close/Archive:**
  - Mark as "Closed - No Contact" after no response to follow-ups

---

## 4. Client Response Handling (Workflow D)

### 4.1 Reply Detection
- Monitor inbox for client responses
- Generate table icon when reply found
- Link reply to client record

### 4.2 Response Routing
| Response Type | Action |
|---------------|--------|
| Ready to schedule | Route to Scheduling (Workflow E) |
| Needs more times/options | Generate email with additional availability |
| Has questions | Generate informational response email |

### 4.3 Communication Chain
- All email exchanges added to communication chain in table
- Full correspondence history maintained per client

---

## 5. Scheduling in Simple Practice (Workflow E)

### 5.1 Client Information Gathering
- Required fields:
  - First name
  - Last name
  - Date of birth
  - Additional fields (TBD based on Simple Practice requirements)

### 5.2 Appointment Details
- Extract from email correspondence:
  - Appointment time
  - Recurrence preferences
  - Assigned clinician

### 5.3 Simple Practice Integration
- Create/setup client in Simple Practice
- Remove scheduled time slot from availability pool
- Update client status to "Scheduled"

### 5.4 Notifications
- Send client notification with Simple Practice portal link
- Send clinician notification of new client booking

### 5.5 Post-Scheduling Tracking
- Add client to "Scheduled / Paperwork Incomplete" table
- Route to paperwork tracking workflow (Workflow F - TBD)

---

## 6. Referral Processing (Workflow R)

### 6.1 Referral Email Generation
- Generate referral preview
- Send button functionality in table

### 6.2 Referral Completion
- Confirm successful email delivery
- Mark record as "Closed - Referral"

---

## System-Wide Requirements

### Data Management
- Centralized Google Sheets database
- Real-time sync between components
- Audit trail for all status changes

### User Interface
- Table-based dashboard view
- Action buttons (Preview, Send, Schedule) embedded in table
- Status indicators and timestamps visible
- Communication chain/history per client

### Automation
- Automated email generation based on templates and criteria
- Calculated follow-up dates based on timestamps
- Automated status transitions

### Reporting (Suggested)
- Conversion metrics (form → scheduled)
- Response time tracking
- Follow-up effectiveness rates
- Referral volume tracking

---

## Open Items / Questions

1. What additional client info fields are required for Simple Practice setup?
2. What criteria/keywords determine potential client vs. referral routing?
3. What is the timing for follow-up intervals (days between follow-ups)?
4. What does Workflow F (post-scheduling paperwork) include?
5. What insurance panels/networks need to be considered in clinician matching?
