const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// Middleware to ensure user is a citizen or administrator authorized to access citizen portal
function requireCitizenOrAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.user.role === 'Citizen') {
        if (!req.user.citizen_id) {
            return res.status(403).json({ success: false, message: 'Citizen profile not linked to user account.' });
        }
        return next();
    }
    if (req.user.role === 'Administrator') {
        // Administrator accessing citizen portal: if no citizen_id attached, allow preview with fallback or active citizen_id query
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access restricted to citizen account holders.'
    });
}

// All citizen portal routes require token and citizen/admin authorization
router.use(authenticateToken, requireCitizenOrAdmin);

// Helper to resolve effective citizen_id (admin can preview a citizen_id via query parameter if specified)
function getEffectiveCitizenId(req) {
    if (req.user.role === 'Administrator' && req.query.preview_citizen_id) {
        return parseInt(req.query.preview_citizen_id);
    }
    return req.user.citizen_id;
}

// GET /api/citizen-portal/overview
router.get('/overview', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.json({
                success: true,
                data: {
                    stats: { total: 0, under_review: 0, investigating: 0, resolved: 0 },
                    recent_complaints: [],
                    recent_updates: [],
                    upcoming_hearings: []
                }
            });
        }

        // 1. Complaint counts
        const [counts] = await db.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status IN ('Received', 'Under Review') THEN 1 ELSE 0 END) AS under_review,
                SUM(CASE WHEN status IN ('Accepted', 'Converted to Incident') THEN 1 ELSE 0 END) AS investigating,
                SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved
            FROM complaint
            WHERE citizen_id = ?
        `, [citizenId]);

        // 2. Recent complaints
        const [recentComplaints] = await db.query(`
            SELECT
                c.complaint_id, c.type, c.description, c.complaint_date, c.status,
                l.area, l.city,
                f.fir_number,
                pc.case_id, pc.status AS case_status
            FROM complaint c
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE c.citizen_id = ?
            ORDER BY c.complaint_date DESC
            LIMIT 5
        `, [citizenId]);

        // 3. Recent status updates & notifications
        const [recentUpdates] = await db.query(`
            SELECT
                csu.update_id, csu.complaint_id, csu.status, csu.public_message, csu.created_at,
                c.type AS complaint_type
            FROM complaint_status_update csu
            JOIN complaint c ON csu.complaint_id = c.complaint_id
            WHERE c.citizen_id = ? AND csu.is_citizen_visible = 1
            ORDER BY csu.created_at DESC
            LIMIT 5
        `, [citizenId]);

        // 4. Relevant court hearings (only for cases originating from this citizen's complaints)
        const [hearings] = await db.query(`
            SELECT
                cp.proceeding_id, cp.court_name, cp.hearing_date, cp.status, cp.judge_name, cp.remarks,
                pc.case_id, pc.case_type, f.fir_number
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            JOIN complaint c ON i.complaint_id = c.complaint_id
            WHERE c.citizen_id = ? AND cp.hearing_date >= CURRENT_TIMESTAMP
            ORDER BY cp.hearing_date ASC
            LIMIT 3
        `, [citizenId]);

        res.json({
            success: true,
            data: {
                stats: {
                    total: counts[0].total || 0,
                    under_review: counts[0].under_review || 0,
                    investigating: counts[0].investigating || 0,
                    resolved: counts[0].resolved || 0
                },
                recent_complaints: recentComplaints,
                recent_updates: recentUpdates,
                upcoming_hearings: hearings
            }
        });
    } catch (err) {
        console.error('Error fetching citizen overview:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve citizen overview.' });
    }
});

// GET /api/citizen-portal/complaints - list personal complaints only
router.get('/complaints', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await db.query(`
            SELECT
                c.complaint_id, c.type, c.description, c.complaint_date, c.status,
                l.address AS location_address, l.area, l.city,
                i.incident_id, i.type AS incident_type, i.status AS incident_status,
                f.fir_id, f.fir_number, f.registered_date AS fir_date,
                pc.case_id, pc.case_type, pc.status AS case_status,
                (SELECT COUNT(*) FROM complaint_status_update WHERE complaint_id = c.complaint_id AND is_citizen_visible = 1) AS update_count
            FROM complaint c
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE c.citizen_id = ?
            ORDER BY c.complaint_date DESC
        `, [citizenId]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching citizen complaints:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve your complaints.' });
    }
});

// GET /api/citizen-portal/complaints/:id - detailed timeline & tracking
router.get('/complaints/:id', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        const complaintId = req.params.id;

        // Verify ownership
        const [complaintRows] = await db.query(`
            SELECT
                c.complaint_id, c.citizen_id, c.type, c.description, c.complaint_date, c.status,
                l.address AS location_address, l.area, l.city,
                i.incident_id, i.type AS incident_type, i.status AS incident_status, i.reported_at AS incident_reported_at,
                f.fir_id, f.fir_number, f.registered_date AS fir_date, f.sections AS fir_sections,
                pc.case_id, pc.case_type, pc.status AS case_status, pc.registered_date AS case_registered_date
            FROM complaint c
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE c.complaint_id = ?
        `, [complaintId]);

        if (complaintRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint record not found.' });
        }

        const complaint = complaintRows[0];
        // Enforce ownership: must match citizen_id or be administrator
        if (req.user.role !== 'Administrator' && complaint.citizen_id !== citizenId) {
            return res.status(403).json({ success: false, message: 'Unauthorized. You may only view complaints you personally submitted.' });
        }

        // Fetch citizen-visible timeline updates
        const [timeline] = await db.query(`
            SELECT
                csu.update_id, csu.status, csu.public_message, csu.created_at,
                u.full_name AS updated_by_name
            FROM complaint_status_update csu
            LEFT JOIN system_user u ON csu.changed_by = u.user_id
            WHERE csu.complaint_id = ? AND csu.is_citizen_visible = 1
            ORDER BY csu.created_at ASC
        `, [complaintId]);

        // Fetch linked court hearing if case exists
        let hearings = [];
        if (complaint.case_id) {
            const [hRows] = await db.query(`
                SELECT proceeding_id, court_name, hearing_date, status, judge_name, remarks
                FROM court_proceeding
                WHERE case_id = ?
                ORDER BY hearing_date ASC
            `, [complaint.case_id]);
            hearings = hRows;
        }

        res.json({
            success: true,
            data: {
                ...complaint,
                timeline,
                court_hearings: hearings
            }
        });
    } catch (err) {
        console.error('Error fetching complaint details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve complaint details.' });
    }
});

// POST /api/citizen-portal/complaints - submit a new complaint
router.post('/complaints', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'No valid citizen ID associated with this account.' });
        }

        const { type, description, location_id, custom_location } = req.body;
        if (!type || !description) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Complaint type and description are required.' });
        }

        let locId = location_id ? parseInt(location_id) : null;

        // If custom address provided, create location record
        if (!locId && custom_location && custom_location.address) {
            const [locRes] = await conn.query(
                'INSERT INTO location (address, area, city, landmark) VALUES (?, ?, ?, ?)',
                [custom_location.address, custom_location.area || 'City Central', custom_location.city || 'Mumbai', custom_location.landmark || null]
            );
            locId = locRes.insertId;
        }

        // Insert complaint strictly with req.user.citizen_id (ownership enforced)
        const [compResult] = await conn.query(
            `INSERT INTO complaint (citizen_id, type, description, location_id, status, complaint_date)
             VALUES (?, ?, ?, ?, 'Received', CURRENT_TIMESTAMP)`,
            [citizenId, type.trim(), description.trim(), locId]
        );

        const complaintId = compResult.insertId;

        // Insert initial timeline status update
        await conn.query(
            `INSERT INTO complaint_status_update (complaint_id, status, public_message, is_citizen_visible, changed_by, created_at)
             VALUES (?, 'Received', 'Your complaint has been successfully recorded in the central intelligence system and queued for police department review.', 1, ?, CURRENT_TIMESTAMP)`,
            [complaintId, req.user.user_id]
        );

        await conn.commit();

        // Audit log
        logAudit(req.user.user_id, 'CITIZEN_COMPLAINT_FILED', 'COMPLAINT', complaintId, `Citizen ${req.user.full_name} filed new complaint #${complaintId} (${type})`);

        res.status(201).json({
            success: true,
            message: 'Complaint successfully registered. Reference ID #' + complaintId,
            complaint_id: complaintId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error submitting citizen complaint:', err);
        res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
    } finally {
        conn.release();
    }
});

// GET /api/citizen-portal/cases - view linked cases for citizen
router.get('/cases', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await db.query(`
            SELECT
                pc.case_id, pc.case_type, pc.status AS case_status, pc.registered_date, pc.closed_date,
                f.fir_number, f.registered_date AS fir_date,
                c.complaint_id, c.type AS complaint_type,
                l.area, l.city
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            JOIN complaint c ON i.complaint_id = c.complaint_id
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE c.citizen_id = ?
            ORDER BY pc.registered_date DESC
        `, [citizenId]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching citizen cases:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve cases.' });
    }
});

// GET /api/citizen-portal/hearings - view linked court hearings
router.get('/hearings', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await db.query(`
            SELECT
                cp.proceeding_id, cp.court_name, cp.hearing_date, cp.status, cp.judge_name, cp.remarks,
                pc.case_id, pc.case_type, pc.status AS case_status,
                f.fir_number,
                c.complaint_id, c.type AS complaint_type
            FROM court_proceeding cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            JOIN complaint c ON i.complaint_id = c.complaint_id
            WHERE c.citizen_id = ?
            ORDER BY cp.hearing_date ASC
        `, [citizenId]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching citizen hearings:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve court hearings.' });
    }
});

// GET /api/citizen-portal/profile
router.get('/profile', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.status(404).json({ success: false, message: 'Citizen profile not found.' });
        }

        const [rows] = await db.query('SELECT * FROM citizen WHERE citizen_id = ?', [citizenId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Citizen record not found.' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching citizen profile:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
});

// PUT /api/citizen-portal/profile
router.put('/profile', async (req, res) => {
    try {
        const citizenId = getEffectiveCitizenId(req);
        if (!citizenId) {
            return res.status(404).json({ success: false, message: 'Citizen profile not found.' });
        }

        const { phone, address } = req.body;
        await db.query(
            'UPDATE citizen SET phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE citizen_id = ?',
            [phone || null, address || null, citizenId]
        );

        logAudit(req.user.user_id, 'CITIZEN_PROFILE_UPDATE', 'CITIZEN', citizenId, `Citizen updated contact info`);

        res.json({ success: true, message: 'Contact profile updated successfully.' });
    } catch (err) {
        console.error('Error updating citizen profile:', err);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

module.exports = router;
