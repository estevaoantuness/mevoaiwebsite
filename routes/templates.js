import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Proteger todas as rotas
router.use(authMiddleware);

// GET /api/templates - Listar templates do usuário
router.get('/', async (req, res) => {
  try {
    const { type, channel, isActive } = req.query;

    const where = {
      OR: [
        { userId: req.userId },
        { userId: null } // Templates globais
      ]
    };

    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: [
        { userId: 'desc' }, // Templates do usuário primeiro
        { type: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(templates);
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

// GET /api/templates/types - Listar tipos disponíveis
router.get('/types', (req, res) => {
  res.json([
    { value: 'welcome', label: 'Mensagem de boas-vindas', description: 'Enviada ao criar reserva' },
    { value: 'checkin_reminder', label: 'Lembrete de check-in', description: 'Enviada 1 dia antes do check-in' },
    { value: 'checkout_reminder', label: 'Lembrete de checkout', description: 'Enviada 1 dia antes do checkout' },
    { value: 'cleaning', label: 'Notificação de limpeza', description: 'Enviada para funcionários no dia do checkout' },
    { value: 'review_request', label: 'Solicitação de avaliação', description: 'Enviada 1 dia após o checkout' },
    { value: 'custom', label: 'Personalizada', description: 'Template customizado para uso manual' }
  ]);
});

// GET /api/templates/placeholders - Listar placeholders disponíveis
router.get('/placeholders', (req, res) => {
  res.json([
    { placeholder: '{{guest_name}}', description: 'Nome do hóspede' },
    { placeholder: '{{property_name}}', description: 'Nome da propriedade' },
    { placeholder: '{{checkin_date}}', description: 'Data de check-in (DD/MM/AAAA)' },
    { placeholder: '{{checkout_date}}', description: 'Data de checkout (DD/MM/AAAA)' },
    { placeholder: '{{checkin_time}}', description: 'Horário de check-in' },
    { placeholder: '{{checkout_time}}', description: 'Horário de checkout' },
    { placeholder: '{{wifi_name}}', description: 'Nome da rede WiFi' },
    { placeholder: '{{wifi_password}}', description: 'Senha do WiFi' },
    { placeholder: '{{access_instructions}}', description: 'Instruções de acesso' },
    { placeholder: '{{employee_name}}', description: 'Nome do funcionário' },
    { placeholder: '{{total_amount}}', description: 'Valor total da reserva' },
    { placeholder: '{{adults}}', description: 'Número de adultos' },
    { placeholder: '{{children}}', description: 'Número de crianças' }
  ]);
});

// GET /api/templates/:id - Buscar um template
router.get('/:id', async (req, res) => {
  try {
    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: parseInt(req.params.id),
        OR: [
          { userId: req.userId },
          { userId: null }
        ]
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json(template);
  } catch (error) {
    console.error('Erro ao buscar template:', error);
    res.status(500).json({ error: 'Erro ao buscar template' });
  }
});

// POST /api/templates - Criar novo template
router.post('/', async (req, res) => {
  try {
    const { name, type, channel, subject, content, isActive } = req.body;

    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Nome, tipo e conteúdo são obrigatórios' });
    }

    const validTypes = ['welcome', 'checkin_reminder', 'checkout_reminder', 'cleaning', 'review_request', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido', validTypes });
    }

    const validChannels = ['whatsapp', 'email', 'sms'];
    if (channel && !validChannels.includes(channel)) {
      return res.status(400).json({ error: 'Canal inválido', validChannels });
    }

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        type,
        channel: channel || 'whatsapp',
        subject,
        content,
        isActive: isActive ?? true,
        userId: req.userId
      }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

// PUT /api/templates/:id - Atualizar template
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template não encontrado ou não pertence ao usuário' });
    }

    const { name, type, channel, subject, content, isActive } = req.body;

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        type: type ?? existing.type,
        channel: channel ?? existing.channel,
        subject: subject ?? existing.subject,
        content: content ?? existing.content,
        isActive: isActive ?? existing.isActive
      }
    });

    res.json(template);
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

// DELETE /api/templates/:id - Remover template
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template não encontrado ou não pertence ao usuário' });
    }

    await prisma.messageTemplate.delete({ where: { id } });

    res.json({ message: 'Template removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover template:', error);
    res.status(500).json({ error: 'Erro ao remover template' });
  }
});

// POST /api/templates/:id/preview - Visualizar template com dados de exemplo
router.post('/:id/preview', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id,
        OR: [
          { userId: req.userId },
          { userId: null }
        ]
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    // Dados de exemplo
    const sampleData = req.body.data || {
      guestName: 'João Silva',
      propertyName: 'Apartamento Vista Mar',
      checkinDate: new Date(),
      checkoutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      checkinTime: '15:00',
      checkoutTime: '11:00',
      wifiName: 'ApartamentoWiFi',
      wifiPassword: 'senha123',
      accessInstructions: 'A chave está na portaria. Apartamento 501.',
      employeeName: 'Maria',
      totalAmount: 1500.00,
      adults: 2,
      children: 1
    };

    // Importar serviço de notificação para processar template
    const notificationService = (await import('../services/notification.service.js')).default;

    const preview = {
      subject: template.subject ? notificationService.processTemplate(template.subject, sampleData) : null,
      content: notificationService.processTemplate(template.content, sampleData)
    };

    res.json(preview);
  } catch (error) {
    console.error('Erro ao gerar preview:', error);
    res.status(500).json({ error: 'Erro ao gerar preview' });
  }
});

// POST /api/templates/:id/duplicate - Duplicar template
router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const original = await prisma.messageTemplate.findFirst({
      where: {
        id,
        OR: [
          { userId: req.userId },
          { userId: null }
        ]
      }
    });

    if (!original) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    const duplicate = await prisma.messageTemplate.create({
      data: {
        name: `${original.name} (cópia)`,
        type: original.type,
        channel: original.channel,
        subject: original.subject,
        content: original.content,
        isActive: true,
        userId: req.userId
      }
    });

    res.status(201).json(duplicate);
  } catch (error) {
    console.error('Erro ao duplicar template:', error);
    res.status(500).json({ error: 'Erro ao duplicar template' });
  }
});

export default router;
