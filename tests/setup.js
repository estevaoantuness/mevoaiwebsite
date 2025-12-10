import { beforeAll, afterAll } from 'vitest';

// Setup antes de todos os testes
beforeAll(async () => {
  // Configurar variáveis de ambiente para testes
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-vitest';
});

// Cleanup depois de todos os testes
afterAll(async () => {
  // Limpar recursos se necessário
});
