# Calendar · Vanilla JS + MongoDB Atlas

Misma UI. Eventos en Atlas (`gcal.events`).

## Local

```bash
npm install
npm start
```

Sin `MONGODB_URI` usa `/tmp`.

## Cloud Run

```bash
export GCP_PROJECT_ID=project-778283d9-dc7e-4c2c-947
export MONGODB_URI="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/gcal?retryWrites=true&w=majority&authSource=admin"

gcloud run deploy gcal-vanilla \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --update-env-vars="MONGODB_URI=${MONGODB_URI},MONGODB_DB=gcal,MONGODB_COLLECTION=events"
```

`/health` tiene que decir `"store":"mongodb"`.

## API

- `GET /api/events?month=2026-09`
- `POST /api/events` `{ title, date }`
- `DELETE /api/events/:id`
- `GET /health`
