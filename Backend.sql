

-- =========================================================
-- POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
-- COMPLETE MYSQL BACKEND
-- =========================================================

CREATE DATABASE IF NOT EXISTS police_intelligence_system
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE police_intelligence_system;

-- =========================================================
-- 1. LOCATION
-- =========================================================

CREATE TABLE IF NOT EXISTS location (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    landmark VARCHAR(150)
);

-- =========================================================
-- 2. CITIZEN
-- =========================================================

CREATE TABLE IF NOT EXISTS citizen (
    citizen_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    address VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 3. COMPLAINT
-- =========================================================

CREATE TABLE IF NOT EXISTS complaint (
    complaint_id INT AUTO_INCREMENT PRIMARY KEY,
    citizen_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    complaint_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'Received',
        'Under Review',
        'Accepted',
        'Rejected',
        'Converted to Incident',
        'Closed'
    ) DEFAULT 'Received',
    location_id INT,
    FOREIGN KEY (citizen_id)
        REFERENCES citizen(citizen_id),
    FOREIGN KEY (location_id)
        REFERENCES location(location_id)
);

-- =========================================================
-- 4. INCIDENT
-- =========================================================

CREATE TABLE IF NOT EXISTS incident (
    incident_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    severity ENUM('Low','Medium','High','Critical')
        DEFAULT 'Medium',
    description TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'Reported',
        'Under Investigation',
        'Resolved',
        'Closed'
    ) DEFAULT 'Reported',
    location_id INT,
    FOREIGN KEY (complaint_id)
        REFERENCES complaint(complaint_id),
    FOREIGN KEY (location_id)
        REFERENCES location(location_id)
);

-- =========================================================
-- 5. FIR
-- =========================================================

CREATE TABLE IF NOT EXISTS fir (
    fir_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    fir_number VARCHAR(60) NOT NULL UNIQUE,
    registered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    sections VARCHAR(255),
    details TEXT,
    FOREIGN KEY (incident_id)
        REFERENCES incident(incident_id)
);

-- =========================================================
-- 6. POLICE STATION
-- =========================================================

CREATE TABLE IF NOT EXISTS police_station (
    station_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    area VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    jurisdiction VARCHAR(255)
);

-- =========================================================
-- 7. DEPARTMENT
-- =========================================================

CREATE TABLE IF NOT EXISTS department (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT
);

-- =========================================================
-- 8. OFFICER
-- =========================================================

CREATE TABLE IF NOT EXISTS officer (
    officer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    `rank` VARCHAR(80),
    badge_number VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    station_id INT NOT NULL,
    dept_id INT,
    status ENUM(
        'Active',
        'On Leave',
        'Suspended',
        'Retired'
    ) DEFAULT 'Active',
    FOREIGN KEY (station_id)
        REFERENCES police_station(station_id),
    FOREIGN KEY (dept_id)
        REFERENCES department(dept_id)
);

-- =========================================================
-- 9. PERSON
-- =========================================================

CREATE TABLE IF NOT EXISTS person (
    person_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(30),
    photo VARCHAR(500)
);

-- =========================================================
-- 10. VICTIM
-- =========================================================

CREATE TABLE IF NOT EXISTS victim (
    victim_id INT AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    age SMALLINT UNSIGNED,
    gender VARCHAR(30),
    FOREIGN KEY (person_id)
        REFERENCES person(person_id)
);

-- =========================================================
-- 11. SUSPECT
-- =========================================================

CREATE TABLE IF NOT EXISTS suspect (
    suspect_id INT AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    alias VARCHAR(120),
    phone VARCHAR(20),
    address VARCHAR(255),
    age SMALLINT UNSIGNED,
    gender VARCHAR(30),
    criminal_history TEXT,
    FOREIGN KEY (person_id)
        REFERENCES person(person_id)
);

-- =========================================================
-- 12. WITNESS
-- =========================================================

CREATE TABLE IF NOT EXISTS witness (
    witness_id INT AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    age SMALLINT UNSIGNED,
    gender VARCHAR(30),
    statement TEXT,
    FOREIGN KEY (person_id)
        REFERENCES person(person_id)
);

-- =========================================================
-- 13. POLICE CASE
-- =========================================================

CREATE TABLE IF NOT EXISTS police_case (
    case_id INT AUTO_INCREMENT PRIMARY KEY,
    fir_id INT NOT NULL,
    case_type VARCHAR(120) NOT NULL,
    registered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'Registered',
        'Investigation',
        'Under Trial',
        'Resolved',
        'Closed'
    ) DEFAULT 'Registered',
    closed_date DATETIME,
    FOREIGN KEY (fir_id)
        REFERENCES fir(fir_id)
);

-- =========================================================
-- 14. CASE-OFFICER RELATIONSHIP
-- =========================================================

CREATE TABLE IF NOT EXISTS case_officer (
    case_id INT NOT NULL,
    officer_id INT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assignment_role VARCHAR(100)
        DEFAULT 'Investigating Officer',
    PRIMARY KEY (case_id, officer_id),
    FOREIGN KEY (case_id)
        REFERENCES police_case(case_id),
    FOREIGN KEY (officer_id)
        REFERENCES officer(officer_id)
);

-- =========================================================
-- 15. CASE-PERSON RELATIONSHIP
-- =========================================================

CREATE TABLE IF NOT EXISTS case_person (
    case_id INT NOT NULL,
    person_id INT NOT NULL,
    association_type ENUM(
        'Victim',
        'Suspect',
        'Witness',
        'Other'
    ) DEFAULT 'Other',
    notes TEXT,
    PRIMARY KEY (case_id, person_id, association_type),
    FOREIGN KEY (case_id)
        REFERENCES police_case(case_id),
    FOREIGN KEY (person_id)
        REFERENCES person(person_id)
);

-- =========================================================
-- 16. EVIDENCE LOCATION
-- =========================================================

CREATE TABLE IF NOT EXISTS evidence_location (
    evidence_loc_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    description TEXT
);

-- =========================================================
-- 17. EVIDENCE
-- =========================================================

CREATE TABLE IF NOT EXISTS evidence (
    evidence_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    collected_by INT NOT NULL,
    collected_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_id INT,
    evidence_loc_id INT,
    status ENUM(
        'Collected',
        'In Storage',
        'Under Examination',
        'Released',
        'Disposed'
    ) DEFAULT 'Collected',
    file_path VARCHAR(500),
    FOREIGN KEY (case_id)
        REFERENCES police_case(case_id),
    FOREIGN KEY (collected_by)
        REFERENCES officer(officer_id),
    FOREIGN KEY (location_id)
        REFERENCES location(location_id),
    FOREIGN KEY (evidence_loc_id)
        REFERENCES evidence_location(evidence_loc_id)
);

-- =========================================================
-- 18. COURT PROCEEDING
-- =========================================================

CREATE TABLE IF NOT EXISTS court_proceeding (
    proceeding_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    court_name VARCHAR(180) NOT NULL,
    hearing_date DATETIME,
    status ENUM(
        'Scheduled',
        'Completed',
        'Adjourned',
        'Cancelled',
        'Judgment Delivered'
    ) DEFAULT 'Scheduled',
    judge_name VARCHAR(120),
    remarks TEXT,
    FOREIGN KEY (case_id)
        REFERENCES police_case(case_id)
);

-- =========================================================
-- 19. CASE STATUS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS case_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    status VARCHAR(80) NOT NULL,
    changed_by INT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (case_id)
        REFERENCES police_case(case_id),
    FOREIGN KEY (changed_by)
        REFERENCES officer(officer_id)
);

-- =========================================================
-- INSERT QUERIES
-- SAMPLE DATA FOR TESTING
-- =========================================================

INSERT INTO location
(address, area, city, latitude, longitude, landmark)
VALUES
('Near Market Road', 'Andheri', 'Mumbai',
 19.1197, 72.8468, 'Local Market');

INSERT INTO citizen
(name, phone, email, address, date_of_birth, gender)
VALUES
('Aarav Sharma', '9000000001', 'aarav@example.com',
 'Andheri, Mumbai', '2000-05-12', 'Male');

INSERT INTO complaint
(citizen_id, type, description, location_id)
VALUES
(1, 'Theft', 'Mobile phone stolen near market', 1);

INSERT INTO incident
(complaint_id, type, severity, description, location_id)
VALUES
(1, 'Theft', 'Medium',
 'Mobile phone stolen near market', 1);

UPDATE complaint
SET status = 'Converted to Incident'
WHERE complaint_id = 1;

INSERT INTO fir
(incident_id, fir_number, sections, details)
VALUES
(1, 'FIR/MUM/2026/001',
 'Applicable legal sections', 'Theft incident details');

INSERT INTO police_station
(name, address, area, city, phone, jurisdiction)
VALUES
('Andheri Police Station', 'Andheri, Mumbai',
 'Andheri', 'Mumbai', '02200000000', 'Andheri area');

INSERT INTO department (name, description)
VALUES
('Investigation', 'Crime investigation department');

INSERT INTO officer
(name, `rank`, badge_number, phone, email,
 station_id, dept_id, status)
VALUES
('Rajesh Kumar', 'Inspector', 'MH001',
 '9000000002', 'rajesh@example.com', 1, 1, 'Active');

INSERT INTO police_case (fir_id, case_type, status)
VALUES (1, 'Theft Case', 'Investigation');

INSERT INTO case_officer
(case_id, officer_id, assignment_role)
VALUES (1, 1, 'Investigating Officer');

INSERT INTO person
(name, phone, address, date_of_birth, gender)
VALUES
('Demo Person', '9000000003', 'Mumbai',
 '1998-04-10', 'Male');

INSERT INTO victim
(person_id, name, phone, address, age, gender)
VALUES
(1, 'Demo Person', '9000000003', 'Mumbai', 28, 'Male');

INSERT INTO case_person
(case_id, person_id, association_type, notes)
VALUES
(1, 1, 'Victim', 'Victim associated with theft case');

INSERT INTO evidence_location
(name, address, description)
VALUES
('Evidence Room A', 'Andheri Police Station',
 'Secure evidence storage');

INSERT INTO evidence
(case_id, type, description, collected_by,
 location_id, evidence_loc_id, status)
VALUES
(1, 'Physical', 'Recovered mobile phone',
 1, 1, 1, 'In Storage');

INSERT INTO court_proceeding
(case_id, court_name, hearing_date, status, judge_name, remarks)
VALUES
(1, 'Mumbai Magistrate Court',
 '2026-11-10 10:00:00', 'Scheduled',
 'Judge Name', 'Initial hearing');

-- =========================================================
-- SELECT QUERIES
-- =========================================================

-- Display all records
SELECT * FROM citizen;
SELECT * FROM complaint;
SELECT * FROM incident;
SELECT * FROM fir;
SELECT * FROM police_case;
SELECT * FROM officer;
SELECT * FROM evidence;
SELECT * FROM court_proceeding;
SELECT * FROM police_station;
SELECT * FROM department;
SELECT * FROM location;
SELECT * FROM person;
SELECT * FROM victim;
SELECT * FROM suspect;
SELECT * FROM witness;
SELECT * FROM case_person;
SELECT * FROM case_officer;
SELECT * FROM case_status_history;

-- Complaints with citizen and location
SELECT
    c.complaint_id,
    ci.name AS citizen_name,
    ci.phone,
    c.type,
    c.description,
    c.complaint_date,
    c.status,
    l.area,
    l.city
FROM complaint c
JOIN citizen ci ON c.citizen_id = ci.citizen_id
LEFT JOIN location l ON c.location_id = l.location_id
ORDER BY c.complaint_date DESC;

-- Incidents for the crime map
SELECT
    i.incident_id,
    i.type,
    i.severity,
    i.status,
    i.reported_at,
    l.address,
    l.area,
    l.city,
    l.latitude,
    l.longitude
FROM incident i
LEFT JOIN location l ON i.location_id = l.location_id
WHERE l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
ORDER BY i.reported_at DESC;

-- Recent cases for the frontend
SELECT
    pc.case_id,
    pc.case_type,
    pc.status,
    pc.registered_date,
    f.fir_number,
    i.severity,
    i.description,
    l.area,
    l.city,
    GROUP_CONCAT(DISTINCT o.name SEPARATOR ', ')
        AS assigned_officers
FROM police_case pc
JOIN fir f ON pc.fir_id = f.fir_id
JOIN incident i ON f.incident_id = i.incident_id
LEFT JOIN location l ON i.location_id = l.location_id
LEFT JOIN case_officer co ON pc.case_id = co.case_id
LEFT JOIN officer o ON co.officer_id = o.officer_id
GROUP BY
    pc.case_id, pc.case_type, pc.status, pc.registered_date,
    f.fir_number, i.severity, i.description, l.area, l.city
ORDER BY pc.registered_date DESC;

-- Dashboard statistics
SELECT
    (SELECT COUNT(*) FROM police_case)
        AS total_cases,
    (SELECT COUNT(*) FROM police_case
     WHERE status IN ('Registered','Investigation','Under Trial'))
        AS active_cases,
    (SELECT COUNT(*) FROM fir)
        AS total_firs,
    (SELECT COUNT(*) FROM officer WHERE status = 'Active')
        AS active_officers,
    (SELECT COUNT(*) FROM incident WHERE severity = 'High')
        AS high_severity_incidents;

-- Complete case details
SELECT
    pc.case_id,
    pc.case_type,
    pc.status,
    pc.registered_date,
    pc.closed_date,
    f.fir_number,
    f.registered_date AS fir_date,
    f.sections,
    i.type AS incident_type,
    i.severity,
    i.description AS incident_description,
    l.address,
    l.area,
    l.city,
    GROUP_CONCAT(DISTINCT o.name SEPARATOR ', ')
        AS assigned_officers
FROM police_case pc
JOIN fir f ON pc.fir_id = f.fir_id
JOIN incident i ON f.incident_id = i.incident_id
LEFT JOIN location l ON i.location_id = l.location_id
LEFT JOIN case_officer co ON pc.case_id = co.case_id
LEFT JOIN officer o ON co.officer_id = o.officer_id
GROUP BY
    pc.case_id, pc.case_type, pc.status,
    pc.registered_date, pc.closed_date,
    f.fir_number, f.registered_date, f.sections,
    i.type, i.severity, i.description,
    l.address, l.area, l.city;

-- Evidence details
SELECT
    e.evidence_id,
    e.case_id,
    e.type,
    e.description,
    e.collected_date,
    e.status,
    o.name AS collected_by,
    el.name AS storage_location,
    e.file_path
FROM evidence e
JOIN officer o ON e.collected_by = o.officer_id
LEFT JOIN evidence_location el
    ON e.evidence_loc_id = el.evidence_loc_id
ORDER BY e.collected_date DESC;

-- Court schedule
SELECT
    cp.proceeding_id,
    cp.court_name,
    cp.hearing_date,
    cp.status,
    cp.judge_name,
    pc.case_id,
    pc.case_type,
    cp.remarks
FROM court_proceeding cp
JOIN police_case pc ON cp.case_id = pc.case_id
ORDER BY cp.hearing_date;

-- Officers with stations and departments
SELECT
    o.officer_id,
    o.name,
    o.`rank`,
    o.badge_number,
    o.phone,
    o.email,
    o.status,
    ps.name AS station_name,
    ps.city,
    d.name AS department_name
FROM officer o
JOIN police_station ps ON o.station_id = ps.station_id
LEFT JOIN department d ON o.dept_id = d.dept_id
ORDER BY o.name;

-- Case status history
SELECT
    h.history_id,
    h.case_id,
    h.status,
    h.changed_at,
    h.remarks,
    o.name AS changed_by_officer
FROM case_status_history h
LEFT JOIN officer o ON h.changed_by = o.officer_id
WHERE h.case_id = 1
ORDER BY h.changed_at DESC;

-- Search cases
SELECT
    pc.case_id,
    pc.case_type,
    pc.status,
    f.fir_number,
    i.description,
    i.severity
FROM police_case pc
JOIN fir f ON pc.fir_id = f.fir_id
JOIN incident i ON f.incident_id = i.incident_id
WHERE pc.case_type LIKE '%Theft%'
   OR f.fir_number LIKE '%MUM%'
   OR pc.status = 'Investigation'
ORDER BY pc.registered_date DESC;

-- Count complaints by status
SELECT status, COUNT(*) AS total
FROM complaint
GROUP BY status;

-- Count incidents by severity
SELECT severity, COUNT(*) AS total
FROM incident
GROUP BY severity;

-- Count cases by status
SELECT status, COUNT(*) AS total
FROM police_case
GROUP BY status;

-- Complaints without incidents
SELECT c.*
FROM complaint c
LEFT JOIN incident i ON c.complaint_id = i.complaint_id
WHERE i.incident_id IS NULL;

-- Cases without assigned officers
SELECT pc.case_id, pc.case_type, pc.status
FROM police_case pc
LEFT JOIN case_officer co ON pc.case_id = co.case_id
WHERE co.case_id IS NULL;

-- Evidence awaiting examination
SELECT *
FROM evidence
WHERE status = 'Under Examination'
ORDER BY collected_date;

-- Upcoming scheduled hearings
SELECT *
FROM court_proceeding
WHERE status = 'Scheduled'
  AND hearing_date >= CURRENT_TIMESTAMP
ORDER BY hearing_date;

-- =========================================================
-- UPDATE QUERIES
-- =========================================================

UPDATE citizen
SET phone = '9111111111',
    address = 'Bandra, Mumbai'
WHERE citizen_id = 1;

UPDATE complaint
SET status = 'Under Review'
WHERE complaint_id = 1;

UPDATE incident
SET severity = 'High',
    status = 'Under Investigation'
WHERE incident_id = 1;

UPDATE fir
SET sections = 'Updated legal sections',
    details = 'Updated FIR details'
WHERE fir_id = 1;

UPDATE police_case
SET status = 'Resolved',
    closed_date = CURRENT_TIMESTAMP
WHERE case_id = 1;

UPDATE officer
SET phone = '9222222222',
    status = 'Active'
WHERE officer_id = 1;

UPDATE evidence
SET status = 'Under Examination'
WHERE evidence_id = 1;

UPDATE court_proceeding
SET hearing_date = '2026-11-15 11:00:00',
    status = 'Adjourned'
WHERE proceeding_id = 1;

-- =========================================================
-- DELETE QUERIES
-- Run only when deletion is intended.
-- =========================================================

DELETE FROM court_proceeding
WHERE proceeding_id = 1;

DELETE FROM evidence
WHERE evidence_id = 1;

DELETE FROM case_officer
WHERE case_id = 1 AND officer_id = 1;

DELETE FROM case_person
WHERE case_id = 1
  AND person_id = 1
  AND association_type = 'Victim';

-- Delete only when no dependent records reference the row.
DELETE FROM complaint
WHERE complaint_id = 1;

DELETE FROM citizen
WHERE citizen_id = 1;

-- =========================================================
-- CASE STATUS HISTORY TRANSACTION EXAMPLE
-- Execute this separately when changing a case's status.
-- =========================================================

START TRANSACTION;

UPDATE police_case
SET status = 'Investigation',
    closed_date = NULL
WHERE case_id = 1;

INSERT INTO case_status_history
(case_id, status, changed_by, remarks)
VALUES
(1, 'Investigation', 1, 'Investigation resumed');

COMMIT;

-- =========================================================
-- END OF SQL SCRIPT
-- =========================================================