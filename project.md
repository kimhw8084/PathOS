# Product Requirements Document (PRD)
## Project: Metrology Automation & Knowledge Hub
**Department:** Metrology 
**Tech Stack:** React-based Web App

## 1. Objective
To build a centralized, highly guided web application for the Metrology department to document, visualize, and track their daily workflows. The platform serves as a "Knowledge & Operations Hub" that captures manual tasks, calculates the ROI of automating them, and provides the Automation Team with structured, standardized data to drive partial or full automation initiatives, eliminating redundant work and Jira/verbal requests.

---

## 2. Core Pillars & Requirements

### 2.1. The Gatekeeper: Workflow Validation Intake
To prevent "garbage-in" data, the application must interview the user before allowing them to build a workflow sequence. If the input does not meet the criteria of a repeatable workflow, it must be rejected.

**Intake Fields:**
1. **Trigger Type (Enum):** What initiates this work?
2. **Trigger Description (Text):** Brief explanation of the exact scenario.
3. **Frequency (Enum/Number):** How often does this trigger occur?
4. **Output Type (Enum):** What is the final, measurable product of this workflow?
5. **Output Description (Text):** Explanation of the final state.
6. **Repeatability Check (Boolean):** "Is this a standardized, repeatable process?"

**Rejection Logic:**
* **Not Repeatable:** If Repeatability Check is `false` -> Reject: *"Workflows must be repeatable processes. One-off troubleshooting or isolated incidents should be handled via Jira."*
* **No Measurable Output:** If Output Type is undefined -> Reject: *"A workflow must produce a measurable outcome or product. Please define the final state before mapping tasks."*

### 2.2. Administrator-Controlled Taxonomy (Enums)
To enforce standardization, core data fields must be driven by database-backed enums manageable by App Admins. 

**Baseline Data Seeds:**
* **Trigger Types:** OOC/OOS Alarm, PIE Request, YE Yield Excursion, Tool PM Recovery, Shift-ly Qual, New NPI Routing.
* **Tool Types:** CD-SEM, Overlay (OVL), Ellipsometry (Thickness), Defect Inspection, XRF/XRD.
* **Workflow Types:** Recipe Creation/Mgmt, Tool Qualification, Data Extraction/Reporting, Measurement Setup, Tool Matching.
* **Output Types:** Recipe Deployed (e.g., to s2github.samsungds.net), Tool Released to Prod, Data Report Generated, Lot Released, Parameter Updated.

### 2.3. Task Sequence Builder & Task Anatomy
Workflows are composed of sequential (and potentially conditional) tasks. For every task node created in the workflow, the following data fields are mandatory:

* **Task Name:** String (Short title).
* **Detailed Description:** Text area.
* **Target System/Software:** The specific equipment UI, MES, RMS, or internal server used.
* **Average TAT (Turnaround Time):** Number (Minutes, assuming no blockers).
* **Occurrences per Workflow:** Number (How many times this specific task is repeated inside one workflow cycle).
* **Potential Mistakes/Errors:** Text (Impact of human error).
* **Error Probability:** Percentage (e.g., 5% chance of error doing this manually).
* **Average Recovery Time:** Number (Minutes spent fixing the error if it occurs).

### 2.4. Blocker Data Model & Visualization
Blockers are primary data objects attached to specific tasks and must be highly visible in the UI.

* **Blocking Entity (Enum):** PIE, YE, Module, IT/Network, Equipment Vendor.
* **Reason:** Text explanation.
* **Average Delay Time:** Number (Minutes/Hours).
* **Standard Mitigation:** Text (Current manual workaround to get unblocked).

### 2.5. Locked Automation Lifecycle Statuses
The Automation Team will track the progress of every workflow/task through a strict Kanban-style lifecycle. The statuses are strictly defined as:

1. Created
2. Workflow Review
3. Priority Measurement
4. Feasibility Review
5. Backlog
6. Automation Brainstorming
7. Automation Planned
8. In Automation
9. Verification
10. Partially Automated
11. Fully Automated

### 2.6. ROI & Error Quantification (The Metric Engine)
The application must automatically calculate the value of automating tasks to build a gamified "Hours Saved" leaderboard and prioritize the backlog.

**Formulas:**
* `Base Time Saved = (Task TAT * Occurrences) * Workflow Frequency`
* `Error Penalty Time = Error Probability * Average Recovery Time`
* `Total ROI (Time Saved) = Base Time Saved + Error Penalty Time`

### 2.7. User Permissions, Audit Logging & Soft Deletes
Data integrity is paramount. Records should never be permanently destroyed by standard users.

* **Soft Deletes:** All primary database tables (`workflows`, `tasks`, `blockers`) must implement an `is_deleted` boolean column. Deleting from the UI only toggles this flag to `true`.
* **Audit Logs:** Implement a central `audit_logs` table to track every modification.
  * Schema: `[timestamp] | [user_id] | [action_type (CREATE/UPDATE/DELETE)] | [table_name] | [record_id] | [previous_json_state] | [new_json_state]`
* **Role-Based Access Control (RBAC):**
  * *Standard User:* Create/edit own workflows, view others.
  * *Automation Team:* Update automation lifecycle statuses, add internal notes.
  * *Admin:* Full CRUD access to Enum lists, user roles, and hard-delete capabilities if necessary.