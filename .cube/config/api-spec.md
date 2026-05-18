# consilium — API Specification

## API Style
RESTful, Next.js App Router API routes

## Base URL Pattern
`/api/{resource}`

## Response Format
```ts
{
  success: boolean,
  data: T | null,
  error?: {
    code: string,
    message: string,
    details?: unknown
  },
  requestId: string
}
```

## Endpoints

### Health
| Method | Path | Response |
|--------|------|---------|
| GET | `/api/health` | `{ version, status, timestamp }` |

### Templates
| Method | Path | Response |
|--------|------|---------|
| GET | `/api/templates` | `Template[]` |
| GET | `/api/templates/:id` | `Template` |

### Sessions
| Method | Path | Response |
|--------|------|---------|
| GET | `/api/sessions` | `Session[]` |
| POST | `/api/sessions` | `Session` (created) |
| GET | `/api/sessions/:id` | `Session` |
| DELETE | `/api/sessions/:id` | `void` |

### Discussions
| Method | Path | Response |
|--------|------|---------|
| GET | `/api/discussions` | Discussion list |
| POST | `/api/discussions` | Create discussion |

### LLM Providers
| Method | Path | Response |
|--------|------|---------|
| GET | `/api/llm/providers` | `LLMProvider[]` |

## Error Codes
| Code | Meaning |
|------|---------|
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Invalid request parameters |
| INTERNAL_ERROR | Server error |

## Authentication
None in MVP — local-only app, no user auth required.
