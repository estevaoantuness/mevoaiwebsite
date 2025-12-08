import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import whatsappService from '../services/whatsapp.service.js';

const router = Router();

// =============================================
// WEBHOOK PÚBLICO (recebe eventos da Evolution)
// =============================================

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.event || event.type;
    const instanceName = event.instance || event.instanceName;

    console.log(`📥 Webhook Evolution: ${eventType} para ${instanceName}`);

    // Processa eventos de conexão
    if (eventType === 'CONNECTION_UPDATE' || eventType === 'connection.update') {
      await whatsappService.handleConnectionWebhook(instanceName, event.data || event);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ROTAS PROTEGIDAS (requer autenticação)
// =============================================

router.use(authMiddleware);

// GET /api/whatsapp/status - Status do WhatsApp do usuário logado
router.get('/status', async (req, res) => {
  try {
    const status = await whatsappService.getUserStatus(req.user.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/whatsapp/qr - Gera QR Code para o usuário conectar
router.get('/qr', async (req, res) => {
  try {
    const result = await whatsappService.getUserQRCode(req.user.id);

    if (result.connected) {
      return res.json({
        connected: true,
        phone: result.phone,
        message: 'WhatsApp já está conectado'
      });
    }

    res.json({
      connected: false,
      qr: result.qr,
      code: result.code,
      pairingCode: result.pairingCode
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao gerar QR Code',
      message: error.message
    });
  }
});

// POST /api/whatsapp/disconnect - Desconecta WhatsApp do usuário
router.post('/disconnect', async (req, res) => {
  try {
    await whatsappService.disconnectUser(req.user.id);
    res.json({ success: true, message: 'WhatsApp desconectado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/whatsapp/reconnect - Força reconexão (gera novo QR)
router.post('/reconnect', async (req, res) => {
  try {
    // Desconecta primeiro
    await whatsappService.disconnectUser(req.user.id);

    // Gera novo QR
    const result = await whatsappService.getUserQRCode(req.user.id);

    res.json({
      success: true,
      qr: result.qr,
      code: result.code
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENVIO DE MENSAGENS
// =============================================

// POST /api/whatsapp/send - Enviar mensagem
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
    }

    const result = await whatsappService.sendMessageForUser(req.user.id, phone, message);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/whatsapp/send-media - Enviar mídia
router.post('/send-media', async (req, res) => {
  try {
    const { phone, media } = req.body;

    if (!phone || !media || !media.url) {
      return res.status(400).json({ error: 'Telefone e mídia (url) são obrigatórios' });
    }

    const result = await whatsappService.sendMediaForUser(req.user.id, phone, media);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/whatsapp/test - Enviar mensagem de teste
router.post('/test', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const testMessage = message || '✅ Teste do Mevo! Se você recebeu esta mensagem, seu WhatsApp está configurado corretamente.';
    await whatsappService.sendMessageForUser(req.user.id, phone, testMessage);

    res.json({ success: true, message: 'Mensagem de teste enviada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ADMIN ONLY - Gestão de instâncias
// =============================================

// GET /api/whatsapp/instances - Lista todas instâncias (admin)
router.get('/instances', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const instances = await whatsappService.listInstances();
    res.json(instances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
