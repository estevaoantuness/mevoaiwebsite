import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import schedulerService from '../services/scheduler.service.js';
import queueService from '../services/queue.service.js';
import notificationService from '../services/notification.service.js';

const router = Router();

// Proteger todas as rotas
router.use(authMiddleware);

// GET /api/automation/status - Status geral da automação
router.get('/status', async (req, res) => {
  try {
    const schedulerStatus = schedulerService.getStatus();
    const queueStats = await queueService.getStats();
    const notificationProviders = notificationService.getProvidersStatus();

    res.json({
      scheduler: schedulerStatus,
      queues: queueStats,
      notifications: notificationProviders
    });
  } catch (error) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
});

// POST /api/automation/jobs/:name/run - Executar job manualmente
router.post('/jobs/:name/run', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await schedulerService.runJob(name);

    res.json({
      message: `Job '${name}' executado com sucesso`,
      result
    });
  } catch (error) {
    console.error('Erro ao executar job:', error);
    res.status(500).json({ error: error.message || 'Erro ao executar job' });
  }
});

// GET /api/automation/jobs - Listar jobs disponíveis
router.get('/jobs', (req, res) => {
  res.json([
    {
      name: 'calendar-sync',
      description: 'Sincroniza calendários iCal de todas as propriedades',
      schedule: 'A cada 30 minutos'
    },
    {
      name: 'checkin-reminders',
      description: 'Envia lembretes de check-in para hóspedes (check-ins de amanhã)',
      schedule: '08:00 diariamente'
    },
    {
      name: 'checkout-reminders',
      description: 'Envia lembretes de checkout para hóspedes (checkouts de amanhã)',
      schedule: '08:00 diariamente'
    },
    {
      name: 'cleaning-notifications',
      description: 'Notifica funcionários sobre limpezas do dia',
      schedule: '07:00 diariamente'
    },
    {
      name: 'review-requests',
      description: 'Envia solicitações de avaliação (checkouts de ontem)',
      schedule: '18:00 diariamente'
    },
    {
      name: 'cleanup',
      description: 'Limpa dados antigos do banco de dados',
      schedule: '03:00 aos domingos'
    },
    {
      name: 'daily-summary',
      description: 'Gera resumo diário de reservas',
      schedule: '06:00 diariamente'
    }
  ]);
});

// POST /api/automation/sync-calendar/:propertyId - Sincronizar calendário de uma propriedade
router.post('/sync-calendar/:propertyId', async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);

    // Verificar se a propriedade pertence ao usuário
    const property = await prisma.property.findFirst({
      where: { id: propertyId, userId: req.userId }
    });

    if (!property) {
      return res.status(404).json({ error: 'Propriedade não encontrada' });
    }

    const result = await queueService.syncPropertyCalendar(propertyId);

    res.json({
      message: 'Calendário sincronizado com sucesso',
      ...result
    });
  } catch (error) {
    console.error('Erro ao sincronizar calendário:', error);
    res.status(500).json({ error: 'Erro ao sincronizar calendário' });
  }
});

// POST /api/automation/send-notification - Enviar notificação manual
router.post('/send-notification', async (req, res) => {
  try {
    const { channel, recipient, message, subject, type } = req.body;

    if (!channel || !recipient || !message) {
      return res.status(400).json({
        error: 'Canal, destinatário e mensagem são obrigatórios'
      });
    }

    const validChannels = ['whatsapp', 'email', 'sms'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({
        error: 'Canal inválido',
        validChannels
      });
    }

    const result = await notificationService.send({
      channel,
      recipient,
      message,
      subject,
      type: type || 'custom',
      userId: req.userId
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: error.message || 'Erro ao enviar notificação' });
  }
});

// GET /api/automation/notifications - Histórico de notificações
router.get('/notifications', async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;

    const where = { userId: req.userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [notifications, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.notificationLog.count({ where })
    ]);

    res.json({
      notifications,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// GET /api/automation/notifications/stats - Estatísticas de notificações
router.get('/notifications/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalSent,
      sentToday,
      sentThisMonth,
      failedThisMonth,
      byChannel,
      byType
    ] = await Promise.all([
      prisma.notificationLog.count({
        where: { userId: req.userId, status: 'sent' }
      }),
      prisma.notificationLog.count({
        where: {
          userId: req.userId,
          status: 'sent',
          createdAt: { gte: today }
        }
      }),
      prisma.notificationLog.count({
        where: {
          userId: req.userId,
          status: 'sent',
          createdAt: { gte: thisMonth }
        }
      }),
      prisma.notificationLog.count({
        where: {
          userId: req.userId,
          status: 'failed',
          createdAt: { gte: thisMonth }
        }
      }),
      prisma.notificationLog.groupBy({
        by: ['channel'],
        where: { userId: req.userId },
        _count: true
      }),
      prisma.notificationLog.groupBy({
        by: ['type'],
        where: { userId: req.userId },
        _count: true
      })
    ]);

    res.json({
      totalSent,
      sentToday,
      sentThisMonth,
      failedThisMonth,
      byChannel: byChannel.reduce((acc, item) => {
        acc[item.channel] = item._count;
        return acc;
      }, {}),
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// POST /api/automation/schedule - Agendar notificação para data futura
router.post('/schedule', async (req, res) => {
  try {
    const { type, data, runAt } = req.body;

    if (!type || !data || !runAt) {
      return res.status(400).json({
        error: 'Tipo, dados e data de execução são obrigatórios'
      });
    }

    const runAtDate = new Date(runAt);
    if (runAtDate <= new Date()) {
      return res.status(400).json({
        error: 'Data de execução deve ser no futuro'
      });
    }

    const delay = runAtDate.getTime() - Date.now();

    // Salvar no banco
    const job = await prisma.scheduledJob.create({
      data: {
        name: `Scheduled ${type}`,
        type: 'send_notification',
        runAt: runAtDate,
        payload: JSON.stringify({ type, ...data }),
        status: 'pending',
        userId: req.userId
      }
    });

    // Agendar na fila
    await queueService.scheduleJob('notification', { type, data }, delay);

    res.status(201).json({
      message: 'Notificação agendada com sucesso',
      job
    });
  } catch (error) {
    console.error('Erro ao agendar notificação:', error);
    res.status(500).json({ error: 'Erro ao agendar notificação' });
  }
});

// GET /api/automation/scheduled - Listar jobs agendados
router.get('/scheduled', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const where = { userId: req.userId };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.scheduledJob.findMany({
        where,
        orderBy: { runAt: 'asc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.scheduledJob.count({ where })
    ]);

    res.json({
      jobs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao listar jobs agendados:', error);
    res.status(500).json({ error: 'Erro ao listar jobs agendados' });
  }
});

// DELETE /api/automation/scheduled/:id - Cancelar job agendado
router.delete('/scheduled/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const job = await prisma.scheduledJob.findFirst({
      where: { id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas jobs pendentes podem ser cancelados' });
    }

    await prisma.scheduledJob.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.json({ message: 'Job cancelado com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar job:', error);
    res.status(500).json({ error: 'Erro ao cancelar job' });
  }
});

export default router;
