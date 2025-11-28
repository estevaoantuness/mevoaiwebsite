import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// TODO: Reativar autenticação depois
// router.use(authMiddleware);

// GET /api/settings - Retorna todas as configurações
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();

    // Converte para objeto { key: value }
    const settingsObj = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// PUT /api/settings/:key - Atualiza uma configuração
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Valor é obrigatório' });
    }

    // Upsert: insere ou atualiza
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
});

export default router;
