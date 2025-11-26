import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'mevo.sqlite');

let db = null;

// Wrapper para manter compatibilidade com better-sqlite3 API
class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.sqlDb.run(sql, params);
        self.save();
        return { lastInsertRowid: self.sqlDb.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
      },
      get(...params) {
        const stmt = self.sqlDb.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self.sqlDb.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) {
    this.sqlDb.run(sql);
    this.save();
  }

  save() {
    const data = this.sqlDb.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

// Inicializa o banco
async function initDb() {
  const SQL = await initSqlJs();

  let sqlDb;
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DatabaseWrapper(sqlDb);

  // Executar schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  // Executar cada statement separadamente
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        db.sqlDb.run(stmt);
      } catch (e) {
        // Ignorar erros de "já existe"
      }
    }
  }
  db.save();

  // Criar usuário admin padrão se não existir
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@mevo.app');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('admin@mevo.app', hash);
    console.log('Usuário admin criado: admin@mevo.app / admin');
  }

  return db;
}

// Exporta uma promise que resolve para o db
const dbPromise = initDb();

export default dbPromise;
