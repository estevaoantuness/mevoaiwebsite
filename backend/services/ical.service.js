import ical from 'node-ical';
import dayjs from 'dayjs';

class ICalService {
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
   * Filtra eventos com checkout hoje
   * @param {Array} events - Lista de eventos
   * @param {Date} date - Data para filtrar (default: hoje)
   * @returns {Array} Eventos com checkout na data especificada
   */
  filterCheckoutsForDate(events, date = new Date()) {
    const targetDate = dayjs(date).format('YYYY-MM-DD');

    return events.filter(event => {
      if (!event.end) return false;

      // DTEND no iCal é a data do checkout
      const eventEnd = dayjs(event.end).format('YYYY-MM-DD');
      return eventEnd === targetDate;
    });
  }

  /**
   * Extrai informações úteis de um evento
   * @param {Object} event - Evento do iCal
   * @returns {Object} Dados formatados
   */
  parseEvent(event) {
    return {
      uid: event.uid || `event-${Date.now()}`,
      summary: event.summary || 'Reserva',
      startDate: event.start ? dayjs(event.start).format('YYYY-MM-DD') : null,
      endDate: event.end ? dayjs(event.end).format('YYYY-MM-DD') : null,
      description: event.description || ''
    };
  }

  /**
   * Busca checkouts de hoje para um imóvel
   * @param {Object} property - Imóvel com ical_airbnb e ical_booking
   * @returns {Promise<Array>} Lista de checkouts
   */
  async getCheckoutsForProperty(property) {
    const checkouts = [];

    // Busca do Airbnb
    if (property.ical_airbnb) {
      const airbnbEvents = await this.fetchEvents(property.ical_airbnb);
      const airbnbCheckouts = this.filterCheckoutsForDate(airbnbEvents);

      airbnbCheckouts.forEach(event => {
        checkouts.push({
          ...this.parseEvent(event),
          source: 'airbnb',
          propertyId: property.id,
          propertyName: property.name
        });
      });
    }

    // Busca do Booking
    if (property.ical_booking) {
      const bookingEvents = await this.fetchEvents(property.ical_booking);
      const bookingCheckouts = this.filterCheckoutsForDate(bookingEvents);

      bookingCheckouts.forEach(event => {
        checkouts.push({
          ...this.parseEvent(event),
          source: 'booking',
          propertyId: property.id,
          propertyName: property.name
        });
      });
    }

    return checkouts;
  }
}

const icalService = new ICalService();

export default icalService;
