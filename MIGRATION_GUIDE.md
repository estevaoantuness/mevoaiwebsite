# Mevo - PostgreSQL Migration Complete! 🎉

## ✅ O Que Foi Feito

### 1. **Migração de Supabase → PostgreSQL Railway**
- ✅ Removido `@supabase/supabase-js`
- ✅ Instalado `pg` (PostgreSQL nativo)
- ✅ Criado `databaseService.js` completo com connection pooling
- ✅ Todas as queries migradas para SQL nativo

### 2. **Schema Aprimorado**
- ✅ **Endereços completos** em clients, properties e recipients
- ✅ **Tabela de users** com autenticação JWT
- ✅ **Tabela de sessions** para gerenciar tokens
- ✅ **Campos expandidos**:
  - Properties: lat/lng, tipo, quartos, banheiros, m²
  - Recipients: CPF, avaliação, total de limpezas
  - Clients: CPF/CNPJ, email, endereço
- ✅ **Triggers automáticos** para updated_at
- ✅ **Views úteis** (properties_full, upcoming_cleanings, recipient_performance)

### 3. **Autenticação Completa**
- ✅ Sistema de registro e login
- ✅ JWT tokens com expiração
- ✅ Middleware de autenticação
- ✅ Controle de acesso por role (admin/agent/viewer)
- ✅ Gerenciamento de sessões

### 4. **Validação Aprimorada**
- ✅ Validação de endereços brasileiros (CEP, estado)
- ✅ Validação de CPF/CNPJ
- ✅ Validação de coordenadas geográficas
- ✅ Schemas Joi para todos os novos campos

### 5. **Novos Endpoints**
- ✅ `POST /api/users/register` - Registro
- ✅ `POST /api/users/login` - Login
- ✅ `POST /api/users/logout` - Logout
- ✅ `GET /api/users/me` - Perfil atual
- ✅ `PUT /api/users/me` - Atualizar perfil
- ✅ `GET /api/users` - Listar usuários (admin)
- ✅ Todos os endpoints CRUD atualizados com novos campos

---

## 🚀 Próximos Passos

### 1. Criar Banco PostgreSQL no Railway

1. Acesse https://railway.app
2. Crie um novo projeto ou use existente
3. Adicione **PostgreSQL** ao projeto
4. Copie a `DATABASE_URL` (vai aparecer nas variáveis)

### 2. Aplicar o Schema

**Opção A - Via Railway Dashboard:**
1. No Railway, vá em PostgreSQL → **Data** tab
2. Clique em **Query**
3. Cole todo o conteúdo de `schema.sql`
4. Execute

**Opção B - Via psql (se tiver instalado):**
```bash
# Copie a DATABASE_URL do Railway
export DATABASE_URL="postgresql://..."
psql $DATABASE_URL < schema.sql
```

### 3. Configurar .env

Edite o arquivo `.env` e adicione a `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

(Copie exatamente como aparece no Railway)

### 4. Testar Conexão

```bash
npm start
```

Se tudo estiver correto, você verá:
```
✅ Connected to PostgreSQL database
Mevo scheduler listening on port 3000
```

### 5. Criar Primeiro Usuário Admin

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mevo.ai",
    "password": "sua-senha-segura",
    "name": "Admin",
    "role": "admin"
  }'
```

### 6. Fazer Login

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mevo.ai",
    "password": "sua-senha-segura"
  }'
```

Copie o `token` retornado. Use-o em todas as requisições:
```bash
Authorization: Bearer SEU_TOKEN_AQUI
```

### 7. Criar Primeiro Cliente

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "whatsapp_number": "+5511999999999",
    "cpf_cnpj": "12345678901",
    "address_street": "Rua das Flores",
    "address_number": "123",
    "address_neighborhood": "Centro",
    "address_city": "São Paulo",
    "address_state": "SP",
    "address_zipcode": "01234-567"
  }'
```

Copie o `id` retornado e adicione ao `.env` como `DEFAULT_CLIENT_ID`.

### 8. Criar Propriedade

```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "client_id": "uuid-do-cliente",
    "name": "Apto 101",
    "address_street": "Av. Paulista",
    "address_number": "1000",
    "address_neighborhood": "Bela Vista",
    "address_city": "São Paulo",
    "address_state": "SP",
    "address_zipcode": "01310-100",
    "property_type": "apartment",
    "bedrooms": 2,
    "bathrooms": 1
  }'
```

### 9. Adicionar Calendário

```bash
curl -X POST http://localhost:3000/api/calendars \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "property_id": "uuid-da-propriedade",
    "platform": "airbnb",
    "url": "https://airbnb.com/calendar/ical/..."
  }'
```

### 10. Criar Destinatário (Faxineira)

```bash
curl -X POST http://localhost:3000/api/recipients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "client_id": "uuid-do-cliente",
    "name": "Maria Santos",
    "email": "maria@example.com",
    "phone": "+5511988888888",
    "cpf": "98765432100",
    "channel": "whatsapp"
  }'
```

### 11. Associar Destinatário à Propriedade

```bash
curl -X POST http://localhost:3000/api/recipients/{recipient-id}/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "recipient_id": "uuid-da-propriedade",
    "role": "cleaner"
  }'
```

### 12. Testar Rotina

```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-12-05"}'
```

---

## 📊 Novos Campos Disponíveis

### Clients
- `email`, `cpf_cnpj`, `avatar_url`
- Endereço completo: `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`, `address_zipcode`

### Properties
- Endereço completo (obrigatório)
- `address_lat`, `address_lng` (coordenadas)
- `property_type` (apartment, house, condo, studio, other)
- `bedrooms`, `bathrooms`, `square_meters`

### Recipients
- `email`, `cpf`, `avatar_url`
- Endereço completo (opcional)
- `rating` (0-5), `total_cleanings`

### Users (Novo!)
- `email`, `password_hash`, `name`, `phone`
- `role` (admin, agent, viewer)
- `avatar_url`, `active`, `last_login_at`

---

## 🔐 Autenticação

Todas as rotas de CRUD agora podem ser protegidas. Para proteger uma rota:

```javascript
const { authenticateToken, requireRole } = require('./middleware/auth');

// Requer autenticação
router.get('/protected', authenticateToken, handler);

// Requer role específica
router.delete('/admin-only', authenticateToken, requireRole('admin'), handler);
```

---

## 📁 Arquivos Criados/Modificados

### Novos:
- ✅ `src/databaseService.js` - Serviço PostgreSQL completo
- ✅ `src/middleware/auth.js` - Autenticação JWT
- ✅ `src/routes/users.js` - Rotas de usuários
- ✅ `schema.sql` - Schema aprimorado (substituído)

### Modificados:
- ✅ `src/server.js` - Usa databaseService
- ✅ `src/middleware/validation.js` - Schemas expandidos
- ✅ `src/routes/index.js` - Adiciona rota /users
- ✅ `.env.example` - PostgreSQL config
- ✅ `.env` - Pronto para DATABASE_URL
- ✅ `package.json` - Novas dependências

### Removidos:
- ✅ `src/supabaseService.js`
- ✅ `src/scripts/testSupabase.js`

---

## 🎯 Frontend - Próximos Passos

Quando você me informar onde está o frontend, vou:

1. **Atualizar tipos/interfaces** com novos campos
2. **Criar formulários** para:
   - Login/Registro
   - Cadastro de cliente com endereço
   - Cadastro de propriedade com endereço e características
   - Cadastro de destinatário com dados pessoais
3. **Atualizar API calls** para incluir autenticação
4. **Adicionar gerenciamento de token** JWT

---

## ❓ Dúvidas Comuns

### Como resetar senha de usuário?
Atualmente não há endpoint de reset. Você pode criar um usuário admin e usar PUT /api/users/:id para alterar.

### Como adicionar mais roles?
Edite o schema.sql e adicione no CHECK constraint da tabela users.

### Como fazer backup do banco?
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Como restaurar backup?
```bash
psql $DATABASE_URL < backup.sql
```

---

## 🚨 Importante

1. **Mude o JWT_SECRET** no `.env` para produção!
2. **Use HTTPS** em produção
3. **Faça backup** regular do banco
4. **Monitore** os logs do Railway

---

## ✨ Pronto!

Seu backend agora está **100% migrado para PostgreSQL** com:
- ✅ Schema expandido com endereços
- ✅ Autenticação completa
- ✅ Validação robusta
- ✅ Pronto para Railway

**Próximo passo**: Me passe a `DATABASE_URL` do Railway e o caminho do frontend para sincronizar tudo! 🚀
