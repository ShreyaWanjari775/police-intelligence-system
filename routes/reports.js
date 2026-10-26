const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Block citizen accounts from accessing internal intelligence reports
router.use(optionalAuth);
router.use((req, res, next) => {
    if (req.user && req.user.role === 'Citizen') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Internal departmental analytics and reports are restricted to police personnel.'
        });
    }
    next();
});

// Helper to format rows as CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => {
        return headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
    });
    return [headerRow, ...rows].join('\r\n');
}

// 1. Complaints by status (Backend.sql lines 661-664)
router.get('/complaints-by-status', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT status, COUNT(*) AS total
            FROM complaint
            GROUP BY status
            ORDER BY total DESC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in complaints by status report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 2. Incidents by severity (Backend.sql lines 666-669)
router.get('/incidents-by-severity', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT severity, COUNT(*) AS total
            FROM incident
            GROUP BY severity
            ORDER BY FIELD(severity, 'Critical', 'High', 'Medium', 'Low');
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in incidents by severity report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 3. Cases by status (Backend.sql lines 671-674)
router.get('/cases-by-status', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT status, COUNT(*) AS total
            FROM police_case
            GROUP BY status
            ORDER BY total DESC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in cases by status report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 4. Complaints without incidents (Backend.sql lines 676-680)
router.get('/complaints-without-incidents', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                c.complaint_id,
                ci.name AS citizen_name,
                ci.phone AS citizen_phone,
                c.type,
                c.description,
                c.complaint_date,
                c.status,
                l.area,
                l.city
            FROM complaint c
            JOIN citizen ci ON c.citizen_id = ci.citizen_id
            LEFT JOIN location l ON c.location_id = l.location_id
            LEFT JOIN incident i ON c.complaint_id = i.complaint_id
            WHERE i.incident_id IS NULL
            ORDER BY c.complaint_date DESC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in complaints without incidents report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 5. Cases without assigned officers (Backend.sql lines 682-686)
router.get('/cases-without-officers', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                pc.case_id,
                pc.case_type,
                pc.status,
                pc.registered_date,
                f.fir_number,
                i.severity,
                l.area,
                l.city
            FROM police_case pc
            JOIN fir f ON pc.fir_id = f.fir_id
            JOIN incident i ON f.incident_id = i.incident_id
            LEFT JOIN location l ON i.location_id = l.location_id
            LEFT JOIN case_officer co ON pc.case_id = co.case_id
            WHERE co.case_id IS NULL
            ORDER BY pc.registered_date DESC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in cases without officers report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 6. Evidence awaiting examination (Backend.sql lines 688-692)
router.get('/evidence-awaiting-examination', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                e.evidence_id,
                e.case_id,
                e.type,
                e.description,
                e.collected_date,
                e.status,
                o.name AS collected_by,
                el.name AS storage_location,
                pc.case_type,
                f.fir_number
            FROM evidence e
            JOIN officer o ON e.collected_by = o.officer_id
            LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
            JOIN police_case pc ON e.case_id = pc.case_id
            JOIN fir f ON pc.fir_id = f.fir_id
            WHERE e.status = 'Under Examination'
            ORDER BY e.collected_date ASC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in evidence awaiting examination report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 7. Officer and station workload
router.get('/officer-workload', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                o.officer_id,
                o.name AS officer_name,
                o.rank,
                o.badge_number,
                o.status AS officer_status,
                ps.name AS station_name,
                ps.city,
                d.name AS department_name,
                COUNT(DISTINCT co.case_id) AS active_cases_assigned,
                COUNT(DISTINCT e.evidence_id) AS evidence_collected
            FROM officer o
            JOIN police_station ps ON o.station_id = ps.station_id
            LEFT JOIN department d ON o.dept_id = d.dept_id
            LEFT JOIN case_officer co ON o.officer_id = co.officer_id
            LEFT JOIN evidence e ON o.officer_id = e.collected_by
            GROUP BY o.officer_id, o.name, o.rank, o.badge_number, o.status, ps.name, ps.city, d.name
            ORDER BY active_cases_assigned DESC, o.name ASC;
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in officer workload report:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 8. CSV Export for any report
router.get('/export/:reportType', authenticateToken, async (req, res) => {
    try {
        const { reportType } = req.params;
        let query = '';
        let filename = `${reportType}_report.csv`;

        if (reportType === 'complaints-by-status') {
            query = `SELECT status, COUNT(*) AS total FROM complaint GROUP BY status;`;
        } else if (reportType === 'incidents-by-severity') {
            query = `SELECT severity, COUNT(*) AS total FROM incident GROUP BY severity;`;
        } else if (reportType === 'cases-by-status') {
            query = `SELECT status, COUNT(*) AS total FROM police_case GROUP BY status;`;
        } else if (reportType === 'complaints-without-incidents') {
            query = `
                SELECT c.complaint_id, ci.name AS citizen_name, ci.phone, c.type, c.description, c.complaint_date, c.status
                FROM complaint c
                JOIN citizen ci ON c.citizen_id = ci.citizen_id
                LEFT JOIN incident i ON c.complaint_id = i.complaint_id
                WHERE i.incident_id IS NULL;
            `;
        } else if (reportType === 'cases-without-officers') {
            query = `
                SELECT pc.case_id, pc.case_type, pc.status, pc.registered_date, f.fir_number
                FROM police_case pc
                JOIN fir f ON pc.fir_id = f.fir_id
                LEFT JOIN case_officer co ON pc.case_id = co.case_id
                WHERE co.case_id IS NULL;
            `;
        } else if (reportType === 'evidence-awaiting-examination') {
            query = `
                SELECT e.evidence_id, e.case_id, e.type, e.description, e.collected_date, e.status, o.name AS collected_by, el.name AS storage_location
                FROM evidence e
                JOIN officer o ON e.collected_by = o.officer_id
                LEFT JOIN evidence_location el ON e.evidence_loc_id = el.evidence_loc_id
                WHERE e.status = 'Under Examination';
            `;
        } else if (reportType === 'officer-workload') {
            query = `
                SELECT o.officer_id, o.name AS officer_name, o.rank, o.badge_number, ps.name AS station_name,
                       COUNT(DISTINCT co.case_id) AS active_cases, COUNT(DISTINCT e.evidence_id) AS evidence_collected
                FROM officer o
                JOIN police_station ps ON o.station_id = ps.station_id
                LEFT JOIN case_officer co ON o.officer_id = co.officer_id
                LEFT JOIN evidence e ON o.officer_id = e.collected_by
                GROUP BY o.officer_id, o.name, o.rank, o.badge_number, ps.name;
            `;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid report type requested.' });
        }

        const [rows] = await db.query(query);
        const csv = convertToCSV(rows);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('Error exporting CSV report:', err);
        res.status(500).json({ success: false, message: 'Failed to export CSV report.' });
    }
});

module.exports = router;
