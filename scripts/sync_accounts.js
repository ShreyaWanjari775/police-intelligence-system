const pool = require('../db');
const bcrypt = require('bcryptjs');

async function syncAccounts() {
    console.log('Synchronizing user accounts for Police Intelligence System...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const officerHash = await bcrypt.hash('officer123', 10);
    const investigatorHash = await bcrypt.hash('investigator123', 10);
    const reviewerHash = await bcrypt.hash('reviewer123', 10);
    const citizenHash = await bcrypt.hash('citizen123', 10);

    const users = [
        { username: 'admin', hash: adminHash, name: 'System Administrator', email: 'admin@policeintel.gov.in', role: 'Administrator', officer_id: null, citizen_id: null },
        { username: 'officer1', hash: officerHash, name: 'Inspector Rajesh Kumar', email: 'rajesh.kumar@mahapolice.gov.in', role: 'Officer', officer_id: 1, citizen_id: null },
        { username: 'investigator1', hash: investigatorHash, name: 'Sr. Inspector Neha Singh', email: 'neha.singh@mahapolice.gov.in', role: 'Investigator', officer_id: 2, citizen_id: null },
        { username: 'reviewer1', hash: reviewerHash, name: 'Civil Reviewer Priya Kulkarni', email: 'reviewer@mumbaipolice.gov.in', role: 'Read-only Reviewer', officer_id: null, citizen_id: null },
        { username: 'citizen1', hash: citizenHash, name: 'Demo Citizen One', email: 'citizen1@example.com', role: 'Citizen', officer_id: null, citizen_id: 2 },
        { username: 'aarav', hash: citizenHash, name: 'Aarav Sharma', email: 'aarav@example.com', role: 'Citizen', officer_id: null, citizen_id: 1 }
    ];

    for (const u of users) {
        let existing = [];
        if (u.citizen_id) {
            [existing] = await pool.query('SELECT user_id FROM system_user WHERE username = ? OR email = ? OR citizen_id = ?', [u.username, u.email, u.citizen_id]);
        } else {
            [existing] = await pool.query('SELECT user_id FROM system_user WHERE username = ? OR email = ?', [u.username, u.email]);
        }

        if (existing.length > 0) {
            await pool.query(
                'UPDATE system_user SET username = ?, password_hash = ?, full_name = ?, email = ?, role = ?, officer_id = ?, citizen_id = ?, is_active = 1 WHERE user_id = ?',
                [u.username, u.hash, u.name, u.email, u.role, u.officer_id, u.citizen_id, existing[0].user_id]
            );
            console.log(`Updated user: ${u.username} (${u.role})`);
        } else {
            await pool.query(
                'INSERT INTO system_user (username, password_hash, full_name, email, role, officer_id, citizen_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                [u.username, u.hash, u.name, u.email, u.role, u.officer_id, u.citizen_id]
            );
            console.log(`Created user: ${u.username} (${u.role})`);
        }
    }

    // Also update existing demo users if present
    await pool.query('UPDATE system_user SET password_hash = ? WHERE username = ?', [adminHash, 'admin@police.demo']);
    await pool.query('UPDATE system_user SET password_hash = ? WHERE username = ?', [citizenHash, 'citizen@demo.com']);
    await pool.query('UPDATE system_user SET password_hash = ? WHERE username = ?', [citizenHash, 'citizen2@demo.com']);

    console.log('Account synchronization complete!');
    await pool.end();
}

syncAccounts().catch(err => {
    console.error('Error syncing accounts:', err);
    process.exit(1);
});
