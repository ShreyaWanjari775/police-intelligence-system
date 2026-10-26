const db = require('../db');

/**
 * Record an administrative or security-critical action into the audit log.
 * @param {number|null} actorUserId - User ID performing the action
 * @param {string} actionType - Category of action (e.g. 'STATUS_CHANGE', 'CASE_UPDATE', 'EVIDENCE_CUSTODY', 'USER_MANAGEMENT', 'LOGIN')
 * @param {string} entityType - Entity affected (e.g. 'COMPLAINT', 'CASE', 'EVIDENCE', 'OFFICER', 'USER')
 * @param {number|null} entityId - ID of affected entity
 * @param {string} summary - Human-readable explanation of the action
 */
async function logAudit(actorUserId, actionType, entityType, entityId, summary) {
    try {
        if (!actorUserId) {
            // Find a fallback or system user ID if needed
            actorUserId = 1;
        }
        await db.query(
            `INSERT INTO administrative_audit_log (actor_user_id, action_type, entity_type, entity_id, summary, created_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [actorUserId, actionType, entityType, entityId || null, summary.substring(0, 500)]
        );
    } catch (err) {
        console.error('Failed to write audit log entry:', err.message);
    }
}

module.exports = {
    logAudit
};
