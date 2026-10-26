const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_police_intel_jwt_key_2026_change_in_production';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (authHeader) {
        token = authHeader.trim();
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (authHeader) {
        token = authHeader.trim();
    }

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
            next();
        });
    } else {
        next();
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
}

// Police Personnel Roles (internal operations)
const POLICE_ROLES = ['Administrator', 'Officer', 'Investigator', 'Read-only Reviewer'];
const OFFICER_WRITE_ROLES = ['Administrator', 'Officer', 'Investigator'];

function requirePolice(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!POLICE_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Access restricted to authorized police department personnel.'
        });
    }
    next();
}

function requireOfficer(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!OFFICER_WRITE_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Active officer privileges required.'
        });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.user.role !== 'Administrator') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. System Administrator privileges required.'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requirePolice,
    requireOfficer,
    requireAdmin,
    POLICE_ROLES,
    OFFICER_WRITE_ROLES
};
