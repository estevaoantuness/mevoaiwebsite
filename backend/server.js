import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Middlewares
app.use(cors());
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

// Serve frontend estático em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'dist')));

  // SPA fallback - todas as rotas não-API vão para o index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
} else {
  // Rota raiz em desenvolvimento
  app.get('/', (req, res) => {
    res.json({
      name: 'Mevo API',
      version: '1.0.0',
      endpoints: [
        'POST /api/auth/login',
        'GET /api/properties',
        'GET /api/settings',
        'GET /api/whatsapp/status',
        'GET /api/dashboard/stats',
        'GET /api/logs'
      ]
    });
  });
}

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
