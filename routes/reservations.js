import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import webhookService from '../services/webhook.service.js';
import queueService from '../services/queue.service.js';

const router = Router();

// Proteger todas as rotas
router.use(authMiddleware);

// GET /api/reservations - Listar reservas do usuário
router.get('/', async (req, res) => {
  try {
    const {
      propertyId,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const where = { userId: req.userId };

    if (propertyId) {
      where.propertyId = parseInt(propertyId);
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.OR = [];

      if (startDate) {
        where.OR.push({
          checkinDate: { gte: new Date(startDate) }
        });
      }

      if (endDate) {
        where.OR.push({
          checkoutDate: { lte: new Date(endDate) }
        });
      }
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: { checkinDate: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          property: {
            select: { id: true, name: true }
          },
          guest: {
            select: { id: true, name: true, email: true, phone: true }
          }
        }
      }),
      prisma.reservation.count({ where })
    ]);

    res.json({
      reservations,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao listar reservas:', error);
    res.status(500).json({ error: 'Erro ao listar reservas' });
  }
});

// GET /api/reservations/upcoming - Próximas reservas (check-ins nos próximos 7 dias)
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const reservations = await prisma.reservation.findMany({
      where: {
        userId: req.userId,
        status: { in: ['pending', 'confirmed'] },
        checkinDate: {
          gte: today,
          lte: nextWeek
        }
      },
      orderBy: { checkinDate: 'asc' },
      include: {
        property: {
          select: { id: true, name: true }
        },
        guest: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    res.json(reservations);
  } catch (error) {
    console.error('Erro ao buscar próximas reservas:', error);
    res.status(500).json({ error: 'Erro ao buscar próximas reservas' });
  }
});

// GET /api/reservations/today - Reservas de hoje (check-ins e checkouts)
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [checkins, checkouts] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          userId: req.userId,
          status: 'confirmed',
          checkinDate: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          property: { select: { id: true, name: true } },
          guest: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.reservation.findMany({
        where: {
          userId: req.userId,
          status: 'confirmed',
          checkoutDate: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          property: { select: { id: true, name: true } },
          guest: { select: { id: true, name: true, phone: true } }
        }
      })
    ]);

    res.json({ checkins, checkouts });
  } catch (error) {
    console.error('Erro ao buscar reservas de hoje:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas de hoje' });
  }
});

// GET /api/reservations/:id - Buscar uma reserva
router.get('/:id', async (req, res) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.userId
      },
      include: {
        property: true,
        guest: true,
        notificationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    res.json(reservation);
  } catch (error) {
    console.error('Erro ao buscar reserva:', error);
    res.status(500).json({ error: 'Erro ao buscar reserva' });
  }
});

// POST /api/reservations - Criar nova reserva
router.post('/', async (req, res) => {
  try {
    const {
      propertyId,
      guestId,
      checkinDate,
      checkoutDate,
      checkinTime,
      checkoutTime,
      source,
      externalId,
      totalAmount,
      currency,
      adults,
      children,
      infants,
      guestNotes,
      internalNotes,
      sendWelcomeMessage
    } = req.body;

    if (!propertyId || !checkinDate || !checkoutDate) {
      return res.status(400).json({
        error: 'Propriedade, data de check-in e data de checkout são obrigatórios'
      });
    }

    // Verificar se a propriedade pertence ao usuário
    const property = await prisma.property.findFirst({
      where: { id: propertyId, userId: req.userId }
    });

    if (!property) {
      return res.status(404).json({ error: 'Propriedade não encontrada' });
    }

    // Verificar conflitos de datas
    const conflict = await prisma.reservation.findFirst({
      where: {
        propertyId,
        status: { in: ['pending', 'confirmed'] },
        OR: [
          {
            AND: [
              { checkinDate: { lte: new Date(checkinDate) } },
              { checkoutDate: { gt: new Date(checkinDate) } }
            ]
          },
          {
            AND: [
              { checkinDate: { lt: new Date(checkoutDate) } },
              { checkoutDate: { gte: new Date(checkoutDate) } }
            ]
          }
        ]
      }
    });

    if (conflict) {
      return res.status(400).json({
        error: 'Já existe uma reserva para este período',
        conflictId: conflict.id
      });
    }

    const reservation = await prisma.reservation.create({
      data: {
        propertyId,
        guestId,
        checkinDate: new Date(checkinDate),
        checkoutDate: new Date(checkoutDate),
        checkinTime: checkinTime || property.checkinTime || '15:00',
        checkoutTime: checkoutTime || property.checkoutTime || '11:00',
        source: source || 'manual',
        externalId,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        currency: currency || 'BRL',
        adults: adults || 1,
        children: children || 0,
        infants: infants || 0,
        status: 'confirmed',
        guestNotes,
        internalNotes,
        userId: req.userId
      },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } }
      }
    });

    // Disparar webhook
    await webhookService.trigger('reservation.created', {
      id: reservation.id,
      propertyId: reservation.propertyId,
      propertyName: reservation.property?.name,
      guestId: reservation.guestId,
      guestName: reservation.guest?.name,
      checkinDate: reservation.checkinDate,
      checkoutDate: reservation.checkoutDate
    }, req.userId);

    // Enviar mensagem de boas-vindas se solicitado
    if (sendWelcomeMessage && guestId) {
      await queueService.addNotificationJob('welcome', {
        reservationId: reservation.id,
        channel: 'whatsapp'
      });
    }

    res.status(201).json(reservation);
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  }
});

// PUT /api/reservations/:id - Atualizar reserva
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.reservation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    const {
      checkinDate,
      checkoutDate,
      checkinTime,
      checkoutTime,
      guestId,
      totalAmount,
      currency,
      adults,
      children,
      infants,
      status,
      guestNotes,
      internalNotes
    } = req.body;

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        checkinDate: checkinDate ? new Date(checkinDate) : existing.checkinDate,
        checkoutDate: checkoutDate ? new Date(checkoutDate) : existing.checkoutDate,
        checkinTime: checkinTime ?? existing.checkinTime,
        checkoutTime: checkoutTime ?? existing.checkoutTime,
        guestId: guestId ?? existing.guestId,
        totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : existing.totalAmount,
        currency: currency ?? existing.currency,
        adults: adults ?? existing.adults,
        children: children ?? existing.children,
        infants: infants ?? existing.infants,
        status: status ?? existing.status,
        guestNotes: guestNotes ?? existing.guestNotes,
        internalNotes: internalNotes ?? existing.internalNotes
      },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } }
      }
    });

    // Disparar webhook
    await webhookService.trigger('reservation.updated', {
      id: reservation.id,
      status: reservation.status,
      changes: Object.keys(req.body)
    }, req.userId);

    res.json(reservation);
  } catch (error) {
    console.error('Erro ao atualizar reserva:', error);
    res.status(500).json({ error: 'Erro ao atualizar reserva' });
  }
});

// PATCH /api/reservations/:id/cancel - Cancelar reserva
router.patch('/:id/cancel', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    const existing = await prisma.reservation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Reserva já está cancelada' });
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'cancelled',
        internalNotes: existing.internalNotes
          ? `${existing.internalNotes}\n\nCancelamento: ${reason || 'Sem motivo informado'}`
          : `Cancelamento: ${reason || 'Sem motivo informado'}`
      },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } }
      }
    });

    // Disparar webhook
    await webhookService.trigger('reservation.cancelled', {
      id: reservation.id,
      propertyId: reservation.propertyId,
      propertyName: reservation.property?.name,
      reason
    }, req.userId);

    res.json(reservation);
  } catch (error) {
    console.error('Erro ao cancelar reserva:', error);
    res.status(500).json({ error: 'Erro ao cancelar reserva' });
  }
});

// POST /api/reservations/:id/send-notification - Enviar notificação manualmente
router.post('/:id/send-notification', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, channel = 'whatsapp' } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Tipo de notificação é obrigatório' });
    }

    const validTypes = ['welcome', 'checkin_reminder', 'checkout_reminder', 'review_request'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Tipo inválido',
        validTypes
      });
    }

    const reservation = await prisma.reservation.findFirst({
      where: { id, userId: req.userId },
      include: { guest: true }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (!reservation.guest) {
      return res.status(400).json({ error: 'Reserva não tem hóspede associado' });
    }

    await queueService.addNotificationJob(type, {
      reservationId: id,
      channel
    });

    res.json({ message: 'Notificação agendada com sucesso', type, channel });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

// DELETE /api/reservations/:id - Remover reserva
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.reservation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    await prisma.reservation.delete({ where: { id } });

    res.json({ message: 'Reserva removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover reserva:', error);
    res.status(500).json({ error: 'Erro ao remover reserva' });
  }
});

// GET /api/reservations/stats/summary - Estatísticas de reservas
router.get('/stats/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      totalReservations,
      confirmedThisMonth,
      cancelledThisMonth,
      checkinsToday,
      checkoutsToday,
      upcomingWeek
    ] = await Promise.all([
      prisma.reservation.count({
        where: { userId: req.userId }
      }),
      prisma.reservation.count({
        where: {
          userId: req.userId,
          status: 'confirmed',
          createdAt: { gte: thisMonth, lt: nextMonth }
        }
      }),
      prisma.reservation.count({
        where: {
          userId: req.userId,
          status: 'cancelled',
          updatedAt: { gte: thisMonth, lt: nextMonth }
        }
      }),
      prisma.reservation.count({
        where: {
          userId: req.userId,
          status: 'confirmed',
          checkinDate: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.reservation.count({
        where: {
          userId: req.userId,
          status: 'confirmed',
          checkoutDate: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.reservation.count({
        where: {
          userId: req.userId,
          status: 'confirmed',
          checkinDate: {
            gte: today,
            lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      totalReservations,
      thisMonth: {
        confirmed: confirmedThisMonth,
        cancelled: cancelledThisMonth
      },
      today: {
        checkins: checkinsToday,
        checkouts: checkoutsToday
      },
      upcomingWeek
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;
