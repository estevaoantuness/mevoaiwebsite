import cron from 'node-cron';
import dayjs from 'dayjs';
import prisma from '../lib/prisma.js';
import icalService from './ical.service.js';
import whatsappService from './whatsapp.service.js';

class WorkerService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Inicia o cron job diário às 08:00
   */
  start() {
    // Executa todo dia às 08:00
    cron.schedule('0 8 * * *', () => {
      console.log('Worker iniciado às', new Date().toLocaleString());
      this.processAllUsers();
    });

    console.log('Worker agendado para 08:00 diariamente');
  }

  /**
   * Executa o processamento manualmente para um usuário específico
   */
  async runNow(userId = null) {
    console.log('Executando worker manualmente...');

    if (userId) {
      await this.processCheckoutsForUser(userId);
    } else {
      await this.processAllUsers();
    }
  }

  /**
   * Processa checkouts para todos os usuários
   */
  async processAllUsers() {
    // Verifica se WhatsApp está conectado ANTES de processar
    const whatsappStatus = whatsappService.getStatus();
    if (whatsappStatus.status !== 'connected') {
      console.log('WhatsApp não está conectado. Abortando worker.');
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        properties: {
          some: {} // Apenas usuários que têm pelo menos 1 imóvel
        }
      }
    });

    console.log(`Processando ${users.length} usuário(s)...`);

    for (const user of users) {
      await this.processCheckoutsForUser(user.id);
    }
  }

  /**
   * Processa checkouts de um usuário específico
   */
  async processCheckoutsForUser(userId) {
    if (this.isRunning) {
      console.log('Worker já está em execução');
      return;
    }

    this.isRunning = true;
    const today = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(today);

    try {
      // Verifica se WhatsApp está conectado
      const whatsappStatus = whatsappService.getStatus();
      if (whatsappStatus.status !== 'connected') {
        console.log('WhatsApp não está conectado. Abortando.');
        return;
      }

      // Busca configurações do usuário (ou globais como fallback)
      const messageTemplateSetting = await prisma.setting.findUnique({
        where: { key: 'message_template' }
      });
      const defaultTimeSetting = await prisma.setting.findUnique({
        where: { key: 'default_checkout_time' }
      });

      const messageTemplate = messageTemplateSetting?.value || null;
      const defaultCheckoutTime = defaultTimeSetting?.value || '11:00';

      // Busca apenas os imóveis do usuário específico
      const properties = await prisma.property.findMany({
        where: { userId: userId }
      });

      if (properties.length === 0) {
        console.log(`Usuário ${userId}: Nenhum imóvel cadastrado`);
        return;
      }

      console.log(`Usuário ${userId}: Processando ${properties.length} imóvel(is)...`);

      // Coleta checkouts de todos os imóveis do usuário
      const allCheckouts = [];

      for (const property of properties) {
        // Mapear para formato esperado pelo icalService
        const propertyMapped = {
          id: property.id,
          name: property.name,
          ical_airbnb: property.icalAirbnb,
          ical_booking: property.icalBooking,
          employee_name: property.employeeName,
          employee_phone: property.employeePhone,
          checkout_time: property.checkoutTime
        };

        const checkouts = await icalService.getCheckoutsForProperty(propertyMapped);

        for (const checkout of checkouts) {
          // Verifica se já foi processado
          const processed = await prisma.processedEvent.findFirst({
            where: {
              propertyId: property.id,
              eventUid: checkout.uid,
              eventDate: todayDate
            }
          });

          if (!processed) {
            allCheckouts.push({
              ...checkout,
              employeeName: property.employeeName,
              employeePhone: property.employeePhone,
              checkoutTime: property.checkoutTime || defaultCheckoutTime
            });
          }
        }
      }

      if (allCheckouts.length === 0) {
        console.log(`Usuário ${userId}: Nenhum checkout para hoje`);
        return;
      }

      // Agrupa por funcionária (telefone)
      const groupedByEmployee = this.groupByEmployee(allCheckouts);

      // Envia mensagens
      for (const [phone, data] of Object.entries(groupedByEmployee)) {
        // Usa template personalizado ou mensagem padrão
        const message = messageTemplate
          ? this.buildMessageFromTemplate(messageTemplate, data)
          : this.buildMessage(data);

        try {
          await whatsappService.sendMessage(phone, message);

          // Registra no log e marca como processado
          for (const checkout of data.checkouts) {
            // Log da mensagem
            await prisma.messageLog.create({
              data: {
                propertyId: checkout.propertyId,
                employeePhone: phone,
                message: message,
                status: 'sent'
              }
            });

            // Marca evento como processado (upsert para evitar duplicação)
            await prisma.processedEvent.upsert({
              where: {
                propertyId_eventUid_eventDate: {
                  propertyId: checkout.propertyId,
                  eventUid: checkout.uid,
                  eventDate: todayDate
                }
              },
              update: {},
              create: {
                propertyId: checkout.propertyId,
                eventUid: checkout.uid,
                eventDate: todayDate
              }
            });
          }

          console.log(`Mensagem enviada para ${data.employeeName} (${phone})`);
        } catch (error) {
          console.error(`Erro ao enviar para ${phone}:`, error);

          // Registra falha
          await prisma.messageLog.create({
            data: {
              propertyId: data.checkouts[0]?.propertyId,
              employeePhone: phone,
              message: message,
              status: 'failed'
            }
          });
        }
      }

      console.log(`Usuário ${userId}: ${allCheckouts.length} checkout(s) processado(s).`);
    } catch (error) {
      console.error(`Erro no worker para usuário ${userId}:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Agrupa checkouts por telefone da funcionária
   */
  groupByEmployee(checkouts) {
    const grouped = {};

    for (const checkout of checkouts) {
      const phone = checkout.employeePhone;

      if (!grouped[phone]) {
        grouped[phone] = {
          employeeName: checkout.employeeName,
          checkouts: []
        };
      }

      grouped[phone].checkouts.push(checkout);
    }

    return grouped;
  }

  /**
   * Monta mensagem a partir do template do banco
   */
  buildMessageFromTemplate(template, data) {
    const { employeeName, checkouts } = data;

    if (checkouts.length === 1) {
      const c = checkouts[0];
      return template
        .replace(/\(nome da funcionária\)/gi, employeeName)
        .replace(/\(nome do imóvel\)/gi, c.propertyName)
        .replace(/\(horário\)/gi, c.checkoutTime);
    }

    // Múltiplos imóveis - usa template para cada um e junta
    const propertyList = checkouts
      .map(c => `• ${c.propertyName} às ${c.checkoutTime}`)
      .join('\n');

    return `Olá ${employeeName}! Hoje você tem ${checkouts.length} limpezas:\n\n${propertyList}\n\nBom trabalho!`;
  }

  /**
   * Monta mensagem padrão (fallback)
   */
  buildMessage(data) {
    const { employeeName, checkouts } = data;

    if (checkouts.length === 1) {
      const c = checkouts[0];
      return `Olá ${employeeName}! Hoje tem limpeza no ${c.propertyName} às ${c.checkoutTime}. Bom trabalho!`;
    }

    // Múltiplos imóveis
    const propertyList = checkouts
      .map(c => `• ${c.propertyName} às ${c.checkoutTime}`)
      .join('\n');

    return `Olá ${employeeName}! Hoje você tem ${checkouts.length} limpezas:\n\n${propertyList}\n\nBom trabalho!`;
  }
}

const workerService = new WorkerService();

export default workerService;
