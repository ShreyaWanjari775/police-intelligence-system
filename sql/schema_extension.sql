-- =========================================================
-- POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
-- SCHEMA EXTENSIONS (AUTHENTICATION & AUDIT / CHAIN OF CUSTODY)
-- =========================================================
-- Note: These tables extend the core ER model to provide secure
-- role-based authentication and evidence chain of custody auditing,
-- as requested in specification sections 3.H, 5, and 6.
-- =========================================================

USE police_intelligence_system;

-- 1. SYSTEM USERS (Authentication & Role-Based Access Control)
CREATE TABLE IF NOT EXISTS system_user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE,
    role ENUM(
        'Administrator',
        'Officer',
        'Investigator',
        'Read-only Reviewer'
    ) NOT NULL DEFAULT 'Read-only Reviewer',
    officer_id INT NULL,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (officer_id)
        REFERENCES officer(officer_id)
        ON DELETE SET NULL
);

-- 2. EVIDENCE CUSTODY LOG (Chain-of-Custody Tracking)
CREATE TABLE IF NOT EXISTS evidence_custody_log (
    custody_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    action_type ENUM(
        'Collected',
        'Transferred to Evidence Room',
        'Sent for Forensic Lab Examination',
        'Returned to Storage',
        'Presented in Court',
        'Released to Owner',
        'Disposed'
    ) NOT NULL,
    handled_by INT NOT NULL,
    from_location VARCHAR(150),
    to_location VARCHAR(150),
    evidence_loc_id INT NULL,
    action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (evidence_id)
        REFERENCES evidence(evidence_id)
        ON DELETE CASCADE,
    FOREIGN KEY (handled_by)
        REFERENCES officer(officer_id),
    FOREIGN KEY (evidence_loc_id)
        REFERENCES evidence_location(evidence_loc_id)
        ON DELETE SET NULL
);
