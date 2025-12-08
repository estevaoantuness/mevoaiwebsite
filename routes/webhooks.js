import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import webhookService from '../services/webhook.service.js';

const router = Router();

// Proteger todas as rotas
router.use(authMiddleware);

// GET /api/webhooks - Listar webhooks do usuário
router.get('/', async (req, res) => {
  try {
    const webhooks = await webhookService.list(req.userId);
    res.json(webhooks);
  } catch (error) {
    console.error('Erro ao listar webhooks:', error);
    res.status(500).json({ error: 'Erro ao listar webhooks' });
  }
});

// GET /api/webhooks/events - Listar eventos disponíveis
router.get('/events', (req, res) => {
  res.json(webhookService.getAvailableEvents());
});

// GET /api/webhooks/:id - Buscar um webhook
router.get('/:id', async (req, res) => {
  try {
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.userId
      }
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    res.json(webhook);
  } catch (error) {
    console.error('Erro ao buscar webhook:', error);
    res.status(500).json({ error: 'Erro ao buscar webhook' });
  }
});

// POST /api/webhooks - Criar novo webhook
router.post('/', async (req, res) => {
  try {
    const { name, url, events, secret } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }

    // Validar eventos
    const availableEvents = webhookService.getAvailableEvents().map(e => e.name);
    if (events && events.length > 0) {
      const invalidEvents = events.filter(e => !availableEvents.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          error: 'Eventos inválidos',
          invalidEvents,
          availableEvents
        });
      }
    }

    const webhook = await webhookService.create({
      name,
      url,
      events: events || [],
      secret,
      userId: req.userId
    });

    res.status(201).json(webhook);
  } catch (error) {
    console.error('Erro ao criar webhook:', error);
    res.status(500).json({ error: 'Erro ao criar webhook' });
  }
});

// PUT /api/webhooks/:id - Atualizar webhook
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, url, events, isActive } = req.body;

    // Validar URL se fornecida
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'URL inválida' });
      }
    }

    const webhook = await webhookService.update(id, {
      name,
      url,
      events,
      isActive
    }, req.userId);

    res.json(webhook);
  } catch (error) {
    console.error('Erro ao atualizar webhook:', error);
    res.status(500).json({ error: 'Erro ao atualizar webhook' });
  }
});

// DELETE /api/webhooks/:id - Remover webhook
router.delete('/:id', async (req, res) => {
  try {
    await webhookService.delete(parseInt(req.params.id), req.userId);
    res.json({ message: 'Webhook removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover webhook:', error);
    res.status(500).json({ error: 'Erro ao remover webhook' });
  }
});

// POST /api/webhooks/:id/test - Testar webhook
router.post('/:id/test', async (req, res) => {
  try {
    const result = await webhookService.test(parseInt(req.params.id), req.userId);
    res.json(result);
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
    res.status(500).json({ error: error.message || 'Erro ao testar webhook' });
  }
});

// POST /api/webhooks/:id/regenerate-secret - Regenerar secret
router.post('/:id/regenerate-secret', async (req, res) => {
  try {
    const webhook = await webhookService.regenerateSecret(parseInt(req.params.id), req.userId);
    res.json({ secret: webhook.secret });
  } catch (error) {
    console.error('Erro ao regenerar secret:', error);
    res.status(500).json({ error: 'Erro ao regenerar secret' });
  }
});

// GET /api/webhooks/:id/logs - Histórico de logs do webhook
router.get('/:id/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await webhookService.getLogs(
      parseInt(req.params.id),
      parseInt(limit),
      req.userId
    );
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar logs' });
  }
});

export default router;
