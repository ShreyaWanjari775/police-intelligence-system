const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

// GET /api/search?q=keyword
router.get('/', optionalAuth, async (req, res) => {
    try {
        if (req.user && req.user.role === 'Citizen') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Database-wide search is restricted to police department personnel.'
            });
        }

        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Search term must be at least 2 characters.' });
        }

        const searchTerm = `%${q.trim()}%`;

        // 1. Search Cases (Backend.sql lines 646-660)
        const [cases] = await db.query(`
            SELECT pc.case_id, pc.case_type, pc.status, f.fir_number, i.severity, i.description
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            WHERE pc.case_type LIKE ? OR f.fir_number LIKE ? OR pc.status LIKE ? OR i.description LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

        // 2. Search FIRs
        const [firs] = await db.query(`
            SELECT fir_id, fir_number, sections, details, registered_date
            FROM fir
            WHERE fir_number LIKE ? OR sections LIKE ? OR details LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm]);

        // 3. Search Incidents
        const [incidents] = await db.query(`
            SELECT incident_id, type, severity, status, description, reported_at
            FROM incident
            WHERE type LIKE ? OR description LIKE ? OR severity LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm]);

        // 4. Search Complaints
        const [complaints] = await db.query(`
            SELECT c.complaint_id, c.type, c.description, c.status, ci.name AS citizen_name
            FROM complaint c
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            WHERE c.type LIKE ? OR c.description LIKE ? OR ci.name LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm]);

        // 5. Search Citizens
        const [citizens] = await db.query(`
            SELECT citizen_id, name, phone, email, address
            FROM citizen
            WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm]);

        // 6. Search Officers
        const [officers] = await db.query(`
            SELECT officer_id, name, \`rank\`, badge_number, phone, status
            FROM officer
            WHERE name LIKE ? OR badge_number LIKE ? OR \`rank\` LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm, searchTerm]);

        // 7. Search Evidence
        const [evidence] = await db.query(`
            SELECT evidence_id, case_id, type, description, status
            FROM evidence
            WHERE type LIKE ? OR description LIKE ?
            LIMIT 5;
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            query: q,
            results: {
                cases,
                firs,
                incidents,
                complaints,
                citizens,
                officers,
                evidence
            }
        });
    } catch (err) {
        console.error('Error during global search:', err);
        res.status(500).json({ success: false, message: 'Failed to perform search.' });
    }
});

module.exports = router;
