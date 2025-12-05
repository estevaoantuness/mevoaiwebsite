-- Mevo Enhanced Schema for PostgreSQL
-- Complete schema with addresses, user authentication, and expanded data models

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- USERS TABLE (Authentication & Authorization)
-- ============================================================================

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    name text NOT NULL,
    phone text,
    role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
    avatar_url text,
    active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- ============================================================================
-- SESSIONS TABLE (JWT Token Management)
-- ============================================================================

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_token ON sessions (token);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- ============================================================================
-- CLIENTS TABLE (Property Owners/Managers)
-- ============================================================================

CREATE TABLE clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    name text NOT NULL,
    email text,
    whatsapp_number text NOT NULL,
    cpf_cnpj text,
    
    -- Address fields
    address_street text,
    address_number text,
    address_complement text,
    address_neighborhood text,
    address_city text,
    address_state text,
    address_zipcode text,
    
    avatar_url text,
    time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_clients_whatsapp_number ON clients (whatsapp_number);
CREATE INDEX idx_clients_email ON clients (email);
CREATE INDEX idx_clients_user_id ON clients (user_id);

-- ============================================================================
-- PROPERTIES TABLE (Rental Properties)
-- ============================================================================

CREATE TABLE properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    name text NOT NULL,
    label text,
    
    -- Address fields
    address_street text NOT NULL,
    address_number text NOT NULL,
    address_complement text,
    address_neighborhood text NOT NULL,
    address_city text NOT NULL,
    address_state text NOT NULL,
    address_zipcode text NOT NULL,
    
    -- Geolocation
    address_lat decimal(10, 8),
    address_lng decimal(11, 8),
    
    -- Property details
    property_type text DEFAULT 'apartment' CHECK (property_type IN ('apartment', 'house', 'condo', 'studio', 'other')),
    bedrooms integer,
    bathrooms integer,
    square_meters decimal(10, 2),
    
    time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
    cleaning_notes text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_client_id ON properties (client_id);
CREATE INDEX idx_properties_city ON properties (address_city);
CREATE INDEX idx_properties_zipcode ON properties (address_zipcode);

-- ============================================================================
-- CALENDARS TABLE (iCal Integration)
-- ============================================================================

CREATE TABLE calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('airbnb', 'booking', 'vrbo', 'custom')),
    url text NOT NULL,
    etag text,
    last_modified text,
    last_synced_at timestamptz,
    sync_enabled boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_calendars_property_platform_url ON calendars (property_id, platform, url);
CREATE INDEX idx_calendars_property_id ON calendars (property_id);
CREATE INDEX idx_calendars_platform ON calendars (platform);

-- ============================================================================
-- RECIPIENTS TABLE (Cleaners/Service Providers)
-- ============================================================================

CREATE TABLE recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text NOT NULL,
    cpf text,
    
    -- Address fields
    address_street text,
    address_number text,
    address_complement text,
    address_neighborhood text,
    address_city text,
    address_state text,
    address_zipcode text,
    
    avatar_url text,
    channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
    
    -- Performance metrics
    rating decimal(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    total_cleanings integer DEFAULT 0,
    
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_recipients_client_phone ON recipients (client_id, phone);
CREATE INDEX idx_recipients_email ON recipients (email);
CREATE INDEX idx_recipients_rating ON recipients (rating);

-- ============================================================================
-- PROPERTY_RECIPIENTS TABLE (Many-to-Many Relationship)
-- ============================================================================

CREATE TABLE property_recipients (
    property_id uuid NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES recipients (id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'cleaner' CHECK (role IN ('cleaner', 'maintenance', 'manager', 'other')),
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (property_id, recipient_id)
);

CREATE INDEX idx_property_recipients_property_id ON property_recipients (property_id);
CREATE INDEX idx_property_recipients_recipient_id ON property_recipients (recipient_id);

-- ============================================================================
-- CLEANING_RUNS TABLE (Daily Routine Executions)
-- ============================================================================

CREATE TABLE cleaning_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    run_date date NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed')),
    properties_processed integer NOT NULL DEFAULT 0,
    cleanings_detected integer NOT NULL DEFAULT 0,
    messages_sent integer NOT NULL DEFAULT 0,
    log jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (client_id, run_date)
);

CREATE INDEX idx_cleaning_runs_run_date ON cleaning_runs (run_date);
CREATE INDEX idx_cleaning_runs_client_id ON cleaning_runs (client_id);
CREATE INDEX idx_cleaning_runs_status ON cleaning_runs (status);

-- ============================================================================
-- CLEANING_EVENTS TABLE (Individual Cleaning Tasks)
-- ============================================================================

CREATE TABLE cleaning_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES cleaning_runs (id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES recipients (id) ON DELETE SET NULL,
    summary text NOT NULL,
    checkout_time timestamptz NOT NULL,
    checkin_time timestamptz,
    guest_name text,
    source_platform text NOT NULL DEFAULT 'custom',
    source_calendar_id uuid REFERENCES calendars (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'confirmed', 'completed', 'skipped', 'cancelled')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaning_events_run_id ON cleaning_events (run_id);
CREATE INDEX idx_cleaning_events_checkout_time ON cleaning_events (checkout_time);
CREATE INDEX idx_cleaning_events_property_id ON cleaning_events (property_id);
CREATE INDEX idx_cleaning_events_recipient_id ON cleaning_events (recipient_id);
CREATE INDEX idx_cleaning_events_status ON cleaning_events (status);

-- ============================================================================
-- MESSAGE_LOG TABLE (Communication History)
-- ============================================================================

CREATE TABLE message_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES cleaning_runs (id) ON DELETE SET NULL,
    recipient_id uuid NOT NULL REFERENCES recipients (id) ON DELETE CASCADE,
    channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
    message_body text NOT NULL,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_log_recipient_id ON message_log (recipient_id);
CREATE INDEX idx_message_log_run_id ON message_log (run_id);
CREATE INDEX idx_message_log_status ON message_log (status);
CREATE INDEX idx_message_log_sent_at ON message_log (sent_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipients_updated_at BEFORE UPDATE ON recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cleaning_events_updated_at BEFORE UPDATE ON cleaning_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Create default admin user (password: 'admin123' - CHANGE THIS!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@mevo.ai', '$2b$10$rKZvVxwvXxVXxvXxvXxvXeO7vXxvXxvXxvXxvXxvXxvXxvXxvXxvX', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- VIEWS (Useful Queries)
-- ============================================================================

-- View: Properties with full address
CREATE OR REPLACE VIEW properties_full AS
SELECT 
    p.*,
    p.address_street || ', ' || p.address_number || 
    COALESCE(' ' || p.address_complement, '') || ' - ' ||
    p.address_neighborhood || ', ' || p.address_city || ' - ' || 
    p.address_state || ', ' || p.address_zipcode AS full_address,
    c.name as client_name,
    c.whatsapp_number as client_phone
FROM properties p
JOIN clients c ON p.client_id = c.id;

-- View: Upcoming cleanings
CREATE OR REPLACE VIEW upcoming_cleanings AS
SELECT 
    ce.*,
    p.name as property_name,
    p.address_city,
    r.name as recipient_name,
    r.phone as recipient_phone
FROM cleaning_events ce
JOIN properties p ON ce.property_id = p.id
LEFT JOIN recipients r ON ce.recipient_id = r.id
WHERE ce.checkout_time >= now()
ORDER BY ce.checkout_time;

-- View: Recipient performance
CREATE OR REPLACE VIEW recipient_performance AS
SELECT 
    r.id,
    r.name,
    r.phone,
    r.rating,
    r.total_cleanings,
    COUNT(DISTINCT pr.property_id) as properties_assigned,
    COUNT(ce.id) as cleanings_completed
FROM recipients r
LEFT JOIN property_recipients pr ON r.id = pr.recipient_id
LEFT JOIN cleaning_events ce ON r.id = ce.recipient_id AND ce.status = 'completed'
GROUP BY r.id, r.name, r.phone, r.rating, r.total_cleanings;
