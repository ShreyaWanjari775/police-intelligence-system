# POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM (POLICE INTEL)

A complete, responsive, full-stack enterprise web application for police operations, crime intelligence monitoring, forensic custody tracking, and judicial proceedings management. Built for academic demonstration and real-world database integration.

---

## 1. PROJECT OVERVIEW & ARCHITECTURE

The **Police Operations & Crime Intelligence System** connects operational policing workflows with a relational MySQL database adhering to the provided Entity-Relationship (ER) model and all 20+ specialized queries from `Backend.sql`.

### Key Architecture Highlights:
- **Backend**: Node.js with Express.js REST API, parameterized MySQL queries, transactions, and JWT authentication.
- **Database**: MySQL 8.0 (`police_intelligence_system`) supporting all 17 ER model entities plus extensions.
- **Frontend**: Responsive Single-Page Application (SPA) preserving the original **POLICE INTEL** dark aesthetic (`#0B0C10`, `#1F2833`, `#C5C6C7`, `#66FCF1`, `#45A29E`), Anton typography, FontAwesome icons, and dark-themed Leaflet geospatial crime mapping.
- **Security & RBAC**: Role-Based Access Control (`Administrator`, `Officer`, `Investigator`, `Read-only Reviewer`) with bcrypt password hashing and sensitive dossier masking.
- **Auditable Transactions**: Multi-table atomic transactions for case status updates (`police_case` + `case_status_history`), complaint conversion (`complaint` + `incident`), and evidence custody chain logging.

---

## 2. SYSTEM MODULES & FEATURES

| Module | ER Entities Mapped | Description & Capabilities |
| :--- | :--- | :--- |
| **Command Dashboard** | `police_case`, `incident`, `fir`, `officer`, `citizen`, `complaint`, `court_proceeding` | Dynamic database counts, active investigation cards, priority incidents, and recent status transitions. |
| **Crime Map** | `incident`, `location` | Interactive Leaflet map with dark theme, real coordinates, severity markers, and filtering. |
| **Citizen Management** | `citizen`, `complaint` | Citizen registration, search, contact directory, and complaint history views. |
| **Complaint Management** | `complaint`, `citizen`, `location` | Citizen complaints registration, status workflows, and atomic conversion into operational incidents. |
| **Incident Management** | `incident`, `complaint`, `location` | Severity levels (`Low`, `Medium`, `High`, `Critical`), investigation status, GPS tagging, and FIR creation. |
| **FIR Management** | `fir`, `incident`, `police_case` | Auto-formatted unique FIR numbering (`FIR/CITY/YEAR/XXX`), legal sections, and case linkage. |
| **Case Management** | `police_case`, `case_officer`, `case_person`, `case_status_history` | Multi-tab case workspace, officer assignments, suspect/witness dossiers, and transactional status timeline. |
| **Persons & Dossiers** | `person`, `victim`, `suspect`, `witness` | Common person entity with specialized victim, suspect (alias, history), and witness (testimony) records. |
| **Evidence & Custody** | `evidence`, `evidence_location`, `evidence_custody_log` | Property tagging, forensic status, secure locker rooms, and an auditable chain-of-custody log. |
| **Storage Locations** | `evidence_location`, `evidence` | Secure evidence rooms, digital forensic vaults, armory management, and item counts. |
| **Court Proceedings** | `court_proceeding`, `police_case` | Hearing schedules, magistrate/sessions courts, presiding judges, and upcoming hearing alerts. |
| **Police Officers** | `officer`, `police_station`, `department` | Officer directory, ranks, badge numbers, assigned cases, and collected evidence workload. |
| **Police Stations** | `police_station`, `officer` | Stations across cities (Mumbai, Pune, Delhi), contact desks, jurisdictions, and stationed personnel. |
| **Intelligence Reports** | Aggregations from `Backend.sql` | Complaints by status, incidents by severity, cases by status, unassigned cases, pending forensics, and CSV export. |
| **Global Search** | All entities | Instant multi-table search across cases, FIRs, incidents, citizens, officers, and evidence. |

---

## 3. PREREQUISITES & INSTALLATION

### Prerequisites:
1. **Node.js** (v18 or higher) & **npm**
2. **MySQL Server 8.0** running on `localhost:3306`

### Step 1: Clone / Navigate to Project Directory
```powershell
cd "c:\Users\Admin\OneDrive\Desktop\DBMS_MiniProject"
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Edit `.env` to verify your MySQL credentials:
```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=police_intelligence_system
PORT=3000
NODE_ENV=development
JWT_SECRET=super_secret_police_intel_jwt_key_2026_change_in_production
```

### Step 3: Install Dependencies
```powershell
npm.cmd install
```

### Step 4: Initialize Database & Seed Demo Data
Run the automated database setup script. This creates missing tables, applies schema extensions, and seeds interconnected fictional records:
```powershell
node scripts/init_db.js
```

### Step 5: Start the Server
```powershell
node server.js
```
The application will be live at:
**`http://localhost:3000`**

---

## 4. DEMO CREDENTIALS & ROLE-BASED ACCESS

For demonstration and evaluation, 4 pre-configured user accounts are provided with instant one-click login buttons in the Login modal:

| Username | Password | Role | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **Administrator** | Full system access: manage users, create/delete records, manage stations and departments. |
| **`officer1`** | `officer123` | **Officer** | Operational operations: log complaints, incidents, FIRs, evidence, and update assigned cases. |
| **`investigator1`** | `investigator123` | **Investigator** | Investigation workspace: update case status, assign custody logs, view suspect records. |
| **`reviewer1`** | `reviewer123` | **Read-only Reviewer** | Auditing and inspection: view permitted dashboards and reports; sensitive dossiers are masked. |

---

## 5. ER MODEL & SQL SCHEMA INTEGRATION NOTES

### Schema Alignment & Discrepancy Clarifications:
1. **Core Entities**: All 17 entities depicted in the ER diagram and `Backend.sql` are implemented with exact column names, constraints, and ENUM values:
   - `location`, `citizen`, `complaint`, `incident`, `fir`, `police_station`, `department`, `officer`, `person`, `victim`, `suspect`, `witness`, `police_case`, `case_officer`, `case_person`, `evidence_location`, `evidence`, `court_proceeding`, `case_status_history`.
2. **Schema Extensions**:
   - `system_user`: Added to fulfill authentication and role-based access control requirements (Section 6).
   - `evidence_custody_log`: Added to implement the requested auditable chain-of-custody workflow (Section 3.H).
3. **M:N Cardinalities**:
   - `case_officer` manages multiple officers assigned to multiple cases.
   - `case_person` links persons to cases with explicit role associations (`Victim`, `Suspect`, `Witness`, `Other`).
4. **Transactions**:
   - Case status transitions are wrapped in atomic MySQL transactions (`START TRANSACTION ... UPDATE police_case ... INSERT INTO case_status_history ... COMMIT`) to guarantee audit history integrity.
   - Complaint conversion to incident updates the complaint status and verifies 1:1 integrity.

---

## 6. VERIFICATION & AUTOMATED TESTING

To execute the automated end-to-end verification test suite:
```powershell
node scripts/test_suite.js
```
The suite runs 17 automated tests verifying:
- Server health and connectivity
- Authentication and token validation
- Role-based authorization and sensitive field masking
- Parameterized execution of queries from `Backend.sql`
- Transaction atomicity for case status and complaint conversions
- Crime Map coordinate extraction
- CSV export generation
- Multi-table global search
