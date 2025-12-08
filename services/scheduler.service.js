/**
 * Serviço de Agendamento de Tarefas
 *
 * Gerencia tarefas automáticas:
 * - Envio de lembretes de check-in/checkout
 * - Notificações de limpeza
 * - Sincronização de calendários
 * - Limpeza de dados antigos
 * - Solicitações de avaliação
 */

import cron from 'node-cron';
import dayjs from 'dayjs';
import prisma from '../lib/prisma.js';
import queueService from './queue.service.js';
import notificationService from './notification.service.js';
import icalService from './ical.service.js';
import webhookService from './webhook.service.js';
import whatsappService from './whatsapp.service.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Inicia todos os cron jobs
   */
  start() {
    if (this.isRunning) return;

    console.log('⏰ Iniciando scheduler de automação...');

    // Job: Sincronizar calendários (a cada 30 minutos)
    this.addJob('calendar-sync', '*/30 * * * *', async () => {
      await this.syncAllCalendars();
    });

    // Job: Enviar lembretes de check-in (08:00 diariamente)
    this.addJob('checkin-reminders', '0 8 * * *', async () => {
      await this.sendCheckinReminders();
    });

    // Job: Enviar lembretes de checkout (08:00 diariamente)
    this.addJob('checkout-reminders', '0 8 * * *', async () => {
      await this.sendCheckoutReminders();
    });

    // Job: Notificar funcionários sobre limpezas (07:00 diariamente)
    this.addJob('cleaning-notifications', '0 7 * * *', async () => {
      await this.sendCleaningNotifications();
    });

    // Job: Enviar solicitações de avaliação (18:00 diariamente)
    this.addJob('review-requests', '0 18 * * *', async () => {
      await this.sendReviewRequests();
    });

    // Job: Limpeza de dados antigos (03:00 aos domingos)
    this.addJob('cleanup', '0 3 * * 0', async () => {
      await queueService.addCleanupJob();
    });

    // Job: Verificar reservas do dia (06:00 diariamente)
    this.addJob('daily-summary', '0 6 * * *', async () => {
      await this.generateDailySummary();
    });

    this.isRunning = true;
    console.log(`✅ ${this.jobs.size} jobs agendados`);
  }

  /**
   * Para todos os cron jobs
   */
  stop() {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Job '${name}' parado`);
    }
    this.jobs.clear();
    this.isRunning = false;
  }

  /**
   * Adiciona um cron job
   */
  addJob(name, schedule, handler) {
    const job = cron.schedule(schedule, async () => {
      console.log(`🔄 Executando job '${name}'...`);
      const start = Date.now();

      try {
        await handler();
        console.log(`✅ Job '${name}' concluído em ${Date.now() - start}ms`);
      } catch (error) {
        console.error(`❌ Erro no job '${name}':`, error.message);

        // Registrar erro no audit log
        await prisma.auditLog.create({
          data: {
            action: 'job_failed',
            entity: 'scheduler',
            newData: JSON.stringify({ job: name, error: error.message })
          }
        });
      }
    });

    this.jobs.set(name, job);
    console.log(`📅 Job '${name}' agendado: ${schedule}`);
  }

  /**
   * Executa um job manualmente
   */
  async runJob(name) {
    switch (name) {
      case 'calendar-sync':
        return this.syncAllCalendars();
      case 'checkin-reminders':
        return this.sendCheckinReminders();
      case 'checkout-reminders':
        return this.sendCheckoutReminders();
      case 'cleaning-notifications':
        return this.sendCleaningNotifications();
      case 'review-requests':
        return this.sendReviewRequests();
      case 'cleanup':
        return queueService.addCleanupJob();
      case 'daily-summary':
        return this.generateDailySummary();
      default:
        throw new Error(`Job '${name}' não encontrado`);
    }
  }

  /**
   * Sincroniza calendários de todas as propriedades
   */
  async syncAllCalendars() {
    const properties = await prisma.property.findMany({
      where: {
        isActive: true,
        OR: [
          { icalAirbnb: { not: null } },
          { icalBooking: { not: null } },
          { icalOther: { not: null } }
        ]
      }
    });

    console.log(`📅 Sincronizando calendários de ${properties.length} propriedade(s)`);

    let totalImported = 0;

    for (const property of properties) {
      try {
        const result = await queueService.syncPropertyCalendar(property.id);
        totalImported += result.imported || 0;

        // Disparar webhook
        if (result.imported > 0) {
          await webhookService.trigger('calendar.synced', {
            propertyId: property.id,
            propertyName: property.name,
            imported: result.imported
          }, property.userId);
        }
      } catch (error) {
        console.error(`Erro ao sincronizar propriedade ${property.id}:`, error.message);
      }
    }

    return { properties: properties.length, imported: totalImported };
  }

  /**
   * Envia lembretes de check-in para hóspedes
   * (Para check-ins que ocorrem amanhã)
   */
  async sendCheckinReminders() {
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
    const dayAfter = dayjs().add(2, 'day').startOf('day').toDate();

    const reservations = await prisma.reservation.findMany({
      where: {
        checkinDate: {
          gte: tomorrow,
          lt: dayAfter
        },
        status: 'confirmed',
        checkinReminderSent: false
      },
      include: {
        guest: true,
        property: true
      }
    });

    console.log(`📬 Enviando ${reservations.length} lembrete(s) de check-in`);

    let sent = 0;
    let failed = 0;

    for (const reservation of reservations) {
      if (!reservation.guest) continue;

      try {
        await queueService.addNotificationJob('checkin_reminder', {
          reservationId: reservation.id,
          channel: reservation.guest.whatsapp ? 'whatsapp' : 'email'
        });
        sent++;
      } catch (error) {
        console.error(`Erro ao enviar lembrete para reserva ${reservation.id}:`, error.message);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Envia lembretes de checkout para hóspedes
   * (Para checkouts que ocorrem amanhã)
   */
  async sendCheckoutReminders() {
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
    const dayAfter = dayjs().add(2, 'day').startOf('day').toDate();

    const reservations = await prisma.reservation.findMany({
      where: {
        checkoutDate: {
          gte: tomorrow,
          lt: dayAfter
        },
        status: 'confirmed',
        checkoutReminderSent: false
      },
      include: {
        guest: true,
        property: true
      }
    });

    console.log(`📬 Enviando ${reservations.length} lembrete(s) de checkout`);

    let sent = 0;

    for (const reservation of reservations) {
      if (!reservation.guest) continue;

      try {
        await queueService.addNotificationJob('checkout_reminder', {
          reservationId: reservation.id,
          channel: reservation.guest.whatsapp ? 'whatsapp' : 'email'
        });
        sent++;
      } catch (error) {
        console.error(`Erro ao enviar lembrete para reserva ${reservation.id}:`, error.message);
      }
    }

    return { sent };
  }

  /**
   * Envia notificações de limpeza para funcionários
   * (Para checkouts de hoje)
   */
  async sendCleaningNotifications() {
    // Verificar se WhatsApp está conectado
    const whatsappStatus = whatsappService.getStatus();
    if (whatsappStatus.status !== 'connected') {
      console.log('⚠️ WhatsApp não conectado. Pulando notificações de limpeza.');
      return { sent: 0, reason: 'whatsapp_disconnected' };
    }

    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();

    // Buscar propriedades com checkout hoje
    const properties = await prisma.property.findMany({
      where: {
        isActive: true,
        reservations: {
          some: {
            checkoutDate: {
              gte: today,
              lt: tomorrow
            },
            status: 'confirmed'
          }
        }
      },
      include: {
        reservations: {
          where: {
            checkoutDate: {
              gte: today,
              lt: tomorrow
            },
            status: 'confirmed'
          }
        }
      }
    });

    // Agrupar por funcionário
    const byEmployee = new Map();

    for (const property of properties) {
      const phone = property.employeePhone;
      if (!phone) continue;

      if (!byEmployee.has(phone)) {
        byEmployee.set(phone, {
          employeeName: property.employeeName,
          checkouts: []
        });
      }

      byEmployee.get(phone).checkouts.push({
        propertyId: property.id,
        propertyName: property.name,
        checkoutTime: property.checkoutTime || '11:00'
      });
    }

    console.log(`🧹 Enviando notificações de limpeza para ${byEmployee.size} funcionário(s)`);

    let sent = 0;

    for (const [phone, data] of byEmployee) {
      try {
        // Verificar se já foi notificado hoje
        const alreadySent = await prisma.processedEvent.findFirst({
          where: {
            propertyId: data.checkouts[0].propertyId,
            eventDate: today,
            eventType: 'checkout'
          }
        });

        if (alreadySent) {
          console.log(`Funcionário ${phone} já notificado hoje`);
          continue;
        }

        await queueService.addNotificationJob('cleaning', {
          propertyId: data.checkouts[0].propertyId,
          checkouts: data.checkouts
        });

        // Marcar como processado
        for (const checkout of data.checkouts) {
          await prisma.processedEvent.upsert({
            where: {
              propertyId_eventUid_eventDate_eventType: {
                propertyId: checkout.propertyId,
                eventUid: `cleaning-${today.toISOString().split('T')[0]}`,
                eventDate: today,
                eventType: 'checkout'
              }
            },
            update: {},
            create: {
              propertyId: checkout.propertyId,
              eventUid: `cleaning-${today.toISOString().split('T')[0]}`,
              eventDate: today,
              eventType: 'checkout'
            }
          });
        }

        sent++;
      } catch (error) {
        console.error(`Erro ao notificar funcionário ${phone}:`, error.message);
      }
    }

    return { sent };
  }

  /**
   * Envia solicitações de avaliação
   * (Para checkouts que ocorreram ontem)
   */
  async sendReviewRequests() {
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
    const today = dayjs().startOf('day').toDate();

    const reservations = await prisma.reservation.findMany({
      where: {
        checkoutDate: {
          gte: yesterday,
          lt: today
        },
        status: 'confirmed',
        reviewRequestSent: false
      },
      include: {
        guest: true,
        property: true
      }
    });

    console.log(`⭐ Enviando ${reservations.length} solicitação(ões) de avaliação`);

    let sent = 0;

    for (const reservation of reservations) {
      if (!reservation.guest) continue;

      try {
        await queueService.addNotificationJob('review_request', {
          reservationId: reservation.id,
          channel: reservation.guest.email ? 'email' : 'whatsapp'
        });

        // Marcar como completada
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'completed' }
        });

        sent++;
      } catch (error) {
        console.error(`Erro ao enviar solicitação para reserva ${reservation.id}:`, error.message);
      }
    }

    return { sent };
  }

  /**
   * Gera resumo diário de reservas
   */
  async generateDailySummary() {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();

    const [checkinsToday, checkoutsToday, totalReservations] = await Promise.all([
      prisma.reservation.count({
        where: {
          checkinDate: { gte: today, lt: tomorrow },
          status: 'confirmed'
        }
      }),
      prisma.reservation.count({
        where: {
          checkoutDate: { gte: today, lt: tomorrow },
          status: 'confirmed'
        }
      }),
      prisma.reservation.count({
        where: {
          status: { in: ['pending', 'confirmed'] }
        }
      })
    ]);

    console.log(`📊 Resumo do dia: ${checkinsToday} check-ins, ${checkoutsToday} checkouts, ${totalReservations} reservas ativas`);

    return {
      date: today,
      checkinsToday,
      checkoutsToday,
      totalReservations
    };
  }

  /**
   * Lista status de todos os jobs
   */
  getStatus() {
    const status = [];

    for (const [name, job] of this.jobs) {
      status.push({
        name,
        running: job.running || false
      });
    }

    return {
      isRunning: this.isRunning,
      jobs: status,
      totalJobs: this.jobs.size
    };
  }
}

// Singleton
const schedulerService = new SchedulerService();

export default schedulerService;
