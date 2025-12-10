/**
 * Constantes de domínio para o Mevo
 * Centraliza valores que são usados em múltiplos lugares do sistema
 */

// Fontes de reserva
export const BOOKING_SOURCES = {
  AIRBNB: 'airbnb',
  BOOKING: 'booking',
  VRBO: 'vrbo',
  MANUAL: 'manual',
  OTHER: 'other',
};

export const BOOKING_SOURCE_LIST = Object.values(BOOKING_SOURCES);

// Status de reserva
export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const RESERVATION_STATUS_LIST = Object.values(RESERVATION_STATUS);

// Tipos de mensagem/notificação
export const MESSAGE_TYPES = {
  WELCOME: 'welcome',
  CHECKIN_REMINDER: 'checkin_reminder',
  CHECKOUT_REMINDER: 'checkout_reminder',
  CLEANING: 'cleaning',
  REVIEW_REQUEST: 'review_request',
  CUSTOM: 'custom',
};

export const MESSAGE_TYPE_LIST = Object.values(MESSAGE_TYPES);

// Canais de notificação
export const NOTIFICATION_CHANNELS = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
};

export const NOTIFICATION_CHANNEL_LIST = Object.values(NOTIFICATION_CHANNELS);

// Status de notificação/mensagem
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

export const MESSAGE_STATUS_LIST = Object.values(MESSAGE_STATUS);

// Prioridades de manutenção
export const MAINTENANCE_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const MAINTENANCE_PRIORITY_LIST = Object.values(MAINTENANCE_PRIORITY);

// Status de tarefas/jobs
export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const JOB_STATUS_LIST = Object.values(JOB_STATUS);

// Roles de usuário
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const USER_ROLE_LIST = Object.values(USER_ROLES);

// Configurações padrão
export const DEFAULTS = {
  CHECKOUT_TIME: '11:00',
  CHECKIN_TIME: '15:00',
  CLEANING_MINUTES: 120,
  LOG_RETENTION_DAYS: 90,
  TOKEN_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  MAX_PROPERTIES_PER_USER: 50,
  MAX_TEMPLATES_PER_USER: 20,
};

// Eventos de webhook
export const WEBHOOK_EVENTS = {
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_UPDATED: 'reservation.updated',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_FAILED: 'message.failed',
  PROPERTY_CREATED: 'property.created',
  PROPERTY_UPDATED: 'property.updated',
  CALENDAR_SYNCED: 'calendar.synced',
};

export const WEBHOOK_EVENT_LIST = Object.values(WEBHOOK_EVENTS);

// Placeholders disponíveis para templates de mensagem
export const TEMPLATE_PLACEHOLDERS = {
  GUEST_NAME: '{{guest_name}}',
  PROPERTY_NAME: '{{property_name}}',
  PROPERTY_ADDRESS: '{{property_address}}',
  CHECKIN_DATE: '{{checkin_date}}',
  CHECKOUT_DATE: '{{checkout_date}}',
  CHECKIN_TIME: '{{checkin_time}}',
  CHECKOUT_TIME: '{{checkout_time}}',
  WIFI_NAME: '{{wifi_name}}',
  WIFI_PASSWORD: '{{wifi_password}}',
  ACCESS_INSTRUCTIONS: '{{access_instructions}}',
  EMPLOYEE_NAME: '{{employee_name}}',
  EMPLOYEE_PHONE: '{{employee_phone}}',
};

export const TEMPLATE_PLACEHOLDER_LIST = Object.values(TEMPLATE_PLACEHOLDERS);

// Tipos de integração
export const INTEGRATION_TYPES = {
  CALENDAR: 'calendar',
  MESSAGING: 'messaging',
  PAYMENT: 'payment',
  OTHER: 'other',
};

// Ações de auditoria
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  SEND_MESSAGE: 'send_message',
  SYNC_CALENDAR: 'sync_calendar',
};
