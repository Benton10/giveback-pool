# Giveback Pool

A class game about a shared insurance pool. Students join from a QR code on their phones, vote on premiums and claims, and the teacher runs the round on a projector.

- `src/index.html`: the game page. The teacher uses `/`, students use `/join`.
- `src/worker.js`: the server. It serves the page and the API (`/api/*`), which stores the game in a Cloudflare D1 database.
- `schema.sql`: the database tables.
- `wrangler.toml`: the Cloudflare settings.

## Live site

https://giveback-pool.giveback-pool.workers.dev (teacher: `/`, students: `/join`)

## Redeploy after changes

```bash
npx wrangler deploy
```

## Set up from scratch

Run these from the repo folder, one at a time. `npx` downloads Wrangler, Cloudflare's command-line tool, the first time it runs.

1. Sign in to Cloudflare: `npx wrangler login`
2. Create the database and paste the `database_id` it prints into `wrangler.toml`: `npx wrangler d1 create giveback-pool`
3. Create the tables: `npx wrangler d1 execute DB --remote --file=schema.sql`
4. Set the teacher code. Pick one only you know; students never need it: `npx wrangler secret put HOST_CODE`
5. Deploy: `npx wrangler deploy`

## Notes

- Anyone with the link can open the student page. Students can only join while the lobby is open.
- Student names and votes are stored in your Cloudflare D1 database. Clear the `players` and `ballots` tables when the unit ends.
- The teacher code is the only thing that protects the teacher controls.
