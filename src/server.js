require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const { DateTime } = require('luxon');
const { aggregateEvents, DEFAULT_TIMEZONE } = require('./icalService');
const { errorHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes');
const {
  getProperties,
  getCalendars,
  getPropertyRecipients,
  createCleaningRun,
  updateCleaningRun,
  createCleaningEvent,
  createMessageLog,
  updateMessageStatus,
} = require('./databaseService');
const { sendMessage, isConfigured: isWhatsAppConfigured } = require('./whatsappService');

const app = express();
app.use(express.json());

const timezone = process.env.TIMEZONE || DEFAULT_TIMEZONE;
const port = process.env.PORT || 3000;
const defaultClientId = process.env.DEFAULT_CLIENT_ID;

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api', apiRoutes);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const buildCalendarInputs = async (clientId) => {
  const properties = await getProperties({ clientId, activeOnly: true });

  const calendarInputs = [];

  for (const property of properties) {
    const calendars = await getCalendars({ propertyId: property.id, activeOnly: true });

    for (const calendar of calendars) {
      calendarInputs.push({
        id: calendar.id,
        url: calendar.url,
        platform: calendar.platform,
        propertyId: property.id,
        propertyName: property.name,
      });
    }
  }

  return calendarInputs;
};

const buildMessage = ({ recipientName, date, tasks }) => {
  const dateLabel = date.setZone(timezone).toFormat('dd/LL');

  if (!tasks.length) {
    return `Bom dia ${recipientName}! Hoje (${dateLabel}) não há limpezas programadas.`;
  }

  const header = `Bom dia ${recipientName}! Hoje (${dateLabel}) temos ${tasks.length} limpeza${tasks.length > 1 ? 's' : ''}:`;
  const lines = tasks.map(
    (task, index) =>
      `${index + 1}. ${task.propertyName} (${task.platform}) checkout às ${task.checkoutTime}h`,
  );

  return [header, ...lines].join('\n');
};

const groupTasksByRecipient = async (events, properties) => {
  const tasksByRecipient = new Map();

  for (const event of events) {
    if (event.error || !event.end) {
      continue;
    }

    const property = properties.find((p) => p.id === event.propertyId);
    if (!property) {
      continue;
    }

    const recipients = await getPropertyRecipients(property.id);

    for (const recipient of recipients) {
      const checkout = DateTime.fromISO(event.end).setZone(timezone);
      const task = {
        propertyName: property.name,
        platform: event.platform,
        checkoutTime: checkout.toFormat('HH:mm'),
        calendarUrl: event.calendarUrl,
        fromCache: event.fromCache,
        eventData: event,
      };

      const existingTasks = tasksByRecipient.get(recipient.id) || { recipient, tasks: [] };
      existingTasks.tasks.push(task);
      tasksByRecipient.set(recipient.id, existingTasks);
    }
  }

  return tasksByRecipient;
};

// ============================================================================
// DAILY ROUTINE
// ============================================================================

const runDailyRoutine = async (targetDate = DateTime.now().setZone(timezone), clientId = defaultClientId) => {
  if (!clientId) {
    throw new Error('No client ID provided. Set DEFAULT_CLIENT_ID in .env or pass clientId parameter.');
  }

  const runDate = targetDate.toISODate();

  // Create cleaning run record
  const cleaningRun = await createCleaningRun({
    client_id: clientId,
    run_date: runDate,
    status: 'pending',
  });

  try {
    // Build calendar inputs from database
    const calendarInputs = await buildCalendarInputs(clientId);

    if (calendarInputs.length === 0) {
      await updateCleaningRun(cleaningRun.id, {
        status: 'success',
        properties_processed: 0,
        cleanings_detected: 0,
        log: { message: 'No calendars configured' },
      });

      console.log('No calendars configured for client:', clientId);
      return { events: [], messages: [] };
    }

    // Fetch and aggregate events
    const events = await aggregateEvents(calendarInputs, targetDate, timezone);

    const failures = events.filter((event) => event.error);
    if (failures.length) {
      console.warn('Calendars with errors:', failures);
    }

    // Get properties for grouping
    const properties = await getProperties({ clientId, activeOnly: true });

    // Group tasks by recipient
    const tasksByRecipient = await groupTasksByRecipient(events, properties);
    const messages = [];

    // Process each recipient
    for (const [recipientId, { recipient, tasks }] of tasksByRecipient.entries()) {
      const sortedTasks = [...tasks].sort((a, b) => a.checkoutTime.localeCompare(b.checkoutTime));
      const message = buildMessage({
        recipientName: recipient.name,
        date: targetDate,
        tasks: sortedTasks,
      });

      // Create message log
      const messageLog = await createMessageLog({
        run_id: cleaningRun.id,
        recipient_id: recipientId,
        channel: recipient.channel || 'whatsapp',
        message_body: message,
        status: 'pending',
      });

      // Send WhatsApp message
      let sendResult;
      if (isWhatsAppConfigured()) {
        sendResult = await sendMessage(recipient.phone, message);

        if (sendResult.success) {
          await updateMessageStatus(messageLog.id, 'sent');
        } else {
          await updateMessageStatus(messageLog.id, 'failed', sendResult.error);
        }
      } else {
        console.log(`[SIMULATED] Message to ${recipient.name} (${recipient.phone}):\n${message}\n`);
        sendResult = { success: true, simulated: true };
      }

      messages.push({
        recipient,
        tasks: sortedTasks,
        message,
        sent: sendResult.success,
        simulated: sendResult.simulated || false,
      });

      // Create cleaning events
      for (const task of sortedTasks) {
        await createCleaningEvent({
          run_id: cleaningRun.id,
          property_id: task.eventData.propertyId,
          recipient_id: recipientId,
          summary: task.eventData.summary || 'Limpeza',
          checkout_time: task.eventData.end,
          source_platform: task.platform,
          status: sendResult.success ? 'notified' : 'pending',
        });
      }
    }

    // Update cleaning run with results
    await updateCleaningRun(cleaningRun.id, {
      status: failures.length > 0 ? 'partial' : 'success',
      properties_processed: properties.length,
      cleanings_detected: events.filter(e => !e.error).length,
      message_sent: messages.some(m => m.sent),
      log: {
        total_events: events.length,
        failures: failures.length,
        messages_sent: messages.filter(m => m.sent).length,
      },
    });

    return { events, messages, runId: cleaningRun.id };
  } catch (error) {
    // Update run as failed
    await updateCleaningRun(cleaningRun.id, {
      status: 'failed',
      log: { error: error.message, stack: error.stack },
    });

    throw error;
  }
};

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timezone,
    whatsapp: isWhatsAppConfigured() ? 'configured' : 'not configured',
  });
});

app.post('/run', async (req, res, next) => {
  try {
    const requestedDate = req.body?.date;
    const clientId = req.body?.client_id || defaultClientId;

    const targetDate = requestedDate
      ? DateTime.fromISO(requestedDate, { zone: timezone })
      : DateTime.now().setZone(timezone);

    const result = await runDailyRoutine(targetDate, clientId);

    res.json({
      ok: true,
      run_id: result.runId,
      count: result.messages.length,
      messages: result.messages,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CRON JOB
// ============================================================================

if (defaultClientId) {
  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        console.log('Running scheduled daily routine...');
        await runDailyRoutine(DateTime.now().setZone(timezone), defaultClientId);
        console.log('Scheduled routine completed successfully');
      } catch (error) {
        console.error('Cron routine failed:', error);
      }
    },
    { timezone },
  );
  console.log(`Cron job scheduled for 08:00 ${timezone} (Client: ${defaultClientId})`);
} else {
  console.warn('DEFAULT_CLIENT_ID not set. Cron job disabled. Use POST /run with client_id to run manually.');
}

// ============================================================================
// ERROR HANDLER (must be last)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, () => {
  console.log(`Mevo scheduler listening on port ${port} (timezone: ${timezone})`);
  console.log(`WhatsApp: ${isWhatsAppConfigured() ? 'Configured' : 'Not configured (simulated mode)'}`);
  console.log(`API endpoints available at http://localhost:${port}/api`);
});

