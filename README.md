# Polity

Civic issue reporting for the Bay Area. Residents report problems, recommendations and ideas by text, voice, WhatsApp-style chat or a phone call. Claude Sonnet (`claude-sonnet-5-5`) categorizes each report, scores its priority, routes it to an agency and matches it to similar nearby reports. Staff work a ranked queue of clusters, and residents get notified as issues move to resolved.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production runs as two hosts from one deployment: `polity.geckur.com` is the marketing page and `app.polity.geckur.com` is the app, whose `/` is the app home. `src/proxy.ts` routes by host and redirects app paths on the marketing host to the app host. Locally, `localhost:3000` serves the marketing page at `/` and the app home at `/home`; `app.localhost:3000` behaves like the app host.

`.env` must contain `claude_api=<Anthropic API key>`. If the key is missing or the API fails, the app falls back to a keyword classifier and labels results "offline analysis".

Data lives in `data/db.json`, which is created and seeded on first run. **Demo controls → Reset demo data** restores the seed.

## Demo script

1. Open **Demo controls** (bottom left), then choose **Citizen** to sign in as Maya Chen, a verified resident in Oakland.
2. **Report**: describe a problem (type it or use the mic) and drop a pin, for example near I-880 and High St in Oakland. Claude proposes a category and priority and finds the existing pothole cluster. Confirm the category and choose to join the issue.
3. **Feed**: your report is marked "Your report" and shows how many neighbors reported the same issue.
4. **Heatmap**: public, filterable, weighted by priority.
5. **Chat & call**: talk to Sam by WhatsApp-style chat or by voice call (speech recognition needs Chrome or Edge).
6. **Demo controls → Start live simulation** adds a simulated neighbor report every 8–12 s.
7. **Demo controls → Run resolution demo** moves Maya's I-880 cluster through Acknowledged, In progress and Resolved in about 15 s. Watch the bell, the toasts and the issue page.
8. **Staff** sign-in opens the triage dashboard: a priority queue, status changes with public notes, an AI staff brief, department routing and merging duplicates.

Demo accounts use the password `demo1234`: `maya@demo.unigov` (resident) and `jordan.rivera@demo.unigov` (staff). New accounts go through UniGov registration and ID verification: Claude reads an uploaded ID photo and checks the name and expiry. A **Use sample ID** button skips the upload in demos.

## Real WhatsApp and phone (Twilio)

The same intake agent is exposed as Twilio webhooks:

| Channel | Twilio setting | URL |
| --- | --- | --- |
| WhatsApp | "A message comes in" (POST) | `https://<public-host>/api/channels/whatsapp` |
| Voice | "A call comes in" (POST) | `https://<public-host>/api/channels/voice` |

Expose your local server with a tunnel (for example `ngrok http 3000`). To enforce Twilio request signatures, set `TWILIO_AUTH_TOKEN` and `PUBLIC_BASE_URL`. Without them, every request is accepted, which is fine for local demos only.

## Optional env

| Var | Purpose |
| --- | --- |
| `SESSION_SECRET` | HMAC key for session cookies (a dev default is used otherwise) |
| `TWILIO_AUTH_TOKEN`, `PUBLIC_BASE_URL` | Twilio webhook signature validation |

## Layout

- `src/lib/ai.ts`: every Claude call: report analysis, ID reading, staff brief and the intake agent. Each call is structured output validated with Zod, with server-side refusal fallback.
- `src/lib/service.ts`: clustering, priority, status changes and notifications.
- `src/lib/seed.ts`: 20 real Bay Area hot spots and the live-simulation script.
- `src/app/api/*`: route handlers. `src/app/*`: pages.

Map tiles © Esri; geocoding by OpenStreetMap Nominatim.
