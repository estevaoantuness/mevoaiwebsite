import { Router } from 'express';
import dayjs from 'dayjs';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import workerService from '../services/worker.service.js';

const router = Router();

// Proteger todas as rotas do dashboard
router.use(authMiddleware);

// GET /api/dashboard/stats - Estatísticas do usuário logado
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Busca IDs das propriedades do usuário
    const userProperties = await prisma.property.findMany({
      where: { userId },
      select: { id: true }
    });
    const propertyIds = userProperties.map(p => p.id);

    const [totalProperties, messagesToday, messagesThisMonth, failedMessages] = await Promise.all([
      prisma.property.count({
        where: { userId }
      }),

      prisma.messageLog.count({
        where: {
          propertyId: { in: propertyIds },
          sentAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),

      prisma.messageLog.count({
        where: {
          propertyId: { in: propertyIds },
          sentAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),

      prisma.messageLog.count({
        where: {
          propertyId: { in: propertyIds },
          status: 'failed',
          sentAt: {
            gte: today,
            lt: tomorrow
          }
        }
      })
    ]);

    res.json({
      totalProperties,
      messagesToday,
      messagesThisMonth,
      failedMessages
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/logs - Histórico de mensagens do usuário
router.get('/logs', async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Busca IDs das propriedades do usuário
    const userProperties = await prisma.property.findMany({
      where: { userId },
      select: { id: true }
    });
    const propertyIds = userProperties.map(p => p.id);

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where: {
          propertyId: { in: propertyIds }
        },
        include: {
          property: {
            select: { name: true }
          }
        },
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset
      }),

      prisma.messageLog.count({
        where: {
          propertyId: { in: propertyIds }
        }
      })
    ]);

    // Mapear para manter compatibilidade com frontend
    const mappedLogs = logs.map(log => ({
      id: log.id,
      property_id: log.propertyId,
      employee_phone: log.employeePhone,
      message: log.message,
      sent_at: log.sentAt,
      status: log.status,
      property_name: log.property?.name || null
    }));

    res.json({
      logs: mappedLogs,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

// POST /api/dashboard/run-worker - Executar worker para o usuário logado
router.post('/run-worker', async (req, res) => {
  try {
    const userId = req.userId;
    await workerService.runNow(userId);
    res.json({ message: 'Worker executado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
