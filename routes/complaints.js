const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireOfficer, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// GET /api/complaints - list complaints with role-based filtering
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, type, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                c.complaint_id,
                c.citizen_id,
                ci.name AS citizen_name,
                ci.phone AS citizen_phone,
                ci.email AS citizen_email,
                c.type,
                c.description,
                c.complaint_date,
                c.status,
                c.location_id,
                l.address AS location_address,
                l.area,
                l.city,
                i.incident_id,
                i.severity AS incident_severity,
                i.status AS incident_status
            FROM complaint c
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            WHERE 1=1
        `;
        const params = [];

        // ENFORCE OWNERSHIP: If authenticated user is a Citizen, restrict to their own complaints ONLY!
        if (req.user.role === 'Citizen') {
            query += ` AND c.citizen_id = ?`;
            params.push(req.user.citizen_id);
        } else if (req.query.citizen_id) {
            // Police officer/admin can filter by specific citizen
            query += ` AND c.citizen_id = ?`;
            params.push(parseInt(req.query.citizen_id));
        }

        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        if (type) {
            query += ` AND c.type = ?`;
            params.push(type);
        }
        if (search) {
            query += ` AND (c.description LIKE ? OR c.type LIKE ? OR ci.name LIKE ? OR l.area LIKE ? OR l.city LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        query += ` ORDER BY c.complaint_date DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM complaint c
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON c.location_id = l.location_id
            WHERE 1=1
        `;
        const countParams = [];

        if (req.user.role === 'Citizen') {
            countQuery += ` AND c.citizen_id = ?`;
            countParams.push(req.user.citizen_id);
        } else if (req.query.citizen_id) {
            countQuery += ` AND c.citizen_id = ?`;
            countParams.push(parseInt(req.query.citizen_id));
        }

        if (status) {
            countQuery += ` AND c.status = ?`;
            countParams.push(status);
        }
        if (type) {
            countQuery += ` AND c.type = ?`;
            countParams.push(type);
        }
        if (search) {
            countQuery += ` AND (c.description LIKE ? OR c.type LIKE ? OR ci.name LIKE ? OR l.area LIKE ? OR l.city LIKE ?)`;
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
        console.error('Error fetching complaints:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve complaints.' });
    }
});

// GET /api/complaints/:id - details + incident + timeline updates
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const complaintId = req.params.id;
        const [rows] = await db.query(`
            SELECT
                c.*,
                ci.name AS citizen_name,
                ci.phone AS citizen_phone,
                ci.email AS citizen_email,
                ci.address AS citizen_address,
                l.address AS location_address,
                l.area,
                l.city,
                l.latitude,
                l.longitude,
                l.landmark,
                i.incident_id,
                i.type AS incident_type,
                i.severity AS incident_severity,
                i.status AS incident_status,
                i.reported_at AS incident_reported_at
            FROM complaint c
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            WHERE c.complaint_id = ?
        `, [complaintId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const complaint = rows[0];

        // RBAC Check: If user is Citizen, ensure they own this complaint
        if (req.user.role === 'Citizen' && complaint.citizen_id !== req.user.citizen_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission to view other citizens complaints.'
            });
        }

        // Fetch timeline updates
        const [updates] = await db.query(`
            SELECT csu.*, u.full_name AS updated_by_name, u.role AS updated_by_role
            FROM complaint_status_update csu
            LEFT JOIN system_user u ON csu.changed_by = u.user_id
            WHERE csu.complaint_id = ?
            ORDER BY csu.created_at ASC
        `, [complaintId]);

        res.json({
            success: true,
            data: {
                ...complaint,
                updates
            }
        });
    } catch (err) {
        console.error('Error fetching complaint details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve complaint details.' });
    }
});

// POST /api/complaints - register complaint
router.post('/', authenticateToken, async (req, res) => {
    try {
        let { citizen_id, type, description, location_id, status } = req.body;

        // If logged-in user is a Citizen, enforce their own citizen_id
        if (req.user.role === 'Citizen') {
            citizen_id = req.user.citizen_id;
        }

        if (!citizen_id || !type || !description) {
            return res.status(400).json({ success: false, message: 'Citizen ID, type, and description are required.' });
        }

        // Validate citizen exists
        const [citizens] = await db.query('SELECT citizen_id FROM citizen WHERE citizen_id = ?', [citizen_id]);
        if (citizens.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified citizen does not exist.' });
        }

        const validStatuses = ['Received', 'Under Review', 'Accepted', 'Rejected', 'Converted to Incident', 'Closed'];
        const complaintStatus = validStatuses.includes(status) ? status : 'Received';

        const [result] = await db.query(`
            INSERT INTO complaint (citizen_id, type, description, location_id, status, complaint_date)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [citizen_id, type.trim(), description.trim(), location_id || null, complaintStatus]);

        const complaintId = result.insertId;

        // Create initial timeline entry
        await db.query(`
            INSERT INTO complaint_status_update (complaint_id, status, public_message, is_citizen_visible, changed_by, created_at)
            VALUES (?, ?, 'Complaint recorded and assigned reference ID.', 1, ?, CURRENT_TIMESTAMP)
        `, [complaintId, complaintStatus, req.user.user_id]);

        logAudit(req.user.user_id, 'COMPLAINT_CREATED', 'COMPLAINT', complaintId, `Complaint #${complaintId} (${type}) registered for citizen #${citizen_id}`);

        res.status(201).json({
            success: true,
            message: 'Complaint registered successfully.',
            complaint_id: complaintId
        });
    } catch (err) {
        console.error('Error registering complaint:', err);
        res.status(500).json({ success: false, message: 'Failed to register complaint.' });
    }
});

// PUT /api/complaints/:id - update status or details (Officer / Administrator only)
router.put('/:id', authenticateToken, requireOfficer, async (req, res) => {
    try {
        const complaintId = req.params.id;
        const { type, description, status, location_id, public_message } = req.body;

        const [existing] = await db.query('SELECT * FROM complaint WHERE complaint_id = ?', [complaintId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const oldComplaint = existing[0];

        const [result] = await db.query(`
            UPDATE complaint
            SET type = COALESCE(?, type),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                location_id = COALESCE(?, location_id)
            WHERE complaint_id = ?
        `, [type, description, status, location_id, complaintId]);

        // If status changed or public note provided, record in timeline
        if ((status && status !== oldComplaint.status) || public_message) {
            const newStatus = status || oldComplaint.status;
            const message = public_message || `Complaint status updated to ${newStatus} by investigating officer.`;

            await db.query(`
                INSERT INTO complaint_status_update (complaint_id, status, public_message, is_citizen_visible, changed_by, created_at)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            `, [complaintId, newStatus, message, req.user.user_id]);

            logAudit(req.user.user_id, 'COMPLAINT_STATUS_UPDATE', 'COMPLAINT', complaintId, `Status updated to ${newStatus}. Note: ${message}`);
        }

        res.json({ success: true, message: 'Complaint updated successfully.' });
    } catch (err) {
        console.error('Error updating complaint:', err);
        res.status(500).json({ success: false, message: 'Failed to update complaint.' });
    }
});

// POST /api/complaints/:id/convert-to-incident (Officer / Administrator only)
router.post('/:id/convert-to-incident', authenticateToken, requireOfficer, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const complaintId = req.params.id;
        const { incident_type, severity = 'Medium', description, location_id } = req.body;

        // Check if complaint exists
        const [complaints] = await conn.query('SELECT * FROM complaint WHERE complaint_id = ?', [complaintId]);
        if (complaints.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        // Check if incident already exists for this complaint (1:1 constraint)
        const [existing] = await conn.query('SELECT incident_id FROM incident WHERE complaint_id = ?', [complaintId]);
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: `An incident (#${existing[0].incident_id}) has already been generated from this complaint.`
            });
        }

        const complaint = complaints[0];
        const incType = incident_type || complaint.type;
        const incDesc = description || complaint.description;
        const incLoc = location_id || complaint.location_id;

        // Insert incident
        const [incResult] = await conn.query(`
            INSERT INTO incident (complaint_id, type, severity, description, location_id, status, reported_at)
            VALUES (?, ?, ?, ?, ?, 'Reported', CURRENT_TIMESTAMP)
        `, [complaintId, incType, severity, incDesc, incLoc]);

        const incidentId = incResult.insertId;

        // Update complaint status
        await conn.query(`
            UPDATE complaint
            SET status = 'Converted to Incident'
            WHERE complaint_id = ?
        `, [complaintId]);

        // Insert timeline status update
        await conn.query(`
            INSERT INTO complaint_status_update (complaint_id, status, public_message, is_citizen_visible, changed_by, created_at)
            VALUES (?, 'Converted to Incident', ?, 1, ?, CURRENT_TIMESTAMP)
        `, [complaintId, `Complaint escalated and officially registered as Police Incident #${incidentId}.`, req.user.user_id]);

        await conn.commit();

        logAudit(req.user.user_id, 'CONVERT_TO_INCIDENT', 'INCIDENT', incidentId, `Complaint #${complaintId} converted to incident #${incidentId}`);

        res.status(201).json({
            success: true,
            message: 'Complaint successfully converted to Incident.',
            incident_id: incidentId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error converting complaint to incident:', err);
        res.status(500).json({ success: false, message: 'Failed to convert complaint to incident.' });
    } finally {
        conn.release();
    }
});

// DELETE /api/complaints/:id (Administrator only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const complaintId = req.params.id;
        const [result] = await db.query('DELETE FROM complaint WHERE complaint_id = ?', [complaintId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        logAudit(req.user.user_id, 'COMPLAINT_DELETE', 'COMPLAINT', complaintId, `Admin deleted complaint #${complaintId}`);

        res.json({ success: true, message: 'Complaint deleted successfully.' });
    } catch (err) {
        console.error('Error deleting complaint:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete complaint because an incident references it. Delete the linked incident first.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
    }
});

module.exports = router;
