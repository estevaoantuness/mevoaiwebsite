import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Criar/conectar ao banco
const db = new Database(join(__dirname, 'mevo.sqlite'));

// Executar schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Criar usuário admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@mevo.app');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('admin@mevo.app', hash);
  console.log('Usuário admin criado: admin@mevo.app / admin');
}

export default db;
