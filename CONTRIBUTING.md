# Contributing

1. Create a branch from `main`.
2. Follow the setup in [README.md](README.md) (`npm ci`, `.dev.vars`, `npm run db:migrate:local`).
3. Make your change. Keep menu, price, fee and status rules in `lib/domain.ts` only.
4. If you change `db/schema.ts`, run `npm run db:generate` and commit the new SQL and snapshot in `drizzle/`.
5. If you change `wrangler.jsonc`, run `npm run cf-typegen`.
6. Before opening a pull request, run:

   ```bash
   npm run typecheck && npm run lint && npm test
   ```

7. Open a pull request using the template. CI runs the same three checks.

## Guidelines

- Never commit secrets, `.dev.vars`, or database files.
- Validate every API input on the server; never trust prices or totals from the browser.
- Add a test for new rules in `lib/` and for new security-relevant behaviour in the worker.
- Do not alter the supplied logo; the original is kept in `branding/`.
