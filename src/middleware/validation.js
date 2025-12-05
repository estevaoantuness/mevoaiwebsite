const Joi = require('joi');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const uuidSchema = Joi.string().uuid();

// Address schema (reusable)
const addressSchema = Joi.object({
    address_street: Joi.string().max(255),
    address_number: Joi.string().max(20),
    address_complement: Joi.string().max(255).allow(null, ''),
    address_neighborhood: Joi.string().max(100),
    address_city: Joi.string().max(100),
    address_state: Joi.string().length(2).uppercase(), // BR state codes
    address_zipcode: Joi.string().pattern(/^\d{5}-?\d{3}$/), // Brazilian CEP
});

// User schema (authentication)
const userSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(255).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    role: Joi.string().valid('admin', 'agent', 'viewer').default('agent'),
    avatar_url: Joi.string().uri().allow(null, ''),
    active: Joi.boolean().default(true),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

// Client schema (enhanced)
const clientSchema = Joi.object({
    user_id: uuidSchema.allow(null),
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    whatsapp_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    cpf_cnpj: Joi.string().pattern(/^\d{11}$|^\d{14}$/).allow(null, ''), // CPF (11) or CNPJ (14)
    address_street: Joi.string().max(255).allow(null, ''),
    address_number: Joi.string().max(20).allow(null, ''),
    address_complement: Joi.string().max(255).allow(null, ''),
    address_neighborhood: Joi.string().max(100).allow(null, ''),
    address_city: Joi.string().max(100).allow(null, ''),
    address_state: Joi.string().length(2).uppercase().allow(null, ''),
    address_zipcode: Joi.string().pattern(/^\d{5}-?\d{3}$/).allow(null, ''),
    avatar_url: Joi.string().uri().allow(null, ''),
    time_zone: Joi.string().default('America/Sao_Paulo'),
    active: Joi.boolean().default(true),
});

// Property schema (enhanced)
const propertySchema = Joi.object({
    client_id: uuidSchema.required(),
    name: Joi.string().min(2).max(255).required(),
    label: Joi.string().max(255).allow(null, ''),
    address_street: Joi.string().max(255).required(),
    address_number: Joi.string().max(20).required(),
    address_complement: Joi.string().max(255).allow(null, ''),
    address_neighborhood: Joi.string().max(100).required(),
    address_city: Joi.string().max(100).required(),
    address_state: Joi.string().length(2).uppercase().required(),
    address_zipcode: Joi.string().pattern(/^\d{5}-?\d{3}$/).required(),
    address_lat: Joi.number().min(-90).max(90).allow(null),
    address_lng: Joi.number().min(-180).max(180).allow(null),
    property_type: Joi.string().valid('apartment', 'house', 'condo', 'studio', 'other').default('apartment'),
    bedrooms: Joi.number().integer().min(0).allow(null),
    bathrooms: Joi.number().integer().min(0).allow(null),
    square_meters: Joi.number().positive().allow(null),
    time_zone: Joi.string().default('America/Sao_Paulo'),
    cleaning_notes: Joi.string().allow(null, ''),
    active: Joi.boolean().default(true),
});

// Calendar schema
const calendarSchema = Joi.object({
    property_id: uuidSchema.required(),
    platform: Joi.string().valid('airbnb', 'booking', 'vrbo', 'custom').required(),
    url: Joi.string().uri().required(),
    sync_enabled: Joi.boolean().default(true),
    active: Joi.boolean().default(true),
});

// Recipient schema (enhanced)
const recipientSchema = Joi.object({
    client_id: uuidSchema.required(),
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    cpf: Joi.string().pattern(/^\d{11}$/).allow(null, ''), // CPF only
    address_street: Joi.string().max(255).allow(null, ''),
    address_number: Joi.string().max(20).allow(null, ''),
    address_complement: Joi.string().max(255).allow(null, ''),
    address_neighborhood: Joi.string().max(100).allow(null, ''),
    address_city: Joi.string().max(100).allow(null, ''),
    address_state: Joi.string().length(2).uppercase().allow(null, ''),
    address_zipcode: Joi.string().pattern(/^\d{5}-?\d{3}$/).allow(null, ''),
    avatar_url: Joi.string().uri().allow(null, ''),
    channel: Joi.string().valid('whatsapp', 'sms', 'email').default('whatsapp'),
    rating: Joi.number().min(0).max(5).default(0),
    total_cleanings: Joi.number().integer().min(0).default(0),
    active: Joi.boolean().default(true),
});

// Property-Recipient association
const propertyRecipientSchema = Joi.object({
    recipient_id: uuidSchema.required(),
    role: Joi.string().valid('cleaner', 'maintenance', 'manager', 'other').default('cleaner'),
});

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            return res.status(400).json({
                ok: false,
                error: 'Validation failed',
                details: errors,
            });
        }

        req.validatedData = value;
        next();
    };
};

const validateUuid = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        const { error } = uuidSchema.validate(id);

        if (error) {
            return res.status(400).json({
                ok: false,
                error: `Invalid UUID format for ${paramName}`,
            });
        }

        next();
    };
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    validate,
    validateUuid,
    schemas: {
        user: userSchema,
        login: loginSchema,
        client: clientSchema,
        property: propertySchema,
        calendar: calendarSchema,
        recipient: recipientSchema,
        propertyRecipient: propertyRecipientSchema,
        address: addressSchema,
    },
};
