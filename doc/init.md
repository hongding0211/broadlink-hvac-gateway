# BroadLink HVAC Gateway Handover

## Goal

This project is for local control of the central AC gateway discovered on the
home LAN. The immediate integration goal is small:

- read/sync current AC unit state
- control power on/off
- control target temperature
- control mode
- control fan speed

The working path is the gateway's built-in HTTP CGI API. The TCP `9999` driver
path from public ZhongHongHVAC repositories was tested but is not currently
usable against this device.

## Device

- Vendor/brand: BroadLink
- Label name: System Gateway / HVAC Management Module / Air condition Management Module
- Model: `BL-LAN-AC.GW1`
- SKU: `GB.T.013.0001.0011`
- Serial number: `GW12H6EA500279`
- MAC: `50:35:55:85:e6:e8`
- Current IP: set with `HVAC_HOST`
- HTTP auth: username `admin`, empty password

Earlier network findings:

- `<mac-lan-ip>` was the Mac `en0` address, not the gateway.
- `<non-gateway-lan-ip>` remained online after unplugging the gateway, so it was not
  the gateway.
- Before DHCP was enabled, the gateway was found as a static IP on
  the upstream L2 network.
- UDP discovery on port `43708` returned the gateway IP and TCP port `9999`.

Current discovery response:

```text
request:  01 50 40 ff ff ff 8e
response: 01 50 40 c0 a8 1f e5 27 0f 33
decoded:  <gateway-ip>, tcp port 9999
```

## Working HTTP API

Base URL:

```text
http://<gateway-ip>/cgi-bin/api.html
```

Auth:

```text
admin:
```

The CGI response is HTTP/0.9-style JSON. With curl, use both Basic Auth and
`--http0.9`.

```bash
curl --http0.9 -u 'admin:' "http://$HVAC_HOST/cgi-bin/api.html?f=17&p=0"
```

The web UI is at:

```text
http://<gateway-ip>/zh/airCloud.html
```

Relevant web source findings:

- `/zh/airCloud.html` contains the AC management UI and mode/fan mappings.
- `/js/common.js` defines `ajxDevice.api = "/cgi-bin/api.html"`.
- The correct API endpoint is `/cgi-bin/api.html`, not `/zh/api.html`.

## Read Status

Read paged AC unit status:

```bash
curl --http0.9 -u 'admin:' \
  "http://$HVAC_HOST/cgi-bin/api.html?f=17&p=0"
```

Continue incrementing `p` until the API returns an empty unit list.

Observed currently:

- `p=0`: four units
- `p>=1`: `{"unit":[]}`

Status fields:

| Field | Meaning |
| --- | --- |
| `idx` | Unit control ID used by write API |
| `oa` | Outdoor/system address prefix |
| `ia` | Indoor/unit address suffix |
| `nm` | Display name |
| `on` | `0` off, `1` on |
| `mode` | Numeric mode |
| `alarm` | Fault code, `0` means no fault |
| `tempSet` | Target temperature |
| `tempIn` | Current room temperature |
| `fan` | Numeric fan mode |
| `grp` | Group |
| `OnoffLock` | Power lock |
| `tempLock` | Temperature lock |
| `highestVal` | Max allowed temperature when lock is active |
| `lowestVal` | Min allowed temperature when lock is active |
| `modeLock` | Mode lock |
| `FlowDirection1` | Airflow direction 1 |
| `FlowDirection2` | Airflow direction 2 |
| `MainRmc` | Main remote/controller marker |

Current units observed:

| idx | addr | power | set | room | mode | fan | flow | alarm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `1-0` | off | 25C | 26C | cooling | high | `0/0` | 0 |
| 1 | `1-1` | on | 26C | 25C | cooling | auto | `0/0` | 0 |
| 2 | `1-2` | on | 26C | 25-26C | cooling | auto | `0/0` | 0 |
| 3 | `1-3` | off | 26C | 27C | cooling | high | `0/0` | 0 |

## Control

Control endpoint:

```text
GET /cgi-bin/api.html?f=18&on=<0|1>&mode=<mode>&tempSet=<16..32>&fan=<fan>&FlowDirection1=<n>&FlowDirection2=<n>&idx=<id>[&idx=<id>...]
```

Example:

```bash
curl --http0.9 -u 'admin:' \
  "http://$HVAC_HOST/cgi-bin/api.html?f=18&on=1&mode=1&tempSet=26&fan=0&FlowDirection1=0&FlowDirection2=0&idx=1"
```

Observed successful response:

```json
{"err":0}
```

The web UI sends full-state commands, not partial patches. For a safe local
client, read the unit first, merge requested changes into the current state,
then send the full `f=18` parameter set.

The web UI batches up to 10 `idx` parameters in one control request.

## Mode Mapping

From `/zh/airCloud.html`:

| Value | Label | Note |
| --- | --- | --- |
| 0 | Auto | auto |
| 1 | Cooling | cooling |
| 2 | Dehumidify | dehumidify |
| 3 | Comfort Dry | fresh/dry comfort |
| 4 | Fresh Air | fresh air |
| 5 | Auto Dehumidify | auto dehumidify |
| 6 | Sleep | sleep |
| 8 | Heating | heating |
| 9 | Floor Heating | floor heating |
| 10 | Strong Heating | strong heating |

## Fan Mapping

From `/zh/airCloud.html`:

| Value | Label | Note |
| --- | --- | --- |
| 0 | Auto | auto |
| 1 | High | high |
| 2 | Medium | medium |
| 4 | Low | low |
| 6 | Quiet | quiet |

## Temperature And Flow

- `tempSet` is enforced by the management modal as `16..32`.
- Lock UI uses high/low bounds around `19..30`, but lock control is outside the
  current integration scope.
- `FlowDirection1` appears to support `0..7`.
- `FlowDirection2` appears to support `1..6`, though the current device state
  uses `0` and this brand/UI may not expose airflow controls.

For the first implementation, preserve `FlowDirection1` and `FlowDirection2`
from current status unless explicitly changing them.

## Other Endpoints

Product info:

```bash
curl --http0.9 -u 'admin:' \
  "http://$HVAC_HOST/cgi-bin/api.html?f=1"
```

Observed:

```json
{
  "err": 0,
  "model": "000",
  "sw": "05.67.00.00.005  ",
  "id": "44003B00185135333338383688B77325",
  "hwerror": "00",
  "moduleerror": "00"
}
```

Capability/brand:

```bash
curl --http0.9 -u 'admin:' \
  "http://$HVAC_HOST/cgi-bin/api.html?f=24"
```

Observed:

```json
{"err":0,"brand":8,"proto":0,"maxnum":64}
```

Air limitation/lock endpoint:

```text
f=21&OnoffLock=<n>&tempLock=<n>&highestVal=<n>&lowestVal=<n>&modeLock=<n>&idx=<id>...
```

Main remote/controller endpoint:

```text
f=33&MainRmc=<n>&idx=<id>
```

## Non-Working TCP Driver Path

The public ZhongHongHVAC driver path was tested and should not be the first
implementation target for this device.

Tested:

- `crhan/ZhongHongHVAC`
- `azureology/ZhongHongHVAC` BroadLink fork
- raw TCP `9999` queries
- BroadLink-style `55 aa` wrapped TCP `9999` queries

Observed behavior:

- TCP port `9999` opens.
- UDP discovery works.
- TCP status/control query frames either hang, return no response, or the
  connection closes.
- The original driver can hang because it resets socket timeout after connect.

Conclusion: use HTTP CGI API for now.

## Existing Local Helper

A temporary helper exists in the MUCAA workspace:

```text
/Users/mehaa/MUCAA/tools/ac_gateway.py
```

Examples:

```bash
python3 /Users/mehaa/MUCAA/tools/ac_gateway.py status
python3 /Users/mehaa/MUCAA/tools/ac_gateway.py set --idx 1 --on 1 --mode 1 --temp 25 --fan 0
```

It uses raw socket HTTP so it can tolerate the gateway's HTTP/0.9-style
response and defaults to `admin:` auth.

## Suggested Next Implementation

1. Build a typed HTTP client around `/cgi-bin/api.html`.
2. Implement `status()` by paging `f=17&p=N` until `unit` is empty.
3. Normalize units by both `idx` and address string `oa-ia`.
4. Implement `set_unit(idx, changes)` by reading current status, merging
   changes, then sending full `f=18` parameters.
5. Keep `mode`, `fan`, and temperature validation explicit.
6. Add tests using captured JSON before touching live AC control.
7. Later, wrap the client for MUCAA/Home Assistant/automation as needed.
