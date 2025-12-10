import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// Formato customizado para logs
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (stack) {
    log += `\n${stack}`;
  }

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

// Formato para produção (JSON estruturado)
const productionFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  winston.format.json()
);

// Formato para desenvolvimento (colorido e legível)
const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? productionFormat : developmentFormat,
  defaultMeta: { service: 'mevo-api' },
  transports: [
    // Console sempre
    new winston.transports.Console(),

    // Em produção, também salva em arquivos
    ...(isProduction ? [
      // Logs de erro
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Todos os logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ] : []),
  ],
  // Não sair em exceções não tratadas
  exitOnError: false,
});

// Adiciona stream para Morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helpers para logging estruturado
export const logRequest = (req, message, data = {}) => {
  logger.info(message, {
    method: req.method,
    path: req.path,
    userId: req.userId,
    ip: req.ip,
    ...data,
  });
};

export const logError = (error, req = null, context = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
  };

  if (req) {
    errorData.method = req.method;
    errorData.path = req.path;
    errorData.userId = req.userId;
    errorData.ip = req.ip;
  }

  logger.error(error.message, errorData);
};

export const logWhatsApp = (action, data) => {
  logger.info(`WhatsApp: ${action}`, {
    category: 'whatsapp',
    ...data,
  });
};

export const logScheduler = (job, status, data = {}) => {
  logger.info(`Scheduler: ${job} - ${status}`, {
    category: 'scheduler',
    job,
    status,
    ...data,
  });
};

export const logNotification = (type, channel, status, data = {}) => {
  logger.info(`Notification: ${type} via ${channel} - ${status}`, {
    category: 'notification',
    type,
    channel,
    status,
    ...data,
  });
};

export default logger;
