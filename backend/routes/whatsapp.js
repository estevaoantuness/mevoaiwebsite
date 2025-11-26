import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import whatsappService from '../services/whatsapp.service.js';

const router = Router();

router.use(authMiddleware);

// GET /api/whatsapp/status - Status da conexão
router.get('/status', (req, res) => {
  res.json(whatsappService.getStatus());
});

// GET /api/whatsapp/qr - Retorna QR Code (base64)
router.get('/qr', (req, res) => {
  const qr = whatsappService.getQRCode();

  if (!qr) {
    return res.status(404).json({
      error: 'QR Code não disponível',
      status: whatsappService.getStatus().status
    });
  }

  res.json({ qr });
});

// POST /api/whatsapp/disconnect - Desconectar
router.post('/disconnect', async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// POST /api/whatsapp/test - Enviar mensagem de teste
router.post('/test', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
  }

  try {
    await whatsappService.sendMessage(phone, message);
    res.json({ success: true, message: 'Mensagem enviada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
