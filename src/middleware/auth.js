const jwt = require('jsonwebtoken');
const { getSessionByToken, getUserById } = require('../databaseService');

const JWT_SECRET = process.env.JWT_SECRET || 'mevo-secret-key-change-this';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            ok: false,
            error: 'Access token required',
        });
    }

    try {
        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if session exists and is valid
        const session = await getSessionByToken(token);
        if (!session) {
            return res.status(401).json({
                ok: false,
                error: 'Invalid or expired session',
            });
        }

        // Get user data
        const user = await getUserById(decoded.userId);
        if (!user || !user.active) {
            return res.status(401).json({
                ok: false,
                error: 'User not found or inactive',
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                ok: false,
                error: 'Token expired',
            });
        }

        return res.status(403).json({
            ok: false,
            error: 'Invalid token',
        });
    }
};

// Middleware to check user role
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                ok: false,
                error: 'Authentication required',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                ok: false,
                error: 'Insufficient permissions',
                required: roles,
                current: req.user.role,
            });
        }

        next();
    };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = await getSessionByToken(token);

        if (session) {
            const user = await getUserById(decoded.userId);
            if (user && user.active) {
                req.user = user;
                req.token = token;
            }
        }
    } catch (error) {
        // Silently fail for optional auth
    }

    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth,
    JWT_SECRET,
};
