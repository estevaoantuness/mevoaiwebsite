import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.status = 'disconnected'; // disconnected, connecting, connected
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: join(__dirname, '..', '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this.client.on('qr', async (qr) => {
      console.log('QR Code recebido');
      this.status = 'connecting';
      this.qrCode = await QRCode.toDataURL(qr);
    });

    this.client.on('ready', () => {
      console.log('WhatsApp conectado!');
      this.status = 'connected';
      this.qrCode = null;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp autenticado');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Falha na autenticação:', msg);
      this.status = 'disconnected';
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp desconectado:', reason);
      this.status = 'disconnected';
      this.qrCode = null;
    });

    this.isInitialized = true;
    await this.client.initialize();
  }

  getStatus() {
    return {
      status: this.status,
      hasQR: !!this.qrCode
    };
  }

  getQRCode() {
    return this.qrCode;
  }

  async sendMessage(phone, message) {
    if (this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado');
    }

    // Formata o número (Brasil)
    const formattedPhone = phone.replace(/\D/g, '');
    const chatId = `55${formattedPhone}@c.us`;

    try {
      await this.client.sendMessage(chatId, message);
      console.log(`Mensagem enviada para ${phone}`);
      return true;
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${phone}:`, error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.logout();
      this.status = 'disconnected';
      this.qrCode = null;
    }
  }
}

// Singleton
const whatsappService = new WhatsAppService();

export default whatsappService;
