const express = require('express');
const { validate, validateUuid, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    getProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
} = require('../supabaseService');

const router = express.Router();

// GET /api/properties - List properties (with optional client filter)
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        clientId: req.query.client_id,
        activeOnly: req.query.active !== 'false',
    };

    const properties = await getProperties(filters);

    res.json({
        ok: true,
        data: properties,
        count: properties.length,
    });
}));

// GET /api/properties/:id - Get property by ID
router.get('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const property = await getPropertyById(req.params.id);

    if (!property) {
        return res.status(404).json({
            ok: false,
            error: 'Property not found',
        });
    }

    res.json({
        ok: true,
        data: property,
    });
}));

// POST /api/properties - Create new property
router.post('/', validate(schemas.property), asyncHandler(async (req, res) => {
    const property = await createProperty(req.validatedData);

    res.status(201).json({
        ok: true,
        data: property,
        message: 'Property created successfully',
    });
}));

// PUT /api/properties/:id - Update property
router.put('/:id', validateUuid('id'), validate(schemas.property.fork(['client_id', 'name'], (schema) => schema.optional())), asyncHandler(async (req, res) => {
    const property = await updateProperty(req.params.id, req.validatedData);

    res.json({
        ok: true,
        data: property,
        message: 'Property updated successfully',
    });
}));

// DELETE /api/properties/:id - Soft delete property
router.delete('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const property = await deleteProperty(req.params.id);

    res.json({
        ok: true,
        data: property,
        message: 'Property deactivated successfully',
    });
}));

module.exports = router;
