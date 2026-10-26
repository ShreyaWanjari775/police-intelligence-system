
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists.
// Vercel's deployment filesystem is read-only.
// Use /tmp for temporary uploads on Vercel.
const uploadsDir = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Secure private evidence files behind police department authorization
const { authenticateToken, requirePolice } = require('./middleware/auth');

app.use(
    '/uploads/evidence',
    authenticateToken,
    requirePolice,
    express.static(path.join(uploadsDir, 'evidence'))
);

// Serve public assets & static website files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/citizen-portal', require('./routes/citizen_portal'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/citizens', require('./routes/citizens'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/firs', require('./routes/firs'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/persons', require('./routes/persons'));
app.use('/api/evidence', require('./routes/evidence'));
app.use('/api/evidence-locations', require('./routes/evidence_locations'));
app.use('/api/court-proceedings', require('./routes/court'));
app.use('/api/officers', require('./routes/officers'));
app.use('/api/police-stations', require('./routes/stations'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/search', require('./routes/search'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Police Operations & Crime Intelligence System API',
        timestamp: new Date().toISOString()
    });
});

// Fallback to index.html for SPA client-side routing
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Central error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);

    res.status(500).json({
        success: false,
        message: 'An internal server error occurred.',
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : undefined
    });
});

// Start the server locally.
// Vercel handles the serverless request lifecycle.
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('=======================================================');
        console.log(' POLICE OPERATIONS & CRIME INTELLIGENCE SYSTEM SERVER');
        console.log('=======================================================');
        console.log(` Active at: http://localhost:${PORT}`);
        console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(` MySQL Database: ${process.env.DB_NAME || 'police_intelligence_system'}`);
        console.log('=======================================================\n');
    });
}

// Export the Express app for Vercel's serverless runtime
module.exports = app;
