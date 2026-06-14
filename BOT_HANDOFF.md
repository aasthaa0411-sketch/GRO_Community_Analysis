# Bot repo handoff — Discord export API

Copy everything below the line into Cursor on the machine that has the **gro-discord-bot** repo.

---

## Prompt for bot repo

Add authenticated read API routes to our existing discord.js v14 + Fastify bot so a separate web app can export Discord chat logs with filters.

### Context

- Stack: Node + TypeScript + discord.js v14 + Fastify + Zod
- Entry: `index.ts` boots Discord client and Fastify in one process
- Deployed: Render at `https://gro-discord-bot.onrender.com`
- Existing routes: `GET /health`, `GET /`, `POST /webhooks/restock` (HMAC auth)
- Web app will call these new routes from the browser with an API key

### New environment variable

```env
EXPORT_API_KEY=generate-a-long-random-secret
EXPORT_ALLOWED_GUILD_IDS=123456789,987654321   # optional comma-separated allowlist
```

### Auth middleware

For all `/api/discord/*` routes:

- Require header: `Authorization: Bearer <EXPORT_API_KEY>`
- Return `401` if missing or invalid
- Use same pattern as existing Zod validation in the project

### New routes

#### 1. `GET /api/discord/guilds`

Return guilds the bot is currently in.

Response:

```json
{
  "guilds": [
    { "id": "123", "name": "My Server", "icon": "https://..." }
  ]
}
```

Implementation: iterate `client.guilds.cache` (or fetch if needed).

#### 2. `GET /api/discord/guilds/:guildId/channels`

Return text channels the bot can read in that guild.

Response:

```json
{
  "channels": [
    { "id": "456", "name": "general", "type": "text" }
  ]
}
```

Filter to text-based channels (`GuildText`, `PublicThread`, `PrivateThread`, `AnnouncementThread` as appropriate). Only include channels where the bot has `ViewChannel` and `ReadMessageHistory`.

#### 3. `GET /api/discord/export`

Query params (Zod-validated):

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `guild_id` | yes | — | Must be a guild bot is in |
| `channel_id` | yes | — | Must belong to guild |
| `start` | no | today 00:00 UTC | ISO date `YYYY-MM-DD` or full ISO datetime |
| `end` | no | now | ISO date or datetime |
| `user_id` | no | — | Filter to one author |
| `format` | no | `json` | `json` or `csv` |
| `limit` | no | `10000` | Max messages cap (safety) |

Date preset handling is done client-side; server only needs `start` + `end`.

**Export logic** (`src/discord/exportMessages.ts` or similar):

1. Resolve guild and channel via discord.js client
2. Verify bot permissions
3. Paginate with `channel.messages.fetch({ limit: 100, before })`
4. Stop early when `message.createdAt < start` (messages fetched newest-first)
5. Skip messages where `createdAt > end`
6. Skip if `user_id` set and `author.id !== user_id`
7. Stop when `limit` reached
8. Map each message to:

```typescript
{
  message_id: string;
  channel_id: string;
  channel_name: string;
  guild_id: string;
  guild_name: string;
  author_id: string;
  author_name: string;
  timestamp: string;          // ISO
  content: string;
  attachments: string[];      // URLs
  reply_to_message_id: string | null;
  edited_timestamp: string | null;
}
```

Response for `format=json`:

```json
{
  "platform": "discord",
  "exported_at": "2026-06-14T12:00:00.000Z",
  "filters": {
    "guild_id": "...",
    "channel_id": "...",
    "start": "...",
    "end": "...",
    "user_id": null
  },
  "message_count": 42,
  "messages": [ ... ]
}
```

Response for `format=csv`:

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="discord-export-{channel_id}.csv"`
- Flatten messages; join `attachments` with `;`

### Error responses

Use consistent JSON errors:

```json
{ "error": "Guild not found", "code": "GUILD_NOT_FOUND" }
```

Codes: `UNAUTHORIZED`, `GUILD_NOT_FOUND`, `CHANNEL_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `EXPORT_TOO_LARGE`

Return `403` if guild not in `EXPORT_ALLOWED_GUILD_IDS` (when that env is set).

### CORS

Web app runs on a different origin (localhost or static host). Add Fastify CORS for:

- `http://localhost:5173` (Vite dev)
- Optionally configurable via `CORS_ORIGINS` env (comma-separated)

Allow headers: `Authorization`, `Content-Type`  
Allow methods: `GET`, `OPTIONS`

### File structure suggestion

```
src/
├── discord/
│   └── exportMessages.ts
├── http/
│   ├── routes/
│   │   └── discordExport.ts    # register all /api/discord/* routes
│   ├── middleware/
│   │   └── exportAuth.ts
│   └── schemas/
│       └── discordExport.ts    # Zod schemas
```

Register routes in existing `createServer()`.

### Render deploy notes

- Add `EXPORT_API_KEY` and optional `CORS_ORIGINS` in Render dashboard env vars
- Redeploy after merge
- Test: `curl -H "Authorization: Bearer $KEY" https://gro-discord-bot.onrender.com/api/discord/guilds`

### Contract the web app expects

Base URL: `https://gro-discord-bot.onrender.com`

| Method | Path |
|--------|------|
| GET | `/api/discord/guilds` |
| GET | `/api/discord/guilds/:guildId/channels` |
| GET | `/api/discord/export?guild_id=&channel_id=&start=&end=&user_id=&format=` |

All require `Authorization: Bearer <EXPORT_API_KEY>`.

Do not change existing webhook or health routes. Match existing code style (Zod, Fastify plugins, logger usage).

---

## After bot deploys

1. Set `EXPORT_API_KEY` in Render
2. Share the key with the web app (stored in browser sessionStorage only)
3. Test guilds → channels → export from the web app Discord tab
