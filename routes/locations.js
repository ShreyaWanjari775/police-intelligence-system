const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/locations
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM location ORDER BY city, area');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching locations:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve locations.' });
    }
});

// POST /api/locations
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { address, area, city, latitude, longitude, landmark } = req.body;
        if (!address || !city) {
            return res.status(400).json({ success: false, message: 'Address and city are required.' });
        }

        const [result] = await db.query(`
            INSERT INTO location (address, area, city, latitude, longitude, landmark)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [address, area || null, city, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, landmark || null]);

        res.status(201).json({
            success: true,
            message: 'Location added successfully.',
            location_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating location:', err);
        res.status(500).json({ success: false, message: 'Failed to create location.' });
    }
});

// PUT /api/locations/:id
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const locId = req.params.id;
        const { address, area, city, latitude, longitude, landmark } = req.body;

        const [result] = await db.query(`
            UPDATE location
            SET address = COALESCE(?, address),
                area = COALESCE(?, area),
                city = COALESCE(?, city),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                landmark = COALESCE(?, landmark)
            WHERE location_id = ?
        `, [address, area, city, latitude, longitude, landmark, locId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Location not found.' });
        }

        res.json({ success: true, message: 'Location updated successfully.' });
    } catch (err) {
        console.error('Error updating location:', err);
        res.status(500).json({ success: false, message: 'Failed to update location.' });
    }
});

module.exports = router;
