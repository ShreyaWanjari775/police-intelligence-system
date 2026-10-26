const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_police_intel_jwt_key_2026_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// POST /api/auth/login (Unified login for Police personnel and Citizens)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
        }

        const [rows] = await db.query(
            `SELECT u.*,
                    o.name AS officer_name, o.rank AS officer_rank, o.badge_number, ps.name AS station_name,
                    c.name AS citizen_name, c.phone AS citizen_phone, c.address AS citizen_address
             FROM system_user u
             LEFT JOIN officer o ON u.officer_id = o.officer_id
             LEFT JOIN police_station ps ON o.station_id = ps.station_id
             LEFT JOIN citizen c ON u.citizen_id = c.citizen_id
             WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1`,
            [username.trim(), username.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const payload = {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name || user.officer_name || user.citizen_name,
            email: user.email,
            role: user.role,
            officer_id: user.officer_id,
            citizen_id: user.citizen_id,
            badge_number: user.badge_number,
            officer_rank: user.officer_rank,
            station_name: user.station_name,
            citizen_phone: user.citizen_phone,
            citizen_address: user.citizen_address
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Record audit log
        logAudit(user.user_id, 'USER_LOGIN', 'USER', user.user_id, `User logged in with role ${user.role}`);

        res.json({
            success: true,
            message: 'Authentication successful.',
            token,
            user: payload
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
    }
});

// POST /api/auth/register-citizen (Self-registration for Citizens / Victims)
router.post('/register-citizen', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { name, phone, email, password, address, date_of_birth, gender } = req.body;
        if (!name || !email || !password) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Full name, email address, and password are required.' });
        }

        if (password.length < 6) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const username = cleanEmail;

        // Check for existing user or citizen
        const [existingUsers] = await conn.query('SELECT user_id FROM system_user WHERE username = ? OR email = ?', [username, cleanEmail]);
        if (existingUsers.length > 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'An account with this email address already exists. Please log in.' });
        }

        // 1. Insert or reuse citizen record
        let citizenId = null;
        const [existingCitizen] = await conn.query('SELECT citizen_id FROM citizen WHERE email = ?', [cleanEmail]);
        if (existingCitizen.length > 0) {
            citizenId = existingCitizen[0].citizen_id;
            await conn.query(
                'UPDATE citizen SET name = ?, phone = COALESCE(?, phone), address = COALESCE(?, address), date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender) WHERE citizen_id = ?',
                [name.trim(), phone || null, address || null, date_of_birth || null, gender || null, citizenId]
            );
        } else {
            const [citResult] = await conn.query(
                'INSERT INTO citizen (name, phone, email, address, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?)',
                [name.trim(), phone || null, cleanEmail, address || null, date_of_birth || null, gender || null]
            );
            citizenId = citResult.insertId;
        }

        // 2. Hash password securely
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Insert system_user record
        const [userResult] = await conn.query(
            `INSERT INTO system_user (username, password_hash, full_name, email, role, citizen_id, is_active)
             VALUES (?, ?, ?, ?, 'Citizen', ?, 1)`,
            [username, passwordHash, name.trim(), cleanEmail, citizenId]
        );

        const newUserId = userResult.insertId;

        await conn.commit();

        // Generate JWT
        const payload = {
            user_id: newUserId,
            username,
            full_name: name.trim(),
            email: cleanEmail,
            role: 'Citizen',
            officer_id: null,
            citizen_id: citizenId,
            citizen_phone: phone || null,
            citizen_address: address || null
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Audit log
        logAudit(newUserId, 'CITIZEN_REGISTER', 'CITIZEN', citizenId, `Citizen self-registration completed for ${name.trim()}`);

        res.status(201).json({
            success: true,
            message: 'Citizen registration successful. Welcome to the Citizen Portal.',
            token,
            user: payload
        });
    } catch (err) {
        await conn.rollback();
        console.error('Citizen registration error:', err);
        res.status(500).json({ success: false, message: 'Failed to complete citizen registration.' });
    } finally {
        conn.release();
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.officer_id, u.citizen_id, u.created_at,
                    o.name AS officer_name, o.rank AS officer_rank, o.badge_number, ps.name AS station_name,
                    c.name AS citizen_name, c.phone AS citizen_phone, c.address AS citizen_address, c.date_of_birth, c.gender
             FROM system_user u
             LEFT JOIN officer o ON u.officer_id = o.officer_id
             LEFT JOIN police_station ps ON o.station_id = ps.station_id
             LEFT JOIN citizen c ON u.citizen_id = c.citizen_id
             WHERE u.user_id = ?`,
            [req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, user: rows[0] });
    } catch (err) {
        console.error('Error fetching current user:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve user profile.' });
    }
});

// GET /api/auth/users (Administrator only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.officer_id, u.citizen_id, u.is_active, u.created_at,
                    o.name AS officer_name, o.badge_number,
                    c.name AS linked_citizen_name
             FROM system_user u
             LEFT JOIN officer o ON u.officer_id = o.officer_id
             LEFT JOIN citizen c ON u.citizen_id = c.citizen_id
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('Error listing users:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve system users.' });
    }
});

// POST /api/auth/users (Administrator only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, full_name, email, role, officer_id, citizen_id } = req.body;
        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ success: false, message: 'Username, password, full name, and role are required.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            `INSERT INTO system_user (username, password_hash, full_name, email, role, officer_id, citizen_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [username, password_hash, full_name, email || null, role, officer_id || null, citizen_id || null]
        );

        logAudit(req.user.user_id, 'USER_CREATE', 'USER', result.insertId, `Admin created user ${username} with role ${role}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            user_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating user:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'A user with this username or email already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
});

module.exports = router;
