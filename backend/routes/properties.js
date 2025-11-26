import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/properties - Listar todos os imóveis
router.get('/', (req, res) => {
  const properties = db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
  res.json(properties);
});

// GET /api/properties/:id - Buscar um imóvel
router.get('/:id', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!property) {
    return res.status(404).json({ error: 'Imóvel não encontrado' });
  }

  res.json(property);
});

// POST /api/properties - Criar novo imóvel
router.post('/', (req, res) => {
  const { name, ical_airbnb, ical_booking, employee_name, employee_phone, checkout_time } = req.body;

  if (!name || !employee_name || !employee_phone) {
    return res.status(400).json({ error: 'Nome, funcionária e telefone são obrigatórios' });
  }

  const result = db.prepare(`
    INSERT INTO properties (name, ical_airbnb, ical_booking, employee_name, employee_phone, checkout_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, ical_airbnb || null, ical_booking || null, employee_name, employee_phone, checkout_time || null);

  const newProperty = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(newProperty);
});

// PUT /api/properties/:id - Atualizar imóvel
router.put('/:id', (req, res) => {
  const { name, ical_airbnb, ical_booking, employee_name, employee_phone, checkout_time } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Imóvel não encontrado' });
  }

  db.prepare(`
    UPDATE properties
    SET name = ?, ical_airbnb = ?, ical_booking = ?, employee_name = ?, employee_phone = ?, checkout_time = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    ical_airbnb !== undefined ? ical_airbnb : existing.ical_airbnb,
    ical_booking !== undefined ? ical_booking : existing.ical_booking,
    employee_name || existing.employee_name,
    employee_phone || existing.employee_phone,
    checkout_time !== undefined ? checkout_time : existing.checkout_time,
    id
  );

  const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/properties/:id - Remover imóvel
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Imóvel não encontrado' });
  }

  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  res.json({ message: 'Imóvel removido com sucesso' });
});

export default router;
