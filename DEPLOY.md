# Public Deployment

The quickest durable public link for this MVP is Render with a persistent disk.

## Deploy On Render

1. Put this project folder in a GitHub repository.
2. Go to Render and create a new **Blueprint**.
3. Choose the repository.
4. Render will detect `render.yaml`.
5. Deploy the service.

Render will create a public URL like:

`https://roland-garros-bracket-challenge.onrender.com`

Everyone with that URL can open the bracket challenge.

## Why Render

This prototype stores shared entries, picks, results, and imported draw data in one JSON file. Render supports a small persistent disk through `render.yaml`, so the shared state can survive restarts.

Render persistent disks require a paid web service. A free web service can still run the app, but its filesystem is ephemeral, which means shared entries can disappear after restarts or deploys.

The configured persistent state location is:

`/var/data/state.json`

## Local Run

```sh
npm start
```

Then open:

`http://127.0.0.1:4173/index.html`

## Docker Run

```sh
docker build -t rg-bracket .
docker run -p 4173:4173 -v rg-bracket-data:/app/data rg-bracket
```

Then open:

`http://127.0.0.1:4173/index.html`

## Important MVP Limits

This is good for a friend group MVP. For a larger public contest, move persistence from `data/state.json` to Supabase/Postgres so simultaneous saves, authentication, admin permissions, and audit logs are robust.
