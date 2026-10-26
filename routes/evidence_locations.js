const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/evidence-locations - list with count of stored items
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                el.*,
                COUNT(e.evidence_id) AS stored_items_count
            FROM evidence_location el
            LEFT JOIN evidence e ON el.evidence_loc_id = e.evidence_loc_id
            GROUP BY el.evidence_loc_id
            ORDER BY el.name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching evidence locations:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve storage locations.' });
    }
});

// GET /api/evidence-locations/:id - details + items stored
router.get('/:id', async (req, res) => {
    try {
        const locId = req.params.id;
        const [locRows] = await db.query('SELECT * FROM evidence_location WHERE evidence_loc_id = ?', [locId]);
        if (locRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Storage location not found.' });
        }

        const [items] = await db.query(`
            SELECT
                e.evidence_id, e.type, e.description, e.collected_date, e.status,
                pc.case_id, pc.case_type, f.fir_number, o.name AS collected_by_officer
            FROM evidence e
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN officer o ON e.collected_by = o.officer_id
            WHERE e.evidence_loc_id = ?
            ORDER BY e.collected_date DESC
        `, [locId]);

        res.json({
            success: true,
            data: {
                ...locRows[0],
                stored_evidence: items
            }
        });
    } catch (err) {
        console.error('Error fetching evidence location details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve storage location details.' });
    }
});

// POST /api/evidence-locations
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, address, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Storage location name is required.' });
        }

        const [result] = await db.query(`
            INSERT INTO evidence_location (name, address, description)
            VALUES (?, ?, ?)
        `, [name, address || null, description || null]);

        res.status(201).json({
            success: true,
            message: 'Evidence storage location created successfully.',
            evidence_loc_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating evidence location:', err);
        res.status(500).json({ success: false, message: 'Failed to create storage location.' });
    }
});

// PUT /api/evidence-locations/:id
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const locId = req.params.id;
        const { name, address, description } = req.body;

        const [result] = await db.query(`
            UPDATE evidence_location
            SET name = COALESCE(?, name),
                address = COALESCE(?, address),
                description = COALESCE(?, description)
            WHERE evidence_loc_id = ?
        `, [name, address, description, locId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Storage location not found.' });
        }

        res.json({ success: true, message: 'Storage location updated successfully.' });
    } catch (err) {
        console.error('Error updating storage location:', err);
        res.status(500).json({ success: false, message: 'Failed to update storage location.' });
    }
});

// DELETE /api/evidence-locations/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const locId = req.params.id;

        // Check for referenced evidence
        const [items] = await db.query('SELECT evidence_id FROM evidence WHERE evidence_loc_id = ? LIMIT 1', [locId]);
        if (items.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete storage location because evidence items are currently stored here. Relocate items first.'
            });
        }

        const [result] = await db.query('DELETE FROM evidence_location WHERE evidence_loc_id = ?', [locId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Storage location not found.' });
        }

        res.json({ success: true, message: 'Storage location deleted successfully.' });
    } catch (err) {
        console.error('Error deleting storage location:', err);
        res.status(500).json({ success: false, message: 'Failed to delete storage location.' });
    }
});

module.exports = router;
