/**
 * Serviço de Notificações Unificado
 * Suporta: WhatsApp, Email, SMS
 *
 * CREDENCIAIS NECESSÁRIAS (adicionar no .env):
 *
 * WhatsApp (via whatsapp-web.js - sem custo):
 *   - Nenhuma credencial necessária, usa QR Code
 *
 * Email (via Nodemailer + SMTP ou SendGrid):
 *   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   - OU: SENDGRID_API_KEY
 *
 * SMS (via Twilio):
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_PHONE_NUMBER
 */

import prisma from '../lib/prisma.js';
import whatsappService from './whatsapp.service.js';

// Placeholders para provedores externos (serão inicializados quando credenciais forem fornecidas)
let emailTransporter = null;
let twilioClient = null;

class NotificationService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Inicializa os provedores de notificação com base nas variáveis de ambiente
   */
  async initialize() {
    if (this.isInitialized) return;

    // Inicializar Email (Nodemailer)
    if (process.env.SMTP_HOST || process.env.SENDGRID_API_KEY) {
      try {
        const nodemailer = await import('nodemailer');

        if (process.env.SENDGRID_API_KEY) {
          // Usar SendGrid
          emailTransporter = nodemailer.default.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY
            }
          });
          console.log('✅ Email (SendGrid) configurado');
        } else if (process.env.SMTP_HOST) {
          // Usar SMTP genérico
          emailTransporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          });
          console.log('✅ Email (SMTP) configurado');
        }
      } catch (error) {
        console.warn('⚠️ Nodemailer não instalado. Execute: npm install nodemailer');
      }
    }

    // Inicializar SMS (Twilio)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = await import('twilio');
        twilioClient = twilio.default(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        console.log('✅ SMS (Twilio) configurado');
      } catch (error) {
        console.warn('⚠️ Twilio não instalado. Execute: npm install twilio');
      }
    }

    this.isInitialized = true;
  }

  /**
   * Envia uma notificação por qualquer canal
   * @param {Object} options - Opções da notificação
   * @param {string} options.channel - Canal: 'whatsapp', 'email', 'sms'
   * @param {string} options.recipient - Destino (telefone ou email)
   * @param {string} options.message - Conteúdo da mensagem
   * @param {string} [options.subject] - Assunto (apenas para email)
   * @param {number} [options.propertyId] - ID da propriedade (para log)
   * @param {number} [options.reservationId] - ID da reserva (para log)
   * @param {number} [options.userId] - ID do usuário
   * @param {string} [options.type] - Tipo da notificação (welcome, checkin_reminder, etc)
   * @returns {Promise<Object>} Resultado do envio
   */
  async send(options) {
    const {
      channel,
      recipient,
      message,
      subject,
      propertyId,
      reservationId,
      userId,
      type = 'custom'
    } = options;

    try {
      let result;

      switch (channel) {
        case 'whatsapp':
          result = await this.sendWhatsApp(recipient, message);
          break;
        case 'email':
          result = await this.sendEmail(recipient, subject, message);
          break;
        case 'sms':
          result = await this.sendSMS(recipient, message);
          break;
        default:
          throw new Error(`Canal não suportado: ${channel}`);
      }

      // Registrar no log
      await this.logNotification({
        type,
        channel,
        recipient,
        subject,
        message,
        status: 'sent',
        userId,
        reservationId,
        propertyId
      });

      return { success: true, ...result };
    } catch (error) {
      // Registrar falha no log
      await this.logNotification({
        type,
        channel,
        recipient,
        subject,
        message,
        status: 'failed',
        errorMessage: error.message,
        userId,
        reservationId,
        propertyId
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Envia mensagem via WhatsApp
   */
  async sendWhatsApp(phone, message) {
    const status = whatsappService.getStatus();

    if (status.status !== 'connected') {
      throw new Error('WhatsApp não está conectado');
    }

    await whatsappService.sendMessage(phone, message);
    return { channel: 'whatsapp', recipient: phone };
  }

  /**
   * Envia email
   */
  async sendEmail(to, subject, html) {
    if (!emailTransporter) {
      throw new Error('Email não configurado. Adicione SMTP_HOST ou SENDGRID_API_KEY no .env');
    }

    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@mevo.app';
    const fromName = process.env.EMAIL_FROM_NAME || 'Mevo';

    const info = await emailTransporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html
    });

    return { channel: 'email', recipient: to, messageId: info.messageId };
  }

  /**
   * Envia SMS via Twilio
   */
  async sendSMS(phone, message) {
    if (!twilioClient) {
      throw new Error('SMS não configurado. Adicione TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN no .env');
    }

    // Formata o número para formato internacional
    const formattedPhone = this.formatPhoneNumber(phone);

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    return { channel: 'sms', recipient: phone, sid: result.sid };
  }

  /**
   * Formata número de telefone para formato internacional
   */
  formatPhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');

    // Se já começa com +, retorna
    if (phone.startsWith('+')) {
      return phone;
    }

    // Se tem 10-11 dígitos, assume Brasil
    if (cleaned.length === 10 || cleaned.length === 11) {
      return `+55${cleaned}`;
    }

    // Se tem 12-13 dígitos e começa com 55, adiciona apenas o +
    if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith('55')) {
      return `+${cleaned}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Registra notificação no banco de dados
   */
  async logNotification(data) {
    try {
      await prisma.notificationLog.create({
        data: {
          type: data.type,
          channel: data.channel,
          recipient: data.recipient,
          subject: data.subject,
          message: data.message,
          status: data.status,
          errorMessage: data.errorMessage,
          sentAt: data.status === 'sent' ? new Date() : null,
          userId: data.userId,
          reservationId: data.reservationId
        }
      });
    } catch (error) {
      console.error('Erro ao registrar notificação:', error);
    }
  }

  /**
   * Processa um template substituindo placeholders
   * Placeholders suportados:
   * - {{guest_name}} - Nome do hóspede
   * - {{property_name}} - Nome da propriedade
   * - {{checkin_date}} - Data de check-in
   * - {{checkout_date}} - Data de checkout
   * - {{checkin_time}} - Horário de check-in
   * - {{checkout_time}} - Horário de checkout
   * - {{wifi_name}} - Nome do WiFi
   * - {{wifi_password}} - Senha do WiFi
   * - {{access_instructions}} - Instruções de acesso
   * - {{employee_name}} - Nome do funcionário
   * - {{total_amount}} - Valor total
   */
  processTemplate(template, data) {
    let result = template;

    const replacements = {
      '{{guest_name}}': data.guestName || '',
      '{{property_name}}': data.propertyName || '',
      '{{checkin_date}}': data.checkinDate ? this.formatDate(data.checkinDate) : '',
      '{{checkout_date}}': data.checkoutDate ? this.formatDate(data.checkoutDate) : '',
      '{{checkin_time}}': data.checkinTime || '',
      '{{checkout_time}}': data.checkoutTime || '',
      '{{wifi_name}}': data.wifiName || '',
      '{{wifi_password}}': data.wifiPassword || '',
      '{{access_instructions}}': data.accessInstructions || '',
      '{{employee_name}}': data.employeeName || '',
      '{{total_amount}}': data.totalAmount ? this.formatCurrency(data.totalAmount) : '',
      '{{reservation_id}}': data.reservationId || '',
      '{{adults}}': data.adults || '1',
      '{{children}}': data.children || '0'
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Formata data para exibição
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Formata valor monetário
   */
  formatCurrency(amount, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency
    }).format(amount);
  }

  /**
   * Busca e aplica um template do banco de dados
   */
  async getTemplateAndProcess(templateType, channel, userId, data) {
    const template = await prisma.messageTemplate.findFirst({
      where: {
        type: templateType,
        channel,
        isActive: true,
        OR: [
          { userId },
          { userId: null } // Templates globais
        ]
      },
      orderBy: {
        userId: 'desc' // Prioriza templates do usuário
      }
    });

    if (!template) {
      return null;
    }

    return {
      subject: template.subject ? this.processTemplate(template.subject, data) : null,
      content: this.processTemplate(template.content, data),
      templateId: template.id,
      templateName: template.name
    };
  }

  /**
   * Envia notificação de boas-vindas para hóspede
   */
  async sendWelcomeMessage(reservation, guest, property, channel = 'whatsapp') {
    const data = {
      guestName: guest.name,
      propertyName: property.name,
      checkinDate: reservation.checkinDate,
      checkoutDate: reservation.checkoutDate,
      checkinTime: reservation.checkinTime || property.checkinTime || '15:00',
      checkoutTime: reservation.checkoutTime || property.checkoutTime || '11:00',
      wifiName: property.wifiName,
      wifiPassword: property.wifiPassword,
      accessInstructions: property.accessInstructions
    };

    const template = await this.getTemplateAndProcess('welcome', channel, property.userId, data);

    if (!template) {
      // Mensagem padrão
      template = {
        content: `Olá ${data.guestName}! 🏠\n\nSeja bem-vindo(a) ao ${data.propertyName}!\n\nSeu check-in está confirmado para ${this.formatDate(data.checkinDate)} às ${data.checkinTime}.\n\nQualquer dúvida, estamos à disposição!\n\nAté breve! 😊`
      };
    }

    const recipient = channel === 'email' ? guest.email : (guest.whatsapp || guest.phone);

    if (!recipient) {
      throw new Error(`Hóspede não possui ${channel} cadastrado`);
    }

    return this.send({
      channel,
      recipient,
      message: template.content,
      subject: template.subject,
      type: 'welcome',
      propertyId: property.id,
      reservationId: reservation.id,
      userId: property.userId
    });
  }

  /**
   * Envia lembrete de check-in
   */
  async sendCheckinReminder(reservation, guest, property, channel = 'whatsapp') {
    const data = {
      guestName: guest.name,
      propertyName: property.name,
      checkinDate: reservation.checkinDate,
      checkinTime: reservation.checkinTime || property.checkinTime || '15:00',
      accessInstructions: property.accessInstructions
    };

    let template = await this.getTemplateAndProcess('checkin_reminder', channel, property.userId, data);

    if (!template) {
      template = {
        content: `Olá ${data.guestName}! 📅\n\nLembrando que seu check-in no ${data.propertyName} é amanhã às ${data.checkinTime}!\n\n${data.accessInstructions ? `Instruções de acesso:\n${data.accessInstructions}\n\n` : ''}Boa viagem! 🚗`
      };
    }

    const recipient = channel === 'email' ? guest.email : (guest.whatsapp || guest.phone);

    if (!recipient) {
      throw new Error(`Hóspede não possui ${channel} cadastrado`);
    }

    return this.send({
      channel,
      recipient,
      message: template.content,
      subject: template.subject,
      type: 'checkin_reminder',
      propertyId: property.id,
      reservationId: reservation.id,
      userId: property.userId
    });
  }

  /**
   * Envia lembrete de checkout
   */
  async sendCheckoutReminder(reservation, guest, property, channel = 'whatsapp') {
    const data = {
      guestName: guest.name,
      propertyName: property.name,
      checkoutDate: reservation.checkoutDate,
      checkoutTime: reservation.checkoutTime || property.checkoutTime || '11:00'
    };

    let template = await this.getTemplateAndProcess('checkout_reminder', channel, property.userId, data);

    if (!template) {
      template = {
        content: `Olá ${data.guestName}! 🏠\n\nLembrando que seu checkout do ${data.propertyName} é amanhã às ${data.checkoutTime}.\n\nPor favor, lembre-se de:\n• Verificar se não esqueceu nada\n• Deixar as chaves no local indicado\n• Fechar janelas e portas\n\nEsperamos que tenha tido uma ótima estadia! 😊`
      };
    }

    const recipient = channel === 'email' ? guest.email : (guest.whatsapp || guest.phone);

    if (!recipient) {
      throw new Error(`Hóspede não possui ${channel} cadastrado`);
    }

    return this.send({
      channel,
      recipient,
      message: template.content,
      subject: template.subject,
      type: 'checkout_reminder',
      propertyId: property.id,
      reservationId: reservation.id,
      userId: property.userId
    });
  }

  /**
   * Envia mensagem de limpeza para funcionário
   */
  async sendCleaningNotification(property, checkouts, channel = 'whatsapp') {
    const data = {
      employeeName: property.employeeName,
      propertyName: property.name,
      checkoutTime: checkouts[0]?.checkoutTime || property.checkoutTime || '11:00'
    };

    let template = await this.getTemplateAndProcess('cleaning', channel, property.userId, data);

    if (!template) {
      if (checkouts.length === 1) {
        template = {
          content: `Olá ${data.employeeName}! 🧹\n\nHoje tem limpeza no ${data.propertyName} às ${data.checkoutTime}.\n\nBom trabalho! 💪`
        };
      } else {
        const propertyList = checkouts.map(c => `• ${c.propertyName} às ${c.checkoutTime}`).join('\n');
        template = {
          content: `Olá ${data.employeeName}! 🧹\n\nHoje você tem ${checkouts.length} limpezas:\n\n${propertyList}\n\nBom trabalho! 💪`
        };
      }
    }

    return this.send({
      channel,
      recipient: property.employeePhone,
      message: template.content,
      subject: template.subject,
      type: 'cleaning',
      propertyId: property.id,
      userId: property.userId
    });
  }

  /**
   * Envia solicitação de avaliação
   */
  async sendReviewRequest(reservation, guest, property, channel = 'whatsapp') {
    const data = {
      guestName: guest.name,
      propertyName: property.name
    };

    let template = await this.getTemplateAndProcess('review_request', channel, property.userId, data);

    if (!template) {
      template = {
        content: `Olá ${data.guestName}! ⭐\n\nEsperamos que tenha curtido sua estadia no ${data.propertyName}!\n\nSe puder, deixe uma avaliação. Sua opinião é muito importante para nós!\n\nObrigado e até a próxima! 😊`
      };
    }

    const recipient = channel === 'email' ? guest.email : (guest.whatsapp || guest.phone);

    if (!recipient) {
      throw new Error(`Hóspede não possui ${channel} cadastrado`);
    }

    return this.send({
      channel,
      recipient,
      message: template.content,
      subject: template.subject,
      type: 'review_request',
      propertyId: property.id,
      reservationId: reservation.id,
      userId: property.userId
    });
  }

  /**
   * Retorna status dos provedores de notificação
   */
  getProvidersStatus() {
    return {
      whatsapp: whatsappService.getStatus(),
      email: {
        configured: emailTransporter !== null,
        provider: process.env.SENDGRID_API_KEY ? 'sendgrid' : (process.env.SMTP_HOST ? 'smtp' : null)
      },
      sms: {
        configured: twilioClient !== null,
        provider: 'twilio'
      }
    };
  }
}

// Singleton
const notificationService = new NotificationService();

export default notificationService;
