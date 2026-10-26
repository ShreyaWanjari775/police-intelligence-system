/**
 * POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
 * Automated End-to-End Test Suite
 */

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
    console.log('====================================================');
    console.log(' RUNNING POLICE INTEL SYSTEM API & INTEGRATION TESTS');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    async function assert(desc, fn) {
        try {
            await fn();
            console.log(`[PASS] ${desc}`);
            passed++;
        } catch (err) {
            console.error(`[FAIL] ${desc}:`, err.message);
            failed++;
        }
    }

    // 1. Health Check
    await assert('API Health check responds online', async () => {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        if (data.status !== 'online') throw new Error('Expected status online');
    });

    // 2. Authentication
    let adminToken = '';
    let officerToken = '';
    let reviewerToken = '';

    await assert('Admin authentication succeeds', async () => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        const data = await res.json();
        if (!data.success || !data.token) throw new Error(data.message || 'No token');
        adminToken = data.token;
        if (data.user.role !== 'Administrator') throw new Error('Incorrect role');
    });

    await assert('Officer authentication succeeds', async () => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'officer1', password: 'officer123' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        officerToken = data.token;
    });

    await assert('Reviewer authentication succeeds', async () => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'reviewer1', password: 'reviewer123' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        reviewerToken = data.token;
    });

    await assert('Invalid password correctly rejected', async () => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
        });
        if (res.status !== 401) throw new Error('Expected 401 Unauthorized');
    });

    // 3. Dashboard Statistics (Backend.sql lines 540-551)
    await assert('Dashboard statistics query returns all required metrics', async () => {
        const res = await fetch(`${BASE_URL}/dashboard/stats`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const s = data.data;
        if (typeof s.total_cases !== 'number') throw new Error('Missing total_cases');
        if (typeof s.active_cases !== 'number') throw new Error('Missing active_cases');
        if (typeof s.total_firs !== 'number') throw new Error('Missing total_firs');
        if (typeof s.active_officers !== 'number') throw new Error('Missing active_officers');
        if (typeof s.total_citizens !== 'number') throw new Error('Missing total_citizens');
        if (typeof s.total_complaints !== 'number') throw new Error('Missing total_complaints');
        if (typeof s.total_evidence !== 'number') throw new Error('Missing total_evidence');
    });

    // 4. Crime Map Location Query (Backend.sql lines 498-513)
    await assert('Crime Map endpoint returns incidents with real coordinates', async () => {
        const res = await fetch(`${BASE_URL}/incidents/map`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (!Array.isArray(data.data) || data.data.length === 0) throw new Error('No map incidents');
        const first = data.data[0];
        if (!first.latitude || !first.longitude) throw new Error('Incident missing coordinates');
        if (!first.severity || !first.type) throw new Error('Incident missing severity/type');
    });

    // 5. Recent Cases (Backend.sql lines 516-538)
    await assert('Recent Cases query returns joined case details and officers', async () => {
        const res = await fetch(`${BASE_URL}/dashboard/recent-cases`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (!Array.isArray(data.data) || data.data.length === 0) throw new Error('No recent cases');
        const c = data.data[0];
        if (!c.fir_number) throw new Error('Missing fir_number join');
    });

    // 6. Complete Case Details Workspace (Backend.sql lines 554-583 + officers + persons + evidence + court + history)
    await assert('Complete Case Details workspace returns all related entities', async () => {
        const res = await fetch(`${BASE_URL}/cases/1`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const c = data.data;
        if (c.case_id !== 1) throw new Error('Case ID mismatch');
        if (!c.fir_number) throw new Error('Missing fir_number');
        if (!Array.isArray(c.assigned_officers)) throw new Error('Missing assigned_officers array');
        if (!Array.isArray(c.involved_persons)) throw new Error('Missing involved_persons array');
        if (!Array.isArray(c.evidence)) throw new Error('Missing evidence array');
        if (!Array.isArray(c.court_proceedings)) throw new Error('Missing court_proceedings array');
        if (!Array.isArray(c.status_history)) throw new Error('Missing status_history array');
    });

    // 7. Case Status Update Transaction (Backend.sql lines 770-786)
    await assert('Case status update executes transaction and logs status history', async () => {
        const res = await fetch(`${BASE_URL}/cases/1/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${officerToken}`
            },
            body: JSON.stringify({
                status: 'Under Trial',
                remarks: 'Trial proceedings initiated before Magistrate Court.'
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        // Verify status changed
        const verifyRes = await fetch(`${BASE_URL}/cases/1`);
        const verifyData = await verifyRes.json();
        if (verifyData.data.status !== 'Under Trial') throw new Error('Case status not updated');
        const latestHistory = verifyData.data.status_history[0];
        if (latestHistory.status !== 'Under Trial') throw new Error('Status history not recorded');

        // Revert status back to Investigation cleanly
        await fetch(`${BASE_URL}/cases/1/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${officerToken}`
            },
            body: JSON.stringify({ status: 'Investigation', remarks: 'Reverted for testing' })
        });
    });

    // 8. Convert Complaint to Incident Transaction (Backend.sql lines 381-389)
    await assert('Complaint to Incident conversion transaction succeeds', async () => {
        // Register test citizen & complaint
        const citRes = await fetch(`${BASE_URL}/citizens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ name: 'Automated Test Citizen', phone: '9999999999' })
        });
        const citData = await citRes.json();

        const compRes = await fetch(`${BASE_URL}/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({
                citizen_id: citData.citizen_id,
                type: 'Theft Test',
                description: 'Test mobile theft incident'
            })
        });
        const compData = await compRes.json();

        // Convert to incident
        const convRes = await fetch(`${BASE_URL}/complaints/${compData.complaint_id}/convert-to-incident`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ severity: 'Medium', description: 'Converted incident description' })
        });
        const convData = await convRes.json();
        if (!convData.success || !convData.incident_id) throw new Error(convData.message);

        // Verify complaint status updated
        const verifyComp = await fetch(`${BASE_URL}/complaints/${compData.complaint_id}`);
        const verifyData = await verifyComp.json();
        if (verifyData.data.status !== 'Converted to Incident') throw new Error('Complaint status not updated to Converted');
    });

    // 9. FIR Registration and Unique Auto-formatting
    await assert('FIR registration auto-formats next FIR number and validates incident', async () => {
        const firRes = await fetch(`${BASE_URL}/firs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({
                incident_id: 1,
                sections: 'BNS 303',
                details: 'Automated test FIR'
            })
        });
        const firData = await firRes.json();
        if (!firData.success || !firData.fir_number) throw new Error(firData.message);
        if (!firData.fir_number.startsWith('FIR/')) throw new Error('FIR format invalid: ' + firData.fir_number);
    });

    // 10. Evidence & Chain of Custody Auditing
    await assert('Evidence logging records custody event and timeline is queryable', async () => {
        const evRes = await fetch(`${BASE_URL}/evidence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${officerToken}` },
            body: JSON.stringify({
                case_id: 1,
                type: 'Digital Media',
                description: 'Surveillance USB Flash Drive',
                collected_by: 1,
                status: 'Collected'
            })
        });
        const evData = await evRes.json();
        if (!evData.success) throw new Error(evData.message);

        // Append custody log
        const custRes = await fetch(`${BASE_URL}/evidence/${evData.evidence_id}/custody`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${officerToken}` },
            body: JSON.stringify({
                action_type: 'Transferred to Evidence Room',
                handled_by: 1,
                from_location: 'Duty Desk',
                to_location: 'Evidence Locker Room A',
                remarks: 'Sealed in evidence bag #204'
            })
        });
        const custData = await custRes.json();
        if (!custData.success) throw new Error(custData.message);

        // Fetch details and verify custody logs
        const detailRes = await fetch(`${BASE_URL}/evidence/${evData.evidence_id}`);
        const detailData = await detailRes.json();
        if (detailData.data.custody_logs.length < 2) throw new Error('Custody logs count mismatch');
    });

    // 11. Sensitive Data Masking for Reviewer Role (RBAC)
    await assert('RBAC masks sensitive suspect and witness data for Reviewer role', async () => {
        const res = await fetch(`${BASE_URL}/persons`, {
            headers: { 'Authorization': `Bearer ${reviewerToken}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const suspect = data.data.find(p => p.suspect_id);
        if (suspect && suspect.criminal_history && !suspect.criminal_history.includes('Restricted')) {
            throw new Error('Criminal history not masked for reviewer');
        }
    });

    // 12. Specialized SQL Analytical Reports (Backend.sql)
    await assert('Analytical queries from Backend.sql execute properly', async () => {
        const [r1, r2, r3, r4, r5] = await Promise.all([
            fetch(`${BASE_URL}/reports/complaints-by-status`).then(r => r.json()),
            fetch(`${BASE_URL}/reports/incidents-by-severity`).then(r => r.json()),
            fetch(`${BASE_URL}/reports/cases-by-status`).then(r => r.json()),
            fetch(`${BASE_URL}/reports/complaints-without-incidents`).then(r => r.json()),
            fetch(`${BASE_URL}/reports/cases-without-officers`).then(r => r.json())
        ]);

        if (!r1.success || !r2.success || !r3.success || !r4.success || !r5.success) {
            throw new Error('One or more analytical reports failed');
        }
    });

    // 13. CSV Report Export
    await assert('CSV export endpoint generates valid CSV with correct headers', async () => {
        const res = await fetch(`${BASE_URL}/reports/export/complaints-by-status`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.status !== 200) throw new Error('CSV export failed');
        const text = await res.text();
        if (!text.includes('status') || !text.includes('total')) {
            throw new Error('CSV format unexpected: ' + text);
        }
    });

    // 14. Global Multi-Entity Search
    await assert('Global search queries cases, FIRs, incidents, citizens, officers', async () => {
        const res = await fetch(`${BASE_URL}/search?q=Mumbai`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (!data.results.cases || !data.results.citizens || !data.results.officers) {
            throw new Error('Search result categories missing');
        }
    });

    console.log('\n====================================================');
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
});
