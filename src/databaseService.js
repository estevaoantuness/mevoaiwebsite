const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('Executed query', { text, duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Database query error:', { text, error: error.message });
        throw error;
    }
};

// ============================================================================
// USERS (Authentication)
// ============================================================================

const getUsers = async (filters = {}) => {
    let queryText = 'SELECT id, email, name, phone, role, avatar_url, active, last_login_at, created_at, updated_at FROM users WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.role) {
        queryText += ` AND role = $${paramCount}`;
        params.push(filters.role);
        paramCount++;
    }

    if (filters.activeOnly !== false) {
        queryText += ` AND active = true`;
    }

    queryText += ' ORDER BY name';

    const { rows } = await query(queryText, params);
    return rows;
};

const getUserById = async (id) => {
    const { rows } = await query(
        'SELECT id, email, name, phone, role, avatar_url, active, last_login_at, created_at, updated_at FROM users WHERE id = $1',
        [id]
    );
    return rows[0];
};

const getUserByEmail = async (email) => {
    const { rows } = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );
    return rows[0];
};

const createUser = async (userData) => {
    const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, phone, role, avatar_url, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, name, phone, role, avatar_url, active, created_at, updated_at`,
        [
            userData.email,
            userData.password_hash,
            userData.name,
            userData.phone || null,
            userData.role || 'agent',
            userData.avatar_url || null,
            userData.active !== undefined ? userData.active : true,
        ]
    );
    return rows[0];
};

const updateUser = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
        if (key !== 'id' && key !== 'created_at') {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) return getUserById(id);

    values.push(id);
    const { rows } = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
     RETURNING id, email, name, phone, role, avatar_url, active, last_login_at, created_at, updated_at`,
        values
    );
    return rows[0];
};

const updateLastLogin = async (id) => {
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
};

// ============================================================================
// SESSIONS
// ============================================================================

const createSession = async (userId, token, expiresAt) => {
    const { rows } = await query(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *',
        [userId, token, expiresAt]
    );
    return rows[0];
};

const getSessionByToken = async (token) => {
    const { rows } = await query(
        'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
    );
    return rows[0];
};

const deleteSession = async (token) => {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
};

const deleteExpiredSessions = async () => {
    await query('DELETE FROM sessions WHERE expires_at <= NOW()');
};

// ============================================================================
// CLIENTS
// ============================================================================

const getClients = async (filters = {}) => {
    let queryText = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.userId) {
        queryText += ` AND user_id = $${paramCount}`;
        params.push(filters.userId);
        paramCount++;
    }

    if (filters.activeOnly !== false) {
        queryText += ` AND active = true`;
    }

    queryText += ' ORDER BY name';

    const { rows } = await query(queryText, params);
    return rows;
};

const getClientById = async (id) => {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [id]);
    return rows[0];
};

const createClient = async (clientData) => {
    const { rows } = await query(
        `INSERT INTO clients (
      user_id, name, email, whatsapp_number, cpf_cnpj,
      address_street, address_number, address_complement, address_neighborhood,
      address_city, address_state, address_zipcode,
      avatar_url, time_zone, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
        [
            clientData.user_id || null,
            clientData.name,
            clientData.email || null,
            clientData.whatsapp_number,
            clientData.cpf_cnpj || null,
            clientData.address_street || null,
            clientData.address_number || null,
            clientData.address_complement || null,
            clientData.address_neighborhood || null,
            clientData.address_city || null,
            clientData.address_state || null,
            clientData.address_zipcode || null,
            clientData.avatar_url || null,
            clientData.time_zone || 'America/Sao_Paulo',
            clientData.active !== undefined ? clientData.active : true,
        ]
    );
    return rows[0];
};

const updateClient = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
        'user_id', 'name', 'email', 'whatsapp_number', 'cpf_cnpj',
        'address_street', 'address_number', 'address_complement', 'address_neighborhood',
        'address_city', 'address_state', 'address_zipcode',
        'avatar_url', 'time_zone', 'active'
    ];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) return getClientById(id);

    values.push(id);
    const { rows } = await query(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

const deleteClient = async (id) => {
    return updateClient(id, { active: false });
};

// ============================================================================
// PROPERTIES
// ============================================================================

const getProperties = async (filters = {}) => {
    let queryText = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.clientId) {
        queryText += ` AND client_id = $${paramCount}`;
        params.push(filters.clientId);
        paramCount++;
    }

    if (filters.city) {
        queryText += ` AND address_city = $${paramCount}`;
        params.push(filters.city);
        paramCount++;
    }

    if (filters.activeOnly !== false) {
        queryText += ` AND active = true`;
    }

    queryText += ' ORDER BY name';

    const { rows } = await query(queryText, params);
    return rows;
};

const getPropertyById = async (id) => {
    const { rows } = await query('SELECT * FROM properties WHERE id = $1', [id]);
    return rows[0];
};

const createProperty = async (propertyData) => {
    const { rows } = await query(
        `INSERT INTO properties (
      client_id, name, label,
      address_street, address_number, address_complement, address_neighborhood,
      address_city, address_state, address_zipcode,
      address_lat, address_lng,
      property_type, bedrooms, bathrooms, square_meters,
      time_zone, cleaning_notes, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *`,
        [
            propertyData.client_id,
            propertyData.name,
            propertyData.label || null,
            propertyData.address_street,
            propertyData.address_number,
            propertyData.address_complement || null,
            propertyData.address_neighborhood,
            propertyData.address_city,
            propertyData.address_state,
            propertyData.address_zipcode,
            propertyData.address_lat || null,
            propertyData.address_lng || null,
            propertyData.property_type || 'apartment',
            propertyData.bedrooms || null,
            propertyData.bathrooms || null,
            propertyData.square_meters || null,
            propertyData.time_zone || 'America/Sao_Paulo',
            propertyData.cleaning_notes || null,
            propertyData.active !== undefined ? propertyData.active : true,
        ]
    );
    return rows[0];
};

const updateProperty = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
        'client_id', 'name', 'label',
        'address_street', 'address_number', 'address_complement', 'address_neighborhood',
        'address_city', 'address_state', 'address_zipcode',
        'address_lat', 'address_lng',
        'property_type', 'bedrooms', 'bathrooms', 'square_meters',
        'time_zone', 'cleaning_notes', 'active'
    ];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) return getPropertyById(id);

    values.push(id);
    const { rows } = await query(
        `UPDATE properties SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

const deleteProperty = async (id) => {
    return updateProperty(id, { active: false });
};

// ============================================================================
// CALENDARS
// ============================================================================

const getCalendars = async (filters = {}) => {
    let queryText = 'SELECT * FROM calendars WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.propertyId) {
        queryText += ` AND property_id = $${paramCount}`;
        params.push(filters.propertyId);
        paramCount++;
    }

    if (filters.platform) {
        queryText += ` AND platform = $${paramCount}`;
        params.push(filters.platform);
        paramCount++;
    }

    if (filters.activeOnly !== false) {
        queryText += ` AND active = true`;
    }

    queryText += ' ORDER BY created_at';

    const { rows } = await query(queryText, params);
    return rows;
};

const getCalendarById = async (id) => {
    const { rows } = await query('SELECT * FROM calendars WHERE id = $1', [id]);
    return rows[0];
};

const createCalendar = async (calendarData) => {
    const { rows } = await query(
        `INSERT INTO calendars (property_id, platform, url, sync_enabled, active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
            calendarData.property_id,
            calendarData.platform,
            calendarData.url,
            calendarData.sync_enabled !== undefined ? calendarData.sync_enabled : true,
            calendarData.active !== undefined ? calendarData.active : true,
        ]
    );
    return rows[0];
};

const updateCalendar = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['property_id', 'platform', 'url', 'sync_enabled', 'active'];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) return getCalendarById(id);

    values.push(id);
    const { rows } = await query(
        `UPDATE calendars SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

const updateCalendarSync = async (id, etag, lastModified) => {
    const { rows } = await query(
        `UPDATE calendars SET etag = $1, last_modified = $2, last_synced_at = NOW()
     WHERE id = $3 RETURNING *`,
        [etag, lastModified, id]
    );
    return rows[0];
};

const deleteCalendar = async (id) => {
    return updateCalendar(id, { active: false });
};

// ============================================================================
// RECIPIENTS
// ============================================================================

const getRecipients = async (filters = {}) => {
    let queryText = 'SELECT * FROM recipients WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.clientId) {
        queryText += ` AND client_id = $${paramCount}`;
        params.push(filters.clientId);
        paramCount++;
    }

    if (filters.activeOnly !== false) {
        queryText += ` AND active = true`;
    }

    queryText += ' ORDER BY name';

    const { rows } = await query(queryText, params);
    return rows;
};

const getRecipientById = async (id) => {
    const { rows } = await query('SELECT * FROM recipients WHERE id = $1', [id]);
    return rows[0];
};

const createRecipient = async (recipientData) => {
    const { rows } = await query(
        `INSERT INTO recipients (
      client_id, name, email, phone, cpf,
      address_street, address_number, address_complement, address_neighborhood,
      address_city, address_state, address_zipcode,
      avatar_url, channel, rating, total_cleanings, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
        [
            recipientData.client_id,
            recipientData.name,
            recipientData.email || null,
            recipientData.phone,
            recipientData.cpf || null,
            recipientData.address_street || null,
            recipientData.address_number || null,
            recipientData.address_complement || null,
            recipientData.address_neighborhood || null,
            recipientData.address_city || null,
            recipientData.address_state || null,
            recipientData.address_zipcode || null,
            recipientData.avatar_url || null,
            recipientData.channel || 'whatsapp',
            recipientData.rating || 0,
            recipientData.total_cleanings || 0,
            recipientData.active !== undefined ? recipientData.active : true,
        ]
    );
    return rows[0];
};

const updateRecipient = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
        'client_id', 'name', 'email', 'phone', 'cpf',
        'address_street', 'address_number', 'address_complement', 'address_neighborhood',
        'address_city', 'address_state', 'address_zipcode',
        'avatar_url', 'channel', 'rating', 'total_cleanings', 'active'
    ];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) return getRecipientById(id);

    values.push(id);
    const { rows } = await query(
        `UPDATE recipients SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

const deleteRecipient = async (id) => {
    return updateRecipient(id, { active: false });
};

// ============================================================================
// PROPERTY RECIPIENTS (Many-to-Many)
// ============================================================================

const getPropertyRecipients = async (propertyId) => {
    const { rows } = await query(
        `SELECT r.*, pr.role, pr.assigned_at
     FROM property_recipients pr
     JOIN recipients r ON pr.recipient_id = r.id
     WHERE pr.property_id = $1 AND r.active = true`,
        [propertyId]
    );
    return rows;
};

const addPropertyRecipient = async (propertyId, recipientId, role = 'cleaner') => {
    const { rows } = await query(
        `INSERT INTO property_recipients (property_id, recipient_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (property_id, recipient_id) DO UPDATE SET role = $3
     RETURNING *`,
        [propertyId, recipientId, role]
    );
    return rows[0];
};

const removePropertyRecipient = async (propertyId, recipientId) => {
    await query(
        'DELETE FROM property_recipients WHERE property_id = $1 AND recipient_id = $2',
        [propertyId, recipientId]
    );
    return { success: true };
};

// ============================================================================
// CLEANING RUNS
// ============================================================================

const createCleaningRun = async (runData) => {
    const { rows } = await query(
        `INSERT INTO cleaning_runs (client_id, run_date, status, properties_processed, cleanings_detected, messages_sent, log)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
            runData.client_id,
            runData.run_date,
            runData.status || 'pending',
            runData.properties_processed || 0,
            runData.cleanings_detected || 0,
            runData.messages_sent || 0,
            runData.log ? JSON.stringify(runData.log) : null,
        ]
    );
    return rows[0];
};

const updateCleaningRun = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['status', 'finished_at', 'properties_processed', 'cleanings_detected', 'messages_sent', 'log'];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(key === 'log' && updates[key] ? JSON.stringify(updates[key]) : updates[key]);
            paramCount++;
        }
    });

    if (!updates.finished_at && updates.status && updates.status !== 'pending') {
        fields.push(`finished_at = NOW()`);
    }

    if (fields.length === 0) {
        const { rows } = await query('SELECT * FROM cleaning_runs WHERE id = $1', [id]);
        return rows[0];
    }

    values.push(id);
    const { rows } = await query(
        `UPDATE cleaning_runs SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

const getCleaningRuns = async (filters = {}) => {
    let queryText = 'SELECT * FROM cleaning_runs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.clientId) {
        queryText += ` AND client_id = $${paramCount}`;
        params.push(filters.clientId);
        paramCount++;
    }

    if (filters.runDate) {
        queryText += ` AND run_date = $${paramCount}`;
        params.push(filters.runDate);
        paramCount++;
    }

    queryText += ' ORDER BY run_date DESC, created_at DESC';

    const { rows } = await query(queryText, params);
    return rows;
};

// ============================================================================
// CLEANING EVENTS
// ============================================================================

const createCleaningEvent = async (eventData) => {
    const { rows } = await query(
        `INSERT INTO cleaning_events (
      run_id, property_id, recipient_id, summary, checkout_time, checkin_time,
      guest_name, source_platform, source_calendar_id, status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
        [
            eventData.run_id || null,
            eventData.property_id,
            eventData.recipient_id || null,
            eventData.summary,
            eventData.checkout_time,
            eventData.checkin_time || null,
            eventData.guest_name || null,
            eventData.source_platform || 'custom',
            eventData.source_calendar_id || null,
            eventData.status || 'pending',
            eventData.notes || null,
        ]
    );
    return rows[0];
};

const updateCleaningEvent = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['recipient_id', 'status', 'notes'];

    Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        }
    });

    if (fields.length === 0) {
        const { rows } = await query('SELECT * FROM cleaning_events WHERE id = $1', [id]);
        return rows[0];
    }

    values.push(id);
    const { rows } = await query(
        `UPDATE cleaning_events SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

// ============================================================================
// MESSAGE LOG
// ============================================================================

const createMessageLog = async (messageData) => {
    const { rows } = await query(
        `INSERT INTO message_log (run_id, recipient_id, channel, message_body, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
            messageData.run_id || null,
            messageData.recipient_id,
            messageData.channel || 'whatsapp',
            messageData.message_body,
            messageData.status || 'pending',
            messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        ]
    );
    return rows[0];
};

const updateMessageStatus = async (id, status, error = null) => {
    const fields = ['status = $1'];
    const values = [status];
    let paramCount = 2;

    if (error) {
        fields.push(`error = $${paramCount}`);
        values.push(error);
        paramCount++;
    }

    if (status === 'sent') {
        fields.push('sent_at = NOW()');
    } else if (status === 'delivered') {
        fields.push('delivered_at = NOW()');
    } else if (status === 'read') {
        fields.push('read_at = NOW()');
    }

    values.push(id);
    const { rows } = await query(
        `UPDATE message_log SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    return rows[0];
};

// ============================================================================
// CLEANUP
// ============================================================================

const cleanup = async () => {
    await deleteExpiredSessions();
};

// Run cleanup every hour
setInterval(cleanup, 60 * 60 * 1000);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    pool,
    query,

    // Users
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    updateLastLogin,

    // Sessions
    createSession,
    getSessionByToken,
    deleteSession,
    deleteExpiredSessions,

    // Clients
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,

    // Properties
    getProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,

    // Calendars
    getCalendars,
    getCalendarById,
    createCalendar,
    updateCalendar,
    updateCalendarSync,
    deleteCalendar,

    // Recipients
    getRecipients,
    getRecipientById,
    createRecipient,
    updateRecipient,
    deleteRecipient,

    // Property Recipients
    getPropertyRecipients,
    addPropertyRecipient,
    removePropertyRecipient,

    // Cleaning Runs
    createCleaningRun,
    updateCleaningRun,
    getCleaningRuns,

    // Cleaning Events
    createCleaningEvent,
    updateCleaningEvent,

    // Message Log
    createMessageLog,
    updateMessageStatus,
};
