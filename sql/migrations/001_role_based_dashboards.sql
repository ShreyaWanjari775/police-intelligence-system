-- =========================================================
-- POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
-- MIGRATION: SEPARATE ADMIN AND CITIZEN DASHBOARDS & RBAC
-- =========================================================

USE police_intelligence_system;

-- 1. Ensure system_user has role ENUM with 'Citizen' and citizen_id link
ALTER TABLE system_user
    MODIFY COLUMN role ENUM(
        'Administrator',
        'Officer',
        'Investigator',
        'Read-only Reviewer',
        'Citizen'
    ) NOT NULL DEFAULT 'Read-only Reviewer';

-- Add citizen_id if not present
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'system_user'
      AND COLUMN_NAME = 'citizen_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE system_user ADD COLUMN citizen_id INT NULL, ADD UNIQUE KEY uq_system_user_citizen (citizen_id), ADD CONSTRAINT fk_system_user_citizen FOREIGN KEY (citizen_id) REFERENCES citizen(citizen_id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Audit Log Table for Administrative Operations
CREATE TABLE IF NOT EXISTS administrative_audit_log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NOT NULL,
    action_type VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id BIGINT NULL,
    summary VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY fk_administrative_audit_actor (actor_user_id),
    KEY idx_administrative_audit_created_at (created_at),
    CONSTRAINT fk_administrative_audit_actor
        FOREIGN KEY (actor_user_id) REFERENCES system_user(user_id)
);

-- 3. Citizen-Visible Complaint Status Updates (Timeline)
CREATE TABLE IF NOT EXISTS complaint_status_update (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    status VARCHAR(60) NOT NULL,
    public_message VARCHAR(500) DEFAULT NULL,
    is_citizen_visible TINYINT(1) NOT NULL DEFAULT 1,
    changed_by INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY fk_complaint_status_update_user (changed_by),
    KEY idx_complaint_status_update_visible (complaint_id, is_citizen_visible, created_at),
    CONSTRAINT fk_complaint_status_update_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaint(complaint_id) ON DELETE CASCADE,
    CONSTRAINT fk_complaint_status_update_user
        FOREIGN KEY (changed_by) REFERENCES system_user(user_id) ON DELETE SET NULL
);
