const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePolice, requireOfficer, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

// GET /api/citizens - list with search & pagination (Police Personnel Only)
router.get('/', authenticateToken, requirePolice, async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        let query = `
            SELECT c.*, COUNT(comp.complaint_id) AS complaint_count
            FROM citizen c
            LEFT JOIN complaint comp ON c.citizen_id = comp.citizen_id
        `;
        const params = [];

        if (search) {
            query += ` WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` GROUP BY c.citizen_id ORDER BY c.citizen_id DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Count total
        let countQuery = `SELECT COUNT(*) AS total FROM citizen c`;
        const countParams = [];
        if (search) {
            countQuery += ` WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?`;
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
        console.error('Error fetching citizens:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve citizens.' });
    }
});

// GET /api/citizens/:id - details + complaints
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const citizenId = parseInt(req.params.id);

        // RBAC: If citizen, can only view their own profile
        if (req.user.role === 'Citizen' && req.user.citizen_id !== citizenId) {
            return res.status(403).json({ success: false, message: 'Access denied. You cannot view other citizen profiles.' });
        }

        const [citizenRows] = await db.query(`SELECT * FROM citizen WHERE citizen_id = ?`, [citizenId]);
        if (citizenRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Citizen not found.' });
        }

        const [complaints] = await db.query(`
            SELECT c.*, l.area, l.city, i.incident_id, i.severity AS incident_severity
            FROM complaint c
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            WHERE c.citizen_id = ?
            ORDER BY c.complaint_date DESC
        `, [citizenId]);

        res.json({
            success: true,
            data: {
                ...citizenRows[0],
                complaints
            }
        });
    } catch (err) {
        console.error('Error fetching citizen details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve citizen details.' });
    }
});

// POST /api/citizens - register citizen (Police / Admin desk registration)
router.post('/', authenticateToken, requireOfficer, async (req, res) => {
    try {
        const { name, phone, email, address, date_of_birth, gender } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Citizen name is required.' });
        }

        const [result] = await db.query(`
            INSERT INTO citizen (name, phone, email, address, date_of_birth, gender)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, phone || null, email || null, address || null, date_of_birth || null, gender || null]);

        logAudit(req.user.user_id, 'CITIZEN_CREATE', 'CITIZEN', result.insertId, `Officer ${req.user.full_name} registered citizen record #${result.insertId} (${name})`);

        res.status(201).json({
            success: true,
            message: 'Citizen registered successfully.',
            citizen_id: result.insertId
        });
    } catch (err) {
        console.error('Error registering citizen:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'A citizen with this email address already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to register citizen.' });
    }
});

// PUT /api/citizens/:id - update citizen
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const citizenId = parseInt(req.params.id);

        // RBAC: Citizen can update only their own profile
        if (req.user.role === 'Citizen' && req.user.citizen_id !== citizenId) {
            return res.status(403).json({ success: false, message: 'Access denied. You cannot modify other citizen records.' });
        }

        const { name, phone, email, address, date_of_birth, gender } = req.body;

        const [result] = await db.query(`
            UPDATE citizen
            SET name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                address = COALESCE(?, address),
                date_of_birth = COALESCE(?, date_of_birth),
                gender = COALESCE(?, gender)
            WHERE citizen_id = ?
        `, [name, phone, email, address, date_of_birth, gender, citizenId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Citizen not found.' });
        }

        logAudit(req.user.user_id, 'CITIZEN_UPDATE', 'CITIZEN', citizenId, `Citizen record #${citizenId} updated by ${req.user.full_name}`);

        res.json({ success: true, message: 'Citizen updated successfully.' });
    } catch (err) {
        console.error('Error updating citizen:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email address already in use.' });
        }
        res.status(500).json({ success: false, message: 'Failed to update citizen.' });
    }
});

// DELETE /api/citizens/:id - delete citizen (Administrator only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const citizenId = parseInt(req.params.id);

        // Check for complaints
        const [complaints] = await db.query('SELECT complaint_id FROM complaint WHERE citizen_id = ? LIMIT 1', [citizenId]);
        if (complaints.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete citizen with existing complaints on file. Delete or reassign complaints first to maintain integrity.'
            });
        }

        const [result] = await db.query('DELETE FROM citizen WHERE citizen_id = ?', [citizenId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Citizen not found.' });
        }

        logAudit(req.user.user_id, 'CITIZEN_DELETE', 'CITIZEN', citizenId, `Admin ${req.user.full_name} deleted citizen #${citizenId}`);

        res.json({ success: true, message: 'Citizen deleted successfully.' });
    } catch (err) {
        console.error('Error deleting citizen:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete citizen because other records reference this citizen.'
            });
        }
        res.status(500).json({ success: false, message: 'Failed to delete citizen.' });
    }
});

module.exports = router;
