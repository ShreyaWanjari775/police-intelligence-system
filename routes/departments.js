const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/departments - list with officer counts
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                d.*,
                COUNT(o.officer_id) AS total_officers
            FROM department d
            LEFT JOIN officer o ON d.dept_id = o.dept_id
            GROUP BY d.dept_id
            ORDER BY d.name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve departments.' });
    }
});

// POST /api/departments
router.post('/', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Department name is required.' });
        }

        const [result] = await db.query(
            'INSERT INTO department (name, description) VALUES (?, ?)',
            [name, description || null]
        );

        res.status(201).json({
            success: true,
            message: 'Department created successfully.',
            dept_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating department:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Department with this name already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create department.' });
    }
});

// PUT /api/departments/:id
router.put('/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const deptId = req.params.id;
        const { name, description } = req.body;

        const [result] = await db.query(
            'UPDATE department SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE dept_id = ?',
            [name, description, deptId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }

        res.json({ success: true, message: 'Department updated successfully.' });
    } catch (err) {
        console.error('Error updating department:', err);
        res.status(500).json({ success: false, message: 'Failed to update department.' });
    }
});

// DELETE /api/departments/:id
router.delete('/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
    try {
        const deptId = req.params.id;

        const [officers] = await db.query('SELECT officer_id FROM officer WHERE dept_id = ? LIMIT 1', [deptId]);
        if (officers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete department because officers belong to it. Reassign officers first.'
            });
        }

        const [result] = await db.query('DELETE FROM department WHERE dept_id = ?', [deptId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }

        res.json({ success: true, message: 'Department deleted successfully.' });
    } catch (err) {
        console.error('Error deleting department:', err);
        res.status(500).json({ success: false, message: 'Failed to delete department.' });
    }
});

module.exports = router;
