const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireOfficer, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// GET /api/court-proceedings - list proceedings (Backend.sql lines 602-613)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { case_id, status, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                cp.proceeding_id,
                cp.case_id,
                cp.court_name,
                cp.hearing_date,
                cp.status,
                cp.judge_name,
                cp.remarks,
                pc.case_type,
                pc.status AS case_status,
                f.fir_number
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
        `;
        const params = [];

        // If Citizen, only show hearings originating from their own complaints
        if (req.user.role === 'Citizen') {
            query += `
                JOIN incident i ON f.incident_id = i.incident_id
                JOIN complaint c ON i.complaint_id = c.complaint_id
                WHERE c.citizen_id = ?
            `;
            params.push(req.user.citizen_id);
        } else {
            query += ` WHERE 1=1`;
        }

        if (case_id) {
            query += ` AND cp.case_id = ?`;
            params.push(parseInt(case_id));
        }
        if (status) {
            query += ` AND cp.status = ?`;
            params.push(status);
        }
        if (search) {
            query += ` AND (cp.court_name LIKE ? OR cp.judge_name LIKE ? OR cp.remarks LIKE ? OR pc.case_type LIKE ? OR f.fir_number LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        query += ` ORDER BY cp.hearing_date ASC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
        `;
        const countParams = [];

        if (req.user.role === 'Citizen') {
            countQuery += `
                JOIN incident i ON f.incident_id = i.incident_id
                JOIN complaint c ON i.complaint_id = c.complaint_id
                WHERE c.citizen_id = ?
            `;
            countParams.push(req.user.citizen_id);
        } else {
            countQuery += ` WHERE 1=1`;
        }

        if (case_id) {
            countQuery += ` AND cp.case_id = ?`;
            countParams.push(parseInt(case_id));
        }
        if (status) {
            countQuery += ` AND cp.status = ?`;
            countParams.push(status);
        }
        if (search) {
            countQuery += ` AND (cp.court_name LIKE ? OR cp.judge_name LIKE ? OR cp.remarks LIKE ? OR pc.case_type LIKE ? OR f.fir_number LIKE ?)`;
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
        console.error('Error fetching court proceedings:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve court proceedings.' });
    }
});

// GET /api/court-proceedings/upcoming
router.get('/upcoming', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT
                cp.proceeding_id,
                cp.case_id,
                cp.court_name,
                cp.hearing_date,
                cp.status,
                cp.judge_name,
                cp.remarks,
                pc.case_type,
                pc.status AS case_status,
                f.fir_number
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
        `;
        const params = [];

        if (req.user.role === 'Citizen') {
            query += `
                JOIN incident i ON f.incident_id = i.incident_id
                JOIN complaint c ON i.complaint_id = c.complaint_id
                WHERE c.citizen_id = ? AND cp.status = 'Scheduled' AND cp.hearing_date >= CURRENT_TIMESTAMP
            `;
            params.push(req.user.citizen_id);
        } else {
            query += ` WHERE cp.status = 'Scheduled' AND cp.hearing_date >= CURRENT_TIMESTAMP`;
        }

        query += ` ORDER BY cp.hearing_date ASC LIMIT 10;`;

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching upcoming hearings:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve upcoming hearings.' });
    }
});

// GET /api/court-proceedings/:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const proceedingId = req.params.id;
        const [rows] = await db.query(`
            SELECT
                cp.*,
                pc.case_type,
                pc.status AS case_status,
                pc.registered_date AS case_registered_date,
                f.fir_number,
                c.citizen_id
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            LEFT JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN complaint c ON i.complaint_id = c.complaint_id
            WHERE cp.proceeding_id = ?
        `, [proceedingId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Proceeding record not found.' });
        }

        const proc = rows[0];
        if (req.user.role === 'Citizen' && proc.citizen_id !== req.user.citizen_id) {
            return res.status(403).json({ success: false, message: 'Access denied. You cannot view proceedings for other cases.' });
        }

        res.json({ success: true, data: proc });
    } catch (err) {
        console.error('Error fetching court proceeding details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve proceeding details.' });
    }
});

// POST /api/court-proceedings - add hearing (Officer / Administrator only)
router.post('/', authenticateToken, requireOfficer, async (req, res) => {
    try {
        const { case_id, court_name, hearing_date, status = 'Scheduled', judge_name, remarks } = req.body;
        if (!case_id || !court_name || !hearing_date) {
            return res.status(400).json({ success: false, message: 'Case ID, court name, and hearing date are required.' });
        }

        // Validate case exists
        const [cases] = await db.query('SELECT case_id FROM police_case WHERE case_id = ?', [case_id]);
        if (cases.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified case does not exist.' });
        }

        const validStatuses = ['Scheduled', 'Completed', 'Adjourned', 'Cancelled', 'Judgment Delivered'];
        const procStatus = validStatuses.includes(status) ? status : 'Scheduled';

        const [result] = await db.query(`
            INSERT INTO court_proceeding (case_id, court_name, hearing_date, status, judge_name, remarks)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [case_id, court_name, hearing_date, procStatus, judge_name || null, remarks || null]);

        logAudit(req.user.user_id, 'COURT_HEARING_SCHEDULED', 'COURT', result.insertId, `Officer ${req.user.full_name} scheduled court hearing #${result.insertId} for case #${case_id}`);

        res.status(201).json({
            success: true,
            message: 'Court proceeding scheduled successfully.',
            proceeding_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating court proceeding:', err);
        res.status(500).json({ success: false, message: 'Failed to schedule court proceeding.' });
    }
});

// PUT /api/court-proceedings/:id (Officer / Administrator only)
router.put('/:id', authenticateToken, requireOfficer, async (req, res) => {
    try {
        const proceedingId = req.params.id;
        const { court_name, hearing_date, status, judge_name, remarks } = req.body;

        const [result] = await db.query(`
            UPDATE court_proceeding
            SET court_name = COALESCE(?, court_name),
                hearing_date = COALESCE(?, hearing_date),
                status = COALESCE(?, status),
                judge_name = COALESCE(?, judge_name),
                remarks = COALESCE(?, remarks)
            WHERE proceeding_id = ?
        `, [court_name, hearing_date, status, judge_name, remarks, proceedingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Court proceeding not found.' });
        }

        logAudit(req.user.user_id, 'COURT_HEARING_UPDATED', 'COURT', proceedingId, `Officer ${req.user.full_name} updated hearing #${proceedingId}`);

        res.json({ success: true, message: 'Court proceeding updated successfully.' });
    } catch (err) {
        console.error('Error updating court proceeding:', err);
        res.status(500).json({ success: false, message: 'Failed to update court proceeding.' });
    }
});

// DELETE /api/court-proceedings/:id (Administrator only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const proceedingId = req.params.id;
        const [result] = await db.query('DELETE FROM court_proceeding WHERE proceeding_id = ?', [proceedingId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Court proceeding not found.' });
        }

        logAudit(req.user.user_id, 'COURT_HEARING_DELETED', 'COURT', proceedingId, `Admin ${req.user.full_name} deleted court proceeding #${proceedingId}`);

        res.json({ success: true, message: 'Court proceeding deleted successfully.' });
    } catch (err) {
        console.error('Error deleting court proceeding:', err);
        res.status(500).json({ success: false, message: 'Failed to delete court proceeding.' });
    }
});

module.exports = router;
