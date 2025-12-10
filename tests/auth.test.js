import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import jwt from 'jsonwebtoken';

// Mock do JWT_SECRET para testes
const TEST_SECRET = 'test-secret-key-for-vitest';

describe('Auth Middleware', () => {
  describe('authMiddleware', () => {
    it('should return 401 if no token is provided', async () => {
      const app = express();
      app.get('/test', authMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token não fornecido');
    });

    it('should return 401 if token is malformed', async () => {
      const app = express();
      app.get('/test', authMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token mal formatado');
    });

    it('should return 401 if token is invalid', async () => {
      const app = express();
      app.get('/test', authMiddleware, (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token inválido');
    });
  });

  describe('optionalAuth', () => {
    it('should continue without user if no token is provided', async () => {
      const app = express();
      app.get('/test', optionalAuth, (req, res) => {
        res.json({ hasUser: !!req.user });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.hasUser).toBe(false);
    });

    it('should continue without user if token is invalid', async () => {
      const app = express();
      app.get('/test', optionalAuth, (req, res) => {
        res.json({ hasUser: !!req.user });
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(200);
      expect(response.body.hasUser).toBe(false);
    });
  });

  describe('requireAdmin', () => {
    it('should return 403 if user is not admin', async () => {
      const app = express();
      app.get('/test', (req, res, next) => {
        req.user = { id: 1, role: 'user' };
        next();
      }, requireAdmin, (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('administrador');
    });

    it('should allow access if user is admin', async () => {
      const app = express();
      app.get('/test', (req, res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
      }, requireAdmin, (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Validation', () => {
  it('should validate email format', () => {
    const validEmails = ['test@example.com', 'user.name@domain.co'];
    const invalidEmails = ['notanemail', '@domain.com', 'test@'];

    validEmails.forEach(email => {
      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(true);
    });

    invalidEmails.forEach(email => {
      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(false);
    });
  });

  it('should validate phone format', () => {
    const validPhones = ['5511999999999', '+5511999999999', '11999999999'];
    const invalidPhones = ['123', 'abcdefghij', ''];

    validPhones.forEach(phone => {
      const cleaned = phone.replace(/\D/g, '');
      expect(cleaned.length).toBeGreaterThanOrEqual(10);
    });
  });
});
