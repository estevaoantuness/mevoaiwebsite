const ical = require('node-ical');
const fetch = require('node-fetch');
const { DateTime } = require('luxon');

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo';
const calendarCache = new Map();

const normalizeDateTime = (value, timezone = DEFAULT_TIMEZONE) => {
  if (DateTime.isDateTime(value)) {
    return value.setZone(timezone);
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: timezone });
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return DateTime.fromJSDate(new Date(value), { zone: timezone });
  }
  return DateTime.now().setZone(timezone);
};

const fetchCalendar = async (url) => {
  const cached = calendarCache.get(url);
  const headers = {};

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }
  if (cached?.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304 && cached) {
    return { ...cached, fromCache: true };
  }

  if (!response.ok) {
    const error = new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  const raw = await response.text();
  const parsed = ical.sync.parseICS(raw);

  const payload = {
    url,
    etag: response.headers.get('etag') || cached?.etag || null,
    lastModified: response.headers.get('last-modified') || cached?.lastModified || null,
    fetchedAt: new Date(),
    parsed,
    raw,
    fromCache: false,
  };

  calendarCache.set(url, payload);
  return payload;
};

const filterEventsForDate = (calendarData, targetDate, timezone = DEFAULT_TIMEZONE) => {
  const target = normalizeDateTime(targetDate, timezone);
  const startOfDay = target.startOf('day');
  const endOfDay = target.endOf('day');

  return Object.values(calendarData)
    .filter((entry) => entry.type === 'VEVENT' && entry.start)
    .map((entry) => {
      const start = DateTime.fromJSDate(entry.start).setZone(timezone);
      const end = DateTime.fromJSDate(entry.end || entry.start).setZone(timezone);

      return {
        uid: entry.uid,
        summary: entry.summary || 'Sem titulo',
        description: entry.description || '',
        location: entry.location || '',
        start,
        end,
        source: entry.url || entry.source || '',
      };
    })
    // Checkout-day filter: end must land on the target date.
    .filter((event) => event.end >= startOfDay && event.end <= endOfDay)
    .map((event) => ({
      ...event,
      start: event.start.toISO(),
      end: event.end.toISO(),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
};

const getEventsForDate = async (url, targetDate = DateTime.now(), timezone = DEFAULT_TIMEZONE) => {
  const calendar = await fetchCalendar(url);
  const events = filterEventsForDate(calendar.parsed, targetDate, timezone);

  return {
    events,
    meta: {
      url,
      etag: calendar.etag,
      lastModified: calendar.lastModified,
      fetchedAt: calendar.fetchedAt,
      fromCache: calendar.fromCache,
    },
  };
};

const aggregateEvents = async (calendars, targetDate = DateTime.now(), timezone = DEFAULT_TIMEZONE) => {
  const tasks = calendars.map(async (calendar) => {
    if (!calendar?.url) {
      return [];
    }

    try {
      const { events, meta } = await getEventsForDate(calendar.url, targetDate, timezone);
      return events.map((event) => ({
        ...event,
        propertyId: calendar.propertyId,
        propertyName: calendar.propertyName,
        platform: calendar.platform || 'custom',
        calendarUrl: calendar.url,
        fromCache: meta.fromCache,
      }));
    } catch (error) {
      return [
        {
          error: error.message,
          propertyId: calendar.propertyId,
          propertyName: calendar.propertyName,
          platform: calendar.platform || 'custom',
          calendarUrl: calendar.url,
        },
      ];
    }
  });

  const results = await Promise.all(tasks);
  return results.flat();
};

const clearCache = (url) => {
  if (url) {
    calendarCache.delete(url);
    return;
  }
  calendarCache.clear();
};

module.exports = {
  aggregateEvents,
  clearCache,
  DEFAULT_TIMEZONE,
  getEventsForDate,
  normalizeDateTime,
};
