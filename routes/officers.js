
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePolice, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// All officer directory and management routes require police personnel authentication
router.use(authenticateToken, requirePolice);

// GET /api/officers - list officers
router.get('/', async (req, res) => {
    try {
        const { station_id, dept_id, status, search, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                o.officer_id,
                o.name,
                o.rank,
                o.badge_number,
                o.phone,
                o.email,
                o.status,
                o.station_id,
                o.dept_id,
                ps.name AS station_name,
                ps.city,
                d.name AS department_name,
                COUNT(DISTINCT co.case_id) AS assigned_cases_count,
                COUNT(DISTINCT e.evidence_id) AS evidence_collected_count
            FROM officer o
            JOIN police_station ps ON o.station_id = ps.station_id
            LEFT JOIN department d ON o.dept_id = d.dept_id
            LEFT JOIN case_officer co ON o.officer_id = co.officer_id
            LEFT JOIN evidence e ON o.officer_id = e.collected_by
            WHERE 1=1
        `;

        const params = [];

        if (station_id) {
            query += ` AND o.station_id = ?`;
            params.push(parseInt(station_id));
        }

        if (dept_id) {
            query += ` AND o.dept_id = ?`;
            params.push(parseInt(dept_id));
        }

        if (status) {
            query += ` AND o.status = ?`;
            params.push(status);
        }

        if (search) {
            query += ` AND (
                o.name LIKE ?
                OR o.badge_number LIKE ?
                OR o.rank LIKE ?
                OR ps.name LIKE ?
                OR d.name LIKE ?
            )`;

            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        query += `
            GROUP BY
                o.officer_id, o.name, o.rank, o.badge_number,
                o.phone, o.email, o.status, o.station_id, o.dept_id,
                ps.name, ps.city, d.name
            ORDER BY o.name ASC
        `;

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (currentPage - 1) * pageLimit;

        query += ` LIMIT ? OFFSET ?`;
        params.push(pageLimit, offset);

        const [rows] = await db.query(query, params);

        let countQuery = `
            SELECT COUNT(DISTINCT o.officer_id) AS total
            FROM officer o
            JOIN police_station ps ON o.station_id = ps.station_id
            LEFT JOIN department d ON o.dept_id = d.dept_id
            WHERE 1=1
        `;

        const countParams = [];

        if (station_id) {
            countQuery += ` AND o.station_id = ?`;
            countParams.push(parseInt(station_id));
        }

        if (dept_id) {
            countQuery += ` AND o.dept_id = ?`;
            countParams.push(parseInt(dept_id));
        }

        if (status) {
            countQuery += ` AND o.status = ?`;
            countParams.push(status);
        }

        if (search) {
            countQuery += ` AND (
                o.name LIKE ?
                OR o.badge_number LIKE ?
                OR o.rank LIKE ?
                OR ps.name LIKE ?
                OR d.name LIKE ?
            )`;

            const s = `%${search}%`;
            countParams.push(s, s, s, s, s);
        }

        const [countRows] = await db.query(countQuery, countParams);

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: countRows[0].total,
                page: currentPage,
                limit: pageLimit
            }
        });
    } catch (err) {
        console.error('Error fetching officers:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve officers.'
        });
    }
});

// GET /api/officers/:id - officer profile, assigned cases and collected evidence
router.get('/:id', async (req, res) => {
    try {
        const officerId = req.params.id;

        const [officerRows] = await db.query(`
            SELECT
                o.*,
                ps.name AS station_name,
                ps.address AS station_address,
                ps.city AS station_city,
                ps.phone AS station_phone,
                d.name AS department_name,
                d.description AS department_description
            FROM officer o
            JOIN police_station ps ON o.station_id = ps.station_id
            LEFT JOIN department d ON o.dept_id = d.dept_id
            WHERE o.officer_id = ?
        `, [officerId]);

        if (officerRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Officer not found.'
            });
        }

        const [assignedCases] = await db.query(`
            SELECT
                co.assignment_role,
                co.assigned_at,
                pc.case_id,
                pc.case_type,
                pc.status,
                pc.registered_date,
                f.fir_number,
                i.severity,
                l.area,
                l.city
            FROM case_officer co
            JOIN police_case pc ON co.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE co.officer_id = ?
            ORDER BY pc.registered_date DESC
        `, [officerId]);

        const [collectedEvidence] = await db.query(`
            SELECT
                e.evidence_id,
                e.case_id,
                e.type,
                e.description,
                e.collected_date,
                e.status,
                pc.case_type,
                f.fir_number,
                el.name AS storage_location
            FROM evidence e
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            LEFT JOIN evidence_location el
                ON e.evidence_loc_id = el.evidence_loc_id
            WHERE e.collected_by = ?
            ORDER BY e.collected_date DESC
        `, [officerId]);

        res.json({
            success: true,
            data: {
                ...officerRows[0],
                assigned_cases: assignedCases,
                collected_evidence: collectedEvidence
            }
        });
    } catch (err) {
        console.error('Error fetching officer details:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve officer details.'
        });
    }
});

// POST /api/officers - register officer
// FIX: Use the existing requireAdmin middleware instead of undefined requireRole.
router.post('/', requireAdmin, async (req, res) => {
    try {
        const {
            name,
            rank,
            badge_number,
            phone,
            email,
            station_id,
            dept_id,
            status = 'Active'
        } = req.body;

        if (!name || !badge_number || !station_id) {
            return res.status(400).json({
                success: false,
                message: 'Name, badge number, and police station are required.'
            });
        }

        const validStatuses = ['Active', 'On Leave', 'Suspended', 'Retired'];
        const officerStatus = validStatuses.includes(status)
            ? status
            : 'Active';

        const [result] = await db.query(`
            INSERT INTO officer
                (name, \`rank\`, badge_number, phone, email,
                 station_id, dept_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            rank || null,
            badge_number,
            phone || null,
            email || null,
            station_id,
            dept_id || null,
            officerStatus
        ]);

        await logAudit(
            req.user.user_id,
            'OFFICER_REGISTER',
            'OFFICER',
            result.insertId,
            `Admin ${req.user.full_name} registered officer ${name} [${badge_number}]`
        );

        res.status(201).json({
            success: true,
            message: 'Police officer registered successfully.',
            officer_id: result.insertId
        });
    } catch (err) {
        console.error('Error registering officer:', err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Badge number or email already registered.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to register officer.'
        });
    }
});

// PUT /api/officers/:id - update officer
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const officerId = req.params.id;

        const {
            name,
            rank,
            badge_number,
            phone,
            email,
            station_id,
            dept_id,
            status
        } = req.body;

        const [result] = await db.query(`
            UPDATE officer
            SET name = COALESCE(?, name),
                \`rank\` = COALESCE(?, \`rank\`),
                badge_number = COALESCE(?, badge_number),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                station_id = COALESCE(?, station_id),
                dept_id = COALESCE(?, dept_id),
                status = COALESCE(?, status)
            WHERE officer_id = ?
        `, [
            name,
            rank,
            badge_number,
            phone,
            email,
            station_id,
            dept_id,
            status,
            officerId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Officer not found.'
            });
        }

        await logAudit(
            req.user.user_id,
            'OFFICER_UPDATE',
            'OFFICER',
            officerId,
            `Admin ${req.user.full_name} updated officer #${officerId}`
        );

        res.json({
            success: true,
            message: 'Officer updated successfully.'
        });
    } catch (err) {
        console.error('Error updating officer:', err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Badge number or email already in use.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update officer.'
        });
    }
});

// DELETE /api/officers/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const officerId = req.params.id;

        const [result] = await db.query(
            'DELETE FROM officer WHERE officer_id = ?',
            [officerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Officer not found.'
            });
        }

        await logAudit(
            req.user.user_id,
            'OFFICER_DELETE',
            'OFFICER',
            officerId,
            `Admin ${req.user.full_name} deleted officer #${officerId}`
        );

        res.json({
            success: true,
            message: 'Officer deleted successfully.'
        });
    } catch (err) {
        console.error('Error deleting officer:', err);

        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete officer because active cases or evidence records reference this officer.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete officer.'
        });
    }
});

module.exports = router;
