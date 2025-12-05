# Mevo Backend - Setup Guide

## ✅ Implementação Concluída

O backend foi completamente refatorado e agora inclui:

### 🎯 Funcionalidades Implementadas

1. **Integração com Supabase**
   - Serviço completo de database (`src/supabaseService.js`)
   - Funções CRUD para todas as entidades
   - Logging de runs e mensagens

2. **Integração com Evolution API (WhatsApp)**
   - Serviço de WhatsApp com retry automático (`src/whatsappService.js`)
   - Modo simulado quando não configurado
   - Tratamento robusto de erros

3. **API REST Completa**
   - `GET/POST/PUT/DELETE /api/clients` - Gerenciar clientes
   - `GET/POST/PUT/DELETE /api/properties` - Gerenciar propriedades
   - `GET/POST/PUT/DELETE /api/calendars` - Gerenciar calendários
   - `GET/POST/PUT/DELETE /api/recipients` - Gerenciar destinatários
   - Validação de dados com Joi
   - Error handling centralizado

4. **Rotina Diária Atualizada**
   - Busca dados do Supabase (não mais hardcoded)
   - Envia mensagens via Evolution API
   - Registra tudo no banco de dados
   - Cron job às 08:00

---

## 🚨 Próximos Passos

### 1. Verificar Credenciais do Supabase

O teste de conexão falhou com "Invalid API key". Preciso que você verifique:

**No painel do Supabase** (https://supabase.com/dashboard):
1. Vá em **Settings** → **API**
2. Copie a **service_role key** (não a anon key)
3. Cole aqui para eu atualizar o `.env`

A chave deve ser um JWT longo começando com `eyJ...`

### 2. Aplicar o Schema SQL

O arquivo `schema.sql` precisa ser aplicado no banco:

**Opção A - Via Painel Supabase:**
1. Vá em **SQL Editor** no painel do Supabase
2. Cole todo o conteúdo de `schema.sql`
3. Execute

**Opção B - Via CLI:**
```bash
# Se você tiver o Supabase CLI instalado
supabase db push
```

### 3. Configurar Evolution API (Opcional)

Se você já tem Evolution API configurada, adicione ao `.env`:
```env
EVOLUTION_API_URL=https://sua-api.com
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE_NAME=nome-da-instancia
```

Se não tiver, o sistema funcionará em **modo simulado** (mensagens no console).

---

## 📝 Como Usar Após Setup

### 1. Criar Primeiro Cliente
```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Seu Nome",
    "whatsapp_number": "+5511999999999",
    "time_zone": "America/Sao_Paulo"
  }'
```

Copie o `id` retornado e adicione ao `.env` como `DEFAULT_CLIENT_ID`.

### 2. Criar Propriedade
```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "uuid-do-cliente",
    "name": "Apto 101",
    "time_zone": "America/Sao_Paulo"
  }'
```

### 3. Adicionar Calendário
```bash
curl -X POST http://localhost:3000/api/calendars \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "uuid-da-propriedade",
    "platform": "airbnb",
    "url": "https://airbnb.com/calendar/ical/..."
  }'
```

### 4. Criar Destinatário (Faxineira)
```bash
curl -X POST http://localhost:3000/api/recipients \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "uuid-do-cliente",
    "name": "Maria",
    "phone": "+5511988888888",
    "channel": "whatsapp"
  }'
```

### 5. Associar Destinatário à Propriedade
```bash
curl -X POST http://localhost:3000/api/recipients/{recipient-id}/properties \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "uuid-da-propriedade",
    "role": "cleaner"
  }'
```

### 6. Testar Rotina Manual
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-12-05"}'
```

---

## 🧪 Scripts de Teste

```bash
# Testar conexão Supabase
node src/scripts/testSupabase.js

# Testar WhatsApp (se configurado)
node src/scripts/testWhatsApp.js

# Iniciar servidor
npm start
```

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
- `src/supabaseService.js` - Serviço de database
- `src/whatsappService.js` - Serviço de WhatsApp
- `src/routes/index.js` - Router principal
- `src/routes/clients.js` - Rotas de clientes
- `src/routes/properties.js` - Rotas de propriedades
- `src/routes/calendars.js` - Rotas de calendários
- `src/routes/recipients.js` - Rotas de destinatários
- `src/middleware/validation.js` - Validação de dados
- `src/middleware/errorHandler.js` - Tratamento de erros
- `src/scripts/testSupabase.js` - Teste de conexão
- `src/scripts/testWhatsApp.js` - Teste de WhatsApp

### Modificados:
- `src/server.js` - Integração completa com Supabase e WhatsApp
- `.env.example` - Novas variáveis de ambiente
- `.env` - Configuração (precisa da service_role key correta)
- `package.json` - Novas dependências

---

## ❓ Dúvidas?

Me envie:
1. A **service_role key** correta do Supabase
2. Confirme se aplicou o `schema.sql`
3. (Opcional) Credenciais da Evolution API

Depois disso, o sistema estará 100% funcional! 🚀
