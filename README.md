# Calendar · Vanilla JS + Cloud Run

Mes tipo Google Calendar. Alta y baja de eventos. Node `http` nativo.

## Local

```bash
npm start
```

http://localhost:8080

## Cloud Run

```bash
gcloud run deploy gcal-vanilla \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

Usa `PORT` y escucha en `0.0.0.0`. Los eventos se guardan en `/tmp` (se pierden al apagar la instancia).

## API

- `GET /api/events?month=2026-09`
- `POST /api/events` `{ title, date }`
- `DELETE /api/events/:id`
- `GET /health`
