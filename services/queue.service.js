/**
 * Serviço de Filas e Jobs em Background
 *
 * Suporta dois modos:
 * 1. Com Redis (Bull) - Para produção com alta disponibilidade
 * 2. Sem Redis (in-memory) - Para desenvolvimento ou quando Redis não está disponível
 *
 * CREDENCIAIS NECESSÁRIAS (opcional):
 *   - REDIS_URL ou REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 *
 * Se Redis não estiver configurado, usa processamento síncrono
 */

import prisma from '../lib/prisma.js';
import notificationService from './notification.service.js';
import icalService from './ical.service.js';

// Queue será inicializado dinamicamente
let Queue = null;
let notificationQueue = null;
let calendarSyncQueue = null;
let cleanupQueue = null;

class QueueService {
  constructor() {
    this.isInitialized = false;
    this.useRedis = false;
    this.pendingJobs = []; // Para modo in-memory
  }

  /**
   * Inicializa as filas com Bull + Redis (se disponível)
   */
  async initialize() {
    if (this.isInitialized) return;

    // Verificar se Redis está configurado
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    if (redisUrl || redisHost) {
      try {
        const BullModule = await import('bull');
        Queue = BullModule.default;

        const redisConfig = redisUrl
          ? redisUrl
          : {
              host: redisHost || 'localhost',
              port: parseInt(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined
            };

        // Criar filas
        notificationQueue = new Queue('notifications', redisConfig);
        calendarSyncQueue = new Queue('calendar-sync', redisConfig);
        cleanupQueue = new Queue('cleanup', redisConfig);

        // Configurar processadores
        this.setupProcessors();

        this.useRedis = true;
        console.log('✅ Filas (Bull + Redis) configuradas');
      } catch (error) {
        console.warn('⚠️ Bull/Redis não disponível. Usando modo in-memory.');
        console.warn('   Para usar filas, execute: npm install bull');
        this.useRedis = false;
      }
    } else {
      console.log('ℹ️ Redis não configurado. Usando processamento síncrono.');
      this.useRedis = false;
    }

    this.isInitialized = true;
  }

  /**
   * Configura os processadores das filas
   */
  setupProcessors() {
    if (!this.useRedis) return;

    // Processador de notificações
    notificationQueue.process(async (job) => {
      const { type, data } = job.data;
      console.log(`📤 Processando notificação: ${type}`);

      try {
        switch (type) {
          case 'welcome':
            return await this.processWelcomeNotification(data);
          case 'checkin_reminder':
            return await this.processCheckinReminder(data);
          case 'checkout_reminder':
            return await this.processCheckoutReminder(data);
          case 'cleaning':
            return await this.processCleaningNotification(data);
          case 'review_request':
            return await this.processReviewRequest(data);
          case 'custom':
            return await notificationService.send(data);
          default:
            throw new Error(`Tipo de notificação desconhecido: ${type}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao processar notificação ${type}:`, error.message);
        throw error;
      }
    });

    // Processador de sincronização de calendário
    calendarSyncQueue.process(async (job) => {
      const { propertyId } = job.data;
      console.log(`📅 Sincronizando calendário da propriedade ${propertyId}`);

      try {
        return await this.syncPropertyCalendar(propertyId);
      } catch (error) {
        console.error(`❌ Erro ao sincronizar calendário:`, error.message);
        throw error;
      }
    });

    // Processador de limpeza de dados antigos
    cleanupQueue.process(async (job) => {
      console.log(`🧹 Executando limpeza de dados antigos`);

      try {
        return await this.cleanupOldData(job.data);
      } catch (error) {
        console.error(`❌ Erro na limpeza:`, error.message);
        throw error;
      }
    });

    // Event handlers
    [notificationQueue, calendarSyncQueue, cleanupQueue].forEach((queue) => {
      queue.on('completed', (job, result) => {
        console.log(`✅ Job ${job.id} concluído`);
      });

      queue.on('failed', (job, err) => {
        console.error(`❌ Job ${job.id} falhou:`, err.message);
      });
    });
  }

  /**
   * Adiciona job à fila de notificações
   */
  async addNotificationJob(type, data, options = {}) {
    const jobData = { type, data };

    if (this.useRedis && notificationQueue) {
      return notificationQueue.add(jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50,
        ...options
      });
    }

    // Modo síncrono (fallback)
    return this.processNotificationSync(type, data);
  }

  /**
   * Adiciona job à fila de sincronização de calendário
   */
  async addCalendarSyncJob(propertyId, options = {}) {
    const jobData = { propertyId };

    if (this.useRedis && calendarSyncQueue) {
      return calendarSyncQueue.add(jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 50,
        ...options
      });
    }

    // Modo síncrono
    return this.syncPropertyCalendar(propertyId);
  }

  /**
   * Adiciona job de limpeza
   */
  async addCleanupJob(options = {}) {
    if (this.useRedis && cleanupQueue) {
      return cleanupQueue.add({ timestamp: new Date() }, {
        removeOnComplete: true,
        ...options
      });
    }

    return this.cleanupOldData({});
  }

  /**
   * Agenda job para execução futura
   */
  async scheduleJob(queue, data, delay) {
    if (this.useRedis) {
      const targetQueue =
        queue === 'notification' ? notificationQueue :
        queue === 'calendar-sync' ? calendarSyncQueue :
        cleanupQueue;

      return targetQueue.add(data, { delay });
    }

    // Para modo sem Redis, agendar com setTimeout
    setTimeout(() => {
      this.processNotificationSync(data.type, data.data);
    }, delay);

    return { id: Date.now(), delayed: true };
  }

  /**
   * Processa notificação de forma síncrona (fallback)
   */
  async processNotificationSync(type, data) {
    switch (type) {
      case 'welcome':
        return this.processWelcomeNotification(data);
      case 'checkin_reminder':
        return this.processCheckinReminder(data);
      case 'checkout_reminder':
        return this.processCheckoutReminder(data);
      case 'cleaning':
        return this.processCleaningNotification(data);
      case 'review_request':
        return this.processReviewRequest(data);
      case 'custom':
        return notificationService.send(data);
      default:
        throw new Error(`Tipo desconhecido: ${type}`);
    }
  }

  /**
   * Processa notificação de boas-vindas
   */
  async processWelcomeNotification(data) {
    const { reservationId, channel = 'whatsapp' } = data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        property: true
      }
    });

    if (!reservation || !reservation.guest) {
      throw new Error('Reserva ou hóspede não encontrado');
    }

    const result = await notificationService.sendWelcomeMessage(
      reservation,
      reservation.guest,
      reservation.property,
      channel
    );

    // Marcar como enviado
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { welcomeMessageSent: true }
    });

    return result;
  }

  /**
   * Processa lembrete de check-in
   */
  async processCheckinReminder(data) {
    const { reservationId, channel = 'whatsapp' } = data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        property: true
      }
    });

    if (!reservation || !reservation.guest) {
      throw new Error('Reserva ou hóspede não encontrado');
    }

    const result = await notificationService.sendCheckinReminder(
      reservation,
      reservation.guest,
      reservation.property,
      channel
    );

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { checkinReminderSent: true }
    });

    return result;
  }

  /**
   * Processa lembrete de checkout
   */
  async processCheckoutReminder(data) {
    const { reservationId, channel = 'whatsapp' } = data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        property: true
      }
    });

    if (!reservation || !reservation.guest) {
      throw new Error('Reserva ou hóspede não encontrado');
    }

    const result = await notificationService.sendCheckoutReminder(
      reservation,
      reservation.guest,
      reservation.property,
      channel
    );

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { checkoutReminderSent: true }
    });

    return result;
  }

  /**
   * Processa notificação de limpeza
   */
  async processCleaningNotification(data) {
    const { propertyId, checkouts } = data;

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      throw new Error('Propriedade não encontrada');
    }

    return notificationService.sendCleaningNotification(property, checkouts);
  }

  /**
   * Processa solicitação de avaliação
   */
  async processReviewRequest(data) {
    const { reservationId, channel = 'whatsapp' } = data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        property: true
      }
    });

    if (!reservation || !reservation.guest) {
      throw new Error('Reserva ou hóspede não encontrado');
    }

    const result = await notificationService.sendReviewRequest(
      reservation,
      reservation.guest,
      reservation.property,
      channel
    );

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { reviewRequestSent: true }
    });

    return result;
  }

  /**
   * Sincroniza calendário de uma propriedade
   */
  async syncPropertyCalendar(propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      throw new Error('Propriedade não encontrada');
    }

    const sources = [];

    if (property.icalAirbnb) {
      sources.push({ url: property.icalAirbnb, source: 'airbnb' });
    }
    if (property.icalBooking) {
      sources.push({ url: property.icalBooking, source: 'booking' });
    }
    if (property.icalOther) {
      sources.push({ url: property.icalOther, source: 'other' });
    }

    const allReservations = [];

    for (const { url, source } of sources) {
      try {
        const events = await icalService.fetchEvents(url);

        for (const event of events) {
          if (!event.start || !event.end) continue;

          const existingReservation = await prisma.reservation.findFirst({
            where: {
              propertyId,
              externalId: event.uid,
              source
            }
          });

          if (!existingReservation) {
            // Criar nova reserva
            const reservation = await prisma.reservation.create({
              data: {
                propertyId,
                checkinDate: new Date(event.start),
                checkoutDate: new Date(event.end),
                source,
                externalId: event.uid,
                status: 'confirmed',
                guestNotes: event.summary || 'Reserva importada',
                userId: property.userId
              }
            });
            allReservations.push(reservation);
          }
        }
      } catch (error) {
        console.error(`Erro ao sincronizar ${source}:`, error.message);
      }
    }

    return { imported: allReservations.length };
  }

  /**
   * Limpa dados antigos do banco
   */
  async cleanupOldData(options) {
    const daysToKeep = options.daysToKeep || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const results = {
      messageLogs: 0,
      webhookLogs: 0,
      processedEvents: 0,
      auditLogs: 0
    };

    // Limpar logs de mensagens antigos
    const deletedMessageLogs = await prisma.messageLog.deleteMany({
      where: { sentAt: { lt: cutoffDate } }
    });
    results.messageLogs = deletedMessageLogs.count;

    // Limpar logs de webhook antigos
    const deletedWebhookLogs = await prisma.webhookLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } }
    });
    results.webhookLogs = deletedWebhookLogs.count;

    // Limpar eventos processados antigos
    const deletedProcessedEvents = await prisma.processedEvent.deleteMany({
      where: { processedAt: { lt: cutoffDate } }
    });
    results.processedEvents = deletedProcessedEvents.count;

    // Limpar audit logs muito antigos (180 dias)
    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - 180);
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } }
    });
    results.auditLogs = deletedAuditLogs.count;

    console.log('🧹 Limpeza concluída:', results);
    return results;
  }

  /**
   * Retorna estatísticas das filas
   */
  async getStats() {
    if (!this.useRedis) {
      return {
        mode: 'in-memory',
        pendingJobs: this.pendingJobs.length
      };
    }

    const [
      notificationWaiting,
      notificationActive,
      notificationCompleted,
      notificationFailed,
      calendarWaiting,
      cleanupWaiting
    ] = await Promise.all([
      notificationQueue.getWaitingCount(),
      notificationQueue.getActiveCount(),
      notificationQueue.getCompletedCount(),
      notificationQueue.getFailedCount(),
      calendarSyncQueue.getWaitingCount(),
      cleanupQueue.getWaitingCount()
    ]);

    return {
      mode: 'redis',
      notifications: {
        waiting: notificationWaiting,
        active: notificationActive,
        completed: notificationCompleted,
        failed: notificationFailed
      },
      calendarSync: {
        waiting: calendarWaiting
      },
      cleanup: {
        waiting: cleanupWaiting
      }
    };
  }

  /**
   * Limpa todas as filas (para testes)
   */
  async clearAllQueues() {
    if (!this.useRedis) {
      this.pendingJobs = [];
      return;
    }

    await Promise.all([
      notificationQueue.empty(),
      calendarSyncQueue.empty(),
      cleanupQueue.empty()
    ]);
  }
}

// Singleton
const queueService = new QueueService();

export default queueService;
