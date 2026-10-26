const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePolice, requireOfficer, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// All case management routes require police personnel authentication
router.use(authenticateToken, requirePolice);

// GET /api/cases - list cases (from Backend.sql lines 516-538)
router.get('/', async (req, res) => {
    try {
        const { status, case_type, search, officer_id, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                pc.case_id,
                pc.fir_id,
                pc.case_type,
                pc.status,
                pc.registered_date,
                pc.closed_date,
                f.fir_number,
                i.incident_id,
                i.severity,
                i.description AS incident_description,
                l.area,
                l.city,
                GROUP_CONCAT(DISTINCT o.name SEPARATOR ', ') AS assigned_officers
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN case_officer co ON pc.case_id = co.case_id
            LEFT JOIN officer o ON co.officer_id = o.officer_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND pc.status = ?`;
            params.push(status);
        }
        if (case_type) {
            query += ` AND pc.case_type LIKE ?`;
            params.push(`%${case_type}%`);
        }
        if (officer_id) {
            query += ` AND co.officer_id = ?`;
            params.push(parseInt(officer_id));
        }
        if (search) {
            query += ` AND (pc.case_type LIKE ? OR f.fir_number LIKE ? OR i.description LIKE ? OR l.area LIKE ? OR l.city LIKE ? OR o.name LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        query += `
            GROUP BY
                pc.case_id, pc.fir_id, pc.case_type, pc.status, pc.registered_date, pc.closed_date,
                f.fir_number, i.incident_id, i.severity, i.description, l.area, l.city
            ORDER BY pc.registered_date DESC
        `;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total cases
        let countQuery = `
            SELECT COUNT(DISTINCT pc.case_id) AS total
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN case_officer co ON pc.case_id = co.case_id
            LEFT JOIN officer o ON co.officer_id = o.officer_id
            WHERE 1=1
        `;
        const countParams = [];
        if (status) {
            countQuery += ` AND pc.status = ?`;
            countParams.push(status);
        }
        if (case_type) {
            countQuery += ` AND pc.case_type LIKE ?`;
            countParams.push(`%${case_type}%`);
        }
        if (officer_id) {
            countQuery += ` AND co.officer_id = ?`;
            countParams.push(parseInt(officer_id));
        }
        if (search) {
            countQuery += ` AND (pc.case_type LIKE ? OR f.fir_number LIKE ? OR i.description LIKE ? OR l.area LIKE ? OR l.city LIKE ? OR o.name LIKE ?)`;
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
        console.error('Error fetching cases:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve cases.' });
    }
});

// GET /api/cases/:id - complete case details (Backend.sql lines 554-583 + sub-records)
router.get('/:id', async (req, res) => {
    try {
        const caseId = req.params.id;

        // 1. Core case details
        const [caseRows] = await db.query(`
            SELECT
                pc.case_id,
                pc.fir_id,
                pc.case_type,
                pc.status,
                pc.registered_date,
                pc.closed_date,
                f.fir_number,
                f.registered_date AS fir_date,
                f.sections,
                f.details AS fir_details,
                i.incident_id,
                i.type AS incident_type,
                i.severity,
                i.description AS incident_description,
                i.reported_at AS incident_reported_at,
                l.address,
                l.area,
                l.city,
                l.latitude,
                l.longitude,
                l.landmark,
                c.complaint_id,
                c.description AS complaint_description,
                ci.citizen_id,
                ci.name AS complainant_name,
                ci.phone AS complainant_phone
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            JOIN complaint c ON i.complaint_id = c.complaint_id
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE pc.case_id = ?
        `, [caseId]);

        if (caseRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }

        const caseData = caseRows[0];

        // 2. Assigned officers (case_officer)
        const [officers] = await db.query(`
            SELECT co.officer_id, co.assigned_at, co.assignment_role,
                   o.name, o.rank, o.badge_number, o.phone, o.email,
                   ps.name AS station_name, d.name AS department_name
            FROM case_officer co
            JOIN officer o ON co.officer_id = o.officer_id
            LEFT JOIN police_station ps ON o.station_id = ps.station_id
            LEFT JOIN department d ON o.dept_id = d.dept_id
            WHERE co.case_id = ?
            ORDER BY co.assigned_at ASC
        `, [caseId]);

        // 3. Persons involved (case_person)
        const [persons] = await db.query(`
            SELECT cp.person_id, cp.association_type, cp.notes,
                   p.name, p.phone, p.address, p.date_of_birth, p.gender,
                   v.age AS victim_age,
                   s.alias AS suspect_alias, s.criminal_history,
                   w.statement AS witness_statement
            FROM case_person cp
            JOIN person p ON cp.person_id = p.person_id
            LEFT JOIN victim v ON p.person_id = v.person_id
            LEFT JOIN suspect s ON p.person_id = s.person_id
            LEFT JOIN witness w ON p.person_id = w.person_id
            WHERE cp.case_id = ?
            ORDER BY cp.association_type, p.name
        `, [caseId]);

        // 4. Evidence items (Backend.sql lines 585-600)
        const [evidence] = await db.query(`
            SELECT e.evidence_id, e.case_id, e.type, e.description, e.collected_date,
                   e.status, e.file_path, o.name AS collected_by_officer,
                   el.name AS storage_location, el.address AS storage_address
            FROM evidence e
            JOIN officer o ON e.collected_by = o.officer_id
            LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
            WHERE e.case_id = ?
            ORDER BY e.collected_date DESC
        `, [caseId]);

        // 5. Court proceedings (Backend.sql lines 602-613)
        const [courtProceedings] = await db.query(`
            SELECT proceeding_id, case_id, court_name, hearing_date, status, judge_name, remarks
            FROM court_proceeding
            WHERE case_id = ?
            ORDER BY hearing_date ASC
        `, [caseId]);

        // 6. Case status history (Backend.sql lines 632-644)
        const [statusHistory] = await db.query(`
            SELECT h.history_id, h.case_id, h.status, h.changed_at, h.remarks,
                   o.name AS changed_by_officer
            FROM case_status_history h
            LEFT JOIN officer o ON h.changed_by = o.officer_id
            WHERE h.case_id = ?
            ORDER BY h.changed_at DESC
        `, [caseId]);

        res.json({
            success: true,
            data: {
                ...caseData,
                assigned_officers: officers,
                involved_persons: persons,
                evidence,
                court_proceedings: courtProceedings,
                status_history: statusHistory
            }
        });
    } catch (err) {
        console.error('Error fetching complete case details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve case details.' });
    }
});

// POST /api/cases - create a case
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { fir_id, case_type, status = 'Registered', initial_officer_id } = req.body;
        if (!fir_id || !case_type) {
            return res.status(400).json({ success: false, message: 'FIR ID and Case Type are required.' });
        }

        // Validate FIR exists
        const [firs] = await db.query('SELECT fir_id FROM fir WHERE fir_id = ?', [fir_id]);
        if (firs.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified FIR does not exist.' });
        }

        const validStatuses = ['Registered', 'Investigation', 'Under Trial', 'Resolved', 'Closed'];
        const caseStatus = validStatuses.includes(status) ? status : 'Registered';

        const [result] = await db.query(`
            INSERT INTO police_case (fir_id, case_type, status, registered_date)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [fir_id, case_type, caseStatus]);

        const caseId = result.insertId;

        // Record initial status history
        const changedBy = req.user && req.user.officer_id ? req.user.officer_id : (initial_officer_id || null);
        await db.query(`
            INSERT INTO case_status_history (case_id, status, changed_by, remarks)
            VALUES (?, ?, ?, 'Initial case creation and registration')
        `, [caseId, caseStatus, changedBy]);

        // Assign initial officer if provided
        if (initial_officer_id) {
            await db.query(`
                INSERT INTO case_officer (case_id, officer_id, assignment_role)
                VALUES (?, ?, 'Lead Investigating Officer')
            `, [caseId, initial_officer_id]);
        }

        res.status(201).json({
            success: true,
            message: 'Case created successfully.',
            case_id: caseId
        });
    } catch (err) {
        console.error('Error creating case:', err);
        res.status(500).json({ success: false, message: 'Failed to create case.' });
    }
});

// POST /api/cases/:id/status
// CRITICAL REQUIREMENT: Transaction-based Case Status Update and Status History logging
// Implements Backend.sql lines 770-786
router.post('/:id/status', authenticateToken, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const caseId = req.params.id;
        const { status, remarks, officer_id } = req.body;

        const validStatuses = ['Registered', 'Investigation', 'Under Trial', 'Resolved', 'Closed'];
        if (!status || !validStatuses.includes(status)) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
            });
        }

        const [caseRows] = await conn.query('SELECT case_id, status FROM police_case WHERE case_id = ?', [caseId]);
        if (caseRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }

        const isClosing = (status === 'Resolved' || status === 'Closed');
        const closedDateExpr = isClosing ? 'CURRENT_TIMESTAMP' : 'NULL';

        // 1. UPDATE police_case
        await conn.query(`
            UPDATE police_case
            SET status = ?,
                closed_date = ${closedDateExpr}
            WHERE case_id = ?
        `, [status, caseId]);

        // 2. INSERT into case_status_history
        const changedBy = (req.user && req.user.officer_id) ? req.user.officer_id : (officer_id || null);
        await conn.query(`
            INSERT INTO case_status_history (case_id, status, changed_by, remarks)
            VALUES (?, ?, ?, ?)
        `, [caseId, status, changedBy, remarks || `Status transitioned to ${status}`]);

        // 3. Find linked complaint if any, and record citizen-visible milestone
        const [linkedComplaint] = await conn.query(`
            SELECT c.complaint_id FROM complaint c
            JOIN incident i ON c.complaint_id = i.complaint_id
            JOIN fir f ON i.incident_id = f.incident_id
            WHERE f.fir_id = (SELECT fir_id FROM police_case WHERE case_id = ?)
        `, [caseId]);

        if (linkedComplaint.length > 0) {
            await conn.query(`
                INSERT INTO complaint_status_update (complaint_id, status, public_message, is_citizen_visible, changed_by, created_at)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            `, [linkedComplaint[0].complaint_id, status, remarks || `Police Case #${caseId} investigation status progressed to ${status}.`, req.user.user_id]);
        }

        await conn.commit();

        logAudit(req.user.user_id, 'CASE_STATUS_UPDATE', 'CASE', caseId, `Case #${caseId} status updated to '${status}'. Remarks: ${remarks || 'None'}`);

        res.json({
            success: true,
            message: `Case status successfully updated to '${status}'. Status history logged in transaction.`
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error updating case status transaction:', err);
        res.status(500).json({ success: false, message: 'Failed to update case status. Transaction rolled back.' });
    } finally {
        conn.release();
    }
});

// POST /api/cases/:id/officers - assign officer
router.post('/:id/officers', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { officer_id, assignment_role = 'Investigating Officer' } = req.body;

        if (!officer_id) {
            return res.status(400).json({ success: false, message: 'Officer ID is required.' });
        }

        // Validate officer exists
        const [officers] = await db.query('SELECT officer_id FROM officer WHERE officer_id = ?', [officer_id]);
        if (officers.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified officer does not exist.' });
        }

        await db.query(`
            INSERT INTO case_officer (case_id, officer_id, assignment_role, assigned_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [caseId, officer_id, assignment_role]);

        res.status(201).json({ success: true, message: 'Officer assigned to case successfully.' });
    } catch (err) {
        console.error('Error assigning officer:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This officer is already assigned to this case.' });
        }
        res.status(500).json({ success: false, message: 'Failed to assign officer.' });
    }
});

// DELETE /api/cases/:id/officers/:officerId - unassign officer (Backend.sql lines 754-756)
router.delete('/:id/officers/:officerId', authenticateToken, async (req, res) => {
    try {
        const { id: caseId, officerId } = req.params;
        const [result] = await db.query(
            'DELETE FROM case_officer WHERE case_id = ? AND officer_id = ?',
            [caseId, officerId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Officer assignment not found.' });
        }
        res.json({ success: true, message: 'Officer unassigned from case successfully.' });
    } catch (err) {
        console.error('Error unassigning officer:', err);
        res.status(500).json({ success: false, message: 'Failed to unassign officer.' });
    }
});

// POST /api/cases/:id/persons - link person to case (case_person)
router.post('/:id/persons', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { person_id, association_type = 'Other', notes } = req.body;

        if (!person_id) {
            return res.status(400).json({ success: false, message: 'Person ID is required.' });
        }

        const validAssoc = ['Victim', 'Suspect', 'Witness', 'Other'];
        const assocType = validAssoc.includes(association_type) ? association_type : 'Other';

        await db.query(`
            INSERT INTO case_person (case_id, person_id, association_type, notes)
            VALUES (?, ?, ?, ?)
        `, [caseId, person_id, assocType, notes || null]);

        res.status(201).json({ success: true, message: 'Person associated with case successfully.' });
    } catch (err) {
        console.error('Error linking person to case:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'This person is already linked to this case with that association type.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to associate person with case.' });
    }
});

// DELETE /api/cases/:id/persons/:personId/:associationType - remove person association (Backend.sql lines 757-761)
router.delete('/:id/persons/:personId/:associationType', authenticateToken, async (req, res) => {
    try {
        const { id: caseId, personId, associationType } = req.params;
        const [result] = await db.query(`
            DELETE FROM case_person
            WHERE case_id = ? AND person_id = ? AND association_type = ?
        `, [caseId, personId, associationType]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Person association not found.' });
        }
        res.json({ success: true, message: 'Person association removed successfully.' });
    } catch (err) {
        console.error('Error removing person from case:', err);
        res.status(500).json({ success: false, message: 'Failed to remove person association.' });
    }
});

// DELETE /api/cases/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const [result] = await db.query('DELETE FROM police_case WHERE case_id = ?', [caseId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }
        res.json({ success: true, message: 'Case deleted successfully.' });
    } catch (err) {
        console.error('Error deleting case:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete case because related evidence, court proceedings, or status history exist. Remove them first.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to delete case.' });
    }
});

module.exports = router;
