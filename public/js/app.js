/**
 * POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
 * Single Page Application & UI Controller
 */

// Global State
const State = {
    activeView: 'home',
    currentUser: null,
    map: null,
    mapMarkers: [],
    locationsCache: [],
    officersCache: [],
    citizensCache: [],
    casesCache: [],
    evidenceLocsCache: [],
    stationsCache: [],
    departmentsCache: []
};

// UI Notification Helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Modal Manager
const Modal = {
    open(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('open');
    },
    close(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
    },
    closeAll() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    }
};

// Navigation Controller
function switchView(viewName) {
    State.activeView = viewName;

    // Update nav links
    document.querySelectorAll('nav a').forEach(a => {
        if (a.getAttribute('data-view') === viewName) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });

    // Hide hero & homepage sections if entering dedicated module view
    const homeSections = document.querySelectorAll('.home-section');
    const moduleViews = document.querySelectorAll('.module-view');

    if (viewName === 'home') {
        homeSections.forEach(s => s.style.display = '');
        moduleViews.forEach(v => v.classList.remove('active'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadDashboardData();
    } else {
        homeSections.forEach(s => s.style.display = 'none');
        moduleViews.forEach(v => {
            if (v.id === `view-${viewName}`) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Load specific module data
        switch (viewName) {
            case 'complaints': loadComplaints(); break;
            case 'incidents': loadIncidents(); break;
            case 'firs': loadFirs(); break;
            case 'cases': loadCases(); break;
            case 'evidence': loadEvidence(); break;
            case 'officers': loadOfficers(); break;
            case 'court': loadCourtProceedings(); break;
            case 'citizens': loadCitizens(); break;
            case 'persons': loadPersons(); break;
            case 'stations': loadStations(); break;
            case 'reports': loadReports(); break;
        }
    }
}

// -------------------------------------------------------------
// DASHBOARD & HOMEPAGE LOADER
// -------------------------------------------------------------
async function loadDashboardData() {
    try {
        // 1. Dashboard Stats (Backend.sql lines 540-551)
        const statsRes = await API.getStats();
        if (statsRes.success) {
            const s = statsRes.data;
            const elTotalCases = document.getElementById('stat-total-cases');
            const elActiveCases = document.getElementById('stat-active-cases');
            const elTotalFirs = document.getElementById('stat-total-firs');
            const elActiveOfficers = document.getElementById('stat-active-officers');

            if (elTotalCases) elTotalCases.innerText = String(s.total_cases).padStart(2, '0');
            if (elActiveCases) elActiveCases.innerText = String(s.active_cases).padStart(2, '0');
            if (elTotalFirs) elTotalFirs.innerText = String(s.total_firs).padStart(2, '0');
            if (elActiveOfficers) elActiveOfficers.innerText = String(s.active_officers).padStart(2, '0');

            // Extended stats
            const elTotalCitizens = document.getElementById('stat-total-citizens');
            const elTotalComplaints = document.getElementById('stat-total-complaints');
            const elTotalIncidents = document.getElementById('stat-total-incidents');
            const elTotalEvidence = document.getElementById('stat-total-evidence');
            const elUpcomingHearings = document.getElementById('stat-upcoming-hearings');

            if (elTotalCitizens) elTotalCitizens.innerText = s.total_citizens;
            if (elTotalComplaints) elTotalComplaints.innerText = s.total_complaints;
            if (elTotalIncidents) elTotalIncidents.innerText = s.total_incidents;
            if (elTotalEvidence) elTotalEvidence.innerText = s.total_evidence;
            if (elUpcomingHearings) elUpcomingHearings.innerText = s.upcoming_hearings;

            // Map overlay counters
            const elMapActive = document.getElementById('map-stat-active');
            const elMapHigh = document.getElementById('map-stat-high');
            if (elMapActive) elMapActive.innerText = String(s.active_cases).padStart(2, '0');
            if (elMapHigh) elMapHigh.innerText = String(s.high_severity_incidents).padStart(2, '0');
        }

        // 2. Recent Cases (Backend.sql lines 516-538)
        const casesRes = await API.getRecentCases();
        const caseListEl = document.getElementById('recent-cases-grid');
        if (caseListEl && casesRes.success) {
            caseListEl.innerHTML = '';
            if (casesRes.data.length === 0) {
                caseListEl.innerHTML = `<div class="table-state" style="grid-column: span 2;"><h4>No recent cases found</h4></div>`;
            } else {
                casesRes.data.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'case-card';
                    card.onclick = () => openCaseDetails(c.case_id);
                    card.innerHTML = `
                        <div class="case-top">
                            <div class="case-id">CASE #${String(c.case_id).padStart(3, '0')}</div>
                            <div class="status-badge status-${c.status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(c.status)}</div>
                        </div>
                        <h3>${escapeHtml(c.case_type)}</h3>
                        <p>${escapeHtml(c.description || 'No incident description available.')}</p>
                        <div class="case-details">
                            <div class="detail">
                                <small>FIR NUMBER</small>
                                <span>${escapeHtml(c.fir_number)}</span>
                            </div>
                            <div class="detail">
                                <small>LOCATION</small>
                                <span>${escapeHtml(c.area || c.city || 'Central')}</span>
                            </div>
                            <div class="detail">
                                <small>OFFICER</small>
                                <span>${escapeHtml(c.assigned_officers || 'Unassigned')}</span>
                            </div>
                            <div class="detail">
                                <small>SEVERITY</small>
                                <span style="color: ${getSeverityColor(c.severity)}">${escapeHtml(c.severity || 'Medium')}</span>
                            </div>
                        </div>
                    `;
                    caseListEl.appendChild(card);
                });
            }
        }
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function getSeverityColor(severity) {
    switch (severity) {
        case 'Critical': return '#ff4757';
        case 'High': return '#ffa502';
        case 'Medium': return '#66fcf1';
        case 'Low': return '#45a29e';
        default: return '#c5c6c7';
    }
}

// -------------------------------------------------------------
// CRIME MAP WITH LEAFLET (PRESERVING EXACT THEME & FILTERING)
// -------------------------------------------------------------
function initCrimeMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (State.map) {
        State.map.invalidateSize();
        return;
    }

    // Default center at central India
    State.map = L.map('map').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(State.map);

    loadMapIncidents();
}

async function loadMapIncidents() {
    if (!State.map) return;

    const severity = document.getElementById('map-filter-severity')?.value || '';
    const status = document.getElementById('map-filter-status')?.value || '';
    let params = '';
    if (severity) params += `severity=${encodeURIComponent(severity)}&`;
    if (status) params += `status=${encodeURIComponent(status)}&`;

    try {
        const res = await API.getMapIncidents(params);
        if (!res.success) return;

        // Clear existing markers
        State.mapMarkers.forEach(m => State.map.removeLayer(m));
        State.mapMarkers = [];

        const bounds = [];
        const uniqueLocs = new Set();

        res.data.forEach(inc => {
            const lat = parseFloat(inc.latitude);
            const lng = parseFloat(inc.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            uniqueLocs.add(`${lat.toFixed(2)},${lng.toFixed(2)}`);
            bounds.push([lat, lng]);

            const color = getSeverityColor(inc.severity);
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    width: 16px;
                    height: 16px;
                    background: ${color};
                    border-radius: 50%;
                    box-shadow: 0 0 18px ${color};
                    border: 2px solid #0B0C10;
                    transition: transform 0.2s;
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(State.map);

            const popupContent = `
                <div style="font-family: 'Poppins', sans-serif; font-size: 12px; color: #111; min-width: 200px;">
                    <div style="font-weight: 700; color: #1f2833; font-size: 13px; margin-bottom: 4px;">
                        ${escapeHtml(inc.type)}
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="background: ${color}; color: #fff; padding: 2px 6px; border-radius: 2px; font-size: 9px; font-weight: 600; text-transform: uppercase;">
                            ${escapeHtml(inc.severity)}
                        </span>
                        <span style="background: #1f2833; color: #66FCF1; padding: 2px 6px; border-radius: 2px; font-size: 9px; font-weight: 600; margin-left: 4px;">
                            ${escapeHtml(inc.status)}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #444; margin-bottom: 6px;">
                        <strong>Location:</strong> ${escapeHtml(inc.address || inc.area)}, ${escapeHtml(inc.city)}
                    </div>
                    <div style="font-size: 11px; color: #555; margin-bottom: 8px;">
                        ${escapeHtml(inc.description || '')}
                    </div>
                    ${inc.case_id ? `<button onclick="openCaseDetails(${inc.case_id})" style="background: #1F2833; color: #66FCF1; border: 1px solid #45A29E; padding: 4px 8px; border-radius: 2px; font-size: 10px; cursor: pointer;">View Linked Case #${inc.case_id}</button>` : ''}
                </div>
            `;

            marker.bindPopup(popupContent);
            State.mapMarkers.push(marker);
        });

        // Update map overlay unique location count
        const elMapLocs = document.getElementById('map-stat-locations');
        if (elMapLocs) elMapLocs.innerText = String(uniqueLocs.size).padStart(2, '0');

        // Fit map view if markers exist
        if (bounds.length > 0) {
            State.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
    } catch (err) {
        console.error('Error updating map markers:', err);
    }
}

// -------------------------------------------------------------
// MODULE: CITIZEN MANAGEMENT
// -------------------------------------------------------------
async function loadCitizens(page = 1) {
    const search = document.getElementById('search-citizens')?.value || '';
    const tableBody = document.getElementById('table-citizens-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading citizens...</h4></td></tr>`;

    try {
        const res = await API.getCitizens(`page=${page}&limit=20&search=${encodeURIComponent(search)}`);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-users-slash"></i><h4>No citizen records found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(c => `
            <tr>
                <td><strong>#${c.citizen_id}</strong></td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.phone || 'N/A')}</td>
                <td>${escapeHtml(c.email || 'N/A')}</td>
                <td>${escapeHtml(c.address || 'N/A')}</td>
                <td><span class="user-role-pill">${c.complaint_count || 0} Complaints</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details & Complaints" onclick="openCitizenDetails(${c.citizen_id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" title="Edit Citizen" onclick="openEditCitizenModal(${c.citizen_id})"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-icon danger" title="Delete Citizen" onclick="deleteCitizenRecord(${c.citizen_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading citizens</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openCitizenDetails(citizenId) {
    try {
        const res = await API.getCitizen(citizenId);
        if (!res.success) return;
        const c = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `CITIZEN <span>#${c.citizen_id}</span> - ${escapeHtml(c.name)}`;

        let complaintsHtml = '';
        if (c.complaints && c.complaints.length > 0) {
            complaintsHtml = `
                <h4 style="color: var(--aqua); margin: 20px 0 10px; font-size: 13px; text-transform: uppercase;">Complaints Filed (${c.complaints.length})</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Incident</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${c.complaints.map(comp => `
                                <tr>
                                    <td>#${comp.complaint_id}</td>
                                    <td><strong>${escapeHtml(comp.type)}</strong></td>
                                    <td><span class="status-badge">${escapeHtml(comp.status)}</span></td>
                                    <td>${formatDate(comp.complaint_date)}</td>
                                    <td>${escapeHtml(comp.area || comp.city || 'Central')}</td>
                                    <td>${comp.incident_id ? `<span style="color:var(--aqua)">Incident #${comp.incident_id}</span>` : '<span style="color:#666">None</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            complaintsHtml = `<p style="margin-top: 15px; color: #888; font-size: 12px;">No complaints filed by this citizen.</p>`;
        }

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Full Name</small>
                    <strong>${escapeHtml(c.name)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Phone Number</small>
                    <strong>${escapeHtml(c.phone || 'N/A')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Email Address</small>
                    <strong>${escapeHtml(c.email || 'N/A')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Gender / DOB</small>
                    <strong>${escapeHtml(c.gender || 'N/A')} | ${c.date_of_birth ? c.date_of_birth.substring(0,10) : 'N/A'}</strong>
                </div>
            </div>
            <div style="font-size: 12px; margin-bottom: 20px;">
                <strong style="color: var(--teal); display: block; margin-bottom: 4px;">REGISTERED ADDRESS</strong>
                <p>${escapeHtml(c.address || 'No residential address recorded.')}</p>
            </div>
            ${complaintsHtml}
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCitizenRecord(citizenId) {
    if (!confirm(`Are you sure you want to delete Citizen #${citizenId}? Database constraints will prevent deletion if complaints exist.`)) return;

    try {
        const res = await API.deleteCitizen(citizenId);
        showToast(res.message, 'success');
        loadCitizens();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: COMPLAINT MANAGEMENT
// -------------------------------------------------------------
async function loadComplaints(page = 1) {
    const status = document.getElementById('filter-complaint-status')?.value || '';
    const type = document.getElementById('filter-complaint-type')?.value || '';
    const search = document.getElementById('search-complaints')?.value || '';
    const tableBody = document.getElementById('table-complaints-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading complaints...</h4></td></tr>`;

    let params = `page=${page}&limit=20`;
    if (status) params += `&status=${encodeURIComponent(status)}`;
    if (type) params += `&type=${encodeURIComponent(type)}`;
    if (search) params += `&search=${encodeURIComponent(search)}`;

    try {
        const res = await API.getComplaints(params);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-folder-open"></i><h4>No complaints found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(c => `
            <tr>
                <td><strong>#${c.complaint_id}</strong></td>
                <td><strong>${escapeHtml(c.citizen_name)}</strong><br><small style="color:#777">${escapeHtml(c.citizen_phone || '')}</small></td>
                <td><span style="color:var(--aqua)">${escapeHtml(c.type)}</span></td>
                <td>${escapeHtml(c.area || c.city || 'Central')}</td>
                <td><span class="status-badge">${escapeHtml(c.status)}</span></td>
                <td>${formatDate(c.complaint_date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details" onclick="openComplaintDetails(${c.complaint_id})"><i class="fa-solid fa-eye"></i></button>
                        ${c.incident_id ? `<button class="btn-icon" style="color:var(--aqua)" title="View Incident #${c.incident_id}" onclick="openIncidentDetails(${c.incident_id})"><i class="fa-solid fa-triangle-exclamation"></i></button>` :
                        `<button class="btn-icon" style="color:var(--teal)" title="Convert to Incident" onclick="openConvertIncidentModal(${c.complaint_id})"><i class="fa-solid fa-bolt"></i></button>`}
                        <button class="btn-icon danger" title="Delete Complaint" onclick="deleteComplaintRecord(${c.complaint_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading complaints</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openComplaintDetails(complaintId) {
    try {
        const res = await API.getComplaint(complaintId);
        if (!res.success) return;
        const c = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `COMPLAINT <span>#${c.complaint_id}</span>`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Citizen Complainant</small>
                    <strong>${escapeHtml(c.citizen_name)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Type</small>
                    <strong style="color:var(--aqua)">${escapeHtml(c.type)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Current Status</small>
                    <strong class="status-badge">${escapeHtml(c.status)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Registered Date</small>
                    <strong>${formatDate(c.complaint_date)}</strong>
                </div>
            </div>

            <div style="font-size: 13px; margin-bottom: 20px; background: #0b0c10; padding: 18px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">COMPLAINT NARRATIVE</strong>
                <p style="color: #ddd;">${escapeHtml(c.description)}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px; margin-bottom: 20px;">
                <div style="background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                    <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">INCIDENT LOCATION</strong>
                    <p>${escapeHtml(c.location_address || c.area || 'N/A')}, ${escapeHtml(c.city || '')}</p>
                    ${c.latitude ? `<small style="color: #666;">Coordinates: ${c.latitude}, ${c.longitude}</small>` : ''}
                </div>
                <div style="background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                    <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">INCIDENT CONVERSION</strong>
                    ${c.incident_id ? `<p style="color:var(--aqua); font-weight:600;">Linked to Incident #${c.incident_id} (${escapeHtml(c.incident_severity || 'Medium')})</p><button class="btn btn-sm btn-teal" style="margin-top:6px;" onclick="openIncidentDetails(${c.incident_id})">Open Incident Details</button>` :
                    `<p style="color:#888;">No incident generated yet.</p><button class="btn btn-sm" style="margin-top:6px;" onclick="openConvertIncidentModal(${c.complaint_id})">Convert to Incident</button>`}
                </div>
            </div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openConvertIncidentModal(complaintId) {
    document.getElementById('convert-complaint-id').value = complaintId;
    Modal.open('modal-convert-incident');
}

async function handleConvertIncident(e) {
    e.preventDefault();
    const complaintId = document.getElementById('convert-complaint-id').value;
    const severity = document.getElementById('convert-severity').value;
    const description = document.getElementById('convert-description').value;

    try {
        const res = await API.convertToIncident(complaintId, { severity, description });
        showToast(res.message, 'success');
        Modal.close('modal-convert-incident');
        loadComplaints();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteComplaintRecord(complaintId) {
    if (!confirm(`Are you sure you want to delete Complaint #${complaintId}?`)) return;
    try {
        const res = await API.deleteComplaint(complaintId);
        showToast(res.message, 'success');
        loadComplaints();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: INCIDENT MANAGEMENT
// -------------------------------------------------------------
async function loadIncidents(page = 1) {
    const severity = document.getElementById('filter-incident-severity')?.value || '';
    const status = document.getElementById('filter-incident-status')?.value || '';
    const search = document.getElementById('search-incidents')?.value || '';
    const tableBody = document.getElementById('table-incidents-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading incidents...</h4></td></tr>`;

    let params = `page=${page}&limit=20`;
    if (severity) params += `&severity=${encodeURIComponent(severity)}`;
    if (status) params += `&status=${encodeURIComponent(status)}`;
    if (search) params += `&search=${encodeURIComponent(search)}`;

    try {
        const res = await API.getIncidents(params);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>No incidents found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(i => `
            <tr>
                <td><strong>#${i.incident_id}</strong></td>
                <td><strong>${escapeHtml(i.type)}</strong></td>
                <td><span style="color: ${getSeverityColor(i.severity)}; font-weight:600;">${escapeHtml(i.severity)}</span></td>
                <td>${escapeHtml(i.area || i.city || 'Central')}</td>
                <td><span class="status-badge">${escapeHtml(i.status)}</span></td>
                <td>${formatDate(i.reported_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details" onclick="openIncidentDetails(${i.incident_id})"><i class="fa-solid fa-eye"></i></button>
                        ${i.fir_id ? `<button class="btn-icon" style="color:var(--aqua)" title="View FIR #${i.fir_number}" onclick="openFirDetails(${i.fir_id})"><i class="fa-solid fa-file-lines"></i></button>` :
                        `<button class="btn-icon" style="color:var(--teal)" title="Register FIR" onclick="openRegisterFirModal(${i.incident_id})"><i class="fa-solid fa-plus"></i></button>`}
                        <button class="btn-icon danger" title="Delete Incident" onclick="deleteIncidentRecord(${i.incident_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading incidents</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openIncidentDetails(incidentId) {
    try {
        const res = await API.getIncident(incidentId);
        if (!res.success) return;
        const i = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `INCIDENT <span>#${i.incident_id}</span> - ${escapeHtml(i.type)}`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Severity</small>
                    <strong style="color: ${getSeverityColor(i.severity)}">${escapeHtml(i.severity)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Status</small>
                    <strong class="status-badge">${escapeHtml(i.status)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Origin Complaint</small>
                    <strong>Complaint #${i.complaint_id}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Reported Date</small>
                    <strong>${formatDate(i.reported_at)}</strong>
                </div>
            </div>

            <div style="font-size: 13px; margin-bottom: 20px; background: #0b0c10; padding: 18px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">INCIDENT DETAILS</strong>
                <p style="color: #ddd;">${escapeHtml(i.description || 'No description provided.')}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px; margin-bottom: 20px;">
                <div style="background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                    <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">CRIME LOCATION</strong>
                    <p>${escapeHtml(i.location_address || i.area || 'N/A')}, ${escapeHtml(i.city || '')}</p>
                    ${i.latitude ? `<small style="color: #666;">GPS: ${i.latitude}, ${i.longitude} (${escapeHtml(i.landmark || 'No Landmark')})</small>` : ''}
                </div>
                <div style="background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                    <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">LEGAL ACTION (FIR & CASE)</strong>
                    ${i.fir_id ? `<p style="color:var(--aqua); font-weight:600;">FIR Registered: ${escapeHtml(i.fir_number)}</p><button class="btn btn-sm btn-teal" style="margin-top:6px;" onclick="openFirDetails(${i.fir_id})">View FIR Details</button>` :
                    `<p style="color:#888;">No FIR registered yet.</p><button class="btn btn-sm" style="margin-top:6px;" onclick="openRegisterFirModal(${i.incident_id})">Register FIR</button>`}
                </div>
            </div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteIncidentRecord(incidentId) {
    if (!confirm(`Are you sure you want to delete Incident #${incidentId}?`)) return;
    try {
        const res = await API.deleteIncident(incidentId);
        showToast(res.message, 'success');
        loadIncidents();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: FIR MANAGEMENT
// -------------------------------------------------------------
async function loadFirs(page = 1) {
    const search = document.getElementById('search-firs')?.value || '';
    const tableBody = document.getElementById('table-firs-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading FIRs...</h4></td></tr>`;

    try {
        const res = await API.getFirs(`page=${page}&limit=20&search=${encodeURIComponent(search)}`);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-file-circle-xmark"></i><h4>No FIR records found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(f => `
            <tr>
                <td><strong>#${f.fir_id}</strong></td>
                <td><strong style="color:var(--aqua)">${escapeHtml(f.fir_number)}</strong></td>
                <td>Incident #${f.incident_id} (${escapeHtml(f.incident_type)})</td>
                <td><small style="color:#ffa502">${escapeHtml(f.sections || 'Applicable Sections')}</small></td>
                <td>${formatDate(f.registered_date)}</td>
                <td>${f.case_id ? `<span class="status-badge status-${f.case_status?.toLowerCase().replace(/\s+/g, '-')}">Case #${f.case_id}</span>` : '<span style="color:#666">No Case Created</span>'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details" onclick="openFirDetails(${f.fir_id})"><i class="fa-solid fa-eye"></i></button>
                        ${f.case_id ? `<button class="btn-icon" style="color:var(--aqua)" title="View Case #${f.case_id}" onclick="openCaseDetails(${f.case_id})"><i class="fa-solid fa-folder-open"></i></button>` :
                        `<button class="btn-icon" style="color:var(--teal)" title="Create Case" onclick="openCreateCaseModal(${f.fir_id})"><i class="fa-solid fa-folder-plus"></i></button>`}
                        <button class="btn-icon danger" title="Delete FIR" onclick="deleteFirRecord(${f.fir_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading FIRs</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openFirDetails(firId) {
    try {
        const res = await API.getFir(firId);
        if (!res.success) return;
        const f = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `FIR <span>${escapeHtml(f.fir_number)}</span>`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>FIR Number</small>
                    <strong style="color:var(--aqua)">${escapeHtml(f.fir_number)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Registered Date</small>
                    <strong>${formatDate(f.registered_date)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Incident Ref</small>
                    <strong>Incident #${f.incident_id}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Complainant</small>
                    <strong>${escapeHtml(f.citizen_name || 'N/A')}</strong>
                </div>
            </div>

            <div style="font-size: 13px; margin-bottom: 20px; background: #0b0c10; padding: 18px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">APPLICABLE LEGAL SECTIONS</strong>
                <p style="color: #ffa502; font-weight:600; margin-bottom: 12px;">${escapeHtml(f.sections || 'BNS / IPC / IT Act Sections')}</p>
                <strong style="color: var(--teal); display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">SUBSTANTIVE CASE DETAILS</strong>
                <p style="color: #ddd;">${escapeHtml(f.details || 'No extended FIR details recorded.')}</p>
            </div>

            <div style="background: #0b0c10; padding: 18px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 8px; font-size: 11px; text-transform: uppercase;">ASSOCIATED POLICE CASE</strong>
                ${f.case_id ? `
                    <p style="color:var(--white);">Linked to Police Case #${f.case_id} (${escapeHtml(f.case_type)}) - <span class="status-badge">${escapeHtml(f.case_status)}</span></p>
                    <button class="btn btn-sm btn-teal" style="margin-top:10px;" onclick="openCaseDetails(${f.case_id})">Open Complete Case Workspace</button>
                ` : `
                    <p style="color:#888;">No investigation case opened yet for this FIR.</p>
                    <button class="btn btn-sm" style="margin-top:10px;" onclick="openCreateCaseModal(${f.fir_id})">Create Police Case</button>
                `}
            </div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openRegisterFirModal(incidentId = null) {
    if (incidentId) {
        document.getElementById('fir-incident-id').value = incidentId;
    }
    Modal.open('modal-add-fir');
}

function openCreateCaseModal(firId = null) {
    if (firId) {
        document.getElementById('case-fir-id').value = firId;
    }
    Modal.open('modal-add-case');
}

async function deleteFirRecord(firId) {
    if (!confirm(`Are you sure you want to delete FIR #${firId}?`)) return;
    try {
        const res = await API.deleteFir(firId);
        showToast(res.message, 'success');
        loadFirs();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: CASE MANAGEMENT & DETAILED WORKSPACE
// -------------------------------------------------------------
async function loadCases(page = 1) {
    const status = document.getElementById('filter-case-status')?.value || '';
    const search = document.getElementById('search-cases')?.value || '';
    const tableBody = document.getElementById('table-cases-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading cases...</h4></td></tr>`;

    let params = `page=${page}&limit=20`;
    if (status) params += `&status=${encodeURIComponent(status)}`;
    if (search) params += `&search=${encodeURIComponent(search)}`;

    try {
        const res = await API.getCases(params);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-folder-open"></i><h4>No cases found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(c => `
            <tr>
                <td><strong>#${c.case_id}</strong></td>
                <td><strong>${escapeHtml(c.case_type)}</strong></td>
                <td><span style="color:var(--aqua)">${escapeHtml(c.fir_number)}</span></td>
                <td><span class="status-badge status-${c.status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(c.status)}</span></td>
                <td>${escapeHtml(c.assigned_officers || 'Unassigned')}</td>
                <td>${formatDate(c.registered_date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Complete Workspace" onclick="openCaseDetails(${c.case_id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" style="color:var(--teal)" title="Update Status & Timeline" onclick="openUpdateStatusModal(${c.case_id}, '${escapeHtml(c.status)}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                        <button class="btn-icon danger" title="Delete Case" onclick="deleteCaseRecord(${c.case_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading cases</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openCaseDetails(caseId) {
    try {
        const res = await API.getCase(caseId);
        if (!res.success) return;
        const c = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `CASE <span>#${c.case_id}</span> - ${escapeHtml(c.case_type)}`;

        // Tabbed workspace for case details: Summary, Officers, People, Evidence, Court, Timeline
        const officersList = (c.assigned_officers && c.assigned_officers.length > 0) ?
            c.assigned_officers.map(o => `
                <div style="background:#0b0c10; padding:12px 16px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong>${escapeHtml(o.name)}</strong> <small style="color:var(--teal)">(${escapeHtml(o.rank || 'Officer')})</small>
                        <div style="font-size:11px; color:#888;">Badge: ${escapeHtml(o.badge_number)} | Station: ${escapeHtml(o.station_name || 'HQ')}</div>
                    </div>
                    <div>
                        <span class="user-role-pill">${escapeHtml(o.assignment_role || 'Investigating Officer')}</span>
                        <button class="btn-icon danger" style="margin-left:8px;" title="Unassign Officer" onclick="unassignOfficerFromCase(${c.case_id}, ${o.officer_id})"><i class="fa-solid fa-user-minus"></i></button>
                    </div>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No investigating officers currently assigned to this case.</p>';

        const personsList = (c.involved_persons && c.involved_persons.length > 0) ?
            c.involved_persons.map(p => `
                <div style="background:#0b0c10; padding:12px 16px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong>${escapeHtml(p.name)}</strong> <span class="status-badge" style="margin-left:8px;">${escapeHtml(p.association_type)}</span>
                        <div style="font-size:11px; color:#888;">Phone: ${escapeHtml(p.phone || 'N/A')} | Address: ${escapeHtml(p.address || 'N/A')}</div>
                        ${p.suspect_alias ? `<div style="font-size:11px; color:#ffa502;">Alias: "${escapeHtml(p.suspect_alias)}"</div>` : ''}
                        ${p.witness_statement ? `<div style="font-size:11px; color:#66FCF1; margin-top:2px;">Statement: "${escapeHtml(p.witness_statement)}"</div>` : ''}
                    </div>
                    <button class="btn-icon danger" title="Remove Association" onclick="unlinkPersonFromCase(${c.case_id}, ${p.person_id}, '${p.association_type}')"><i class="fa-solid fa-user-xmark"></i></button>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No individuals currently linked to this case record.</p>';

        const evidenceList = (c.evidence && c.evidence.length > 0) ?
            c.evidence.map(e => `
                <div style="background:#0b0c10; padding:12px 16px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="color:var(--aqua)">${escapeHtml(e.type)}</strong> - ${escapeHtml(e.description || '')}
                        <div style="font-size:11px; color:#888;">Collected by: ${escapeHtml(e.collected_by_officer)} | Stored at: ${escapeHtml(e.storage_location || 'Central Vault')}</div>
                    </div>
                    <div>
                        <span class="status-badge">${escapeHtml(e.status)}</span>
                        <button class="btn-icon" style="margin-left:8px;" title="View Evidence" onclick="openEvidenceDetails(${e.evidence_id})"><i class="fa-solid fa-eye"></i></button>
                    </div>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No evidence logged for this case.</p>';

        const courtList = (c.court_proceedings && c.court_proceedings.length > 0) ?
            c.court_proceedings.map(cp => `
                <div style="background:#0b0c10; padding:12px 16px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="color:var(--white)">${escapeHtml(cp.court_name)}</strong>
                        <div style="font-size:11px; color:#888;">Hearing: ${formatDate(cp.hearing_date)} | Judge: ${escapeHtml(cp.judge_name || 'N/A')}</div>
                        ${cp.remarks ? `<div style="font-size:11px; color:#aaa; margin-top:2px;">Remarks: ${escapeHtml(cp.remarks)}</div>` : ''}
                    </div>
                    <span class="status-badge">${escapeHtml(cp.status)}</span>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No court hearings scheduled yet.</p>';

        const timelineList = (c.status_history && c.status_history.length > 0) ?
            c.status_history.map(h => `
                <div class="timeline-item">
                    <div class="timeline-date">${formatDate(h.changed_at)}</div>
                    <div class="timeline-title">Status changed to "${escapeHtml(h.status)}" by ${escapeHtml(h.changed_by_officer || 'Investigator')}</div>
                    <div class="timeline-desc">${escapeHtml(h.remarks || 'No notes logged.')}</div>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No status change events logged.</p>';

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>FIR Reference</small>
                    <strong style="color:var(--aqua)">${escapeHtml(c.fir_number)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Status</small>
                    <strong class="status-badge status-${c.status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(c.status)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Registered</small>
                    <strong>${formatDate(c.registered_date)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Location</small>
                    <strong>${escapeHtml(c.area || c.city || 'Central')}</strong>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <div class="tabs-nav" style="margin-bottom:0; border-bottom:none;">
                    <button class="tab-btn active" onclick="switchCaseTab(event, 'case-tab-summary')">Overview</button>
                    <button class="tab-btn" onclick="switchCaseTab(event, 'case-tab-officers')">Officers (${c.assigned_officers.length})</button>
                    <button class="tab-btn" onclick="switchCaseTab(event, 'case-tab-people')">Involved People (${c.involved_persons.length})</button>
                    <button class="tab-btn" onclick="switchCaseTab(event, 'case-tab-evidence')">Evidence (${c.evidence.length})</button>
                    <button class="tab-btn" onclick="switchCaseTab(event, 'case-tab-court')">Court (${c.court_proceedings.length})</button>
                    <button class="tab-btn" onclick="switchCaseTab(event, 'case-tab-timeline')">Timeline</button>
                </div>
                <button class="btn btn-sm btn-teal" onclick="openUpdateStatusModal(${c.case_id}, '${escapeHtml(c.status)}')"><i class="fa-solid fa-clock-rotate-left"></i> Update Status</button>
            </div>

            <div id="case-tab-summary" class="case-tab-content" style="display:block;">
                <div style="background:#0b0c10; padding:18px; border:1px solid var(--border); margin-bottom:15px; font-size:13px;">
                    <strong style="color:var(--teal); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;">INCIDENT SUMMARY</strong>
                    <p style="color:#ddd;">${escapeHtml(c.incident_description || 'No incident description.')}</p>
                </div>
                <div style="background:#0b0c10; padding:18px; border:1px solid var(--border); font-size:13px;">
                    <strong style="color:var(--teal); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;">LEGAL SECTIONS IN FIR</strong>
                    <p style="color:#ffa502; font-weight:600;">${escapeHtml(c.sections || 'BNS / IPC')}</p>
                    <p style="color:#aaa; font-size:12px; margin-top:6px;">${escapeHtml(c.fir_details || '')}</p>
                </div>
            </div>

            <div id="case-tab-officers" class="case-tab-content" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Assigned Investigating Personnel</h5>
                    <button class="btn btn-sm" onclick="openAssignOfficerModal(${c.case_id})"><i class="fa-solid fa-plus"></i> Assign Officer</button>
                </div>
                ${officersList}
            </div>

            <div id="case-tab-people" class="case-tab-content" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Victims, Suspects & Witnesses</h5>
                    <button class="btn btn-sm" onclick="openLinkPersonModal(${c.case_id})"><i class="fa-solid fa-plus"></i> Link Person</button>
                </div>
                ${personsList}
            </div>

            <div id="case-tab-evidence" class="case-tab-content" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Seized Property & Evidence Records</h5>
                    <button class="btn btn-sm" onclick="openAddEvidenceModal(${c.case_id})"><i class="fa-solid fa-plus"></i> Log Evidence</button>
                </div>
                ${evidenceList}
            </div>

            <div id="case-tab-court" class="case-tab-content" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Court Proceedings & Hearings</h5>
                    <button class="btn btn-sm" onclick="openScheduleHearingModal(${c.case_id})"><i class="fa-solid fa-plus"></i> Schedule Hearing</button>
                </div>
                ${courtList}
            </div>

            <div id="case-tab-timeline" class="case-tab-content" style="display:none;">
                <div class="timeline">${timelineList}</div>
            </div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function switchCaseTab(e, tabId) {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    document.querySelectorAll('.case-tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';
}

function openUpdateStatusModal(caseId, currentStatus) {
    document.getElementById('status-case-id').value = caseId;
    document.getElementById('status-select').value = currentStatus || 'Investigation';
    document.getElementById('status-remarks').value = '';
    Modal.open('modal-case-status');
}

async function handleUpdateCaseStatus(e) {
    e.preventDefault();
    const caseId = document.getElementById('status-case-id').value;
    const status = document.getElementById('status-select').value;
    const remarks = document.getElementById('status-remarks').value;

    try {
        const res = await API.updateCaseStatus(caseId, { status, remarks });
        showToast(res.message, 'success');
        Modal.close('modal-case-status');
        loadCases();
        loadDashboardData();
        if (document.getElementById('modal-details').classList.contains('open')) {
            openCaseDetails(caseId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function unassignOfficerFromCase(caseId, officerId) {
    if (!confirm('Remove this officer from the case?')) return;
    try {
        const res = await API.unassignOfficer(caseId, officerId);
        showToast(res.message, 'success');
        openCaseDetails(caseId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function unlinkPersonFromCase(caseId, personId, type) {
    if (!confirm(`Remove this person (${type}) from the case?`)) return;
    try {
        const res = await API.unlinkPerson(caseId, personId, type);
        showToast(res.message, 'success');
        openCaseDetails(caseId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCaseRecord(caseId) {
    if (!confirm(`Are you sure you want to delete Case #${caseId}? Constraints require removing evidence and proceedings first.`)) return;
    try {
        const res = await API.deleteCase(caseId);
        showToast(res.message, 'success');
        loadCases();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: EVIDENCE MANAGEMENT
// -------------------------------------------------------------
async function loadEvidence(page = 1) {
    const status = document.getElementById('filter-evidence-status')?.value || '';
    const search = document.getElementById('search-evidence')?.value || '';
    const tableBody = document.getElementById('table-evidence-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading evidence records...</h4></td></tr>`;

    let params = `page=${page}&limit=20`;
    if (status) params += `&status=${encodeURIComponent(status)}`;
    if (search) params += `&search=${encodeURIComponent(search)}`;

    try {
        const res = await API.getEvidence(params);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-fingerprint"></i><h4>No evidence records found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(e => `
            <tr>
                <td><strong>#${e.evidence_id}</strong></td>
                <td><strong style="color:var(--aqua)">${escapeHtml(e.type)}</strong><br><small style="color:#aaa">${escapeHtml(e.description || '')}</small></td>
                <td>Case #${e.case_id} (${escapeHtml(e.fir_number)})</td>
                <td>${escapeHtml(e.collected_by)}</td>
                <td>${escapeHtml(e.storage_location || 'Central Room')}</td>
                <td><span class="status-badge">${escapeHtml(e.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Custody History" onclick="openEvidenceDetails(${e.evidence_id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" style="color:var(--teal)" title="Log Custody Event" onclick="openCustodyTransferModal(${e.evidence_id})"><i class="fa-solid fa-truck-ramp-box"></i></button>
                        <button class="btn-icon danger" title="Delete Evidence" onclick="deleteEvidenceRecord(${e.evidence_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading evidence</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openEvidenceDetails(evidenceId) {
    try {
        const res = await API.getEvidenceItem(evidenceId);
        if (!res.success) return;
        const e = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `EVIDENCE <span>#${e.evidence_id}</span> - ${escapeHtml(e.type)}`;

        const custodyHtml = (e.custody_logs && e.custody_logs.length > 0) ?
            e.custody_logs.map(log => `
                <div class="timeline-item">
                    <div class="timeline-date">${formatDate(log.action_date)}</div>
                    <div class="timeline-title">${escapeHtml(log.action_type)} - Handled by ${escapeHtml(log.handled_by_name)} (${escapeHtml(log.handled_by_badge || 'Officer')})</div>
                    <div class="timeline-desc">
                        ${log.from_location ? `From: ${escapeHtml(log.from_location)} &rarr; ` : ''}
                        ${log.to_location ? `To: ${escapeHtml(log.to_location)}` : ''}
                        ${log.remarks ? `<br><small style="color:#66FCF1;">Remarks: ${escapeHtml(log.remarks)}</small>` : ''}
                    </div>
                </div>
            `).join('') : '<p style="color:#777; font-size:12px;">No custody events recorded.</p>';

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Evidence Type</small>
                    <strong style="color:var(--aqua)">${escapeHtml(e.type)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Status</small>
                    <strong class="status-badge">${escapeHtml(e.status)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Case Reference</small>
                    <strong>Case #${e.case_id} (${escapeHtml(e.fir_number)})</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Collecting Officer</small>
                    <strong>${escapeHtml(e.collected_by_name)}</strong>
                </div>
            </div>

            <div style="background:#0b0c10; padding:18px; border:1px solid var(--border); margin-bottom:15px; font-size:13px;">
                <strong style="color:var(--teal); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;">DESCRIPTION & PROPERTY TAG</strong>
                <p style="color:#ddd;">${escapeHtml(e.description || 'No detailed description.')}</p>
                <div style="margin-top:8px; font-size:11px; color:#888;">
                    <strong>Storage:</strong> ${escapeHtml(e.storage_location_name || 'Central Locker')} (${escapeHtml(e.storage_location_address || '')})
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px;"><i class="fa-solid fa-shield-halved" style="color:var(--aqua); margin-right:6px;"></i> Auditable Chain of Custody History</h5>
                <button class="btn btn-sm btn-teal" onclick="openCustodyTransferModal(${e.evidence_id})"><i class="fa-solid fa-plus"></i> Add Custody Log</button>
            </div>
            <div class="timeline">${custodyHtml}</div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openCustodyTransferModal(evidenceId) {
    document.getElementById('custody-evidence-id').value = evidenceId;
    Modal.open('modal-custody-transfer');
}

async function handleAddCustodyLog(e) {
    e.preventDefault();
    const evidenceId = document.getElementById('custody-evidence-id').value;
    const action_type = document.getElementById('custody-action-type').value;
    const handled_by = document.getElementById('custody-officer').value;
    const from_location = document.getElementById('custody-from').value;
    const to_location = document.getElementById('custody-to').value;
    const remarks = document.getElementById('custody-remarks').value;

    try {
        const res = await API.addCustodyLog(evidenceId, { action_type, handled_by, from_location, to_location, remarks });
        showToast(res.message, 'success');
        Modal.close('modal-custody-transfer');
        loadEvidence();
        if (document.getElementById('modal-details').classList.contains('open')) {
            openEvidenceDetails(evidenceId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteEvidenceRecord(evidenceId) {
    if (!confirm(`Are you sure you want to delete Evidence record #${evidenceId}?`)) return;
    try {
        const res = await API.deleteEvidence(evidenceId);
        showToast(res.message, 'success');
        loadEvidence();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: COURT PROCEEDINGS
// -------------------------------------------------------------
async function loadCourtProceedings(upcomingOnly = false) {
    const tableBody = document.getElementById('table-court-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading court schedule...</h4></td></tr>`;

    try {
        const res = upcomingOnly ? await API.getUpcomingHearings() : await API.getCourtProceedings();
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-scale-balanced"></i><h4>No court proceedings scheduled</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(cp => `
            <tr>
                <td><strong>#${cp.proceeding_id}</strong></td>
                <td><strong style="color:var(--white)">${escapeHtml(cp.court_name)}</strong></td>
                <td>Case #${cp.case_id} (${escapeHtml(cp.fir_number || cp.case_type)})</td>
                <td><span style="color:var(--aqua); font-weight:600;">${formatDate(cp.hearing_date)}</span></td>
                <td>${escapeHtml(cp.judge_name || 'N/A')}</td>
                <td><span class="status-badge">${escapeHtml(cp.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" style="color:var(--aqua)" title="View Case Workspace" onclick="openCaseDetails(${cp.case_id})"><i class="fa-solid fa-folder-open"></i></button>
                        <button class="btn-icon danger" title="Delete Proceeding" onclick="deleteCourtProceedingRecord(${cp.proceeding_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading court proceedings</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function deleteCourtProceedingRecord(proceedingId) {
    if (!confirm(`Are you sure you want to cancel and delete Court Proceeding #${proceedingId}?`)) return;
    try {
        const res = await API.deleteCourtProceeding(proceedingId);
        showToast(res.message, 'success');
        loadCourtProceedings();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: POLICE OFFICERS
// -------------------------------------------------------------
async function loadOfficers(page = 1) {
    const search = document.getElementById('search-officers')?.value || '';
    const tableBody = document.getElementById('table-officers-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading police personnel...</h4></td></tr>`;

    try {
        const res = await API.getOfficers(`page=${page}&limit=20&search=${encodeURIComponent(search)}`);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-user-slash"></i><h4>No officers found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(o => `
            <tr>
                <td><strong>${escapeHtml(o.badge_number)}</strong></td>
                <td><strong>${escapeHtml(o.name)}</strong></td>
                <td><span style="color:var(--aqua)">${escapeHtml(o.rank || 'Officer')}</span></td>
                <td>${escapeHtml(o.station_name || 'Central')}</td>
                <td>${escapeHtml(o.department_name || 'General')}</td>
                <td><span class="status-badge">${escapeHtml(o.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Profile & Cases" onclick="openOfficerDetails(${o.officer_id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon danger" title="Delete Officer" onclick="deleteOfficerRecord(${o.officer_id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading officers</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openOfficerDetails(officerId) {
    try {
        const res = await API.getOfficer(officerId);
        if (!res.success) return;
        const o = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `OFFICER <span>${escapeHtml(o.badge_number)}</span> - ${escapeHtml(o.name)}`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Rank / Designation</small>
                    <strong style="color:var(--aqua)">${escapeHtml(o.rank || 'Officer')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Status</small>
                    <strong class="status-badge">${escapeHtml(o.status)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Police Station</small>
                    <strong>${escapeHtml(o.station_name)} (${escapeHtml(o.station_city)})</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Department</small>
                    <strong>${escapeHtml(o.department_name || 'General Duty')}</strong>
                </div>
            </div>

            <div style="font-size: 12px; margin-bottom: 20px; background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">CONTACT INFORMATION</strong>
                <p>Phone: ${escapeHtml(o.phone || 'N/A')} | Email: ${escapeHtml(o.email || 'N/A')}</p>
            </div>

            <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Currently Assigned Cases (${o.assigned_cases.length})</h5>
            ${o.assigned_cases.length > 0 ? `
                <div class="table-container" style="margin-bottom:20px;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Case ID</th>
                                <th>Type</th>
                                <th>FIR Number</th>
                                <th>Role</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${o.assigned_cases.map(c => `
                                <tr>
                                    <td>#${c.case_id}</td>
                                    <td><strong>${escapeHtml(c.case_type)}</strong></td>
                                    <td>${escapeHtml(c.fir_number)}</td>
                                    <td>${escapeHtml(c.assignment_role)}</td>
                                    <td><span class="status-badge">${escapeHtml(c.status)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p style="color:#777; font-size:12px; margin-bottom:20px;">No cases assigned to this officer.</p>'}
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteOfficerRecord(officerId) {
    if (!confirm(`Are you sure you want to delete Officer record #${officerId}?`)) return;
    try {
        const res = await API.deleteOfficer(officerId);
        showToast(res.message, 'success');
        loadOfficers();
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: PERSONS, VICTIMS, SUSPECTS & WITNESSES
// -------------------------------------------------------------
async function loadPersons(role = '') {
    const tableBody = document.getElementById('table-persons-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading records...</h4></td></tr>`;

    let params = 'limit=50';
    if (role) params += `&role=${encodeURIComponent(role)}`;

    try {
        const res = await API.getPersons(params);
        if (!res.success) return;

        if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-users"></i><h4>No persons found</h4></td></tr>`;
            return;
        }

        tableBody.innerHTML = res.data.map(p => {
            const roleTags = [];
            if (p.victim_id) roleTags.push('<span class="status-badge" style="border-color:var(--teal); color:var(--teal);">Victim</span>');
            if (p.suspect_id) roleTags.push('<span class="status-badge" style="border-color:var(--danger); color:var(--danger);">Suspect</span>');
            if (p.witness_id) roleTags.push('<span class="status-badge" style="border-color:var(--aqua); color:var(--aqua);">Witness</span>');
            if (roleTags.length === 0) roleTags.push('<span style="color:#666;">Citizen / Individual</span>');

            return `
                <tr>
                    <td><strong>#${p.person_id}</strong></td>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td>${escapeHtml(p.phone || 'N/A')}</td>
                    <td>${roleTags.join(' ')}</td>
                    <td>${escapeHtml(p.address || 'N/A')}</td>
                    <td><span class="user-role-pill">${p.case_count || 0} Cases</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" title="View Associations" onclick="openPersonDetails(${p.person_id})"><i class="fa-solid fa-eye"></i></button>
                            <button class="btn-icon danger" title="Delete Person" onclick="deletePersonRecord(${p.person_id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading persons</h4><p>${escapeHtml(err.message)}</p></td></tr>`;
    }
}

async function openPersonDetails(personId) {
    try {
        const res = await API.getPerson(personId);
        if (!res.success) return;
        const p = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `PERSON <span>#${p.person_id}</span> - ${escapeHtml(p.name)}`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>Name</small>
                    <strong>${escapeHtml(p.name)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Contact</small>
                    <strong>${escapeHtml(p.phone || 'N/A')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Gender / Age</small>
                    <strong>${escapeHtml(p.gender || 'N/A')} | ${p.victim_age || p.suspect_age || 'N/A'} yrs</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Specialized Roles</small>
                    <strong>${p.victim_id ? 'Victim ' : ''}${p.suspect_id ? 'Suspect ' : ''}${p.witness_id ? 'Witness' : ''}</strong>
                </div>
            </div>

            ${p.suspect_id ? `
                <div style="background:#0b0c10; padding:15px; border:1px solid var(--danger); margin-bottom:15px;">
                    <strong style="color:var(--danger); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;"><i class="fa-solid fa-triangle-exclamation"></i> SUSPECT DOSSIER & CRIMINAL RECORD</strong>
                    <p style="font-size:12px; color:#fff;">Alias: <strong>"${escapeHtml(p.suspect_alias || 'None')}"</strong></p>
                    <p style="font-size:12px; color:#bbb; margin-top:4px;">History: ${escapeHtml(p.criminal_history || 'No prior convictions recorded.')}</p>
                </div>
            ` : ''}

            ${p.witness_id ? `
                <div style="background:#0b0c10; padding:15px; border:1px solid var(--aqua); margin-bottom:15px;">
                    <strong style="color:var(--aqua); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;"><i class="fa-solid fa-quote-left"></i> WITNESS TESTIMONY / STATEMENT</strong>
                    <p style="font-size:12px; color:#ddd; font-style:italic;">"${escapeHtml(p.witness_statement || 'No statement taken.')}"</p>
                </div>
            ` : ''}

            <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Linked Cases (${p.cases.length})</h5>
            ${p.cases.length > 0 ? `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Case</th>
                                <th>Association</th>
                                <th>FIR Number</th>
                                <th>Status</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.cases.map(c => `
                                <tr>
                                    <td>#${c.case_id} (${escapeHtml(c.case_type)})</td>
                                    <td><span class="status-badge">${escapeHtml(c.association_type)}</span></td>
                                    <td>${escapeHtml(c.fir_number)}</td>
                                    <td>${escapeHtml(c.status)}</td>
                                    <td><small style="color:#aaa">${escapeHtml(c.notes || 'None')}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p style="color:#777; font-size:12px;">No cases linked to this person.</p>'}
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deletePersonRecord(personId) {
    if (!confirm(`Are you sure you want to delete Person #${personId}?`)) return;
    try {
        const res = await API.deletePerson(personId);
        showToast(res.message, 'success');
        loadPersons();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: POLICE STATIONS
// -------------------------------------------------------------
async function loadStations() {
    const tableBody = document.getElementById('table-stations-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i><h4>Loading police stations...</h4></td></tr>`;

    try {
        const res = await API.getStations();
        if (!res.success) return;

        tableBody.innerHTML = res.data.map(s => `
            <tr>
                <td><strong>#${s.station_id}</strong></td>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.city)}</td>
                <td>${escapeHtml(s.area || 'Central')}</td>
                <td>${escapeHtml(s.phone || 'N/A')}</td>
                <td><span class="user-role-pill">${s.total_officers || 0} Officers</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Station Details" onclick="openStationDetails(${s.station_id})"><i class="fa-solid fa-eye"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Error loading stations</h4></td></tr>`;
    }
}

async function openStationDetails(stationId) {
    try {
        const res = await API.getStation(stationId);
        if (!res.success) return;
        const s = res.data;

        const body = document.getElementById('modal-details-body');
        document.getElementById('modal-details-title').innerHTML = `STATION: <span>${escapeHtml(s.name)}</span>`;

        body.innerHTML = `
            <div class="detail-banner">
                <div class="detail-banner-item">
                    <small>City</small>
                    <strong>${escapeHtml(s.city)}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Jurisdiction</small>
                    <strong style="color:var(--aqua)">${escapeHtml(s.jurisdiction || 'Division HQ')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Contact</small>
                    <strong>${escapeHtml(s.phone || 'N/A')}</strong>
                </div>
                <div class="detail-banner-item">
                    <small>Officers Assigned</small>
                    <strong>${s.officers.length}</strong>
                </div>
            </div>

            <div style="font-size: 12px; margin-bottom: 20px; background: #0b0c10; padding: 15px; border: 1px solid var(--border);">
                <strong style="color: var(--teal); display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase;">STATION ADDRESS</strong>
                <p>${escapeHtml(s.address || 'Central Address')}</p>
            </div>

            <h5 style="color:var(--white); font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Personnel Stationed (${s.officers.length})</h5>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Badge</th>
                            <th>Name</th>
                            <th>Rank</th>
                            <th>Department</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${s.officers.map(o => `
                            <tr>
                                <td>${escapeHtml(o.badge_number)}</td>
                                <td><strong>${escapeHtml(o.name)}</strong></td>
                                <td>${escapeHtml(o.rank)}</td>
                                <td>${escapeHtml(o.department_name || 'General')}</td>
                                <td><span class="status-badge">${escapeHtml(o.status)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        Modal.open('modal-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// MODULE: REPORTS & ANALYTICS
// -------------------------------------------------------------
async function loadReports() {
    try {
        // 1. Complaints by status
        const compRes = await API.getComplaintsByStatus();
        const compEl = document.getElementById('report-complaints-status');
        if (compEl && compRes.success) {
            compEl.innerHTML = compRes.data.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1a222c;">
                    <span style="font-size:12px; color:#ddd;">${escapeHtml(item.status)}</span>
                    <strong style="color:var(--aqua); font-size:15px;">${item.total}</strong>
                </div>
            `).join('');
        }

        // 2. Incidents by severity
        const incRes = await API.getIncidentsBySeverity();
        const incEl = document.getElementById('report-incidents-severity');
        if (incEl && incRes.success) {
            incEl.innerHTML = incRes.data.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1a222c;">
                    <span style="font-size:12px; color:${getSeverityColor(item.severity)}; font-weight:600;">${escapeHtml(item.severity)}</span>
                    <strong style="color:var(--white); font-size:15px;">${item.total}</strong>
                </div>
            `).join('');
        }

        // 3. Cases by status
        const caseRes = await API.getCasesByStatus();
        const caseEl = document.getElementById('report-cases-status');
        if (caseEl && caseRes.success) {
            caseEl.innerHTML = caseRes.data.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1a222c;">
                    <span style="font-size:12px; color:#ddd;">${escapeHtml(item.status)}</span>
                    <strong style="color:var(--teal); font-size:15px;">${item.total}</strong>
                </div>
            `).join('');
        }

        // 4. Evidence awaiting examination (Backend.sql lines 688-692)
        const evRes = await API.getEvidenceAwaitingExam();
        const evTable = document.getElementById('table-report-evidence-body');
        if (evTable && evRes.success) {
            evTable.innerHTML = evRes.data.length > 0 ? evRes.data.map(e => `
                <tr>
                    <td>#${e.evidence_id}</td>
                    <td><strong>${escapeHtml(e.type)}</strong></td>
                    <td>${escapeHtml(e.description || '')}</td>
                    <td>Case #${e.case_id} (${escapeHtml(e.fir_number)})</td>
                    <td>${escapeHtml(e.collected_by)}</td>
                    <td>${escapeHtml(e.storage_location || 'Storage')}</td>
                    <td>${formatDate(e.collected_date)}</td>
                </tr>
            `).join('') : '<tr><td colspan="7" class="table-state">No evidence currently awaiting examination.</td></tr>';
        }

        // 5. Officer workload
        const workRes = await API.getOfficerWorkload();
        const workTable = document.getElementById('table-report-workload-body');
        if (workTable && workRes.success) {
            workTable.innerHTML = workRes.data.map(w => `
                <tr>
                    <td>${escapeHtml(w.badge_number)}</td>
                    <td><strong>${escapeHtml(w.officer_name)}</strong></td>
                    <td>${escapeHtml(w.rank || 'Officer')}</td>
                    <td>${escapeHtml(w.station_name)}</td>
                    <td><span class="user-role-pill">${w.active_cases_assigned} Cases</span></td>
                    <td>${w.evidence_collected} Exhibits</td>
                    <td><span class="status-badge">${escapeHtml(w.officer_status)}</span></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}

function exportReport(reportType) {
    const url = API.getExportUrl(reportType);
    window.open(url, '_blank');
}

// -------------------------------------------------------------
// GLOBAL SEARCH OVERLAY
// -------------------------------------------------------------
async function handleGlobalSearch(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (!query) return;

        try {
            const res = await API.searchGlobal(query);
            if (!res.success) return;

            const resultsContainer = document.getElementById('search-results-list');
            document.getElementById('search-modal-query').innerText = `"${query}"`;

            let hasResults = false;
            let html = '';

            const r = res.results;

            if (r.cases && r.cases.length > 0) {
                hasResults = true;
                html += `<div class="search-result-group"><h4>Cases (${r.cases.length})</h4>`;
                r.cases.forEach(c => {
                    html += `
                        <div class="search-item" onclick="Modal.close('modal-search'); openCaseDetails(${c.case_id});">
                            <div><strong>Case #${c.case_id}: ${escapeHtml(c.case_type)}</strong> <small style="color:var(--teal)">(${escapeHtml(c.fir_number)})</small><br><small style="color:#888">${escapeHtml(c.description || '')}</small></div>
                            <span class="status-badge">${escapeHtml(c.status)}</span>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            if (r.firs && r.firs.length > 0) {
                hasResults = true;
                html += `<div class="search-result-group"><h4>FIRs (${r.firs.length})</h4>`;
                r.firs.forEach(f => {
                    html += `
                        <div class="search-item" onclick="Modal.close('modal-search'); openFirDetails(${f.fir_id});">
                            <div><strong style="color:var(--aqua)">${escapeHtml(f.fir_number)}</strong><br><small style="color:#aaa">${escapeHtml(f.sections || '')}</small></div>
                            <span style="font-size:11px; color:#888">${formatDate(f.registered_date)}</span>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            if (r.citizens && r.citizens.length > 0) {
                hasResults = true;
                html += `<div class="search-result-group"><h4>Citizens (${r.citizens.length})</h4>`;
                r.citizens.forEach(c => {
                    html += `
                        <div class="search-item" onclick="Modal.close('modal-search'); openCitizenDetails(${c.citizen_id});">
                            <div><strong>${escapeHtml(c.name)}</strong> <small style="color:#888">${escapeHtml(c.phone || '')}</small><br><small style="color:#777">${escapeHtml(c.address || '')}</small></div>
                            <span class="btn-icon"><i class="fa-solid fa-arrow-right"></i></span>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            if (r.officers && r.officers.length > 0) {
                hasResults = true;
                html += `<div class="search-result-group"><h4>Officers (${r.officers.length})</h4>`;
                r.officers.forEach(o => {
                    html += `
                        <div class="search-item" onclick="Modal.close('modal-search'); openOfficerDetails(${o.officer_id});">
                            <div><strong>${escapeHtml(o.name)}</strong> (${escapeHtml(o.badge_number)}) - <span style="color:var(--aqua)">${escapeHtml(o.rank || '')}</span></div>
                            <span class="status-badge">${escapeHtml(o.status)}</span>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            if (!hasResults) {
                resultsContainer.innerHTML = `<div class="table-state"><i class="fa-solid fa-magnifying-glass"></i><h4>No matching records found</h4><p>Try searching for a case type, FIR number, officer name or citizen.</p></div>`;
            } else {
                resultsContainer.innerHTML = html;
            }

            Modal.open('modal-search');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }
}

// -------------------------------------------------------------
// AUTHENTICATION & ROLE SWITCHER
// -------------------------------------------------------------
function updateAuthUI() {
    const user = API.getUser();
    State.currentUser = user;

    const authContainer = document.getElementById('auth-status-container');
    if (!authContainer) return;

    if (user) {
        authContainer.innerHTML = `
            <div class="user-badge">
                <i class="fa-solid fa-shield-halved" style="color:var(--aqua)"></i>
                <div style="line-height:1.2;">
                    <div style="font-weight:600; color:var(--white); font-size:11px;">${escapeHtml(user.full_name || user.username)}</div>
                    <span class="user-role-pill">${escapeHtml(user.role)}</span>
                </div>
                <button class="btn btn-sm btn-teal" style="padding:4px 8px; margin-left:8px;" onclick="handleLogout()" title="Sign Out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <button class="btn btn-sm btn-filled" onclick="openLoginModal()"><i class="fa-solid fa-lock"></i> LOGIN</button>
        `;
    }
}

function openLoginModal() {
    Modal.open('modal-login');
}

function quickFillLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    try {
        const res = await API.login({ username: u, password: p });
        if (res.success) {
            API.setToken(res.token);
            API.setUser(res.user);
            updateAuthUI();
            Modal.close('modal-login');
            showToast(`Welcome back, ${res.user.full_name}! Authenticated as ${res.user.role}.`, 'success');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function handleLogout() {
    API.setToken(null);
    API.setUser(null);
    updateAuthUI();
    showToast('Signed out successfully.', 'success');
}

// -------------------------------------------------------------
// CACHE PRELOADER FOR MODAL DROPDOWNS
// -------------------------------------------------------------
async function preloadDropdownData() {
    try {
        const [locs, offs, cits, firs, evLocs] = await Promise.all([
            API.getLocations(),
            API.getOfficers(),
            API.getCitizens('limit=100'),
            API.getFirs('limit=100'),
            API.getEvidenceLocations()
        ]);

        if (locs.success) State.locationsCache = locs.data;
        if (offs.success) State.officersCache = offs.data;
        if (cits.success) State.citizensCache = cits.data;
        if (firs.success) State.firsCache = firs.data;
        if (evLocs.success) State.evidenceLocsCache = evLocs.data;

        populateSelectOptions();
    } catch (err) {
        console.error('Dropdown preloading error:', err);
    }
}

function populateSelectOptions() {
    // Populate citizens dropdown
    const citSelects = ['complaint-citizen-id'];
    citSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">-- Select Citizen Complainant --</option>' +
                State.citizensCache.map(c => `<option value="${c.citizen_id}">${escapeHtml(c.name)} (${escapeHtml(c.phone || 'No Phone')})</option>`).join('');
        }
    });

    // Populate locations dropdown
    const locSelects = ['complaint-location-id', 'incident-location-id', 'evidence-location-id'];
    locSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">-- Select Location --</option>' +
                State.locationsCache.map(l => `<option value="${l.location_id}">${escapeHtml(l.area || l.address)}, ${escapeHtml(l.city)}</option>`).join('');
        }
    });

    // Populate officers dropdown
    const offSelects = ['case-initial-officer', 'assign-officer-id', 'evidence-collected-by', 'custody-officer'];
    offSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">-- Select Police Officer --</option>' +
                State.officersCache.map(o => `<option value="${o.officer_id}">${escapeHtml(o.name)} [${escapeHtml(o.badge_number)}] - ${escapeHtml(o.rank || 'Officer')}</option>`).join('');
        }
    });

    // Populate storage locations dropdown
    const elStorage = document.getElementById('evidence-storage-loc-id');
    if (elStorage) {
        elStorage.innerHTML = '<option value="">-- Select Secure Evidence Locker --</option>' +
            State.evidenceLocsCache.map(el => `<option value="${el.evidence_loc_id}">${escapeHtml(el.name)} (${escapeHtml(el.address || 'HQ')})</option>`).join('');
    }
}

// -------------------------------------------------------------
// INITIALIZATION ON DOM READY
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    loadDashboardData();
    initCrimeMap();
    preloadDropdownData();

    // Setup global search listener
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', handleGlobalSearch);
    }

    // Mobile menu toggle
    const menuBtn = document.querySelector('.menu-btn');
    const nav = document.querySelector('nav');
    if (menuBtn && nav) {
        menuBtn.addEventListener('click', () => {
            nav.style.display = (nav.style.display === 'flex') ? 'none' : 'flex';
            if (nav.style.display === 'flex') {
                nav.style.flexDirection = 'column';
                nav.style.position = 'absolute';
                nav.style.top = '75px';
                nav.style.right = '0';
                nav.style.background = '#0B0C10';
                nav.style.padding = '25px';
                nav.style.border = '1px solid #202832';
            }
        });
    }

    // Connect form submissions
    document.getElementById('form-login')?.addEventListener('submit', handleLogin);
    document.getElementById('form-case-status')?.addEventListener('submit', handleUpdateCaseStatus);
    document.getElementById('form-convert-incident')?.addEventListener('submit', handleConvertIncident);
    document.getElementById('form-custody-transfer')?.addEventListener('submit', handleAddCustodyLog);

    // Generic modal close on clicking backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) Modal.closeAll();
        });
    });
});
