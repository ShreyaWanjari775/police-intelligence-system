const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

// Apply optionalAuth so logged-in citizens receive their own stats while police get dept stats
router.use(optionalAuth);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            const citId = req.user.citizen_id || 0;
            const [cStats] = await db.query(`
                SELECT
                    (SELECT COUNT(*) FROM complaint WHERE citizen_id = ?) AS total_complaints,
                    (SELECT COUNT(*) FROM complaint WHERE citizen_id = ? AND status IN ('Received', 'Under Review')) AS under_review,
                    (SELECT COUNT(*) FROM complaint WHERE citizen_id = ? AND status IN ('Accepted', 'Converted to Incident')) AS active_cases,
                    (SELECT COUNT(*) FROM complaint WHERE citizen_id = ? AND status IN ('Resolved', 'Closed')) AS closed_cases,
                    (SELECT COUNT(*) FROM court_proceeding cp
                     JOIN police_case pc ON cp.case_id = pc.case_id
                     JOIN fir f ON pc.fir_id = f.fir_id
                     JOIN incident i ON f.incident_id = i.incident_id
                     JOIN complaint c ON i.complaint_id = c.complaint_id
                     WHERE c.citizen_id = ? AND cp.status = 'Scheduled' AND cp.hearing_date >= CURRENT_TIMESTAMP) AS upcoming_hearings
            `, [citId, citId, citId, citId, citId]);

            return res.json({
                success: true,
                is_citizen: true,
                data: {
                    total_complaints: cStats[0].total_complaints || 0,
                    under_review: cStats[0].under_review || 0,
                    active_cases: cStats[0].active_cases || 0,
                    closed_cases: cStats[0].closed_cases || 0,
                    upcoming_hearings: cStats[0].upcoming_hearings || 0,
                    total_cases: cStats[0].active_cases + cStats[0].closed_cases,
                    total_firs: 0,
                    active_officers: 0,
                    total_evidence: 0
                }
            });
        }

        // Default Police Department Intelligence Statistics (Backend.sql lines 540-551)
        const [statsRows] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM citizen) AS total_citizens,
                (SELECT COUNT(*) FROM complaint) AS total_complaints,
                (SELECT COUNT(*) FROM incident) AS total_incidents,
                (SELECT COUNT(*) FROM fir) AS total_firs,
                (SELECT COUNT(*) FROM police_case) AS total_cases,
                (SELECT COUNT(*) FROM police_case WHERE status IN ('Registered','Investigation','Under Trial')) AS active_cases,
                (SELECT COUNT(*) FROM police_case WHERE status IN ('Resolved','Closed')) AS closed_cases,
                (SELECT COUNT(*) FROM officer WHERE status = 'Active') AS active_officers,
                (SELECT COUNT(*) FROM incident WHERE severity IN ('High', 'Critical')) AS high_severity_incidents,
                (SELECT COUNT(*) FROM evidence) AS total_evidence,
                (SELECT COUNT(*) FROM court_proceeding WHERE status = 'Scheduled' AND hearing_date >= CURRENT_TIMESTAMP) AS upcoming_hearings
        `);

        res.json({
            success: true,
            is_citizen: false,
            data: statsRows[0]
        });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve dashboard statistics.' });
    }
});

// GET /api/dashboard/recent-cases
router.get('/recent-cases', async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            const citId = req.user.citizen_id || 0;
            const [cRows] = await db.query(`
                SELECT
                    pc.case_id, pc.case_type, pc.status, pc.registered_date,
                    f.fir_number, i.severity, i.description, l.area, l.city
                FROM police_case pc
                JOIN fir f ON pc.fir_id = f.fir_id
                JOIN incident i ON f.incident_id = i.incident_id
                JOIN complaint c ON i.complaint_id = c.complaint_id
                LEFT JOIN location l ON i.location_id = l.location_id
                WHERE c.citizen_id = ?
                ORDER BY pc.registered_date DESC
                LIMIT 5;
            `, [citId]);
            return res.json({ success: true, data: cRows });
        }

        const [rows] = await db.query(`
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
                GROUP_CONCAT(DISTINCT o.name SEPARATOR ', ') AS assigned_officers
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN case_officer co ON pc.case_id = co.case_id
            LEFT JOIN officer o ON co.officer_id = o.officer_id
            GROUP BY
                pc.case_id, pc.case_type, pc.status, pc.registered_date,
                f.fir_number, i.severity, i.description, l.area, l.city
            ORDER BY pc.registered_date DESC
            LIMIT 5;
        `);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching recent cases:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve recent cases.' });
    }
});

// GET /api/dashboard/recent-complaints
router.get('/recent-complaints', async (req, res) => {
    try {
        let query = `
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
        `;
        const params = [];

        if (req.user && req.user.role === 'Citizen') {
            query += ` WHERE c.citizen_id = ?`;
            params.push(req.user.citizen_id);
        }

        query += ` ORDER BY c.complaint_date DESC LIMIT 5;`;

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching recent complaints:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve recent complaints.' });
    }
});

// GET /api/dashboard/priority-incidents
router.get('/priority-incidents', async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await db.query(`
            SELECT
                i.incident_id,
                i.type,
                i.severity,
                i.status,
                i.reported_at,
                i.description,
                l.area,
                l.city
            FROM incident i
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE i.severity IN ('High', 'Critical')
            ORDER BY i.reported_at DESC
            LIMIT 5;
        `);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching priority incidents:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve priority incidents.' });
    }
});

// GET /api/dashboard/recent-status-changes
router.get('/recent-status-changes', async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await db.query(`
            SELECT
                h.history_id,
                h.case_id,
                h.status,
                h.changed_at,
                h.remarks,
                o.name AS changed_by_officer,
                pc.case_type
            FROM case_status_history h
            LEFT JOIN officer o ON h.changed_by = o.officer_id
            JOIN police_case pc ON h.case_id = pc.case_id
            ORDER BY h.changed_at DESC
            LIMIT 5;
        `);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching recent status changes:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve recent status changes.' });
    }
});

module.exports = router;
