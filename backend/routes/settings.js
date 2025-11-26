import { Router } from 'express';
import dbPromise from '../database/db.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

let db;
dbPromise.then(d => db = d);

const router = Router();

router.use(authMiddleware);

// GET /api/settings - Retorna todas as configurações
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();

  // Converte para objeto { key: value }
  const settingsObj = settings.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});

  res.json(settingsObj);
});

// PUT /api/settings/:key - Atualiza uma configuração
router.put('/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Valor é obrigatório' });
  }

  // Upsert: insere ou atualiza
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);

  res.json({ key, value });
});

export default router;
