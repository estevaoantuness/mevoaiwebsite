/**
 * Serviço de WhatsApp via Evolution API
 *
 * Cada usuário tem sua própria instância do WhatsApp
 * Instância: mevo-user-{userId}
 */

import prisma from '../lib/prisma.js';

class WhatsAppService {
  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || '';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.isConfigured = false;
    this.webhookUrl = process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/whatsapp/webhook`
      : null;
  }

  /**
   * Inicializa o serviço
   */
  async initialize() {
    if (!this.baseUrl || !this.apiKey) {
      console.warn('⚠️ Evolution API não configurada. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env');
      return;
    }

    this.baseUrl = this.baseUrl.replace(/\/$/, '');
    this.isConfigured = true;

    console.log('✅ Evolution API configurada:', this.baseUrl);

    if (this.webhookUrl) {
      console.log('🔗 Webhook URL:', this.webhookUrl);
    }
  }

  /**
   * Gera nome da instância para um usuário
   */
  getInstanceName(userId) {
    return `mevo-user-${userId}`;
  }

  /**
   * Faz requisição para a Evolution API
   */
  async request(method, endpoint, data = null) {
    if (!this.isConfigured) {
      throw new Error('Evolution API não configurada');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey
    };

    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(30000)
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error('Timeout na requisição para Evolution API');
      }
      throw error;
    }
  }

  // =============================================
  // GESTÃO DE INSTÂNCIAS POR USUÁRIO
  // =============================================

  /**
   * Cria ou obtém instância para um usuário
   */
  async getOrCreateUserInstance(userId) {
    const instanceName = this.getInstanceName(userId);

    // Verifica se já existe
    try {
      const status = await this.getInstanceStatus(instanceName);
      if (status.exists) {
        return { instanceName, created: false, ...status };
      }
    } catch (error) {
      // Instância não existe, vamos criar
    }

    // Cria nova instância com sync de histórico habilitado
    const result = await this.createInstance(instanceName, {
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      // Configurações de sincronização
      syncFullHistory: true,
      readMessages: false,
      readStatus: false,
      rejectCall: false,
      groupsIgnore: true,
      alwaysOnline: false
    });

    // Configura webhook para receber eventos
    if (this.webhookUrl) {
      try {
        await this.setWebhook(instanceName, this.webhookUrl, [
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT'
        ]);
      } catch (error) {
        console.warn(`⚠️ Não foi possível configurar webhook para ${instanceName}:`, error.message);
      }
    }

    // Atualiza usuário no banco
    await prisma.user.update({
      where: { id: userId },
      data: { whatsappInstance: instanceName }
    });

    return { instanceName, created: true, ...result };
  }

  /**
   * Obtém QR Code para um usuário conectar seu WhatsApp
   */
  async getUserQRCode(userId) {
    const instanceName = this.getInstanceName(userId);

    // Garante que instância existe
    await this.getOrCreateUserInstance(userId);

    // Verifica status atual
    const status = await this.getInstanceStatus(instanceName);

    if (status.state === 'open') {
      // Já conectado, busca info do número
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return {
        connected: true,
        phone: user?.whatsappPhone,
        message: 'WhatsApp já está conectado'
      };
    }

    // Busca QR Code
    const result = await this.request('GET', `/instance/connect/${instanceName}`);

    return {
      connected: false,
      qr: result.base64 || result.qrcode?.base64,
      code: result.code || result.qrcode?.code,
      pairingCode: result.pairingCode,
      instanceName
    };
  }

  /**
   * Desconecta WhatsApp de um usuário
   */
  async disconnectUser(userId) {
    const instanceName = this.getInstanceName(userId);

    try {
      await this.request('DELETE', `/instance/logout/${instanceName}`);
    } catch (error) {
      // Ignora se não existir
    }

    // Atualiza banco
    await prisma.user.update({
      where: { id: userId },
      data: {
        whatsappConnected: false,
        whatsappPhone: null,
        whatsappConnectedAt: null
      }
    });

    return { success: true };
  }

  /**
   * Processa webhook de conexão
   */
  async handleConnectionWebhook(instanceName, data) {
    // Extrai userId do nome da instância
    const match = instanceName.match(/^mevo-user-(\d+)$/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const state = data.state || data.status;

    if (state === 'open') {
      // Conectado! Atualiza banco
      const phoneNumber = data.instance?.owner || data.ownerJid?.split('@')[0];

      await prisma.user.update({
        where: { id: userId },
        data: {
          whatsappConnected: true,
          whatsappPhone: phoneNumber,
          whatsappConnectedAt: new Date()
        }
      });

      console.log(`✅ WhatsApp conectado para usuário ${userId}: ${phoneNumber}`);
    } else if (state === 'close' || state === 'disconnected') {
      // Desconectado
      await prisma.user.update({
        where: { id: userId },
        data: {
          whatsappConnected: false
        }
      });

      console.log(`❌ WhatsApp desconectado para usuário ${userId}`);
    }
  }

  /**
   * Obtém status do WhatsApp de um usuário
   */
  async getUserStatus(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        whatsappInstance: true,
        whatsappConnected: true,
        whatsappPhone: true,
        whatsappConnectedAt: true
      }
    });

    if (!user?.whatsappInstance) {
      return {
        configured: false,
        connected: false,
        message: 'WhatsApp não configurado. Escaneie o QR Code para conectar.'
      };
    }

    // Verifica status real na Evolution
    try {
      const status = await this.getInstanceStatus(user.whatsappInstance);
      const isConnected = status.state === 'open';

      // Atualiza banco se status mudou
      if (isConnected !== user.whatsappConnected) {
        await prisma.user.update({
          where: { id: userId },
          data: { whatsappConnected: isConnected }
        });
      }

      return {
        configured: true,
        connected: isConnected,
        phone: user.whatsappPhone,
        connectedAt: user.whatsappConnectedAt,
        instance: user.whatsappInstance,
        state: status.state
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        error: error.message
      };
    }
  }

  // =============================================
  // ENVIO DE MENSAGENS
  // =============================================

  /**
   * Envia mensagem usando a instância do usuário
   */
  async sendMessageForUser(userId, phone, message) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappInstance: true, whatsappConnected: true }
    });

    if (!user?.whatsappInstance) {
      throw new Error('WhatsApp não configurado. Configure seu WhatsApp no dashboard.');
    }

    if (!user.whatsappConnected) {
      throw new Error('WhatsApp não está conectado. Reconecte seu WhatsApp no dashboard.');
    }

    return this.sendMessage(phone, message, user.whatsappInstance);
  }

  /**
   * Envia mensagem de texto
   */
  async sendMessage(phone, message, instanceName) {
    const formattedPhone = this.formatPhoneNumber(phone);

    const data = {
      number: formattedPhone,
      text: message
    };

    const result = await this.request('POST', `/message/sendText/${instanceName}`, data);
    console.log(`📤 Mensagem enviada para ${formattedPhone} via ${instanceName}`);
    return result;
  }

  /**
   * Envia mídia
   */
  async sendMediaForUser(userId, phone, media) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappInstance: true, whatsappConnected: true }
    });

    if (!user?.whatsappInstance || !user.whatsappConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhoneNumber(phone);

    const data = {
      number: formattedPhone,
      mediatype: media.type || 'image',
      media: media.url,
      caption: media.caption || '',
      fileName: media.fileName
    };

    return this.request('POST', `/message/sendMedia/${user.whatsappInstance}`, data);
  }

  // =============================================
  // MÉTODOS BASE DA EVOLUTION API
  // =============================================

  async createInstance(instanceName, options = {}) {
    const data = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      ...options
    };

    return this.request('POST', '/instance/create', data);
  }

  async listInstances() {
    return this.request('GET', '/instance/fetchInstances');
  }

  async getInstanceStatus(instanceName) {
    try {
      const result = await this.request('GET', `/instance/connectionState/${instanceName}`);
      return {
        exists: true,
        state: result.state || result.instance?.state || 'unknown',
        ...result
      };
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return { exists: false, state: 'not_found' };
      }
      throw error;
    }
  }

  async deleteInstance(instanceName) {
    return this.request('DELETE', `/instance/delete/${instanceName}`);
  }

  async setWebhook(instanceName, webhookUrl, events = null) {
    const data = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        events: events || [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT'
        ]
      }
    };

    return this.request('POST', `/webhook/set/${instanceName}`, data);
  }

  async checkNumber(phone, instanceName) {
    const formattedPhone = this.formatPhoneNumber(phone);

    const data = {
      numbers: [formattedPhone]
    };

    const result = await this.request('POST', `/chat/whatsappNumbers/${instanceName}`, data);
    return result[0] || { exists: false };
  }

  // =============================================
  // UTILIDADES
  // =============================================

  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return cleaned;
    }

    if (cleaned.length === 10 || cleaned.length === 11) {
      return `55${cleaned}`;
    }

    if (cleaned.length < 10) {
      throw new Error('Número de telefone inválido: falta DDD');
    }

    return cleaned;
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      provider: 'evolution-api',
      baseUrl: this.baseUrl ? this.baseUrl.replace(/\/\/.*@/, '//***@') : null,
      webhookUrl: this.webhookUrl
    };
  }

  async getDetailedStatus() {
    if (!this.isConfigured) {
      return {
        configured: false,
        status: 'not_configured',
        message: 'Evolution API não configurada'
      };
    }

    return {
      configured: true,
      provider: 'evolution-api',
      baseUrl: this.baseUrl
    };
  }
}

const whatsappService = new WhatsAppService();

export default whatsappService;
