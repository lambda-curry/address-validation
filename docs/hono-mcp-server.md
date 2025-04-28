# Hono MCP Server Setup Guide

This document serves as the single source of truth for setting up, developing, and maintaining an MCP (Model Context Protocol) server using Hono, with a focus on SSE (Server-Sent Events) transport, tooling, and dev workflow. Use this as a reference for future repositories and onboarding.

---

## 1. File/Folder Layout

```
/mcp/
  routes.ts         # Route definitions: health, SSE, JSON-RPC
  mcp.ts            # MCP server wrapper, tool registry, helpers
  /tools/           # Tool definitions and registry
  sse.ts            # Custom SSETransport bridging MCP <-> browser EventSource
  registry.ts       # In-memory tool registry abstraction
```

### Example Route Handlers

```ts
// routes.ts
router.get('/health', healthHandler)
router.get('/sse', sseHandler)
router.post('/messages', messagesHandler)
```

---

## 2. Boot Sequence

- `bun dev` starts the dev server (e.g., `sst dev`)
- `index.ts` creates a Hono instance, mounts CORS and logging middleware
- `/sse` route:
  - Generates a `sessionId` (UUID)
  - Writes initial event: endpoint so the client knows where to POST `/messages?sessionId=...`
  - Hands off to `SSETransport`
- `mcpService.init()` loads OpenAPI-derived tools and registers them with the MCP Server
- Client communicates via JSON-RPC over the SSE transport

### Example Boot Code

```ts
import { Hono } from 'hono';
import { SSETransport } from './sse';
import { mcpService } from './mcp';

const app = new Hono();

app.get('/sse', (c) => SSETransport.handle(c));
app.post('/messages', (c) => mcpService.handleMessage(c));

mcpService.init();
```

---

## 3. Creating Your Own Hono MCP Server (Checklist)

- Install dependencies:
  ```sh
  npm install hono @hono/node-server @modelcontextprotocol/sdk zod
  ```
- Implement `SSETransport` (see [SSE docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events))
- Build an `MCPService` thin wrapper around the SDK server:
  ```ts
  import { Server } from '@modelcontextprotocol/sdk/server';
  const server = new Server({ name: 'My MCP' }, { capabilities: { tools: {} } });
  server.setRequestHandler(CallToolRequestSchema, ...);
  ```
- Load/define tools (manually or via a service like [openapi2mcptools](https://www.npmjs.com/package/openapi2mcptools))
- Expose endpoints:
  - `GET /health` for ops
  - `GET /sse` for streaming
  - `POST /messages` for JSON-RPC
- Set important env vars (example `.dev.vars`):
  ```env
  MEDUSA_SECRET_KEY=sk_...
  MEDUSA_API_URL=http://localhost:9000
  PORT=4200
  ```
- Run with:
  ```sh
  NODE_OPTIONS='--loader ts-node/esm' ts-node src/index.ts
  # or build with tsc
  ```

---

## 4. Local Dev / Debugging Tips

- Use [@modelcontextprotocol/inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector) proxy at `http://localhost:4200/sse` to inspect traffic
- Hono's dev server reloads if you pair with `tsx watch` or similar
- Add `?sessionId=...` query param logging for easier correlation in logs
- Use descriptive logging for SSE events and tool invocations

---

## 5. Further Reading / References

- [Hono Documentation](https://hono.dev)
- [Model Context Protocol Spec](https://github.com/modelcontext/protocol)
- [MCP SDK Server Package](https://github.com/modelcontext/sdk/tree/main/packages/server)
- [openapi2mcptools](https://www.npmjs.com/package/openapi2mcptools)
- [Inspector CLI](https://www.npmjs.com/package/@modelcontextprotocol/inspector)

---

## Example: Minimal Hono MCP Server

```ts
import { Hono } from 'hono';
import { Server } from '@modelcontextprotocol/sdk/server';
import { SSETransport } from './sse';

const app = new Hono();
const mcpServer = new Server({ name: 'Example MCP' }, { capabilities: { tools: {} } });

app.get('/health', (c) => c.json({ status: 'ok', env: process.env.NODE_ENV }));
app.get('/sse', (c) => SSETransport.handle(c, mcpServer));
app.post('/messages', async (c) => {
  const payload = await c.req.json();
  return mcpServer.handleMessage(payload);
});

export default app;
```

---

## SSE Transport: Key Concepts

- Use EventSource-compatible responses for browser clients
- Generate a unique sessionId per connection
- Send initial event with endpoint info for client POSTs
- Bridge between MCP server and browser using custom logic

---

_Last updated: 2025-04-27_ 