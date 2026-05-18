# consilium — System Design

## Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x (strict mode) |
| Framework | Next.js | 14 (App Router) |
| Build | npm/pnpm | — |
| Test | Vitest | latest |
| Styling | Tailwind CSS | — |
| Storage | IndexedDB (local) | — |

## Architecture Pattern
Client-first multi-layer architecture. Core discussion engine runs client-side; Next.js API routes provide backend scaffolding. No database in MVP — local storage (IndexedDB) for session persistence.

## Layer Structure
```
用户入口层 (UI Pages — src/app/)
  ↓
讨论体验层 (Modules — src/modules/)
  ↓
讨论引擎层 (Engine — src/engine/)
  ↓
模型调用层 (LLM — src/llm/)
  ↓
本地数据层 (Store/DB — src/store/, src/db/)
```

## Key Layers & Directories
| Layer | Path | Purpose |
|-------|------|---------|
| Pages | `src/app/` | Next.js App Router pages |
| API Routes | `src/app/api/` | Backend API endpoints |
| Components | `src/components/` | Shared UI components |
| Modules | `src/modules/` | Feature modules (home, discussion, sessions, templates, settings) |
| Engine | `src/engine/` | Discussion engine (orchestrator, scheduler, state-machine, director, intent, events, rhythm) |
| Server | `src/server/` | Server-side services and repositories |
| LLM | `src/llm/` | LLM provider adapters |
| Store | `src/store/` | Client-side state |
| Types | `src/types/` | Core TypeScript type definitions |
| Data | `src/data/` | Mock/static data (三国军师团 template) |

## Core Types
| Type | Purpose |
|------|---------|
| `Template` | Discussion template (worldview, roles, events, rhythm config) |
| `Role` | Host or character role definition |
| `Agent` | Runtime agent profile and output |
| `Session` | Discussion session (template + topic + engine state + messages) |
| `DiscussionState` | State machine state (opening/developing/climax/closing) |
| `Message` | Chat message from agent or user |
| `LLMConfig` | LLM provider configuration |

## API Endpoints (Planned)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check with version, status, timestamp |
| `GET /api/templates` | List available templates |
| `GET /api/sessions` | List sessions |
| `GET /api/discussions` | Discussion management |
| `GET /api/llm/providers` | LLM provider list |

## Response Format
```ts
{ success: boolean, data: T, error?: { code: string, message: string, details?: unknown }, requestId: string }
```

## Configuration
- Config: environment variables + local default config
- LLM provider: configurable via settings UI (Phase 1)
- Session storage: IndexedDB (local, no server required)
