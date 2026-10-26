const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Block citizen accounts from browsing the full FIR database
router.use(optionalAuth);
router.use((req, res, next) => {
    if (req.user && req.user.role === 'Citizen') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. The police FIR register is restricted to authorized personnel.'
        });
    }
    next();
});

// Helper to auto-generate next FIR number if not provided
async function generateFirNumber(cityCode = 'MUM') {
    const year = new Date().getFullYear();
    const prefix = `FIR/${cityCode}/${year}/`;
    const [rows] = await db.query(
        `SELECT fir_number FROM fir WHERE fir_number LIKE ? ORDER BY fir_id DESC LIMIT 1`,
        [`${prefix}%`]
    );
    let nextNum = 1;
    if (rows.length > 0) {
        const last = rows[0].fir_number;
        const parts = last.split('/');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num)) {
            nextNum = num + 1;
        }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// GET /api/firs - list with search & pagination
router.get('/', async (req, res) => {
    try {
        const { search, incident_id, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                f.*,
                i.type AS incident_type,
                i.severity AS incident_severity,
                i.status AS incident_status,
                i.description AS incident_description,
                l.area,
                l.city,
                pc.case_id,
                pc.case_type,
                pc.status AS case_status
            FROM fir f
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE 1=1
        `;
        const params = [];

        if (incident_id) {
            query += ` AND f.incident_id = ?`;
            params.push(parseInt(incident_id));
        }
        if (search) {
            query += ` AND (f.fir_number LIKE ? OR f.sections LIKE ? OR f.details LIKE ? OR i.type LIKE ? OR l.city LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        query += ` ORDER BY f.registered_date DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM fir f
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE 1=1
        `;
        const countParams = [];
        if (incident_id) {
            countQuery += ` AND f.incident_id = ?`;
            countParams.push(parseInt(incident_id));
        }
        if (search) {
            countQuery += ` AND (f.fir_number LIKE ? OR f.sections LIKE ? OR f.details LIKE ? OR i.type LIKE ? OR l.city LIKE ?)`;
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
        console.error('Error fetching FIRs:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve FIRs.' });
    }
});

// GET /api/firs/:id - details + incident + cases
router.get('/:id', async (req, res) => {
    try {
        const firId = req.params.id;
        const [rows] = await db.query(`
            SELECT
                f.*,
                i.incident_id,
                i.type AS incident_type,
                i.severity AS incident_severity,
                i.status AS incident_status,
                i.description AS incident_description,
                i.reported_at AS incident_reported_at,
                c.complaint_id,
                c.description AS complaint_description,
                ci.citizen_id,
                ci.name AS citizen_name,
                ci.phone AS citizen_phone,
                l.address AS location_address,
                l.area,
                l.city,
                pc.case_id,
                pc.case_type,
                pc.status AS case_status
            FROM fir f
            JOIN incident i ON f.incident_id = i.incident_id
            JOIN complaint c ON i.complaint_id = c.complaint_id
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN police_case pc ON f.fir_id = pc.fir_id
            WHERE f.fir_id = ?
        `, [firId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'FIR not found.' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching FIR details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve FIR details.' });
    }
});

// POST /api/firs - register an FIR
router.post('/', authenticateToken, async (req, res) => {
    try {
        let { incident_id, fir_number, sections, details } = req.body;
        if (!incident_id) {
            return res.status(400).json({ success: false, message: 'Incident ID is required to register an FIR.' });
        }

        // Validate incident exists
        const [incidents] = await db.query(
            `SELECT i.*, l.city FROM incident i LEFT JOIN location l ON i.location_id = l.location_id WHERE i.incident_id = ?`,
            [incident_id]
        );
        if (incidents.length === 0) {
            return res.status(400).json({ success: false, message: 'Specified incident does not exist.' });
        }

        // If fir_number not provided, auto-generate standard format
        if (!fir_number || fir_number.trim() === '') {
            const city = incidents[0].city ? incidents[0].city.substring(0, 3).toUpperCase() : 'MUM';
            fir_number = await generateFirNumber(city);
        }

        const [result] = await db.query(`
            INSERT INTO fir (incident_id, fir_number, sections, details, registered_date)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [incident_id, fir_number, sections || null, details || null]);

        res.status(201).json({
            success: true,
            message: 'FIR registered successfully.',
            fir_id: result.insertId,
            fir_number
        });
    } catch (err) {
        console.error('Error registering FIR:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'An FIR with this FIR Number already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to register FIR.' });
    }
});

// PUT /api/firs/:id - update FIR
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const firId = req.params.id;
        const { fir_number, sections, details } = req.body;

        const [result] = await db.query(`
            UPDATE fir
            SET fir_number = COALESCE(?, fir_number),
                sections = COALESCE(?, sections),
                details = COALESCE(?, details)
            WHERE fir_id = ?
        `, [fir_number, sections, details, firId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'FIR not found.' });
        }

        res.json({ success: true, message: 'FIR updated successfully.' });
    } catch (err) {
        console.error('Error updating FIR:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'FIR Number already in use.' });
        }
        res.status(500).json({ success: false, message: 'Failed to update FIR.' });
    }
});

// DELETE /api/firs/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const firId = req.params.id;
        const [result] = await db.query('DELETE FROM fir WHERE fir_id = ?', [firId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'FIR not found.' });
        }
        res.json({ success: true, message: 'FIR deleted successfully.' });
    } catch (err) {
        console.error('Error deleting FIR:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete FIR because an open police case references it. Delete the linked case first.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to delete FIR.' });
    }
});

module.exports = router;
