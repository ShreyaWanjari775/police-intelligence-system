-- =========================================================
-- POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
-- COMPREHENSIVE SEED DATA FOR DEMONSTRATION & TESTING
-- Note: All records are strictly fictional and intended for
-- academic testing and evaluation.
-- =========================================================

USE police_intelligence_system;

-- Disable foreign key checks for clean seeding
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE evidence_custody_log;
TRUNCATE TABLE system_user;
TRUNCATE TABLE case_status_history;
TRUNCATE TABLE court_proceeding;
TRUNCATE TABLE evidence;
TRUNCATE TABLE evidence_location;
TRUNCATE TABLE case_person;
TRUNCATE TABLE case_officer;
TRUNCATE TABLE police_case;
TRUNCATE TABLE fir;
TRUNCATE TABLE incident;
TRUNCATE TABLE complaint;
TRUNCATE TABLE witness;
TRUNCATE TABLE suspect;
TRUNCATE TABLE victim;
TRUNCATE TABLE person;
TRUNCATE TABLE officer;
TRUNCATE TABLE department;
TRUNCATE TABLE police_station;
TRUNCATE TABLE citizen;
TRUNCATE TABLE location;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 1. LOCATIONS (WITH REALISTIC GEOGRAPHIC COORDINATES)
-- =========================================================
INSERT INTO location (location_id, address, area, city, latitude, longitude, landmark) VALUES
(1, 'Near Market Road, S.V. Road Junction', 'Andheri West', 'Mumbai', 19.1197000, 72.8468000, 'Local Market Plaza'),
(2, 'Hill Road, Near Bandra Station', 'Bandra West', 'Mumbai', 19.0596000, 72.8295000, 'Bandra Promenade'),
(3, 'Colaba Causeway, Near Regal Cinema', 'Colaba', 'Mumbai', 18.9220000, 72.8317000, 'Gateway Junction'),
(4, 'Shivaji Park, Veer Savarkar Marg', 'Dadar West', 'Mumbai', 19.0282000, 72.8407000, 'Shivaji Park Ground'),
(5, 'FC Road, Near Deccan Gymkhana', 'Shivajinagar', 'Pune', 18.5204000, 73.8567000, 'Fergusson Gate'),
(6, 'Pashan Highway Link, Near MITCON', 'Kothrud', 'Pune', 18.5074000, 73.8077000, 'Kothrud Flyover'),
(7, 'Connaught Place Outer Circle, Block C', 'Connaught Place', 'Delhi', 28.6315000, 77.2167000, 'Central Park Metro'),
(8, '100 Feet Road, HAL 2nd Stage', 'Indiranagar', 'Bengaluru', 12.9716000, 77.5946000, 'Metro Pillar 124');

-- =========================================================
-- 2. POLICE STATIONS
-- =========================================================
INSERT INTO police_station (station_id, name, address, area, city, phone, jurisdiction) VALUES
(1, 'Andheri Police Station', 'S.V. Road, Andheri West', 'Andheri', 'Mumbai', '02226281001', 'Andheri West Zone 9'),
(2, 'Bandra Police Station', 'Hill Road, Bandra West', 'Bandra', 'Mumbai', '02226422002', 'Bandra West Zone 9'),
(3, 'Colaba Police Station', 'SBS Road, Colaba', 'Colaba', 'Mumbai', '02222853003', 'South Mumbai Zone 1'),
(4, 'Shivajinagar Police Station', 'FC Road, Shivajinagar', 'Shivajinagar', 'Pune', '02025534004', 'Pune Central Division'),
(5, 'Connaught Place Police Station', 'Parliament Street', 'Connaught Place', 'Delhi', '01123365005', 'New Delhi District');

-- =========================================================
-- 3. DEPARTMENTS
-- =========================================================
INSERT INTO department (dept_id, name, description) VALUES
(1, 'Crime Investigation', 'Core homicide, robbery, and major crimes investigation wing'),
(2, 'Cyber Crime Cell', 'Digital forensics, financial fraud, and cyber security division'),
(3, 'Anti-Narcotics Division', 'Illicit drug interception, supply line tracking and raids'),
(4, 'Forensics & Evidence Management', 'Physical and biological evidence logging, chemical analysis & storage');

-- =========================================================
-- 4. POLICE OFFICERS
-- =========================================================
INSERT INTO officer (officer_id, name, `rank`, badge_number, phone, email, station_id, dept_id, status) VALUES
(1, 'Rajesh Kumar', 'Inspector', 'MH-INSP-001', '9820011001', 'rajesh.kumar@mahapolice.gov.in', 1, 1, 'Active'),
(2, 'Neha Singh', 'Senior Inspector', 'MH-SINSP-002', '9820011002', 'neha.singh@mahapolice.gov.in', 2, 2, 'Active'),
(3, 'Amit Patil', 'Sub-Inspector', 'MH-SI-003', '9820011003', 'amit.patil@mahapolice.gov.in', 1, 1, 'Active'),
(4, 'Vikram Deshmukh', 'Assistant Commissioner (ACP)', 'MH-ACP-004', '9820011004', 'vikram.deshmukh@mahapolice.gov.in', 3, 1, 'Active'),
(5, 'Pooja Kulkarni', 'Cyber Specialist SI', 'MH-SI-005', '9820011005', 'pooja.kulkarni@mahapolice.gov.in', 4, 2, 'Active'),
(6, 'Rohan Verma', 'Head Constable', 'DL-HC-006', '9811011006', 'rohan.verma@delhipolice.gov.in', 5, 3, 'Active'),
(7, 'Suresh Jadhav', 'Sub-Inspector', 'MH-SI-007', '9820011007', 'suresh.jadhav@mahapolice.gov.in', 2, 4, 'On Leave');

-- =========================================================
-- 5. CITIZENS
-- =========================================================
INSERT INTO citizen (citizen_id, name, phone, email, address, date_of_birth, gender) VALUES
(1, 'Aarav Sharma', '9000000001', 'aarav.sharma@example.com', 'Flat 402, Sea Green Apartments, Andheri West, Mumbai', '1998-05-12', 'Male'),
(2, 'Priya Kadam', '9000000002', 'priya.kadam@example.com', '12 Lake View Society, Bandra West, Mumbai', '1995-11-20', 'Female'),
(3, 'Rohan Mehta', '9000000003', 'rohan.mehta@example.com', '78 Heritage Chambers, Colaba, Mumbai', '1987-03-15', 'Male'),
(4, 'Ananya Sen', '9000000004', 'ananya.sen@example.com', 'B-14 Ashiana Enclave, Dadar, Mumbai', '2001-08-25', 'Female'),
(5, 'Kavita Joshi', '9000000005', 'kavita.joshi@example.com', '45 Deccan Hills, Shivajinagar, Pune', '1992-09-10', 'Female'),
(6, 'Deepak Nair', '9000000006', 'deepak.nair@example.com', '88 Barakhamba Lane, Connaught Place, Delhi', '1984-12-04', 'Male'),
(7, 'Vikrant Malhotra', '9000000007', 'vikrant.m@example.com', '19 Indiranagar 100ft Road, Bengaluru', '1990-07-18', 'Male');

-- =========================================================
-- 6. COMPLAINTS
-- =========================================================
INSERT INTO complaint (complaint_id, citizen_id, type, description, complaint_date, status, location_id) VALUES
(1, 1, 'Theft', 'Gold chain and high-end smartphone stolen by two motorbikers near market gate.', '2026-10-01 10:15:00', 'Converted to Incident', 1),
(2, 2, 'Cyber Fraud', 'Unauthorized credit card transactions of INR 1,45,000 via phishing link spoofing electricity board.', '2026-10-02 14:30:00', 'Converted to Incident', 2),
(3, 3, 'Burglary', 'Shop shutter broken overnight; electronic goods and cash register looted.', '2026-10-05 08:45:00', 'Converted to Incident', 3),
(4, 4, 'Assault & Battery', 'Physical scuffle and assault resulting in fractures during parking argument outside stadium.', '2026-10-08 19:20:00', 'Converted to Incident', 4),
(5, 5, 'Vehicle Theft', 'Two-wheeler Honda Activa (MH12-DE-4412) stolen from outside shopping complex.', '2026-10-10 11:00:00', 'Converted to Incident', 5),
(6, 6, 'Extortion', 'Threatening calls demanding protection money from store owner in commercial hub.', '2026-10-12 16:10:00', 'Converted to Incident', 7),
(7, 7, 'Missing Person', 'College student missing since yesterday evening after departing coaching class.', '2026-10-14 20:30:00', 'Under Review', 8),
(8, 1, 'Noise Disturbance', 'Unauthorized loudspeaker usage late night near residential zone.', '2026-10-15 23:10:00', 'Received', 1),
(9, 2, 'Lost Document', 'Wallet containing driving license and PAN card misplaced in public transport.', '2026-10-16 12:00:00', 'Closed', 2);

-- =========================================================
-- 7. INCIDENTS (LINKED 1:1 TO CONVERTED COMPLAINTS)
-- =========================================================
INSERT INTO incident (incident_id, complaint_id, type, severity, description, reported_at, status, location_id) VALUES
(1, 1, 'Street Robbery', 'Medium', 'Two suspects on motorcycle snatched mobile phone and chain near market road.', '2026-10-01 11:00:00', 'Under Investigation', 1),
(2, 2, 'Cyber Phishing & Financial Fraud', 'High', 'Organized phishing syndicate drained citizen account using fraudulent SMS spoofing gateway.', '2026-10-02 15:00:00', 'Under Investigation', 2),
(3, 3, 'Commercial Burglary', 'High', 'Break-in at electronics retail shop; CCTV footage shows 3 masked perpetrators.', '2026-10-05 09:30:00', 'Under Investigation', 3),
(4, 4, 'Aggravated Assault', 'High', 'Grievous assault with blunt object in public parking lot during daylight hours.', '2026-10-08 20:00:00', 'Resolved', 4),
(5, 5, 'Motor Vehicle Theft', 'Low', 'Stolen two-wheeler traced through ANPR traffic cameras in city outskirts.', '2026-10-10 12:15:00', 'Under Investigation', 5),
(6, 6, 'Organized Extortion Racket', 'Critical', 'Armed extortion threats and racketeering targeting retail business owners.', '2026-10-12 17:00:00', 'Reported', 7);

-- =========================================================
-- 8. FIRST INFORMATION REPORTS (FIR)
-- =========================================================
INSERT INTO fir (fir_id, incident_id, fir_number, registered_date, sections, details) VALUES
(1, 1, 'FIR/MUM/2026/001', '2026-10-01 12:00:00', 'BNS Section 309(4) (Robbery)', 'FIR registered for street robbery with assault; investigating local history-sheeters.'),
(2, 2, 'FIR/MUM/2026/002', '2026-10-02 16:30:00', 'IT Act 66D, BNS Section 318(4) (Cheating)', 'FIR registered for cyber fraud; bank nodal officers alerted to freeze mule accounts.'),
(3, 3, 'FIR/MUM/2026/003', '2026-10-05 11:00:00', 'BNS Section 305, 331(4) (Lurking house-trespass)', 'FIR registered for commercial burglary; forensic team recovered fingerprint impressions.'),
(4, 4, 'FIR/MUM/2026/004', '2026-10-08 21:00:00', 'BNS Section 115, 118 (Voluntarily causing hurt)', 'FIR registered for assault causing grievous hurt; suspect arrested at scene.'),
(5, 5, 'FIR/PUN/2026/005', '2026-10-10 13:30:00', 'BNS Section 303(2) (Theft of vehicle)', 'FIR registered for two-wheeler theft; toll plaza footage under analysis.'),
(6, 6, 'FIR/DEL/2026/006', '2026-10-12 18:00:00', 'BNS Section 308 (Extortion), Arms Act 25', 'FIR registered for organized gang extortion; special squad deployed for surveillance.');

-- =========================================================
-- 9. POLICE CASES
-- =========================================================
INSERT INTO police_case (case_id, fir_id, case_type, registered_date, status, closed_date) VALUES
(1, 1, 'Theft & Snatching', '2026-10-01 13:00:00', 'Investigation', NULL),
(2, 2, 'Cyber Crime & Online Fraud', '2026-10-02 17:30:00', 'Investigation', NULL),
(3, 3, 'Commercial Burglary', '2026-10-05 12:00:00', 'Investigation', NULL),
(4, 4, 'Assault & Public Disorder', '2026-10-08 22:00:00', 'Under Trial', NULL),
(5, 5, 'Automobile Theft', '2026-10-10 14:30:00', 'Registered', NULL),
(6, 6, 'Organized Crime & Extortion', '2026-10-12 19:00:00', 'Investigation', NULL);

-- =========================================================
-- 10. CASE - OFFICER ASSIGNMENTS (M:N)
-- =========================================================
INSERT INTO case_officer (case_id, officer_id, assigned_at, assignment_role) VALUES
(1, 1, '2026-10-01 13:30:00', 'Lead Investigating Officer'),
(1, 3, '2026-10-01 13:30:00', 'Assisting Officer'),
(2, 2, '2026-10-02 18:00:00', 'Cyber Crime Lead'),
(3, 1, '2026-10-05 12:30:00', 'Investigating Officer'),
(3, 4, '2026-10-05 13:00:00', 'Supervising Officer'),
(4, 3, '2026-10-08 22:30:00', 'Investigating Officer'),
(6, 6, '2026-10-12 19:30:00', 'Field Officer');

-- =========================================================
-- 11. PERSONS (COMMON BASE ENTITY)
-- =========================================================
INSERT INTO person (person_id, name, phone, address, date_of_birth, gender, photo) VALUES
(1, 'Aarav Sharma', '9000000001', 'Andheri West, Mumbai', '1998-05-12', 'Male', NULL),
(2, 'Ramesh "Kalia" Gond', '9700000011', 'Zopadpatti Sector 4, Kurla, Mumbai', '1994-02-14', 'Male', NULL),
(3, 'Sunil D Souza', '9800000012', 'Market Stall 14, Andheri West', '1980-06-22', 'Male', NULL),
(4, 'Priya Kadam', '9000000002', 'Bandra West, Mumbai', '1995-11-20', 'Female', NULL),
(5, 'Alok "Hacker" Verma', '9100000013', 'Sector 18, Noida, UP', '1999-01-09', 'Male', NULL),
(6, 'Rohan Mehta', '9000000003', 'Colaba, Mumbai', '1987-03-15', 'Male', NULL),
(7, 'Vijay Shetty', '9200000014', 'Dadar West, Mumbai', '1989-10-30', 'Male', NULL),
(8, 'Dr. Samir Bhatia', '9300000015', 'Clinic Plaza, Dadar, Mumbai', '1975-04-12', 'Male', NULL);

-- =========================================================
-- 12. SPECIALIZED PERSON ENTITIES (VICTIM, SUSPECT, WITNESS)
-- =========================================================
INSERT INTO victim (victim_id, person_id, name, phone, address, age, gender) VALUES
(1, 1, 'Aarav Sharma', '9000000001', 'Andheri West, Mumbai', 28, 'Male'),
(2, 4, 'Priya Kadam', '9000000002', 'Bandra West, Mumbai', 31, 'Female'),
(3, 6, 'Rohan Mehta', '9000000003', 'Colaba, Mumbai', 39, 'Male');

INSERT INTO suspect (suspect_id, person_id, name, alias, phone, address, age, gender, criminal_history) VALUES
(1, 2, 'Ramesh Gond', 'Kalia', '9700000011', 'Kurla, Mumbai', 32, 'Male', 'Previously convicted in 2023 for chain snatching under CR 142/23; out on bail.'),
(2, 5, 'Alok Verma', 'BitSniper', '9100000013', 'Sector 18, Noida', 27, 'Male', 'Associated with phishing networks in Jamtara; wanted in multiple cyber offenses.'),
(3, 7, 'Vijay Shetty', 'Anna', '9200000014', 'Dadar West, Mumbai', 37, 'Male', 'History of rioting and assault in 2021; bail condition violation.');

INSERT INTO witness (witness_id, person_id, name, phone, address, age, gender, statement) VALUES
(1, 3, 'Sunil D Souza', '9800000012', 'Market Stall 14, Andheri West', 46, 'Male', 'Saw two youths on a black Pulsar motorcycle flee toward link road immediately after snatching phone.'),
(2, 8, 'Dr. Samir Bhatia', '9300000015', 'Clinic Plaza, Dadar', 51, 'Male', 'Administered first aid to the victim and witnessed the accused holding an iron rod.');

-- =========================================================
-- 13. CASE - PERSON ASSOCIATIONS (M:N)
-- =========================================================
INSERT INTO case_person (case_id, person_id, association_type, notes) VALUES
(1, 1, 'Victim', 'Complainant and victim of street robbery'),
(1, 2, 'Suspect', 'Identified by witness during preliminary photo-lineup'),
(1, 3, 'Witness', 'Shopkeeper who witnessed getaway vehicle and noted registration digits'),
(2, 4, 'Victim', 'Account holder defrauded of INR 1.45 Lakhs'),
(2, 5, 'Suspect', 'IP tracking and bank trail points to account operator'),
(3, 6, 'Victim', 'Owner of commercial retail establishment'),
(4, 7, 'Suspect', 'Primary aggressor identified in assault footage'),
(4, 8, 'Witness', 'Attending physician providing medico-legal report');

-- =========================================================
-- 14. EVIDENCE LOCATIONS
-- =========================================================
INSERT INTO evidence_location (evidence_loc_id, name, address, description) VALUES
(1, 'Evidence Locker Room A', 'Andheri Police Station, Ground Floor', 'Secure biological and physical property custody room with 24/7 CCTV'),
(2, 'Digital Forensics Vault', 'Bandra Cyber Cell, 2nd Floor', 'Anti-static, climate-controlled digital media safe for drives and phones'),
(3, 'Central Weapons Armory', 'South Mumbai Police HQ, Basement', 'Reinforced safe storage for seized firearms, sharp weapons and ammunition'),
(4, 'State Forensic Science Lab (FSL)', 'Kalina, Santacruz East, Mumbai', 'Government certified forensic chemistry and toxicology laboratory');

-- =========================================================
-- 15. EVIDENCE RECORDS
-- =========================================================
INSERT INTO evidence (evidence_id, case_id, type, description, collected_by, collected_date, location_id, evidence_loc_id, status, file_path) VALUES
(1, 1, 'Physical Property', 'Recovered Samsung Galaxy S24 Ultra matching victim IMEI', 1, '2026-10-02 18:00:00', 1, 1, 'In Storage', '/uploads/evidence/case1_phone.jpg'),
(2, 1, 'CCTV Footage', 'Pendrive containing traffic CCTV footage of getaway motorcycle', 3, '2026-10-01 16:30:00', 1, 2, 'Under Examination', '/uploads/evidence/case1_cctv.mp4'),
(3, 2, 'Digital Log', 'Server access logs from banking gateway showing unauthorized IP 103.22.45.1', 2, '2026-10-03 11:15:00', 2, 2, 'Under Examination', '/uploads/evidence/case2_serverlogs.csv'),
(4, 3, 'Latent Fingerprint', 'Fingerprint lifted from cash drawer glass panel', 1, '2026-10-05 14:00:00', 3, 4, 'Under Examination', '/uploads/evidence/case3_fingerprint.jpg'),
(5, 4, 'Weapon / Blunt Object', 'Iron pipe with blunt impact marks used in parking lot assault', 3, '2026-10-08 21:30:00', 4, 3, 'In Storage', '/uploads/evidence/case4_weapon.jpg'),
(6, 4, 'Medical Document', 'Official Medico-Legal Certificate (MLC) issued by municipal hospital', 3, '2026-10-09 10:00:00', 4, 1, 'Collected', '/uploads/evidence/case4_mlc.pdf');

-- =========================================================
-- 16. EVIDENCE CUSTODY LOGS (CHAIN OF CUSTODY)
-- =========================================================
INSERT INTO evidence_custody_log (custody_id, evidence_id, action_type, handled_by, from_location, to_location, evidence_loc_id, action_date, remarks) VALUES
(1, 1, 'Collected', 1, 'Crime Scene - Andheri Market', 'Andheri Police Station', 1, '2026-10-02 18:00:00', 'Seized from suspect possession during raid; sealed in tamper-evident bag'),
(2, 1, 'Transferred to Evidence Room', 1, 'Duty Desk', 'Evidence Locker Room A', 1, '2026-10-02 19:15:00', 'Handed over to evidence custodian; logged in property register #114'),
(3, 2, 'Collected', 3, 'Traffic Control Room', 'Digital Forensics Vault', 2, '2026-10-01 16:30:00', 'Digital copy extracted in hash-verified container'),
(4, 4, 'Collected', 1, 'Crime Scene - Colaba Retail', 'State Forensic Science Lab (FSL)', 4, '2026-10-05 14:00:00', 'Transferred with chain-of-custody dispatch slip #891 for AFIS matching'),
(5, 5, 'Collected', 3, 'Crime Scene - Dadar', 'Central Weapons Armory', 3, '2026-10-08 21:30:00', 'Labeled exhibit A-1; inspected by ballistics officer');

-- =========================================================
-- 17. COURT PROCEEDINGS
-- =========================================================
INSERT INTO court_proceeding (proceeding_id, case_id, court_name, hearing_date, status, judge_name, remarks) VALUES
(1, 1, 'Metropolitan Magistrate Court 10, Andheri', '2026-11-12 10:30:00', 'Scheduled', 'Hon. Judge V. K. Deshmukh', 'First production of charge-sheet and bail hearing of suspect Ramesh Gond'),
(2, 2, 'City Civil & Cyber Court, Mumbai', '2026-11-18 11:00:00', 'Scheduled', 'Hon. Judge S. M. Kulkarni', 'Hearing on cyber forensic report submission and bank fund recovery order'),
(3, 4, 'Sessions Court 4, Greater Mumbai', '2026-11-05 11:30:00', 'Scheduled', 'Hon. Judge P. N. Rao', 'Framing of charges under BNS 115, 118; witness Dr. Samir Bhatia summoned'),
(4, 4, 'Metropolitan Magistrate Court 6, Dadar', '2026-10-10 10:00:00', 'Completed', 'Hon. Judge A. A. Shinde', 'Accused remanded to 14 days judicial custody');

-- =========================================================
-- 18. CASE STATUS HISTORY
-- =========================================================
INSERT INTO case_status_history (history_id, case_id, status, changed_by, changed_at, remarks) VALUES
(1, 1, 'Registered', 1, '2026-10-01 13:00:00', 'Case registered on basis of FIR/MUM/2026/001'),
(2, 1, 'Investigation', 1, '2026-10-01 14:00:00', 'Assigned to Inspector Rajesh Kumar for investigation'),
(3, 2, 'Registered', 2, '2026-10-02 17:30:00', 'Case opened under Cyber Crime division'),
(4, 2, 'Investigation', 2, '2026-10-03 09:00:00', 'Digital forensics investigation initiated with nodal authorities'),
(5, 4, 'Registered', 3, '2026-10-08 22:00:00', 'FIR converted to formal court charge case'),
(6, 4, 'Under Trial', 3, '2026-10-10 11:00:00', 'Charge-sheet filed before Magistrate; transferred to trial division');

-- =========================================================
-- 19. SYSTEM USERS (ROLE-BASED ACCESS CONTROL)
-- Passwords:
-- admin           -> admin123
-- officer1        -> officer123
-- investigator1   -> investigator123
-- reviewer1       -> reviewer123
-- =========================================================
INSERT INTO system_user (user_id, username, password_hash, full_name, email, role, officer_id, is_active) VALUES
(1, 'admin', '$2a$10$tqiTndqSVqbWCuz/u2eIuOMmMdIRxAoODSLnwzBVvBpnrCfWuYT.6', 'System Administrator', 'admin@policeintel.gov.in', 'Administrator', NULL, 1),
(2, 'officer1', '$2a$10$YkuKtId0loZaFnZ5ahIlPOsRbn2Z9K/7enWDdsePgkQavWjF9HU1m', 'Inspector Rajesh Kumar', 'rajesh.kumar@mahapolice.gov.in', 'Officer', 1, 1),
(3, 'investigator1', '$2a$10$RHblC9jvJIOBla35I8ZN6eJdl3cYez//pezFEJfvDyFd9ZwiNDv7W', 'Sr. Inspector Neha Singh', 'neha.singh@mahapolice.gov.in', 'Investigator', 2, 1),
(4, 'reviewer1', '$2a$10$Khv3V61flQG/yLjliTqTw.zJCglhGrtXi7iQ5eFflRIEXvRn5i6rC', 'Civil Reviewer Priya Kulkarni', 'reviewer@mumbaipolice.gov.in', 'Read-only Reviewer', NULL, 1);
