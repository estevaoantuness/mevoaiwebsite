-- Schema do banco de dados Mevo
-- SQLite

-- Configurações globais
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Inserir configuração padrão
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_checkout_time', '11:00');

-- Usuários (admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Imóveis
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ical_airbnb TEXT,
  ical_booking TEXT,
  employee_name TEXT NOT NULL,
  employee_phone TEXT NOT NULL,
  checkout_time TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de mensagens
CREATE TABLE IF NOT EXISTS message_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER,
  employee_phone TEXT,
  message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'sent',
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- Eventos processados (evita duplicatas)
CREATE TABLE IF NOT EXISTS processed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER,
  event_uid TEXT,
  event_date DATE,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, event_uid, event_date),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
