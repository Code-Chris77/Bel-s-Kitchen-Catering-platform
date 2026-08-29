# Bel's Kitchen Catering Service

This folder contains the complete source code for the Bel's Kitchen ordering
system. It includes the customer ordering experience, order tracking, the
password-protected kitchen queue, the administrator dashboard, database schema,
migrations, logo, QR code, and food images.

## What is included

| Area | Address after starting the project | Purpose |
| --- | --- | --- |
| Customer ordering | `/` | Menu, cart, delivery or restaurant ordering, and demo payment |
| Order tracking | `/track` | Shows received, preparing, ready, and collected/delivered progress |
| Kitchen queue | `/kitchen` | Password-protected queue for chefs |
| Admin dashboard | `/admin` | Financial totals, order counts, and kitchen-password management |

## Requirements

- Visual Studio Code
- Node.js 22.13 or newer
- npm
- On Windows, use VS Code with WSL (Ubuntu is recommended). The project's
  verified install and build helpers use Linux shell commands.

## Run the project locally

1. Extract the ZIP.
2. Open the `bels-kitchen-catering` folder in Visual Studio Code.
3. Open a terminal in that folder.
4. Install the exact dependencies:

   ```bash
   npm ci
   ```

5. Create your private local settings file:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

6. Open `.dev.vars` and replace every example value. Keep this file private.
7. Create the local database tables:

   ```bash
   npx wrangler d1 migrations apply site-creator-d1 --local
   ```

8. Start the website:

   ```bash
   npm run dev
   ```

9. Open the local address shown in the terminal.

The local database is separate from the live restaurant database, so testing
locally will not change live orders or financial records.

## Local passwords and administrator account

The values in `.dev.vars` control the first kitchen password and the admin
login. Use long, unique values for all three session and account secrets.

- `KITCHEN_PASSWORD`: initial password used by chefs.
- `KITCHEN_SESSION_SECRET`: protects kitchen login sessions and saved kitchen
  password hashes.
- `ADMIN_EMAIL`: administrator login email.
- `ADMIN_PASSWORD`: administrator login password.
- `ADMIN_SESSION_SECRET`: protects administrator login sessions.

After the administrator changes the kitchen password, the new password is
stored securely in the database and the initial `KITCHEN_PASSWORD` stops being
used.

## Important project folders

| Folder | Contents |
| --- | --- |
| `app/` | Pages and server API routes |
| `components/` | Shared branding and interface components |
| `db/` | Database connection and table definitions |
| `drizzle/` | Database migrations required by the ordering system |
| `lib/` | Admin and kitchen authentication helpers |
| `public/` | Exact Bel's Kitchen logo, QR code, and food images |
| `tests/` | Automated project checks |

## Useful commands

```bash
npm run dev       # Start local development
npm run lint      # Check the code
npm run build     # Create a production build
npm test          # Build and run automated tests
```

## Current integration status

- Payments are demonstration-only and do not collect real money.
- SMS messages are demonstration-only and are not sent through a live SMS
  provider.
- Live payments require a verified Paystack, Flutterwave, or Hubtel account.
- Live SMS requires an SMS provider account and server-side integration.
- Never place payment keys, SMS keys, or passwords directly in the source code.

## Branding

The exact supplied logo is stored at `public/bels-kitchen-logo.png`. Do not
redraw or alter it. The interface uses the restaurant's brown, gold-orange, and
white brand colours.
