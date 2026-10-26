const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// GET /api/incidents - list with filtering
router.get('/', optionalAuth, async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. The police incident directory is restricted to authorized personnel.'
            });
        }

        const { severity, status, type, location_id, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                i.*,
                c.citizen_id,
                ci.name AS citizen_name,
                l.address AS location_address,
                l.area,
                l.city,
                l.latitude,
                l.longitude,
                f.fir_id,
                f.fir_number,
                pc.case_id,
                pc.case_type,
                pc.status AS case_status
            FROM incident i
            JOIN complaint c ON i.complaint_id = c.complaint_id
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE 1=1
        `;
        const params = [];

        if (severity) {
            query += ` AND i.severity = ?`;
            params.push(severity);
        }
        if (status) {
            query += ` AND i.status = ?`;
            params.push(status);
        }
        if (type) {
            query += ` AND i.type = ?`;
            params.push(type);
        }
        if (location_id) {
            query += ` AND i.location_id = ?`;
            params.push(parseInt(location_id));
        }
        if (search) {
            query += ` AND (i.description LIKE ? OR i.type LIKE ? OR ci.name LIKE ? OR l.area LIKE ? OR l.city LIKE ? OR f.fir_number LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        query += ` ORDER BY i.reported_at DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM incident i
            JOIN complaint c ON i.complaint_id = c.complaint_id
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            WHERE 1=1
        `;
        const countParams = [];
        if (severity) {
            countQuery += ` AND i.severity = ?`;
            countParams.push(severity);
        }
        if (status) {
            countQuery += ` AND i.status = ?`;
            countParams.push(status);
        }
        if (type) {
            countQuery += ` AND i.type = ?`;
            countParams.push(type);
        }
        if (location_id) {
            countQuery += ` AND i.location_id = ?`;
            countParams.push(parseInt(location_id));
        }
        if (search) {
            countQuery += ` AND (i.description LIKE ? OR i.type LIKE ? OR ci.name LIKE ? OR l.area LIKE ? OR l.city LIKE ? OR f.fir_number LIKE ?)`;
            const s = `%${search}%`;
            countParams.push(s, s, s, s, s, s);
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
        console.error('Error fetching incidents:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve incidents.' });
    }
});

// GET /api/incidents/map
// Query matching Backend.sql line 498-513 for the crime map
router.get('/map', async (req, res) => {
    try {
        const { severity, status, type } = req.query;
        let query = `
            SELECT
                i.incident_id,
                i.type,
                i.severity,
                i.status,
                i.description,
                i.reported_at,
                l.address,
                l.area,
                l.city,
                l.latitude,
                l.longitude,
                l.landmark,
                f.fir_id,
                f.fir_number,
                pc.case_id
            FROM incident i
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE l.latitude IS NOT NULL
              AND l.longitude IS NOT NULL
        `;
        const params = [];

        if (severity) {
            query += ` AND i.severity = ?`;
            params.push(severity);
        }
        if (status) {
            query += ` AND i.status = ?`;
            params.push(status);
        }
        if (type) {
            query += ` AND i.type = ?`;
            params.push(type);
        }

        query += ` ORDER BY i.reported_at DESC;`;

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching map incidents:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve map incidents.' });
    }
});

// GET /api/incidents/:id - details + FIR + Case
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. The police incident directory is restricted to authorized personnel.'
            });
        }
        const incidentId = req.params.id;
        const [rows] = await db.query(`
            SELECT
                i.*,
                c.citizen_id,
                ci.name AS citizen_name,
                ci.phone AS citizen_phone,
                ci.email AS citizen_email,
                l.address AS location_address,
                l.area,
                l.city,
                l.latitude,
                l.longitude,
                l.landmark,
                f.fir_id,
                f.fir_number,
                f.registered_date AS fir_date,
                f.sections,
                pc.case_id,
                pc.case_type,
                pc.status AS case_status
            FROM incident i
            JOIN complaint c ON i.complaint_id = c.complaint_id
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN fir f ON i.incident_id = f.incident_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE i.incident_id = ?
        `, [incidentId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Incident not found.' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching incident details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve incident details.' });
    }
});

// POST /api/incidents - register an incident directly
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { complaint_id, type, severity, description, location_id, status } = req.body;
        if (!complaint_id || !type) {
            return res.status(400).json({ success: false, message: 'Complaint ID and incident type are required.' });
        }

        // Verify complaint exists
        const [complaints] = await db.query('SELECT * FROM complaint WHERE complaint_id = ?', [complaint_id]);
        if (complaints.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified complaint does not exist.' });
        }

        const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
        const validStatuses = ['Reported', 'Under Investigation', 'Resolved', 'Closed'];

        const incSeverity = validSeverities.includes(severity) ? severity : 'Medium';
        const incStatus = validStatuses.includes(status) ? status : 'Reported';

        const [result] = await db.query(`
            INSERT INTO incident (complaint_id, type, severity, description, location_id, status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [complaint_id, type, incSeverity, description || null, location_id || complaints[0].location_id, incStatus]);

        // Update complaint status
        await db.query(`UPDATE complaint SET status = 'Converted to Incident' WHERE complaint_id = ?`, [complaint_id]);

        res.status(201).json({
            success: true,
            message: 'Incident registered successfully.',
            incident_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating incident:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'An incident is already linked to this complaint.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create incident.' });
    }
});

// PUT /api/incidents/:id - update incident
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const incidentId = req.params.id;
        const { type, severity, description, status, location_id } = req.body;

        const [result] = await db.query(`
            UPDATE incident
            SET type = COALESCE(?, type),
                severity = COALESCE(?, severity),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                location_id = COALESCE(?, location_id)
            WHERE incident_id = ?
        `, [type, severity, description, status, location_id, incidentId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Incident not found.' });
        }

        res.json({ success: true, message: 'Incident updated successfully.' });
    } catch (err) {
        console.error('Error updating incident:', err);
        res.status(500).json({ success: false, message: 'Failed to update incident.' });
    }
});

// DELETE /api/incidents/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const incidentId = req.params.id;
        const [result] = await db.query('DELETE FROM incident WHERE incident_id = ?', [incidentId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Incident not found.' });
        }
        res.json({ success: true, message: 'Incident deleted successfully.' });
    } catch (err) {
        console.error('Error deleting incident:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete incident because an FIR or case references it. Delete the linked FIR first.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to delete incident.' });
    }
});

module.exports = router;
