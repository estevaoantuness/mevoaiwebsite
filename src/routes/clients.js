const express = require('express');
const { validate, validateUuid, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
} = require('../supabaseService');

const router = express.Router();

// GET /api/clients - List all clients
router.get('/', asyncHandler(async (req, res) => {
    const activeOnly = req.query.active !== 'false';
    const clients = await getClients(activeOnly);

    res.json({
        ok: true,
        data: clients,
        count: clients.length,
    });
}));

// GET /api/clients/:id - Get client by ID
router.get('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const client = await getClientById(req.params.id);

    if (!client) {
        return res.status(404).json({
            ok: false,
            error: 'Client not found',
        });
    }

    res.json({
        ok: true,
        data: client,
    });
}));

// POST /api/clients - Create new client
router.post('/', validate(schemas.client), asyncHandler(async (req, res) => {
    const client = await createClient(req.validatedData);

    res.status(201).json({
        ok: true,
        data: client,
        message: 'Client created successfully',
    });
}));

// PUT /api/clients/:id - Update client
router.put('/:id', validateUuid('id'), validate(schemas.client.fork(['name', 'whatsapp_number'], (schema) => schema.optional())), asyncHandler(async (req, res) => {
    const client = await updateClient(req.params.id, req.validatedData);

    res.json({
        ok: true,
        data: client,
        message: 'Client updated successfully',
    });
}));

// DELETE /api/clients/:id - Soft delete client
router.delete('/:id', validateUuid('id'), asyncHandler(async (req, res) => {
    const client = await deleteClient(req.params.id);

    res.json({
        ok: true,
        data: client,
        message: 'Client deactivated successfully',
    });
}));

module.exports = router;
