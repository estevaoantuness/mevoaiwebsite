import ical from 'node-ical';
import dayjs from 'dayjs';
import prisma from '../lib/prisma.js';

class ICalService {
  constructor() {
    this.syncInterval = 30; // minutos
  }

  /**
   * Busca eventos de um calendário iCal
   * @param {string} url - URL do iCal
   * @returns {Promise<Array>} Lista de eventos
   */
  async fetchEvents(url) {
    if (!url) return [];

    try {
      const events = await ical.async.fromURL(url);
      return Object.values(events).filter(event => event.type === 'VEVENT');
    } catch (error) {
      console.error(`Erro ao buscar iCal: ${url}`, error);
      return [];
    }
  }

  /**
   * Extrai informações de um evento iCal
   * Airbnb e Booking têm formatos diferentes
   */
  parseEvent(event, source) {
    const uid = event.uid || `${source}-${Date.now()}`;
    const summary = event.summary || '';
    const description = event.description || '';

    // Datas
    const checkIn = event.start ? dayjs(event.start).format('YYYY-MM-DD') : null;
    const checkOut = event.end ? dayjs(event.end).format('YYYY-MM-DD') : null;

    // Tenta extrair nome do hóspede
    let guestName = 'Hóspede';
    let guestPhone = null;
    let confirmationCode = null;
    let platform = source;

    if (source === 'airbnb') {
      // Airbnb: "Nome do Hóspede (ABC123)"
      const match = summary.match(/^(.+?)\s*\(([A-Z0-9]+)\)$/);
      if (match) {
        guestName = match[1].trim();
        confirmationCode = match[2];
      } else if (summary !== 'Reserved' && summary !== 'Blocked') {
        guestName = summary;
      }

      // Telefone pode estar na descrição
      const phoneMatch = description.match(/Phone:\s*(\+?[\d\s-]+)/i);
      if (phoneMatch) {
        guestPhone = phoneMatch[1].replace(/\s/g, '');
      }
    } else if (source === 'booking') {
      // Booking: "CLOSED - Nome do Hóspede"
      const match = summary.match(/^CLOSED\s*-\s*(.+)$/i);
      if (match) {
        guestName = match[1].trim();
      } else if (!summary.includes('CLOSED') && !summary.includes('Not available')) {
        guestName = summary;
      }

      // Booking confirmation
      const confMatch = description.match(/Booking\.com:\s*(\d+)/i);
      if (confMatch) {
        confirmationCode = confMatch[1];
      }
    }

    // Detecta se é bloqueio (não é reserva real)
    const isBlocked =
      summary.toLowerCase().includes('blocked') ||
      summary.toLowerCase().includes('not available') ||
      summary.toLowerCase().includes('unavailable') ||
      guestName === 'Hóspede';

    return {
      uid,
      source,
      platform,
      guestName,
      guestPhone,
      confirmationCode,
      checkIn,
      checkOut,
      summary,
      description,
      isBlocked,
      raw: event
    };
  }

  /**
   * Sincroniza calendário de uma propriedade
   * Cria/atualiza reservas no banco
   */
  async syncProperty(property) {
    const results = {
      propertyId: property.id,
      propertyName: property.name,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    const sources = [
      { url: property.icalAirbnb, source: 'airbnb' },
      { url: property.icalBooking, source: 'booking' }
    ];

    for (const { url, source } of sources) {
      if (!url) continue;

      try {
        console.log(`📅 Sincronizando ${source} para ${property.name}...`);
        const events = await this.fetchEvents(url);

        for (const event of events) {
          try {
            const parsed = this.parseEvent(event, source);

            // Pula bloqueios
            if (parsed.isBlocked) {
              results.skipped++;
              continue;
            }

            // Pula eventos sem datas válidas
            if (!parsed.checkIn || !parsed.checkOut) {
              results.skipped++;
              continue;
            }

            // Pula eventos passados (checkout já foi)
            if (dayjs(parsed.checkOut).isBefore(dayjs(), 'day')) {
              results.skipped++;
              continue;
            }

            // Verifica se evento já foi processado
            const existingEvent = await prisma.processedEvent.findUnique({
              where: { eventUid: parsed.uid }
            });

            if (existingEvent) {
              // Atualiza reserva existente se dados mudaram
              const reservation = await prisma.reservation.findFirst({
                where: { externalId: parsed.uid }
              });

              if (reservation) {
                const needsUpdate =
                  reservation.checkIn.toISOString().split('T')[0] !== parsed.checkIn ||
                  reservation.checkOut.toISOString().split('T')[0] !== parsed.checkOut;

                if (needsUpdate) {
                  await prisma.reservation.update({
                    where: { id: reservation.id },
                    data: {
                      checkIn: new Date(parsed.checkIn),
                      checkOut: new Date(parsed.checkOut)
                    }
                  });
                  results.updated++;
                } else {
                  results.skipped++;
                }
              }
              continue;
            }

            // Busca ou cria hóspede
            let guest = await prisma.guest.findFirst({
              where: {
                userId: property.userId,
                OR: [
                  { name: parsed.guestName },
                  ...(parsed.guestPhone ? [{ phone: parsed.guestPhone }] : [])
                ]
              }
            });

            if (!guest) {
              guest = await prisma.guest.create({
                data: {
                  userId: property.userId,
                  name: parsed.guestName,
                  phone: parsed.guestPhone,
                  source: parsed.platform
                }
              });
            }

            // Cria reserva
            await prisma.reservation.create({
              data: {
                userId: property.userId,
                propertyId: property.id,
                guestId: guest.id,
                externalId: parsed.uid,
                platform: parsed.platform,
                confirmationCode: parsed.confirmationCode,
                checkIn: new Date(parsed.checkIn),
                checkOut: new Date(parsed.checkOut),
                status: 'CONFIRMED',
                notes: parsed.description
              }
            });

            // Marca evento como processado
            await prisma.processedEvent.create({
              data: {
                eventUid: parsed.uid,
                propertyId: property.id,
                source: parsed.source,
                processedAt: new Date()
              }
            });

            results.created++;
            console.log(`  ✅ Nova reserva: ${parsed.guestName} (${parsed.checkIn} - ${parsed.checkOut})`);

          } catch (eventError) {
            results.errors.push({
              event: event.uid,
              error: eventError.message
            });
          }
        }
      } catch (sourceError) {
        results.errors.push({
          source,
          error: sourceError.message
        });
      }
    }

    // Atualiza última sincronização
    await prisma.property.update({
      where: { id: property.id },
      data: { lastSync: new Date() }
    });

    return results;
  }

  /**
   * Sincroniza todas as propriedades de um usuário
   */
  async syncAllProperties(userId = null) {
    const where = userId ? { userId } : {};

    const properties = await prisma.property.findMany({
      where: {
        ...where,
        active: true,
        OR: [
          { icalAirbnb: { not: null } },
          { icalBooking: { not: null } }
        ]
      }
    });

    console.log(`📅 Sincronizando ${properties.length} propriedades...`);

    const results = [];
    for (const property of properties) {
      const result = await this.syncProperty(property);
      results.push(result);
    }

    const summary = {
      properties: results.length,
      created: results.reduce((sum, r) => sum + r.created, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.flatMap(r => r.errors)
    };

    console.log(`📅 Sincronização completa: ${summary.created} criadas, ${summary.updated} atualizadas`);

    return summary;
  }

  /**
   * Busca checkouts para uma data específica
   */
  filterCheckoutsForDate(events, date = new Date()) {
    const targetDate = dayjs(date).format('YYYY-MM-DD');

    return events.filter(event => {
      if (!event.end) return false;
      const eventEnd = dayjs(event.end).format('YYYY-MM-DD');
      return eventEnd === targetDate;
    });
  }

  /**
   * Busca check-ins para uma data específica
   */
  filterCheckinsForDate(events, date = new Date()) {
    const targetDate = dayjs(date).format('YYYY-MM-DD');

    return events.filter(event => {
      if (!event.start) return false;
      const eventStart = dayjs(event.start).format('YYYY-MM-DD');
      return eventStart === targetDate;
    });
  }

  /**
   * Busca reservas do banco com checkout hoje
   */
  async getTodayCheckouts(userId = null) {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();

    const where = {
      checkOut: {
        gte: today,
        lte: tomorrow
      },
      status: { in: ['CONFIRMED', 'CHECKED_IN'] }
    };

    if (userId) where.userId = userId;

    return prisma.reservation.findMany({
      where,
      include: {
        property: true,
        guest: true
      }
    });
  }

  /**
   * Busca reservas do banco com check-in hoje
   */
  async getTodayCheckins(userId = null) {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();

    const where = {
      checkIn: {
        gte: today,
        lte: tomorrow
      },
      status: 'CONFIRMED'
    };

    if (userId) where.userId = userId;

    return prisma.reservation.findMany({
      where,
      include: {
        property: true,
        guest: true
      }
    });
  }

  /**
   * Busca reservas próximas (próximos N dias)
   */
  async getUpcomingReservations(userId = null, days = 7) {
    const today = dayjs().startOf('day').toDate();
    const endDate = dayjs().add(days, 'day').endOf('day').toDate();

    const where = {
      checkIn: {
        gte: today,
        lte: endDate
      },
      status: { in: ['CONFIRMED', 'PENDING'] }
    };

    if (userId) where.userId = userId;

    return prisma.reservation.findMany({
      where,
      include: {
        property: true,
        guest: true
      },
      orderBy: { checkIn: 'asc' }
    });
  }
}

const icalService = new ICalService();

export default icalService;
