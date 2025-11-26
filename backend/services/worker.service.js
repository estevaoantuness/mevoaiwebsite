import cron from 'node-cron';
import dayjs from 'dayjs';
import dbPromise from '../database/db.js';
import icalService from './ical.service.js';
import whatsappService from './whatsapp.service.js';

let db;
dbPromise.then(d => db = d);

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
      this.processCheckouts();
    });

    console.log('Worker agendado para 08:00 diariamente');
  }

  /**
   * Executa o processamento manualmente (para testes)
   */
  async runNow() {
    console.log('Executando worker manualmente...');
    await this.processCheckouts();
  }

  /**
   * Processa todos os checkouts do dia
   */
  async processCheckouts() {
    if (this.isRunning) {
      console.log('Worker já está em execução');
      return;
    }

    this.isRunning = true;
    const today = dayjs().format('YYYY-MM-DD');

    try {
      // Busca configuração de horário padrão
      const defaultTime = db.prepare("SELECT value FROM settings WHERE key = 'default_checkout_time'").get();
      const defaultCheckoutTime = defaultTime?.value || '11:00';

      // Busca todos os imóveis
      const properties = db.prepare('SELECT * FROM properties').all();

      if (properties.length === 0) {
        console.log('Nenhum imóvel cadastrado');
        return;
      }

      // Coleta checkouts de todos os imóveis
      const allCheckouts = [];

      for (const property of properties) {
        const checkouts = await icalService.getCheckoutsForProperty(property);

        for (const checkout of checkouts) {
          // Verifica se já foi processado
          const processed = db.prepare(`
            SELECT id FROM processed_events
            WHERE property_id = ? AND event_uid = ? AND event_date = ?
          `).get(property.id, checkout.uid, today);

          if (!processed) {
            allCheckouts.push({
              ...checkout,
              employeeName: property.employee_name,
              employeePhone: property.employee_phone,
              checkoutTime: property.checkout_time || defaultCheckoutTime
            });
          }
        }
      }

      if (allCheckouts.length === 0) {
        console.log('Nenhum checkout para hoje');
        return;
      }

      // Agrupa por funcionária (telefone)
      const groupedByEmployee = this.groupByEmployee(allCheckouts);

      // Envia mensagens
      for (const [phone, data] of Object.entries(groupedByEmployee)) {
        const message = this.buildMessage(data);

        try {
          await whatsappService.sendMessage(phone, message);

          // Registra no log e marca como processado
          for (const checkout of data.checkouts) {
            // Log da mensagem
            db.prepare(`
              INSERT INTO message_logs (property_id, employee_phone, message, status)
              VALUES (?, ?, ?, 'sent')
            `).run(checkout.propertyId, phone, message);

            // Marca evento como processado
            db.prepare(`
              INSERT OR IGNORE INTO processed_events (property_id, event_uid, event_date)
              VALUES (?, ?, ?)
            `).run(checkout.propertyId, checkout.uid, today);
          }

          console.log(`Mensagem enviada para ${data.employeeName} (${phone})`);
        } catch (error) {
          console.error(`Erro ao enviar para ${phone}:`, error);

          // Registra falha
          db.prepare(`
            INSERT INTO message_logs (property_id, employee_phone, message, status)
            VALUES (?, ?, ?, 'failed')
          `).run(data.checkouts[0]?.propertyId, phone, message);
        }
      }

      console.log(`Worker finalizado. ${allCheckouts.length} checkout(s) processado(s).`);
    } catch (error) {
      console.error('Erro no worker:', error);
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
   * Monta mensagem consolidada para a funcionária
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
