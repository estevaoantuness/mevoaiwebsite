const express = require('express');
const { validate, validateUuid, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    getCalendars,
    getCalendarById,
    createCalendar,
    updateCalendar,
    deleteCalendar,
} = require('../supabaseService');

const router = express.Router();

// GET /api/calendars - List calendars (with optional property filter)
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        propertyId: req.query.property_id,
        activeOnly: req.query.active !== 'false',
    };

    const calendars = await getCalendars(filters);

    res.json({
        ok: true,
        data: calendars,
        count: calendars.length,
    });
}));

// GET /api/calendars/:id - Get calendar by ID
router.get('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const calendar = await getCalendarById(req.params.id);

    if (!calendar) {
        return res.status(404).json({
            ok: false,
            error: 'Calendar not found',
        });
    }

    res.json({
        ok: true,
        data: calendar,
    });
}));

// POST /api/calendars - Create new calendar
router.post('/', validate(schemas.calendar), asyncHandler(async (req, res) => {
    const calendar = await createCalendar(req.validatedData);

    res.status(201).json({
        ok: true,
        data: calendar,
        message: 'Calendar created successfully',
    });
}));

// PUT /api/calendars/:id - Update calendar
router.put('/:id', validateUuid('id'), validate(schemas.calendar.fork(['property_id', 'platform', 'url'], (schema) => schema.optional())), asyncHandler(async (req, res) => {
    const calendar = await updateCalendar(req.params.id, req.validatedData);

    res.json({
        ok: true,
        data: calendar,
        message: 'Calendar updated successfully',
    });
}));

// DELETE /api/calendars/:id - Soft delete calendar
router.delete('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const calendar = await deleteCalendar(req.params.id);

    res.json({
        ok: true,
        data: calendar,
        message: 'Calendar deactivated successfully',
    });
}));

module.exports = router;
