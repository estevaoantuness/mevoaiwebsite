import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import webhookService from '../services/webhook.service.js';

const router = Router();

// Proteger todas as rotas
router.use(authMiddleware);

// GET /api/guests - Listar hóspedes do usuário
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    const where = { userId: req.userId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.guest.count({ where })
    ]);

    res.json({
      guests,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao listar hóspedes:', error);
    res.status(500).json({ error: 'Erro ao listar hóspedes' });
  }
});

// GET /api/guests/:id - Buscar um hóspede
router.get('/:id', async (req, res) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.userId
      },
      include: {
        reservations: {
          orderBy: { checkinDate: 'desc' },
          take: 10,
          include: {
            property: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!guest) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    res.json(guest);
  } catch (error) {
    console.error('Erro ao buscar hóspede:', error);
    res.status(500).json({ error: 'Erro ao buscar hóspede' });
  }
});

// POST /api/guests - Criar novo hóspede
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      whatsapp,
      document,
      documentType,
      nationality,
      notes,
      preferredLanguage
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const guest = await prisma.guest.create({
      data: {
        name,
        email,
        phone,
        whatsapp: whatsapp || phone,
        document,
        documentType,
        nationality,
        notes,
        preferredLanguage,
        userId: req.userId
      }
    });

    // Disparar webhook
    await webhookService.trigger('guest.created', {
      id: guest.id,
      name: guest.name,
      email: guest.email
    }, req.userId);

    res.status(201).json(guest);
  } catch (error) {
    console.error('Erro ao criar hóspede:', error);
    res.status(500).json({ error: 'Erro ao criar hóspede' });
  }
});

// PUT /api/guests/:id - Atualizar hóspede
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.guest.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const {
      name,
      email,
      phone,
      whatsapp,
      document,
      documentType,
      nationality,
      notes,
      preferredLanguage,
      isActive
    } = req.body;

    const guest = await prisma.guest.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        whatsapp: whatsapp ?? existing.whatsapp,
        document: document ?? existing.document,
        documentType: documentType ?? existing.documentType,
        nationality: nationality ?? existing.nationality,
        notes: notes ?? existing.notes,
        preferredLanguage: preferredLanguage ?? existing.preferredLanguage,
        isActive: isActive ?? existing.isActive
      }
    });

    // Disparar webhook
    await webhookService.trigger('guest.updated', {
      id: guest.id,
      name: guest.name
    }, req.userId);

    res.json(guest);
  } catch (error) {
    console.error('Erro ao atualizar hóspede:', error);
    res.status(500).json({ error: 'Erro ao atualizar hóspede' });
  }
});

// DELETE /api/guests/:id - Remover hóspede
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.guest.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    await prisma.guest.delete({ where: { id } });

    res.json({ message: 'Hóspede removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover hóspede:', error);
    res.status(500).json({ error: 'Erro ao remover hóspede' });
  }
});

// GET /api/guests/:id/reservations - Histórico de reservas do hóspede
router.get('/:id/reservations', async (req, res) => {
  try {
    const guestId = parseInt(req.params.id);
    const { limit = 20, offset = 0 } = req.query;

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, userId: req.userId }
    });

    if (!guest) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where: { guestId },
        orderBy: { checkinDate: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          property: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.reservation.count({ where: { guestId } })
    ]);

    res.json({
      reservations,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

export default router;
