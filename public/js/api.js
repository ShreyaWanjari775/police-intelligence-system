/**
 * POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM
 * Client API Connector
 */
const API = (function() {
    const BASE_URL = '/api';

    function getToken() {
        return localStorage.getItem('police_intel_token');
    }

    function setToken(token) {
        if (token) {
            localStorage.setItem('police_intel_token', token);
        } else {
            localStorage.removeItem('police_intel_token');
        }
    }

    function getUser() {
        const u = localStorage.getItem('police_intel_user');
        return u ? JSON.parse(u) : null;
    }

    function setUser(user) {
        if (user) {
            localStorage.setItem('police_intel_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('police_intel_user');
        }
    }

    async function request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const res = await fetch(`${BASE_URL}${endpoint}`, config);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `HTTP error ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err);
            throw err;
        }
    }

    return {
        getToken,
        setToken,
        getUser,
        setUser,

        // Auth
        login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
        registerCitizen: (data) => request('/auth/register-citizen', { method: 'POST', body: JSON.stringify(data) }),
        getMe: () => request('/auth/me'),
        getUsers: () => request('/auth/users'),
        createUser: (userData) => request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }),

        // Citizen Portal
        getCitizenOverview: () => request('/citizen-portal/overview'),
        getCitizenComplaints: () => request('/citizen-portal/complaints'),
        getCitizenComplaint: (id) => request(`/citizen-portal/complaints/${id}`),
        createCitizenComplaint: (data) => request('/citizen-portal/complaints', { method: 'POST', body: JSON.stringify(data) }),
        getCitizenCases: () => request('/citizen-portal/cases'),
        getCitizenHearings: () => request('/citizen-portal/hearings'),
        getCitizenProfile: () => request('/citizen-portal/profile'),
        updateCitizenProfile: (data) => request('/citizen-portal/profile', { method: 'PUT', body: JSON.stringify(data) }),

        // Administrative Audit Logs
        getAuditLogs: (params = '') => request(`/audit-logs${params ? '?' + params : ''}`),

        // Dashboard
        getStats: () => request('/dashboard/stats'),
        getRecentCases: () => request('/dashboard/recent-cases'),
        getRecentComplaints: () => request('/dashboard/recent-complaints'),
        getPriorityIncidents: () => request('/dashboard/priority-incidents'),
        getRecentStatusChanges: () => request('/dashboard/recent-status-changes'),

        // Citizens
        getCitizens: (params = '') => request(`/citizens${params ? '?' + params : ''}`),
        getCitizen: (id) => request(`/citizens/${id}`),
        createCitizen: (data) => request('/citizens', { method: 'POST', body: JSON.stringify(data) }),
        updateCitizen: (id, data) => request(`/citizens/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteCitizen: (id) => request(`/citizens/${id}`, { method: 'DELETE' }),

        // Complaints
        getComplaints: (params = '') => request(`/complaints${params ? '?' + params : ''}`),
        getComplaint: (id) => request(`/complaints/${id}`),
        createComplaint: (data) => request('/complaints', { method: 'POST', body: JSON.stringify(data) }),
        updateComplaint: (id, data) => request(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        convertToIncident: (id, data) => request(`/complaints/${id}/convert-to-incident`, { method: 'POST', body: JSON.stringify(data) }),
        deleteComplaint: (id) => request(`/complaints/${id}`, { method: 'DELETE' }),

        // Incidents
        getIncidents: (params = '') => request(`/incidents${params ? '?' + params : ''}`),
        getMapIncidents: (params = '') => request(`/incidents/map${params ? '?' + params : ''}`),
        getIncident: (id) => request(`/incidents/${id}`),
        createIncident: (data) => request('/incidents', { method: 'POST', body: JSON.stringify(data) }),
        updateIncident: (id, data) => request(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteIncident: (id) => request(`/incidents/${id}`, { method: 'DELETE' }),

        // FIRs
        getFirs: (params = '') => request(`/firs${params ? '?' + params : ''}`),
        getFir: (id) => request(`/firs/${id}`),
        createFir: (data) => request('/firs', { method: 'POST', body: JSON.stringify(data) }),
        updateFir: (id, data) => request(`/firs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteFir: (id) => request(`/firs/${id}`, { method: 'DELETE' }),

        // Cases
        getCases: (params = '') => request(`/cases${params ? '?' + params : ''}`),
        getCase: (id) => request(`/cases/${id}`),
        createCase: (data) => request('/cases', { method: 'POST', body: JSON.stringify(data) }),
        updateCaseStatus: (id, data) => request(`/cases/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
        assignOfficer: (caseId, data) => request(`/cases/${caseId}/officers`, { method: 'POST', body: JSON.stringify(data) }),
        unassignOfficer: (caseId, officerId) => request(`/cases/${caseId}/officers/${officerId}`, { method: 'DELETE' }),
        linkPerson: (caseId, data) => request(`/cases/${caseId}/persons`, { method: 'POST', body: JSON.stringify(data) }),
        unlinkPerson: (caseId, personId, type) => request(`/cases/${caseId}/persons/${personId}/${type}`, { method: 'DELETE' }),
        deleteCase: (id) => request(`/cases/${id}`, { method: 'DELETE' }),

        // Persons
        getPersons: (params = '') => request(`/persons${params ? '?' + params : ''}`),
        getPerson: (id) => request(`/persons/${id}`),
        createPerson: (data) => request('/persons', { method: 'POST', body: JSON.stringify(data) }),
        updatePerson: (id, data) => request(`/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deletePerson: (id) => request(`/persons/${id}`, { method: 'DELETE' }),

        // Evidence
        getEvidence: (params = '') => request(`/evidence${params ? '?' + params : ''}`),
        getEvidenceItem: (id) => request(`/evidence/${id}`),
        createEvidence: (data) => request('/evidence', { method: 'POST', body: JSON.stringify(data) }),
        updateEvidence: (id, data) => request(`/evidence/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        addCustodyLog: (id, data) => request(`/evidence/${id}/custody`, { method: 'POST', body: JSON.stringify(data) }),
        deleteEvidence: (id) => request(`/evidence/${id}`, { method: 'DELETE' }),

        // Evidence Locations
        getEvidenceLocations: () => request('/evidence-locations'),
        getEvidenceLocation: (id) => request(`/evidence-locations/${id}`),
        createEvidenceLocation: (data) => request('/evidence-locations', { method: 'POST', body: JSON.stringify(data) }),
        updateEvidenceLocation: (id, data) => request(`/evidence-locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteEvidenceLocation: (id) => request(`/evidence-locations/${id}`, { method: 'DELETE' }),

        // Court Proceedings
        getCourtProceedings: (params = '') => request(`/court-proceedings${params ? '?' + params : ''}`),
        getUpcomingHearings: () => request('/court-proceedings/upcoming'),
        getCourtProceeding: (id) => request(`/court-proceedings/${id}`),
        createCourtProceeding: (data) => request('/court-proceedings', { method: 'POST', body: JSON.stringify(data) }),
        updateCourtProceeding: (id, data) => request(`/court-proceedings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteCourtProceeding: (id) => request(`/court-proceedings/${id}`, { method: 'DELETE' }),

        // Officers
        getOfficers: (params = '') => request(`/officers${params ? '?' + params : ''}`),
        getOfficer: (id) => request(`/officers/${id}`),
        createOfficer: (data) => request('/officers', { method: 'POST', body: JSON.stringify(data) }),
        updateOfficer: (id, data) => request(`/officers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteOfficer: (id) => request(`/officers/${id}`, { method: 'DELETE' }),

        // Police Stations
        getStations: () => request('/police-stations'),
        getStation: (id) => request(`/police-stations/${id}`),
        createStation: (data) => request('/police-stations', { method: 'POST', body: JSON.stringify(data) }),
        updateStation: (id, data) => request(`/police-stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteStation: (id) => request(`/police-stations/${id}`, { method: 'DELETE' }),

        // Departments
        getDepartments: () => request('/departments'),
        createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
        updateDepartment: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

        // Locations
        getLocations: () => request('/locations'),
        createLocation: (data) => request('/locations', { method: 'POST', body: JSON.stringify(data) }),
        updateLocation: (id, data) => request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

        // Reports
        getComplaintsByStatus: () => request('/reports/complaints-by-status'),
        getIncidentsBySeverity: () => request('/reports/incidents-by-severity'),
        getCasesByStatus: () => request('/reports/cases-by-status'),
        getComplaintsWithoutIncidents: () => request('/reports/complaints-without-incidents'),
        getCasesWithoutOfficers: () => request('/reports/cases-without-officers'),
        getEvidenceAwaitingExam: () => request('/reports/evidence-awaiting-examination'),
        getOfficerWorkload: () => request('/reports/officer-workload'),
        getExportUrl: (reportType) => `${BASE_URL}/reports/export/${reportType}`,

        // Search
        searchGlobal: (query) => request(`/search?q=${encodeURIComponent(query)}`)
    };
})();
