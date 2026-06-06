# BroadLink HVAC Gateway

Local web controller for the BroadLink `BL-LAN-AC.GW1` central AC gateway.

## Run Locally

```bash
HVAC_HOST=192.168.x.x npm start
```

Open:

```text
http://localhost:3000
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `HVAC_HOST` | required | BroadLink gateway IP |
| `HVAC_PORT` | `80` | BroadLink gateway HTTP port |
| `HVAC_USER` | `admin` | Gateway HTTP basic auth user |
| `HVAC_PASSWORD` | empty | Gateway HTTP basic auth password |
| `HVAC_TIMEOUT_MS` | `5000` | Device request timeout |
| `PORT` | `3000` | Web UI/API port |

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

Writes are intentionally implemented as read-merge-write commands because the
gateway expects a full `f=18` control state, not a partial patch.
