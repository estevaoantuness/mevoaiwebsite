import { Router } from 'express';
import dayjs from 'dayjs';
import dbPromise from '../database/db.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import workerService from '../services/worker.service.js';

let db;
dbPromise.then(d => db = d);

const router = Router();

router.use(authMiddleware);

// GET /api/dashboard/stats - Estatísticas gerais
router.get('/stats', (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');

  const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;

  const messagesToday = db.prepare(`
    SELECT COUNT(*) as count FROM message_logs
    WHERE DATE(sent_at) = ?
  `).get(today).count;

  const messagesThisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM message_logs
    WHERE strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now')
  `).get().count;

  const failedMessages = db.prepare(`
    SELECT COUNT(*) as count FROM message_logs
    WHERE status = 'failed' AND DATE(sent_at) = ?
  `).get(today).count;

  res.json({
    totalProperties,
    messagesToday,
    messagesThisMonth,
    failedMessages
  });
});

// GET /api/logs - Histórico de mensagens
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const logs = db.prepare(`
    SELECT
      ml.*,
      p.name as property_name
    FROM message_logs ml
    LEFT JOIN properties p ON ml.property_id = p.id
    ORDER BY ml.sent_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM message_logs').get().count;

  res.json({
    logs,
    total,
    limit,
    offset
  });
});

// POST /api/dashboard/run-worker - Executar worker manualmente
router.post('/run-worker', async (req, res) => {
  try {
    await workerService.runNow();
    res.json({ message: 'Worker executado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
