# mevo.ai

> Automatize a gestão de limpeza dos seus imóveis de temporada com WhatsApp e sincronização iCal.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Sobre

O **Mevo** é uma plataforma para anfitriões de Airbnb e Booking que automatiza o processo de notificação de limpeza. O sistema sincroniza calendários iCal, detecta checkouts automaticamente e envia mensagens via WhatsApp para as funcionárias responsáveis.

### Funcionalidades

- **Sincronização iCal** - Conecte calendários do Airbnb e Booking em um só lugar
- **Notificações WhatsApp** - Envio automático de mensagens às 08:00 diariamente
- **Dashboard Unificado** - Gerencie múltiplos imóveis e funcionárias
- **Agrupamento Inteligente** - Consolida múltiplas limpezas em uma única mensagem por funcionária
- **Execução Manual** - Dispare o worker a qualquer momento pelo painel

### Stack Tecnológico

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express, sql.js (SQLite) |
| **Integrações** | whatsapp-web.js, node-ical, node-cron |
| **Deploy** | Railway |

## Começando

### Pré-requisitos

- Node.js >= 18.0.0
- npm ou yarn

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/mevoaiwebsite.git
cd mevoaiwebsite
```

2. Instale as dependências do frontend:
```bash
npm install
```

3. Instale as dependências do backend:
```bash
cd backend && npm install && cd ..
```

4. Configure as variáveis de ambiente (opcional):
```bash
# backend/.env
PORT=3001
NODE_ENV=development
JWT_SECRET=sua-chave-secreta
FRONTEND_URL=http://localhost:5173
```
`FRONTEND_URL` aceita múltiplos domínios separados por vírgula para liberar CORS do frontend.

5. Inicie em modo desenvolvimento:
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend && npm run dev
```

6. Acesse `http://localhost:5173` e faça login:
```
Email: admin@mevo.app
Senha: admin
```

### Build para Produção

```bash
npm run build
npm start
```

## Estrutura do Projeto

```
mevoaiwebsite/
├── index.tsx                 # App React (SPA completo)
├── index.html                # HTML base
├── vite.config.ts            # Configuração Vite
├── tsconfig.json             # Configuração TypeScript
├── package.json              # Dependências frontend
├── railway.json              # Configuração Railway deploy
│
└── backend/
    ├── server.js             # Express + inicialização
    ├── package.json          # Dependências backend
    │
    ├── database/
    │   ├── db.js             # Conexão SQLite (sql.js)
    │   └── schema.sql        # Schema do banco
    │
    ├── routes/
    │   ├── auth.js           # Login/autenticação
    │   ├── properties.js     # CRUD de imóveis
    │   ├── whatsapp.js       # Status/QR WhatsApp
    │   ├── dashboard.js      # Stats e logs
    │   └── settings.js       # Configurações
    │
    ├── services/
    │   ├── whatsapp.service.js   # Integração WhatsApp
    │   ├── ical.service.js       # Parser de calendários
    │   └── worker.service.js     # Cron job diário
    │
    └── middleware/
        └── auth.middleware.js    # JWT validation
```

## API

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login com email/senha |

**Request:**
```json
{
  "email": "admin@mevo.app",
  "password": "admin"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Imóveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/properties` | Lista todos os imóveis |
| `POST` | `/api/properties` | Cria novo imóvel |
| `DELETE` | `/api/properties/:id` | Remove imóvel |

**Criar imóvel:**
```json
{
  "name": "Loft Centro 402",
  "ical_airbnb": "https://airbnb.com/calendar/ical/...",
  "ical_booking": "https://admin.booking.com/...",
  "employee_name": "Maria",
  "employee_phone": "41999990000"
}
```

### Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/dashboard/stats` | Estatísticas gerais |
| `POST` | `/api/dashboard/run-worker` | Executa worker manualmente |
| `GET` | `/api/logs` | Logs de mensagens enviadas |

### WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/whatsapp/status` | Status da conexão |
| `GET` | `/api/whatsapp/qr` | QR Code para conexão |

### Health Check

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/health` | Status do servidor |

## Como Funciona

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Airbnb iCal   │     │  Booking iCal   │     │   Outros iCal   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │     Worker (08:00)     │
                    │  ┌──────────────────┐  │
                    │  │ Fetch calendars  │  │
                    │  │ Detect checkouts │  │
                    │  │ Group by employee│  │
                    │  └──────────────────┘  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   WhatsApp Service     │
                    │  (whatsapp-web.js)     │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │   Funcionária A │       │   Funcionária B │
          │  "Hoje: Loft    │       │  "Hoje: Casa    │
          │   Centro 402"   │       │   Azul, Ap 101" │
          └─────────────────┘       └─────────────────┘
```

## Deploy

### Railway (Recomendado)

O projeto já está configurado para deploy no Railway:

1. Conecte seu repositório ao Railway
2. As variáveis de ambiente serão detectadas automaticamente
3. O build e start são configurados via `railway.json`

### Variáveis de Ambiente (Produção)

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=sua-chave-super-secreta-aqui
```

## Desenvolvimento

### Scripts Disponíveis

```bash
# Frontend
npm run dev       # Inicia Vite dev server
npm run build     # Build de produção
npm run preview   # Preview do build

# Backend
cd backend
npm run dev       # Inicia com --watch
npm start         # Produção
```

### Banco de Dados

O projeto usa **sql.js** (SQLite em memória/arquivo) para simplicidade. O arquivo `mevo.sqlite` é criado automaticamente em `backend/database/`.

Para resetar o banco, basta deletar o arquivo:
```bash
rm backend/database/mevo.sqlite
```

### WhatsApp

A integração usa **whatsapp-web.js** que emula o WhatsApp Web. Na primeira execução:

1. Acesse a aba "Conexão WhatsApp" no dashboard
2. Escaneie o QR Code com seu celular
3. A sessão fica salva em `backend/.wwebjs_auth/`

## Roadmap

- [x] Dashboard com autenticação
- [x] CRUD de imóveis
- [x] Integração WhatsApp
- [x] Worker com cron job
- [ ] Suporte a múltiplos usuários
- [ ] Histórico de checkouts
- [ ] Templates de mensagem customizáveis
- [ ] Integração com Evolution API
- [ ] App mobile

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">
  <strong>mevo.ai</strong> — Automação para anfitriões exigentes
</div>
