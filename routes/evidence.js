const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken, requirePolice, requireOfficer, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// All evidence endpoints require authentication and police department authorization
router.use(authenticateToken, requirePolice);

// GET /api/evidence - list evidence (Backend.sql lines 585-600)
router.get('/', async (req, res) => {
    try {
        const { case_id, status, type, evidence_loc_id, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                e.evidence_id,
                e.case_id,
                e.type,
                e.description,
                e.collected_date,
                e.status,
                e.file_path,
                e.location_id,
                e.evidence_loc_id,
                o.officer_id AS collected_by_id,
                o.name AS collected_by,
                o.rank AS officer_rank,
                el.name AS storage_location,
                el.address AS storage_address,
                pc.case_type,
                pc.status AS case_status,
                f.fir_number
            FROM evidence e
            JOIN officer o ON e.collected_by = o.officer_id
            LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            WHERE 1=1
        `;
        const params = [];

        if (case_id) {
            query += ` AND e.case_id = ?`;
            params.push(parseInt(case_id));
        }
        if (status) {
            query += ` AND e.status = ?`;
            params.push(status);
        }
        if (type) {
            query += ` AND e.type = ?`;
            params.push(type);
        }
        if (evidence_loc_id) {
            query += ` AND e.evidence_loc_id = ?`;
            params.push(parseInt(evidence_loc_id));
        }
        if (search) {
            query += ` AND (e.description LIKE ? OR e.type LIKE ? OR o.name LIKE ? OR el.name LIKE ? OR f.fir_number LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        query += ` ORDER BY e.collected_date DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM evidence e
            JOIN officer o ON e.collected_by = o.officer_id
            LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            WHERE 1=1
        `;
        const countParams = [];
        if (case_id) {
            countQuery += ` AND e.case_id = ?`;
            countParams.push(parseInt(case_id));
        }
        if (status) {
            countQuery += ` AND e.status = ?`;
            countParams.push(status);
        }
        if (type) {
            countQuery += ` AND e.type = ?`;
            countParams.push(type);
        }
        if (evidence_loc_id) {
            countQuery += ` AND e.evidence_loc_id = ?`;
            countParams.push(parseInt(evidence_loc_id));
        }
        if (search) {
            countQuery += ` AND (e.description LIKE ? OR e.type LIKE ? OR o.name LIKE ? OR el.name LIKE ? OR f.fir_number LIKE ?)`;
            const s = `%${search}%`;
            countParams.push(s, s, s, s, s);
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
        console.error('Error fetching evidence:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve evidence records.' });
    }
});

// GET /api/evidence/:id - details + custody history
router.get('/:id', async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const [rows] = await db.query(`
            SELECT
                e.*,
                o.name AS collected_by_name,
                o.rank AS collected_by_rank,
                o.badge_number AS collected_by_badge,
                el.name AS storage_location_name,
                el.address AS storage_location_address,
                l.address AS recovery_location_address,
                l.area AS recovery_area,
                l.city AS recovery_city,
                pc.case_type,
                pc.status AS case_status,
                f.fir_number
            FROM evidence e
            JOIN officer o ON e.collected_by = o.officer_id
            LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
            LEFT JOIN location l ON e.location_id = l.location_id
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            WHERE e.evidence_id = ?
        `, [evidenceId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Evidence record not found.' });
        }

        // Fetch chain of custody logs
        const [custodyLogs] = await db.query(`
            SELECT
                c.*,
                o.name AS handled_by_name,
                o.rank AS handled_by_rank,
                o.badge_number AS handled_by_badge,
                el.name AS storage_name
            FROM evidence_custody_log c
            JOIN officer o ON c.handled_by = o.officer_id
            LEFT JOIN evidence_location el ON c.evidence_loc_id = el.evidence_loc_id
            WHERE c.evidence_id = ?
            ORDER BY c.action_date DESC
        `, [evidenceId]);

        res.json({
            success: true,
            data: {
                ...rows[0],
                custody_logs: custodyLogs
            }
        });
    } catch (err) {
        console.error('Error fetching evidence details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve evidence details.' });
    }
});

// GET /api/evidence/:id/file - Secure authenticated evidence file download
router.get('/:id/file', async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const [rows] = await db.query('SELECT evidence_id, file_path, description, type FROM evidence WHERE evidence_id = ?', [evidenceId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Evidence not found.' });
        }

        const ev = rows[0];
        if (!ev.file_path) {
            return res.status(404).json({ success: false, message: 'No file is associated with this evidence record.' });
        }

        // Resolve file path safely
        let relativePath = ev.file_path;
        if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
        const resolvedPath = path.resolve(__dirname, '..', 'public', relativePath);

        // Security check: ensure path is within public/uploads
        const uploadsRoot = path.resolve(__dirname, '..', 'public');
        if (!resolvedPath.startsWith(uploadsRoot)) {
            return res.status(403).json({ success: false, message: 'Access denied. Invalid file location.' });
        }

        if (!fs.existsSync(resolvedPath)) {
            // Return placeholder or notification if file not on disk
            return res.status(404).json({
                success: false,
                message: `Evidence file recorded as ${ev.file_path} is not present in the local vault filesystem.`
            });
        }

        logAudit(req.user.user_id, 'EVIDENCE_FILE_ACCESS', 'EVIDENCE', evidenceId, `Officer ${req.user.full_name} accessed secure file for evidence #${evidenceId}`);

        res.sendFile(resolvedPath);
    } catch (err) {
        console.error('Error serving evidence file:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve evidence file.' });
    }
});

// POST /api/evidence - add evidence with initial custody logging
router.post('/', requireOfficer, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            case_id, type, description, collected_by,
            location_id, evidence_loc_id, status = 'Collected', file_path
        } = req.body;

        if (!case_id || !type || !collected_by) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Case ID, evidence type, and collecting officer are required.'
            });
        }

        const validStatuses = ['Collected', 'In Storage', 'Under Examination', 'Released', 'Disposed'];
        const evStatus = validStatuses.includes(status) ? status : 'Collected';

        // 1. Insert into evidence table
        const [result] = await conn.query(`
            INSERT INTO evidence (case_id, type, description, collected_by, location_id, evidence_loc_id, status, file_path, collected_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [case_id, type, description || null, collected_by, location_id || null, evidence_loc_id || null, evStatus, file_path || null]);

        const evidenceId = result.insertId;

        // 2. Insert initial chain of custody entry
        await conn.query(`
            INSERT INTO evidence_custody_log (evidence_id, action_type, handled_by, from_location, to_location, evidence_loc_id, action_date, remarks)
            VALUES (?, 'Collected', ?, 'Scene of Incident', 'Police Custody', ?, CURRENT_TIMESTAMP, 'Initial collection and property tagging')
        `, [evidenceId, collected_by, evidence_loc_id || null]);

        await conn.commit();

        logAudit(req.user.user_id, 'EVIDENCE_CREATED', 'EVIDENCE', evidenceId, `Officer ${req.user.full_name} logged evidence #${evidenceId} (${type}) for case #${case_id}`);

        res.status(201).json({
            success: true,
            message: 'Evidence registered and chain-of-custody log created.',
            evidence_id: evidenceId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error adding evidence:', err);
        res.status(500).json({ success: false, message: 'Failed to add evidence record.' });
    } finally {
        conn.release();
    }
});

// PUT /api/evidence/:id - update evidence status and log custody transfer
router.put('/:id', requireOfficer, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const evidenceId = req.params.id;
        const { type, description, status, evidence_loc_id, handled_by, custody_action, remarks } = req.body;

        const [evRows] = await conn.query('SELECT * FROM evidence WHERE evidence_id = ?', [evidenceId]);
        if (evRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Evidence not found.' });
        }

        const oldEv = evRows[0];

        // Update evidence
        await conn.query(`
            UPDATE evidence
            SET type = COALESCE(?, type),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                evidence_loc_id = COALESCE(?, evidence_loc_id)
            WHERE evidence_id = ?
        `, [type, description, status, evidence_loc_id, evidenceId]);

        // If custody action or status change specified, log it
        if (custody_action || (status && status !== oldEv.status)) {
            const officerId = handled_by || (req.user && req.user.officer_id) || oldEv.collected_by;
            const action = custody_action || (status === 'In Storage' ? 'Transferred to Evidence Room' :
                status === 'Under Examination' ? 'Sent for Forensic Lab Examination' :
                status === 'Released' ? 'Released to Owner' :
                status === 'Disposed' ? 'Disposed' : 'Collected');

            await conn.query(`
                INSERT INTO evidence_custody_log (evidence_id, action_type, handled_by, evidence_loc_id, action_date, remarks)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `, [evidenceId, action, officerId, evidence_loc_id || oldEv.evidence_loc_id, remarks || `Status changed from ${oldEv.status} to ${status}`]);
        }

        await conn.commit();

        logAudit(req.user.user_id, 'EVIDENCE_UPDATED', 'EVIDENCE', evidenceId, `Evidence #${evidenceId} updated by ${req.user.full_name}`);

        res.json({ success: true, message: 'Evidence and custody log updated successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('Error updating evidence:', err);
        res.status(500).json({ success: false, message: 'Failed to update evidence.' });
    } finally {
        conn.release();
    }
});

// POST /api/evidence/:id/custody - append chain of custody event
router.post('/:id/custody', requireOfficer, async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { action_type, handled_by, from_location, to_location, evidence_loc_id, remarks } = req.body;

        if (!action_type || !handled_by) {
            return res.status(400).json({ success: false, message: 'Action type and handling officer are required.' });
        }

        const [result] = await db.query(`
            INSERT INTO evidence_custody_log (evidence_id, action_type, handled_by, from_location, to_location, evidence_loc_id, action_date, remarks)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `, [evidenceId, action_type, handled_by, from_location || null, to_location || null, evidence_loc_id || null, remarks || null]);

        logAudit(req.user.user_id, 'EVIDENCE_CUSTODY_LOG', 'EVIDENCE', evidenceId, `Custody event '${action_type}' recorded for evidence #${evidenceId}`);

        res.status(201).json({
            success: true,
            message: 'Chain of custody event recorded.',
            custody_id: result.insertId
        });
    } catch (err) {
        console.error('Error adding custody event:', err);
        res.status(500).json({ success: false, message: 'Failed to log custody event.' });
    }
});

// DELETE /api/evidence/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const [result] = await db.query('DELETE FROM evidence WHERE evidence_id = ?', [evidenceId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Evidence not found.' });
        }

        logAudit(req.user.user_id, 'EVIDENCE_DELETE', 'EVIDENCE', evidenceId, `Admin ${req.user.full_name} deleted evidence record #${evidenceId}`);

        res.json({ success: true, message: 'Evidence deleted successfully.' });
    } catch (err) {
        console.error('Error deleting evidence:', err);
        res.status(500).json({ success: false, message: 'Failed to delete evidence.' });
    }
});

module.exports = router;
