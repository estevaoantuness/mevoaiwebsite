const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validate, validateUuid, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireRole, JWT_SECRET } = require('../middleware/auth');
const {
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    updateLastLogin,
    createSession,
    deleteSession,
} = require('../databaseService');

const router = express.Router();

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d'; // 7 days

// POST /api/users/register - Register new user
router.post('/register', validate(schemas.user), asyncHandler(async (req, res) => {
    const { email, password, name, phone, role, avatar_url } = req.validatedData;

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return res.status(409).json({
            ok: false,
            error: 'User with this email already exists',
        });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await createUser({
        email,
        password_hash,
        name,
        phone,
        role: role || 'agent',
        avatar_url,
        active: true,
    });

    res.status(201).json({
        ok: true,
        data: user,
        message: 'User registered successfully',
    });
}));

// POST /api/users/login - Login
router.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
    const { email, password } = req.validatedData;

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
        return res.status(401).json({
            ok: false,
            error: 'Invalid email or password',
        });
    }

    // Check if user is active
    if (!user.active) {
        return res.status(401).json({
            ok: false,
            error: 'Account is inactive',
        });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        return res.status(401).json({
            ok: false,
            error: 'Invalid email or password',
        });
    }

    // Generate JWT token
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Create session
    await createSession(user.id, token, expiresAt);

    // Update last login
    await updateLastLogin(user.id);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
        ok: true,
        data: {
            user: userWithoutPassword,
            token,
            expiresAt,
        },
        message: 'Login successful',
    });
}));

// POST /api/users/logout - Logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    await deleteSession(req.token);

    res.json({
        ok: true,
        message: 'Logout successful',
    });
}));

// GET /api/users/me - Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
    const { password_hash, ...userWithoutPassword } = req.user;

    res.json({
        ok: true,
        data: userWithoutPassword,
    });
}));

// PUT /api/users/me - Update current user profile
router.put('/me', authenticateToken, asyncHandler(async (req, res) => {
    const allowedUpdates = ['name', 'phone', 'avatar_url'];
    const updates = {};

    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    // Handle password change
    if (req.body.password) {
        if (req.body.current_password) {
            const isValidPassword = await bcrypt.compare(req.body.current_password, req.user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    ok: false,
                    error: 'Current password is incorrect',
                });
            }
            updates.password_hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        } else {
            return res.status(400).json({
                ok: false,
                error: 'Current password required to change password',
            });
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            ok: false,
            error: 'No valid fields to update',
        });
    }

    const updatedUser = await updateUser(req.user.id, updates);
    const { password_hash, ...userWithoutPassword } = updatedUser;

    res.json({
        ok: true,
        data: userWithoutPassword,
        message: 'Profile updated successfully',
    });
}));

// GET /api/users - List all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const filters = {
        role: req.query.role,
        activeOnly: req.query.active !== 'false',
    };

    const users = await getUsers(filters);

    // Remove password hashes
    const usersWithoutPasswords = users.map(({ password_hash, ...user }) => user);

    res.json({
        ok: true,
        data: usersWithoutPasswords,
        count: usersWithoutPasswords.length,
    });
}));

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', authenticateToken, requireRole('admin'), validateUuid('id'), asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);

    if (!user) {
        return res.status(404).json({
            ok: false,
            error: 'User not found',
        });
    }

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
        ok: true,
        data: userWithoutPassword,
    });
}));

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), validateUuid('id'), asyncHandler(async (req, res) => {
    const allowedUpdates = ['name', 'phone', 'role', 'avatar_url', 'active'];
    const updates = {};

    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            ok: false,
            error: 'No valid fields to update',
        });
    }

    const updatedUser = await updateUser(req.params.id, updates);
    const { password_hash, ...userWithoutPassword } = updatedUser;

    res.json({
        ok: true,
        data: userWithoutPassword,
        message: 'User updated successfully',
    });
}));

// DELETE /api/users/:id - Deactivate user (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), validateUuid('id'), asyncHandler(async (req, res) => {
    const updatedUser = await updateUser(req.params.id, { active: false });
    const { password_hash, ...userWithoutPassword } = updatedUser;

    res.json({
        ok: true,
        data: userWithoutPassword,
        message: 'User deactivated successfully',
    });
}));

module.exports = router;
