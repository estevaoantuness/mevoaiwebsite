import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Importa rotas
import authRoutes from './routes/auth.js';
import propertiesRoutes from './routes/properties.js';
import settingsRoutes from './routes/settings.js';
import whatsappRoutes from './routes/whatsapp.js';
import dashboardRoutes from './routes/dashboard.js';
import guestsRoutes from './routes/guests.js';
import reservationsRoutes from './routes/reservations.js';
import templatesRoutes from './routes/templates.js';
import webhooksRoutes from './routes/webhooks.js';
import automationRoutes from './routes/automation.js';

// Importa serviços
import whatsappService from './services/whatsapp.service.js';
import notificationService from './services/notification.service.js';
import queueService from './services/queue.service.js';
import schedulerService from './services/scheduler.service.js';

// Importa utilitários
import { errorHandler } from './utils/errors.js';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================
// SECURITY: Rate Limiting
// ============================================

// Rate limiter geral - 100 req/min em produção, 1000 em dev
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isProduction ? 100 : 1000,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticação - 5 req/min (proteção contra brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para WhatsApp - 10 req/min (proteção contra spam)
const whatsappLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Limite de mensagens atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// SECURITY: CORS Configuration
// ============================================

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições sem origin (mobile apps, Postman, etc) em dev
    if (!origin && !isProduction) {
      return callback(null, true);
    }

    // Permite origens na whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Em dev, permite qualquer origem se não houver whitelist
    if (!isProduction && allowedOrigins.length === 0) {
      return callback(null, true);
    }

    // Bloqueia origem não autorizada
    console.warn(`⚠️ CORS bloqueado para origem: ${origin}`);
    callback(new Error('Não permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // Cache preflight por 24h
};

// ============================================
// MIDDLEWARES
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors(corsOptions));

// Rate limiting geral
app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Log de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============================================
// ROTAS DA API
// ============================================

// Autenticação (com rate limiting específico para login/register)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

// Gestão de Propriedades
app.use('/api/properties', propertiesRoutes);

// Gestão de Hóspedes
app.use('/api/guests', guestsRoutes);

// Gestão de Reservas
app.use('/api/reservations', reservationsRoutes);

// Templates de Mensagens
app.use('/api/templates', templatesRoutes);

// Webhooks
app.use('/api/webhooks', webhooksRoutes);

// Automação
app.use('/api/automation', automationRoutes);

// Configurações
app.use('/api/settings', settingsRoutes);

// WhatsApp (com rate limiting para envio de mensagens)
app.use('/api/whatsapp/send', whatsappLimiter);
app.use('/api/whatsapp', whatsappRoutes);

// Dashboard e Logs
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', dashboardRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  const queueStats = await queueService.getStats();
  const schedulerStatus = schedulerService.getStatus();
  const notificationProviders = notificationService.getProvidersStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      whatsapp: whatsappService.getStatus(),
      notifications: notificationProviders,
      queues: queueStats,
      scheduler: schedulerStatus
    }
  });
});

// ============================================
// ROTA RAIZ - INFO DA API
// ============================================

app.get('/', (req, res) => {
  res.json({
    name: 'Mevo API',
    version: '2.0.0',
    description: 'API de Automação para Gestão de Propriedades',
    status: 'running',
    documentation: '/api/docs',
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/me',
        'PUT /api/auth/me'
      ],
      properties: [
        'GET /api/properties',
        'POST /api/properties',
        'GET /api/properties/:id',
        'PUT /api/properties/:id',
        'DELETE /api/properties/:id'
      ],
      guests: [
        'GET /api/guests',
        'POST /api/guests',
        'GET /api/guests/:id',
        'PUT /api/guests/:id',
        'DELETE /api/guests/:id'
      ],
      reservations: [
        'GET /api/reservations',
        'POST /api/reservations',
        'GET /api/reservations/:id',
        'PUT /api/reservations/:id',
        'DELETE /api/reservations/:id',
        'GET /api/reservations/upcoming',
        'GET /api/reservations/today',
        'PATCH /api/reservations/:id/cancel',
        'POST /api/reservations/:id/send-notification'
      ],
      templates: [
        'GET /api/templates',
        'POST /api/templates',
        'GET /api/templates/:id',
        'PUT /api/templates/:id',
        'DELETE /api/templates/:id',
        'POST /api/templates/:id/preview'
      ],
      webhooks: [
        'GET /api/webhooks',
        'POST /api/webhooks',
        'GET /api/webhooks/:id',
        'PUT /api/webhooks/:id',
        'DELETE /api/webhooks/:id',
        'POST /api/webhooks/:id/test',
        'GET /api/webhooks/:id/logs'
      ],
      automation: [
        'GET /api/automation/status',
        'GET /api/automation/jobs',
        'POST /api/automation/jobs/:name/run',
        'POST /api/automation/sync-calendar/:propertyId',
        'POST /api/automation/send-notification',
        'GET /api/automation/notifications',
        'GET /api/automation/notifications/stats',
        'POST /api/automation/schedule',
        'GET /api/automation/scheduled'
      ],
      whatsapp: [
        'GET /api/whatsapp/status',
        'GET /api/whatsapp/qr'
      ],
      dashboard: [
        'GET /api/dashboard/stats',
        'GET /api/logs',
        'POST /api/dashboard/run-worker'
      ],
      health: [
        'GET /api/health'
      ]
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

// Usa o handler de erros padronizado
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// ============================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================

async function startServer() {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                   MEVO Backend v2.0.0                      ║
║              Sistema de Automação Completo                 ║
╠═══════════════════════════════════════════════════════════╣
║  PostgreSQL + Prisma | WhatsApp | Email | SMS | Webhooks  ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // 1. Inicializar serviço de filas
    console.log('📦 Inicializando serviço de filas...');
    await queueService.initialize();

    // 2. Inicializar serviço de notificações
    console.log('📬 Inicializando serviço de notificações...');
    await notificationService.initialize();

    // 3. Inicializar WhatsApp
    console.log('💬 Inicializando WhatsApp...');
    try {
      await whatsappService.initialize();
    } catch (error) {
      console.warn('⚠️ WhatsApp não pôde ser inicializado:', error.message);
      console.log('   O servidor continuará rodando sem WhatsApp.');
      console.log('   Acesse /api/whatsapp/qr para escanear o QR Code.');
    }

    // 4. Iniciar scheduler de automação
    console.log('⏰ Iniciando scheduler de automação...');
    schedulerService.start();

    // 5. Iniciar servidor HTTP
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Servidor rodando em http://localhost:${PORT}             ║
╠═══════════════════════════════════════════════════════════╣
║  📖 Documentação: http://localhost:${PORT}/                  ║
║  🏥 Health Check: http://localhost:${PORT}/api/health        ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Recebido SIGTERM, encerrando gracefully...');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recebido SIGINT, encerrando gracefully...');
  schedulerService.stop();
  process.exit(0);
});

startServer();

export default app;
