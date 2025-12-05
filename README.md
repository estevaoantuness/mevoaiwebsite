# Mevo Backend

Backend for Mevo: Automated cleaning scheduling system that fetches iCal calendars (Airbnb/Booking), detects checkout-day cleanings, groups them per recipient, and sends WhatsApp messages via Evolution API.

## Features

- 🔐 **User Authentication** - JWT-based auth with role-based access control
- 📅 **iCal Integration** - Fetch and parse calendars from Airbnb, Booking, VRBO
- 🏠 **Property Management** - Complete address tracking with geocoding support
- 👥 **Recipient Management** - Track cleaners with ratings and performance metrics
- 📱 **WhatsApp Integration** - Send automated messages via Evolution API
- ⏰ **Cron Scheduling** - Daily automated runs at 08:00
- 🗄️ **PostgreSQL Database** - Native PostgreSQL with connection pooling
- ✅ **Validation** - Comprehensive validation for Brazilian addresses, CPF, CEP

## Quick Start

```bash
npm install
cp .env.example .env  # Configure with your DATABASE_URL
npm start
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secret
JWT_SECRET=your-secret-key

# Evolution API (WhatsApp) - Optional
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=

# Configuration
PORT=3000
TIMEZONE=America/Sao_Paulo
DEFAULT_CLIENT_ID=
```

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login (returns JWT token)
- `POST /api/users/logout` - Logout
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update profile

### Management (Requires Auth)
- `GET/POST/PUT/DELETE /api/clients` - Client management
- `GET/POST/PUT/DELETE /api/properties` - Property management (with full address)
- `GET/POST/PUT/DELETE /api/calendars` - Calendar management
- `GET/POST/PUT/DELETE /api/recipients` - Recipient management

### Operations
- `GET /health` - Health check
- `POST /run` - Manual trigger: `{ "date": "2024-11-23", "client_id": "uuid" }`

## Database Schema

See [`schema.sql`](schema.sql) for complete PostgreSQL schema including:
- Users & Sessions (authentication)
- Clients with full address
- Properties with geocoding
- Calendars (Airbnb/Booking/VRBO)
- Recipients with performance tracking
- Cleaning runs & events
- Message logs

## Setup Guide

See [`MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md) for detailed setup instructions.

## Next Steps

1. Create PostgreSQL database on Railway
2. Apply `schema.sql` schema
3. Configure `.env` with DATABASE_URL
4. Create admin user via `/api/users/register`
5. Add clients, properties, calendars, and recipients
6. Test with `POST /run`

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL (via pg)
- **Auth**: JWT + bcrypt
- **Validation**: Joi
- **Scheduling**: node-cron
- **Calendar**: node-ical
- **WhatsApp**: Evolution API (axios)

## License

MIT
