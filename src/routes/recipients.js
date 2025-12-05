const express = require('express');
const { validate, validateUuid, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    getRecipients,
    getRecipientById,
    createRecipient,
    updateRecipient,
    deleteRecipient,
    addPropertyRecipient,
    removePropertyRecipient,
} = require('../supabaseService');

const router = express.Router();

// GET /api/recipients - List recipients (with optional client filter)
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        clientId: req.query.client_id,
        activeOnly: req.query.active !== 'false',
    };

    const recipients = await getRecipients(filters);

    res.json({
        ok: true,
        data: recipients,
        count: recipients.length,
    });
}));

// GET /api/recipients/:id - Get recipient by ID
router.get('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const recipient = await getRecipientById(req.params.id);

    if (!recipient) {
        return res.status(404).json({
            ok: false,
            error: 'Recipient not found',
        });
    }

    res.json({
        ok: true,
        data: recipient,
    });
}));

// POST /api/recipients - Create new recipient
router.post('/', validate(schemas.recipient), asyncHandler(async (req, res) => {
    const recipient = await createRecipient(req.validatedData);

    res.status(201).json({
        ok: true,
        data: recipient,
        message: 'Recipient created successfully',
    });
}));

// PUT /api/recipients/:id - Update recipient
router.put('/:id', validateUuid('id'), validate(schemas.recipient.fork(['client_id', 'name', 'phone'], (schema) => schema.optional())), asyncHandler(async (req, res) => {
    const recipient = await updateRecipient(req.params.id, req.validatedData);

    res.json({
        ok: true,
        data: recipient,
        message: 'Recipient updated successfully',
    });
}));

// DELETE /api/recipients/:id - Soft delete recipient
router.delete('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const recipient = await deleteRecipient(req.params.id);

    res.json({
        ok: true,
        data: recipient,
        message: 'Recipient deactivated successfully',
    });
}));

// POST /api/recipients/:id/properties - Associate recipient with property
router.post('/:id/properties', validateUuid('id'), validate(schemas.propertyRecipient), asyncHandler(async (req, res) => {
    const association = await addPropertyRecipient(
        req.validatedData.recipient_id,
        req.params.id,
        req.validatedData.role
    );

    res.status(201).json({
        ok: true,
        data: association,
        message: 'Recipient associated with property successfully',
    });
}));

// DELETE /api/recipients/:id/properties/:propertyId - Remove property association
router.delete('/:id/properties/:propertyId', validateUuid('id'), validateUuid('propertyId'), asyncHandler(async (req, res) => {
    await removePropertyRecipient(req.params.propertyId, req.params.id);

    res.json({
        ok: true,
        message: 'Property association removed successfully',
    });
}));

module.exports = router;
