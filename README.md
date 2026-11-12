# Windi-Rian wedding invitation

React and Vite invitation site with a Supabase-backed guest administration page at `/admin`.

## Local frontend setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Supabase project URL and publishable/anon key. These two values are public client configuration; never put the service-role key in a `VITE_` variable.
3. Install dependencies and run the site:

   ```sh
   npm install
   npm run dev
   ```

4. Open `/admin` for the administrator sign-in page.

## Supabase setup and deployment

The guest data migration is in `supabase/migrations`. It enables RLS and revokes direct table access from `anon` and `authenticated`; browser requests must use the Edge Functions.

1. Install and authenticate the Supabase CLI, then link this project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   ```

2. Apply the migration:

   ```sh
   supabase db push
   ```

3. Configure the admin username and a new password without sharing the password in chat or putting it in the source code. On Windows, run the setup script from the repository after linking the active Supabase project:

   ```powershell
   .\scripts\configure-admin.ps1
   ```

   Enter the production website origin and any local development origins when prompted. The script asks for the password securely, stores only a PBKDF2-SHA256 hash in Supabase secrets, generates a signing secret, and removes its temporary secrets file. The default username is `admin`.

4. Deploy the migration and Edge Functions:

   ```powershell
   supabase db push
   supabase functions deploy admin-session
   supabase functions deploy admin-guests
   supabase functions deploy public-invite
   ```

   The deploy requires an active Supabase project. `supabase link --project-ref` takes the project reference only, not the full project URL. Supabase Edge Functions provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at runtime. For local function development, configure server-only secrets in an ignored local function environment file; do not commit it.

5. Build the static frontend with the same project URL and anon key in its deployment environment. Never put `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, or the service-role key in any `VITE_` variable or browser bundle. The username, password hash, session signing secret, and `APP_ORIGINS` must remain Supabase server-side secrets.

`vercel.json` rewrites `/admin` to the Vite app entry point so direct navigation and refresh work on Vercel. Other static hosts must provide the equivalent SPA fallback.

`admin-session` verifies the configured username and PBKDF2 password hash, applies a server-side attempt limit, and issues a signed session that expires after four hours. `admin-guests` verifies that signed session on every operation. The Edge Functions enforce `APP_ORIGINS`; include the exact HTTPS production origin and the local origin(s) you use, without a trailing path. `public-invite` returns only a guest's display name for lookup and accepts RSVP status/count updates only for a valid personal invitation slug. It never returns phone numbers, internal notes, or wishes.

## Guest and WhatsApp behavior

- Guest categories: Keluarga, Teman, Rekan Kerja, and Lainnya.
- Guests opening their personal invitation can submit or update an RSVP status and attendance count; the response is stored on that guest record and is visible in the admin dashboard. Only `attending`/`declined` status and a count from 1–6 are accepted; public guests cannot change notes or other fields.
- Each guest gets a unique slug when created. Editing the name does not modify that slug or invalidate the old link.
- Personal links use the current site origin and the `?invite=...` query parameter.
- WhatsApp sharing is manual only. The admin previews the message, opens WhatsApp with a normalized phone number and personal link, and then the admin must press Send in WhatsApp. The saved `Dibuka manual` status does not mean a message was sent or delivered.
- There is no WhatsApp Business API integration and no WhatsApp API credential is required.
- Removing a guest also removes the RSVP/wishes stored on that guest record; the admin UI warns before deletion.

## Validation

```sh
npm run lint
npm run build
npm test
```
