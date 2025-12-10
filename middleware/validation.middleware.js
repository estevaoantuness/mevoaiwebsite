import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware para processar erros de validação
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
}

/**
 * Validações para registro de usuário
 */
export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres')
    .matches(/[A-Z]/)
    .withMessage('Senha deve conter pelo menos uma letra maiúscula')
    .matches(/[0-9]/)
    .withMessage('Senha deve conter pelo menos um número'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
    .escape(),
  handleValidationErrors
];

/**
 * Validações para login
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória'),
  handleValidationErrors
];

/**
 * Validações para criação de propriedade
 */
export const validateProperty = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Nome da propriedade deve ter entre 2 e 200 caracteres')
    .escape(),
  body('employeeName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome do responsável deve ter entre 2 e 100 caracteres')
    .escape(),
  body('employeePhone')
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Telefone inválido (deve ter 10-15 dígitos)'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Endereço muito longo')
    .escape(),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .escape(),
  body('icalAirbnb')
    .optional()
    .trim()
    .isURL()
    .withMessage('URL do iCal Airbnb inválida'),
  body('icalBooking')
    .optional()
    .trim()
    .isURL()
    .withMessage('URL do iCal Booking inválida'),
  handleValidationErrors
];

/**
 * Validações para criação de reserva
 */
export const validateReservation = [
  body('propertyId')
    .isInt({ min: 1 })
    .withMessage('ID da propriedade inválido'),
  body('checkinDate')
    .isISO8601()
    .withMessage('Data de check-in inválida'),
  body('checkoutDate')
    .isISO8601()
    .withMessage('Data de check-out inválida'),
  body('guestId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID do hóspede inválido'),
  body('adults')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Número de adultos inválido'),
  body('children')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Número de crianças inválido'),
  body('source')
    .optional()
    .isIn(['airbnb', 'booking', 'vrbo', 'manual', 'other'])
    .withMessage('Fonte da reserva inválida'),
  handleValidationErrors
];

/**
 * Validações para criação de hóspede
 */
export const validateGuest = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Nome do hóspede deve ter entre 2 e 200 caracteres')
    .escape(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('phone')
    .optional()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Telefone inválido'),
  body('whatsapp')
    .optional()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('WhatsApp inválido'),
  handleValidationErrors
];

/**
 * Validações para templates de mensagem
 */
export const validateTemplate = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome do template deve ter entre 2 e 100 caracteres')
    .escape(),
  body('type')
    .isIn(['welcome', 'checkin_reminder', 'checkout_reminder', 'cleaning', 'review_request', 'custom'])
    .withMessage('Tipo de template inválido'),
  body('content')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Conteúdo deve ter entre 10 e 2000 caracteres'),
  body('channel')
    .optional()
    .isIn(['whatsapp', 'email', 'sms'])
    .withMessage('Canal inválido'),
  handleValidationErrors
];

/**
 * Validação de ID em parâmetros de URL
 */
export const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID inválido'),
  handleValidationErrors
];

/**
 * Validação de paginação
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página inválida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100'),
  handleValidationErrors
];

/**
 * Validação para envio de mensagem WhatsApp
 */
export const validateWhatsAppMessage = [
  body('phone')
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Número de telefone inválido'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 4096 })
    .withMessage('Mensagem deve ter entre 1 e 4096 caracteres'),
  handleValidationErrors
];
