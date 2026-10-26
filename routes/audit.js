const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/audit-logs (Administrator only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { action_type, entity_type, actor_user_id, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                a.audit_id, a.actor_user_id, a.action_type, a.entity_type, a.entity_id, a.summary, a.created_at,
                u.username AS actor_username, u.full_name AS actor_name, u.role AS actor_role
            FROM administrative_audit_log a
            LEFT JOIN system_user u ON a.actor_user_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (action_type) {
            query += ` AND a.action_type = ?`;
            params.push(action_type);
        }
        if (entity_type) {
            query += ` AND a.entity_type = ?`;
            params.push(entity_type);
        }
        if (actor_user_id) {
            query += ` AND a.actor_user_id = ?`;
            params.push(parseInt(actor_user_id));
        }
        if (search) {
            query += ` AND (a.summary LIKE ? OR a.action_type LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` ORDER BY a.created_at DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM administrative_audit_log a
            LEFT JOIN system_user u ON a.actor_user_id = u.user_id
            WHERE 1=1
        `;
        const countParams = [];
        if (action_type) {
            countQuery += ` AND a.action_type = ?`;
            countParams.push(action_type);
        }
        if (entity_type) {
            countQuery += ` AND a.entity_type = ?`;
            countParams.push(entity_type);
        }
        if (actor_user_id) {
            countQuery += ` AND a.actor_user_id = ?`;
            countParams.push(parseInt(actor_user_id));
        }
        if (search) {
            countQuery += ` AND (a.summary LIKE ? OR a.action_type LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)`;
            const s = `%${search}%`;
            countParams.push(s, s, s, s);
        }
        const [countRows] = await db.query(countQuery, countParams);

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: countRows[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve administrative audit logs.' });
    }
});

module.exports = router;
