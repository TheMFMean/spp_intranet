# Piercely.io — Soda Pop Piercing Intranet

Internal operations hub for managing inventory, orders, forms, automations, and data analytics.

## Project Structure

```
/backend        - Node.js/Express API server
/frontend       - React-based web UI
/db             - Database schemas and migrations
/static         - Static assets (images, PDFs, etc.)
/modules        - Modular feature components
/forms          - Form definitions and handlers
```

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT-based role access
- **AI**: OpenAI integration for chatbot
- **Invoice Parser**: OCR + NLP processing

## Development Phases

- **Phase 1**: Core framework, auth, inventory dashboard
- **Phase 2**: Forms & automation, special orders
- **Phase 3**: AI assistant, invoice parser
- **Phase 4**: SaaS commercialization

## Getting Started

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up database
cd ../db && psql -U postgres -f schema.sql

# Run development servers
cd ../backend && npm run dev
cd ../frontend && npm run dev
```
