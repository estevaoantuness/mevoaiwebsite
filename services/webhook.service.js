/**
 * Serviço de Webhooks
 *
 * Dispara eventos para URLs externas quando ações ocorrem no sistema.
 *
 * Eventos suportados:
 * - reservation.created
 * - reservation.updated
 * - reservation.cancelled
 * - reservation.completed
 * - guest.created
 * - guest.updated
 * - message.sent
 * - message.failed
 * - property.created
 * - property.updated
 * - calendar.synced
 */

import crypto from 'crypto';
import prisma from '../lib/prisma.js';

class WebhookService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 segundos
  }

  /**
   * Dispara um evento para todos os webhooks ativos que escutam esse evento
   * @param {string} event - Nome do evento (ex: 'reservation.created')
   * @param {Object} payload - Dados do evento
   * @param {number} [userId] - ID do usuário (para filtrar webhooks)
   */
  async trigger(event, payload, userId = null) {
    try {
      // Buscar webhooks ativos que escutam este evento
      const whereClause = {
        isActive: true,
        events: { has: event }
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const webhooks = await prisma.webhook.findMany({
        where: whereClause
      });

      if (webhooks.length === 0) {
        return { triggered: 0 };
      }

      console.log(`🔔 Disparando evento '${event}' para ${webhooks.length} webhook(s)`);

      const results = await Promise.allSettled(
        webhooks.map((webhook) => this.sendWebhook(webhook, event, payload))
      );

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter((r) => r.status === 'rejected' || !r.value?.success).length;

      return { triggered: webhooks.length, successful, failed };
    } catch (error) {
      console.error('Erro ao disparar webhooks:', error);
      return { triggered: 0, error: error.message };
    }
  }

  /**
   * Envia um webhook para uma URL específica
   */
  async sendWebhook(webhook, event, payload, attempt = 1) {
    const timestamp = Date.now();
    const body = JSON.stringify({
      event,
      timestamp,
      data: payload
    });

    // Calcular assinatura HMAC se houver secret
    const signature = webhook.secret
      ? this.calculateSignature(body, webhook.secret)
      : null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': signature || '',
          'User-Agent': 'Mevo-Webhook/1.0'
        },
        body,
        signal: AbortSignal.timeout(10000) // 10 segundos timeout
      });

      const responseText = await response.text();

      // Registrar no log
      await this.logWebhook(webhook.id, event, body, response.status, responseText, 'success');

      // Atualizar estatísticas do webhook
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          successCount: { increment: 1 }
        }
      });

      return { success: true, statusCode: response.status };
    } catch (error) {
      console.error(`Erro ao enviar webhook para ${webhook.url}:`, error.message);

      // Tentar novamente se ainda houver tentativas
      if (attempt < this.maxRetries) {
        console.log(`Tentando novamente em ${this.retryDelay / 1000}s... (tentativa ${attempt + 1}/${this.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
        return this.sendWebhook(webhook, event, payload, attempt + 1);
      }

      // Registrar falha
      await this.logWebhook(webhook.id, event, body, null, null, 'failed', error.message, attempt);

      // Atualizar estatísticas
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: { increment: 1 }
        }
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Calcula assinatura HMAC-SHA256
   */
  calculateSignature(body, secret) {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  /**
   * Verifica assinatura de um webhook recebido
   */
  verifySignature(body, signature, secret) {
    const expectedSignature = this.calculateSignature(body, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Registra webhook no log
   */
  async logWebhook(webhookId, event, payload, statusCode, response, status, errorMessage = null, attempts = 1) {
    try {
      await prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          payload,
          statusCode,
          response: response ? response.substring(0, 5000) : null, // Limitar tamanho
          status,
          errorMessage,
          attempts
        }
      });
    } catch (error) {
      console.error('Erro ao registrar log de webhook:', error);
    }
  }

  /**
   * Cria um novo webhook
   */
  async create(data) {
    // Gerar secret automático se não fornecido
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    return prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret,
        events: data.events || [],
        isActive: data.isActive ?? true,
        userId: data.userId
      }
    });
  }

  /**
   * Atualiza um webhook
   */
  async update(id, data, userId = null) {
    const whereClause = { id };
    if (userId) {
      whereClause.userId = userId;
    }

    return prisma.webhook.update({
      where: whereClause,
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive
      }
    });
  }

  /**
   * Remove um webhook
   */
  async delete(id, userId = null) {
    const whereClause = { id };
    if (userId) {
      whereClause.userId = userId;
    }

    return prisma.webhook.delete({ where: whereClause });
  }

  /**
   * Lista webhooks do usuário
   */
  async list(userId) {
    return prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Testa um webhook enviando um evento de teste
   */
  async test(webhookId, userId = null) {
    const whereClause = { id: webhookId };
    if (userId) {
      whereClause.userId = userId;
    }

    const webhook = await prisma.webhook.findFirst({ where: whereClause });

    if (!webhook) {
      throw new Error('Webhook não encontrado');
    }

    const testPayload = {
      test: true,
      message: 'Este é um evento de teste do Mevo',
      timestamp: new Date().toISOString()
    };

    return this.sendWebhook(webhook, 'test', testPayload);
  }

  /**
   * Retorna logs de um webhook
   */
  async getLogs(webhookId, limit = 50, userId = null) {
    // Verificar se o webhook pertence ao usuário
    if (userId) {
      const webhook = await prisma.webhook.findFirst({
        where: { id: webhookId, userId }
      });

      if (!webhook) {
        throw new Error('Webhook não encontrado');
      }
    }

    return prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Regenera o secret de um webhook
   */
  async regenerateSecret(webhookId, userId = null) {
    const whereClause = { id: webhookId };
    if (userId) {
      whereClause.userId = userId;
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    return prisma.webhook.update({
      where: whereClause,
      data: { secret: newSecret }
    });
  }

  /**
   * Lista eventos disponíveis
   */
  getAvailableEvents() {
    return [
      { name: 'reservation.created', description: 'Nova reserva criada' },
      { name: 'reservation.updated', description: 'Reserva atualizada' },
      { name: 'reservation.cancelled', description: 'Reserva cancelada' },
      { name: 'reservation.completed', description: 'Reserva concluída' },
      { name: 'guest.created', description: 'Novo hóspede criado' },
      { name: 'guest.updated', description: 'Hóspede atualizado' },
      { name: 'message.sent', description: 'Mensagem enviada' },
      { name: 'message.failed', description: 'Falha ao enviar mensagem' },
      { name: 'property.created', description: 'Nova propriedade criada' },
      { name: 'property.updated', description: 'Propriedade atualizada' },
      { name: 'calendar.synced', description: 'Calendário sincronizado' },
      { name: 'cleaning.scheduled', description: 'Limpeza agendada' }
    ];
  }
}

// Singleton
const webhookService = new WebhookService();

export default webhookService;
