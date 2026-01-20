# EryAI Monitoring

System monitoring och automatiska tester för hela EryAI-plattformen.

## Endpoints

| Endpoint | Beskrivning |
| --- | --- |
| `/api/status` | Status-sida (HTML) för alla system |
| `/api/health` | Snabb health check (JSON) |
| `/api/test` | Kör fullständigt test-suite (33 tester) |

## Vad testas?

### Landing (eryai.tech) - 2 tester
- Sidan laddas
- Demo-länk finns

### Engine (eryai-engine.vercel.app) - 7 tester
- API responds
- Customer lookup works
- Knowledge base used
- Actions trigger correctly
- AI config in database
- Actions in database
- **AI response latency acceptable** ⚡

### Demo Restaurant (ery-ai-demo-restaurang.vercel.app) - 6 tester
- Sidan laddas
- Restaurant API
- Messages API
- Typing API
- Session sparas i Supabase
- Meddelanden sparas

### Dashboard (dashboard.eryai.tech) - 3 tester
- Login-sida laddas
- Redirect till login
- API messages endpoint

### Push Notifications - 5 tester 🆕
- Service Worker accessible (`/sw.js`)
- Manifest accessible (`/manifest.json`)
- Subscribe endpoint exists
- Send endpoint requires API key (zero-trust)
- Subscriptions table exists

### Sales (sales.eryai.tech) - 4 tester
- Login-sida laddas
- Redirect till login
- API leads endpoint
- Leads table exists

### Supabase - 3 tester
- Anslutning fungerar
- Bella Italia customer finns
- Alla tabeller finns (8 st)

### Email - 2 tester
- Resend API-nyckel konfigurerad
- Resend client initialized

### Cleanup - 1 test
- Test data removed

## ⚡ Latency Metrics

Monitoring mäter svarstider för AI och API:

| Typ | Warn | Fail |
| --- | --- | --- |
| AI Response | > 3000ms 🟡 | > 10000ms 🔴 |
| API Response | > 1000ms 🟡 | > 5000ms 🔴 |

Latency-rapporten visar:
- 🟢 Normal (under warn threshold)
- 🟡 Warning (över warn, under fail)
- 🔴 Critical (över fail threshold)

## Cron Jobs

Testerna körs automatiskt **kl 08:00 svensk tid** varje dag.

Vid fel skickas email till [eric@eryai.tech](mailto:eric@eryai.tech) med:
- Lista över failed tests
- AI average latency
- Länk för att köra testerna igen

## Environment Variables

Lägg till i Vercel:

```
SUPABASE_URL=https://tjqxseptmeypfsymrrln.supabase.co
SUPABASE_SERVICE_KEY=xxx
RESEND_API_KEY=xxx
INTERNAL_API_KEY=xxx
```

## URLs

- Status: https://eryai-monitoring.vercel.app/api/status
- Health: https://eryai-monitoring.vercel.app/api/health
- Test: https://eryai-monitoring.vercel.app/api/test

## Test Kategorier Sammanfattning

| Kategori | Antal | Beskrivning |
| --- | --- | --- |
| Landing | 2 | Landningssida |
| Engine | 7 | Multi-tenant AI-motor |
| Demo | 6 | Legacy restaurant demo |
| Dashboard | 3 | Kunddashboard |
| Push | 5 | PWA & Push notifications |
| Sales | 4 | Sales dashboard |
| Supabase | 3 | Databas |
| Email | 2 | Resend integration |
| Cleanup | 1 | Rensa testdata |
| **Total** | **33** | |

## Zero-Trust Security

Push-testerna verifierar att:
- `/api/push/send` kräver `X-Internal-API-Key` header
- Utan API-nyckel → 401/403
- Med rätt API-nyckel → 200
