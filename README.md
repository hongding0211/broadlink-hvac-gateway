# BroadLink HVAC Gateway

Local web controller for the BroadLink `BL-LAN-AC.GW1` central AC gateway.

## Structure

- `src/frontend/`: React, Vite, Tailwind UI
- `src/backend/`: Express API and BroadLink gateway client
- `dist/`: generated production frontend build

## Run Locally

```bash
npm install
npm run build
HVAC_HOST=192.168.x.x npm start
```

Open:

```text
http://localhost:3000
```

For frontend development with Vite hot reload:

```bash
HVAC_HOST=192.168.x.x npm run dev
```

Open:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` to the Express server on port `3000`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `HVAC_HOST` | required | BroadLink gateway IP |
| `HVAC_PORT` | `80` | BroadLink gateway HTTP port |
| `HVAC_USER` | `admin` | Gateway HTTP basic auth user |
| `HVAC_PASSWORD` | empty | Gateway HTTP basic auth password |
| `HVAC_TIMEOUT_MS` | `5000` | Device request timeout |
| `PORT` | `3000` | Web UI/API port |
| `APP_ACCESS_TOKEN` | empty | Optional fixed URL token for web UI/API access |

## Build

```bash
npm run build
npm start
```

The Express server serves the built React app from `dist/` in production.

## Docker

```bash
docker compose up -d --build
```

For Docker Compose, put the real values in a local `.env` file copied from
`.env.example`. The `.env` file is ignored by git.

The container exposes the UI on port `3000`. On a NAS, keep the container on a
network that can reach the gateway IP.

## API

- `GET /api/units`: read all indoor units
- `PATCH /api/units/:idx`: update one unit with any of `on`, `mode`, `tempSet`,
  `fan`, `FlowDirection1`, `FlowDirection2`
- `GET /api/options`: read mode and fan labels
- `GET /api/automations`: read shared automation rules
- `POST /api/automations`: create a shared automation rule
- `PATCH /api/automations/:id`: update a shared automation rule
- `DELETE /api/automations/:id`: delete a shared automation rule

Writes are intentionally implemented as read-merge-write commands because the
gateway expects a full `f=18` control state, not a partial patch.
Enabled automations are evaluated by the backend while the server is running.
