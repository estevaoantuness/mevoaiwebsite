import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/auth/register - Criar nova conta
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalido' });
    }

    // Validar senha (minimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no minimo 6 caracteres' });
    }

    // Verificar se email ja existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email ja cadastrado' });
    }

    // Criar usuario
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'user'
      }
    });

    // Gerar token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me - Dados do usuario logado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuario:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/auth/me - Atualizar perfil
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const updateData = {};

    if (name) updateData.name = name;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email invalido' });
      }
      // Verificar se email ja existe (outro usuario)
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.userId } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Email ja cadastrado' });
      }
      updateData.email = email;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no minimo 6 caracteres' });
      }
      updateData.passwordHash = bcrypt.hashSync(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Erro ao atualizar usuario:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
