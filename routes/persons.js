const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/persons - list persons with role flags (Victim, Suspect, Witness)
router.get('/', async (req, res) => {
    try {
        const { search, role, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT
                p.*,
                v.victim_id,
                v.age AS victim_age,
                s.suspect_id,
                s.alias AS suspect_alias,
                s.criminal_history,
                w.witness_id,
                w.statement AS witness_statement,
                COUNT(DISTINCT cp.case_id) AS case_count
            FROM person p
            LEFT JOIN victim v ON p.person_id = v.person_id
            LEFT JOIN suspect s ON p.person_id = s.person_id
            LEFT JOIN witness w ON p.person_id = w.person_id
            LEFT JOIN case_person cp ON p.person_id = cp.person_id
            WHERE 1=1
        `;
        const params = [];

        if (role === 'victim') {
            query += ` AND v.victim_id IS NOT NULL`;
        } else if (role === 'suspect') {
            query += ` AND s.suspect_id IS NOT NULL`;
        } else if (role === 'witness') {
            query += ` AND w.witness_id IS NOT NULL`;
        }

        if (search) {
            query += ` AND (p.name LIKE ? OR p.phone LIKE ? OR p.address LIKE ? OR s.alias LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` GROUP BY p.person_id ORDER BY p.person_id DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [rows] = await db.query(query, params);

        // Sanitize sensitive fields if user is not authorized or logged in
        // If user is not logged in or role is 'Read-only Reviewer', mask criminal_history and witness_statement
        const isPrivileged = req.user && ['Administrator', 'Officer', 'Investigator'].includes(req.user.role);
        const sanitized = rows.map(r => {
            const copy = { ...r };
            if (!isPrivileged) {
                if (copy.criminal_history) copy.criminal_history = '[Confidential - Restricted Access]';
                if (copy.witness_statement) copy.witness_statement = '[Confidential - Restricted Access]';
            }
            return copy;
        });

        // Total count
        let countQuery = `
            SELECT COUNT(DISTINCT p.person_id) AS total
            FROM person p
            LEFT JOIN victim v ON p.person_id = v.person_id
            LEFT JOIN suspect s ON p.person_id = s.person_id
            LEFT JOIN witness w ON p.person_id = w.person_id
            WHERE 1=1
        `;
        const countParams = [];
        if (role === 'victim') countQuery += ` AND v.victim_id IS NOT NULL`;
        else if (role === 'suspect') countQuery += ` AND s.suspect_id IS NOT NULL`;
        else if (role === 'witness') countQuery += ` AND w.witness_id IS NOT NULL`;
        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.phone LIKE ? OR p.address LIKE ? OR s.alias LIKE ?)`;
            const s = `%${search}%`;
            countParams.push(s, s, s, s);
        }
        const [countRows] = await db.query(countQuery, countParams);

        res.json({
            success: true,
            data: sanitized,
            pagination: {
                total: countRows[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Error fetching persons:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve persons.' });
    }
});

// GET /api/persons/:id - details + associated cases
router.get('/:id', async (req, res) => {
    try {
        const personId = req.params.id;

        const [personRows] = await db.query(`
            SELECT
                p.*,
                v.victim_id,
                v.age AS victim_age,
                s.suspect_id,
                s.alias AS suspect_alias,
                s.criminal_history,
                w.witness_id,
                w.statement AS witness_statement
            FROM person p
            LEFT JOIN victim v ON p.person_id = v.person_id
            LEFT JOIN suspect s ON p.person_id = s.person_id
            LEFT JOIN witness w ON p.person_id = w.person_id
            WHERE p.person_id = ?
        `, [personId]);

        if (personRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Person not found.' });
        }

        const person = personRows[0];
        const isPrivileged = req.user && ['Administrator', 'Officer', 'Investigator'].includes(req.user.role);
        if (!isPrivileged) {
            if (person.criminal_history) person.criminal_history = '[Confidential - Restricted Access]';
            if (person.witness_statement) person.witness_statement = '[Confidential - Restricted Access]';
        }

        // Associated cases via case_person
        const [cases] = await db.query(`
            SELECT
                cp.association_type,
                cp.notes,
                pc.case_id,
                pc.case_type,
                pc.status,
                pc.registered_date,
                f.fir_number,
                i.severity,
                l.area,
                l.city
            FROM case_person cp
            JOIN police_case pc ON cp.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            WHERE cp.person_id = ?
            ORDER BY pc.registered_date DESC
        `, [personId]);

        res.json({
            success: true,
            data: {
                ...person,
                cases
            }
        });
    } catch (err) {
        console.error('Error fetching person details:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve person details.' });
    }
});

// POST /api/persons - register person with optional specialization (victim, suspect, witness)
router.post('/', authenticateToken, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            name, phone, address, date_of_birth, gender, photo,
            is_victim, victim_age,
            is_suspect, alias, suspect_age, criminal_history,
            is_witness, witness_age, statement,
            case_id, association_notes
        } = req.body;

        if (!name) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Person name is required.' });
        }

        // 1. Insert into person
        const [pResult] = await conn.query(`
            INSERT INTO person (name, phone, address, date_of_birth, gender, photo)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, phone || null, address || null, date_of_birth || null, gender || null, photo || null]);

        const personId = pResult.insertId;

        // 2. Specialized records
        if (is_victim) {
            await conn.query(`
                INSERT INTO victim (person_id, name, phone, address, age, gender)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [personId, name, phone || null, address || null, victim_age || null, gender || null]);
        }

        if (is_suspect) {
            await conn.query(`
                INSERT INTO suspect (person_id, name, alias, phone, address, age, gender, criminal_history)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [personId, name, alias || null, phone || null, address || null, suspect_age || null, gender || null, criminal_history || null]);
        }

        if (is_witness) {
            await conn.query(`
                INSERT INTO witness (person_id, name, phone, address, age, gender, statement)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [personId, name, phone || null, address || null, witness_age || null, gender || null, statement || null]);
        }

        // 3. Link to case if requested
        if (case_id) {
            let primaryRole = 'Other';
            if (is_victim) primaryRole = 'Victim';
            else if (is_suspect) primaryRole = 'Suspect';
            else if (is_witness) primaryRole = 'Witness';

            await conn.query(`
                INSERT INTO case_person (case_id, person_id, association_type, notes)
                VALUES (?, ?, ?, ?)
            `, [case_id, personId, primaryRole, association_notes || null]);
        }

        await conn.commit();

        res.status(201).json({
            success: true,
            message: 'Person record created successfully.',
            person_id: personId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error creating person:', err);
        res.status(500).json({ success: false, message: 'Failed to create person record.' });
    } finally {
        conn.release();
    }
});

// PUT /api/persons/:id - update person and specializations
router.put('/:id', authenticateToken, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const personId = req.params.id;
        const {
            name, phone, address, date_of_birth, gender,
            is_victim, victim_age,
            is_suspect, alias, suspect_age, criminal_history,
            is_witness, witness_age, statement
        } = req.body;

        // 1. Update person
        const [pResult] = await conn.query(`
            UPDATE person
            SET name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                address = COALESCE(?, address),
                date_of_birth = COALESCE(?, date_of_birth),
                gender = COALESCE(?, gender)
            WHERE person_id = ?
        `, [name, phone, address, date_of_birth, gender, personId]);

        if (pResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Person not found.' });
        }

        // Handle victim
        if (is_victim) {
            const [vRows] = await conn.query('SELECT victim_id FROM victim WHERE person_id = ?', [personId]);
            if (vRows.length > 0) {
                await conn.query(
                    'UPDATE victim SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), age = COALESCE(?, age), gender = COALESCE(?, gender) WHERE person_id = ?',
                    [name, phone, address, victim_age, gender, personId]
                );
            } else {
                await conn.query(
                    'INSERT INTO victim (person_id, name, phone, address, age, gender) VALUES (?, ?, ?, ?, ?, ?)',
                    [personId, name, phone || null, address || null, victim_age || null, gender || null]
                );
            }
        }

        // Handle suspect
        if (is_suspect) {
            const [sRows] = await conn.query('SELECT suspect_id FROM suspect WHERE person_id = ?', [personId]);
            if (sRows.length > 0) {
                await conn.query(
                    'UPDATE suspect SET name = COALESCE(?, name), alias = COALESCE(?, alias), phone = COALESCE(?, phone), address = COALESCE(?, address), age = COALESCE(?, age), gender = COALESCE(?, gender), criminal_history = COALESCE(?, criminal_history) WHERE person_id = ?',
                    [name, alias, phone, address, suspect_age, gender, criminal_history, personId]
                );
            } else {
                await conn.query(
                    'INSERT INTO suspect (person_id, name, alias, phone, address, age, gender, criminal_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [personId, name, alias || null, phone || null, address || null, suspect_age || null, gender || null, criminal_history || null]
                );
            }
        }

        // Handle witness
        if (is_witness) {
            const [wRows] = await conn.query('SELECT witness_id FROM witness WHERE person_id = ?', [personId]);
            if (wRows.length > 0) {
                await conn.query(
                    'UPDATE witness SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), age = COALESCE(?, age), gender = COALESCE(?, gender), statement = COALESCE(?, statement) WHERE person_id = ?',
                    [name, phone, address, witness_age, gender, statement, personId]
                );
            } else {
                await conn.query(
                    'INSERT INTO witness (person_id, name, phone, address, age, gender, statement) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [personId, name, phone || null, address || null, witness_age || null, gender || null, statement || null]
                );
            }
        }

        await conn.commit();
        res.json({ success: true, message: 'Person updated successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('Error updating person:', err);
        res.status(500).json({ success: false, message: 'Failed to update person.' });
    } finally {
        conn.release();
    }
});

// DELETE /api/persons/:id
router.delete('/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const personId = req.params.id;

        // Check if person has case associations
        const [casePersons] = await conn.query('SELECT case_id FROM case_person WHERE person_id = ? LIMIT 1', [personId]);
        if (casePersons.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: 'Cannot delete person because they are linked to an active police case. Remove case association first.'
            });
        }

        // Delete specialized records first
        await conn.query('DELETE FROM victim WHERE person_id = ?', [personId]);
        await conn.query('DELETE FROM suspect WHERE person_id = ?', [personId]);
        await conn.query('DELETE FROM witness WHERE person_id = ?', [personId]);

        const [result] = await conn.query('DELETE FROM person WHERE person_id = ?', [personId]);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Person not found.' });
        }

        await conn.commit();
        res.json({ success: true, message: 'Person deleted successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('Error deleting person:', err);
        res.status(500).json({ success: false, message: 'Failed to delete person.' });
    } finally {
        conn.release();
    }
});

module.exports = router;
