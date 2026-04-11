# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)

## Artifacts

### crypto-ai (React + Vite web app, preview at `/`)
Real-time Encryption & Decryption app with AI Assistant.

Features:
- Real-time encrypt/decrypt with 6 algorithms: AES-256, Caesar Cipher, Base64, ROT13, Vigenere, XOR
- Key generation for each algorithm
- AI Assistant (streaming chat) — GPT-5.2 powered cryptography expert
- Operation history log with stats
- Dark cybersecurity theme (CYPHER.ai branding)

Pages:
- `/` — Main encryption/decryption workspace
- `/ai` — AI chat assistant
- `/history` — Operation timeline and stats

### api-server (Express API, served at `/api`)
Backend API with:
- `/api/encryption/encrypt` — Encrypt text with algorithm
- `/api/encryption/decrypt` — Decrypt text with algorithm
- `/api/encryption/generate-key` — Generate encryption key
- `/api/encryption/history` — Operation history
- `/api/encryption/stats` — Usage statistics
- `/api/openai/conversations` — Conversation management
- `/api/openai/conversations/:id/messages` — Streaming AI chat (SSE)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `encryption_history` — tracks all encrypt/decrypt operations
- `conversations` — AI chat conversations
- `messages` — AI chat messages

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
