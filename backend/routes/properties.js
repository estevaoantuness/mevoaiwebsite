import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// TODO: Reativar autenticação depois
// router.use(authMiddleware);

// GET /api/properties - Listar todos os imóveis
router.get('/', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Mapear para manter compatibilidade com frontend (snake_case)
    const mapped = properties.map(p => ({
      id: p.id,
      name: p.name,
      ical_airbnb: p.icalAirbnb,
      ical_booking: p.icalBooking,
      employee_name: p.employeeName,
      employee_phone: p.employeePhone,
      checkout_time: p.checkoutTime,
      created_at: p.createdAt
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Erro ao listar imóveis:', error);
    res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
});

// GET /api/properties/:id - Buscar um imóvel
router.get('/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!property) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    res.json({
      id: property.id,
      name: property.name,
      ical_airbnb: property.icalAirbnb,
      ical_booking: property.icalBooking,
      employee_name: property.employeeName,
      employee_phone: property.employeePhone,
      checkout_time: property.checkoutTime,
      created_at: property.createdAt
    });
  } catch (error) {
    console.error('Erro ao buscar imóvel:', error);
    res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

// POST /api/properties - Criar novo imóvel
router.post('/', async (req, res) => {
  try {
    const { name, ical_airbnb, ical_booking, employee_name, employee_phone, checkout_time } = req.body;

    if (!name || !employee_name || !employee_phone) {
      return res.status(400).json({ error: 'Nome, funcionária e telefone são obrigatórios' });
    }

    const property = await prisma.property.create({
      data: {
        name,
        icalAirbnb: ical_airbnb || null,
        icalBooking: ical_booking || null,
        employeeName: employee_name,
        employeePhone: employee_phone,
        checkoutTime: checkout_time || null
      }
    });

    res.status(201).json({
      id: property.id,
      name: property.name,
      ical_airbnb: property.icalAirbnb,
      ical_booking: property.icalBooking,
      employee_name: property.employeeName,
      employee_phone: property.employeePhone,
      checkout_time: property.checkoutTime,
      created_at: property.createdAt
    });
  } catch (error) {
    console.error('Erro ao criar imóvel:', error);
    res.status(500).json({ error: 'Erro ao criar imóvel' });
  }
});

// PUT /api/properties/:id - Atualizar imóvel
router.put('/:id', async (req, res) => {
  try {
    const { name, ical_airbnb, ical_booking, employee_name, employee_phone, checkout_time } = req.body;
    const id = parseInt(req.params.id);

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    const property = await prisma.property.update({
      where: { id },
      data: {
        name: name || existing.name,
        icalAirbnb: ical_airbnb !== undefined ? ical_airbnb : existing.icalAirbnb,
        icalBooking: ical_booking !== undefined ? ical_booking : existing.icalBooking,
        employeeName: employee_name || existing.employeeName,
        employeePhone: employee_phone || existing.employeePhone,
        checkoutTime: checkout_time !== undefined ? checkout_time : existing.checkoutTime
      }
    });

    res.json({
      id: property.id,
      name: property.name,
      ical_airbnb: property.icalAirbnb,
      ical_booking: property.icalBooking,
      employee_name: property.employeeName,
      employee_phone: property.employeePhone,
      checkout_time: property.checkoutTime,
      created_at: property.createdAt
    });
  } catch (error) {
    console.error('Erro ao atualizar imóvel:', error);
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
});

// DELETE /api/properties/:id - Remover imóvel
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    await prisma.property.delete({ where: { id } });
    res.json({ message: 'Imóvel removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover imóvel:', error);
    res.status(500).json({ error: 'Erro ao remover imóvel' });
  }
});

export default router;
