import jwt from 'jsonwebtoken';

// Em produção, JWT_SECRET deve ser definido - falha rápido se não estiver
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (isProduction && !JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in production environment');
}

// Fallback apenas para desenvolvimento/testes
const SECRET = JWT_SECRET || 'dev-only-secret-key';

/**
 * Middleware de autenticação obrigatória
 * Retorna 401 se não houver token válido
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware de autenticação opcional
 * Popula req.user se houver token válido, mas não bloqueia se não houver
 * Útil para rotas que funcionam tanto para usuários logados quanto anônimos
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    req.user = decoded;
  } catch (err) {
    // Token inválido, mas continua sem autenticação
  }

  next();
}

/**
 * Middleware para verificar se usuário é admin
 * Deve ser usado após authMiddleware
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
  }
  next();
}

export { SECRET as JWT_SECRET };
