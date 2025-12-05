const express = require('express');
const clientsRouter = require('./clients');
const propertiesRouter = require('./properties');
const calendarsRouter = require('./calendars');
const recipientsRouter = require('./recipients');
const usersRouter = require('./users');

const router = express.Router();

// Mount all routes
router.use('/users', usersRouter);
router.use('/clients', clientsRouter);
router.use('/properties', propertiesRouter);
router.use('/calendars', calendarsRouter);
router.use('/recipients', recipientsRouter);

// API root endpoint
router.get('/', (req, res) => {
    res.json({
        ok: true,
        message: 'Mevo API',
        version: '0.2.0',
        endpoints: {
            users: '/api/users',
            clients: '/api/clients',
            properties: '/api/properties',
            calendars: '/api/calendars',
            recipients: '/api/recipients',
        },
    });
});

module.exports = router;
