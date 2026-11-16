# Giveback Pool

A class game about a shared insurance pool. Students join from a QR code on their phones, vote on premiums and claims, and the teacher runs the round on a projector.

- `public/index.html`: the teacher page (at `/`) and the student page (at `/join`).
- `public/_worker.js`: the API, which stores the game in a Cloudflare D1 database.
- `schema.sql`: the database tables.
- `wrangler.toml`: the Cloudflare Pages settings.

## Deploy (one time)

Run these from the repo folder, one at a time. Each command uses `npx`, which downloads Wrangler, Cloudflare's command-line tool, the first time it runs.

1. Sign in to Cloudflare:

```bash
npx wrangler login
```

2. Create the database and copy the `database_id` it prints into `wrangler.toml`:

```bash
npx wrangler d1 create giveback-pool
```

3. Create the tables:

```bash
npx wrangler d1 execute DB --remote --file=schema.sql
```

4. Set the teacher code. Pick a code only you know. Students never need it:

```bash
npx wrangler pages secret put HOST_CODE --project-name giveback-pool
```

5. Deploy the site:

```bash
npx wrangler pages deploy public --project-name giveback-pool
```

Cloudflare prints the site address. The teacher opens it, enters the teacher code, and shows the QR code, which points to `<address>/join`.

## Notes

- Anyone who has the site address can open the student page. Students only join while the lobby is open.
- Student names and votes are stored in your Cloudflare D1 database. Delete the database or its rows when the unit ends.
- The teacher code is the only thing that protects the teacher controls.
