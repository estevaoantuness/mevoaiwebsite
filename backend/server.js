import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Importa rotas
import authRoutes from './routes/auth.js';
import propertiesRoutes from './routes/properties.js';
import settingsRoutes from './routes/settings.js';
import whatsappRoutes from './routes/whatsapp.js';
import dashboardRoutes from './routes/dashboard.js';

// Importa serviços
import whatsappService from './services/whatsapp.service.js';
import workerService from './services/worker.service.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

// Middlewares
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log de requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: whatsappService.getStatus()
  });
});

// Rota raiz - info da API
app.get('/', (req, res) => {
  res.json({
    name: 'Mevo API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST /api/auth/login',
      'GET /api/properties',
      'GET /api/settings',
      'GET /api/whatsapp/status',
      'GET /api/dashboard/stats',
      'GET /api/logs',
      'GET /api/health'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializa servidor
async function startServer() {
  app.listen(PORT, async () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         MEVO Backend v1.0.0           ║
  ║         PostgreSQL + Prisma           ║
  ╠═══════════════════════════════════════╣
  ║  Servidor rodando na porta ${PORT}       ║
  ║  http://localhost:${PORT}                ║
  ╚═══════════════════════════════════════╝
    `);

    // Inicializa WhatsApp
    console.log('Inicializando WhatsApp...');
    try {
      await whatsappService.initialize();
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp:', error.message);
      console.log('O servidor continuará rodando sem WhatsApp.');
    }

    // Inicia worker de automação
    workerService.start();
  });
}

startServer();

export default app;
