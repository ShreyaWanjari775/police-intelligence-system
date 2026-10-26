const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/police-stations - list with assigned officer counts
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                ps.*,
                COUNT(o.officer_id) AS total_officers,
                SUM(CASE WHEN o.status = 'Active' THEN 1 ELSE 0 END) AS active_officers
            FROM police_station ps
            LEFT JOIN officer o ON ps.station_id = o.station_id
            GROUP BY ps.station_id
            ORDER BY ps.city, ps.name
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching police stations:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve police stations.' });
    }
});

// GET /api/police-stations/:id - details + assigned officers
router.get('/:id', async (req, res) => {
    try {
        const stationId = req.params.id;
        const [stationRows] = await db.query('SELECT * FROM police_station WHERE station_id = ?', [stationId]);
        if (stationRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Police station not found.' });
        }

        const [officers] = await db.query(`
            SELECT o.*, d.name AS department_name
            FROM officer o
            LEFT JOIN department d ON o.dept_id = d.dept_id
            WHERE o.station_id = ?
            ORDER BY o.name
        `, [stationId]);

        res.json({
            success: true,
            data: {
                ...stationRows[0],
                officers
            }
        });
    } catch (err) {
        console.error('Error fetching police station details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve police station details.' });
    }
});

// POST /api/police-stations
router.post('/', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const { name, address, area, city, phone, jurisdiction } = req.body;
        if (!name || !city) {
            return res.status(400).json({ success: false, message: 'Station name and city are required.' });
        }

        const [result] = await db.query(`
            INSERT INTO police_station (name, address, area, city, phone, jurisdiction)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, address || null, area || null, city, phone || null, jurisdiction || null]);

        res.status(201).json({
            success: true,
            message: 'Police station created successfully.',
            station_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating police station:', err);
        res.status(500).json({ success: false, message: 'Failed to create police station.' });
    }
});

// PUT /api/police-stations/:id
router.put('/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const stationId = req.params.id;
        const { name, address, area, city, phone, jurisdiction } = req.body;

        const [result] = await db.query(`
            UPDATE police_station
            SET name = COALESCE(?, name),
                address = COALESCE(?, address),
                area = COALESCE(?, area),
                city = COALESCE(?, city),
                phone = COALESCE(?, phone),
                jurisdiction = COALESCE(?, jurisdiction)
            WHERE station_id = ?
        `, [name, address, area, city, phone, jurisdiction, stationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Police station not found.' });
        }

        res.json({ success: true, message: 'Police station updated successfully.' });
    } catch (err) {
        console.error('Error updating police station:', err);
        res.status(500).json({ success: false, message: 'Failed to update police station.' });
    }
});

// DELETE /api/police-stations/:id
router.delete('/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const stationId = req.params.id;

        const [officers] = await db.query('SELECT officer_id FROM officer WHERE station_id = ? LIMIT 1', [stationId]);
        if (officers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete police station with assigned officers. Reassign officers first.'
            });
        }

        const [result] = await db.query('DELETE FROM police_station WHERE station_id = ?', [stationId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Police station not found.' });
        }

        res.json({ success: true, message: 'Police station deleted successfully.' });
    } catch (err) {
        console.error('Error deleting police station:', err);
        res.status(500).json({ success: false, message: 'Failed to delete police station.' });
    }
});

module.exports = router;
