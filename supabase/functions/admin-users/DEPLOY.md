# Deploying the `admin-users` Edge Function

This function performs the privileged user-management actions (create, invite,
delete, ban, change role) that **cannot** run in the browser because they need
the Supabase **service-role** key.

You run these steps once (and re-run `deploy` whenever the function changes).

## Prerequisites

- The Supabase CLI: https://supabase.com/docs/guides/cli
- You're logged in and linked to your project:
  ```bash
  supabase login
  supabase link --project-ref <your-project-ref>
  ```
  (`<your-project-ref>` is the subdomain of your project URL, e.g.
  `txgxonwcdrxayurzjcwb`.)

## 1. Run the SQL migration first

In the Supabase dashboard → SQL Editor, run:

```
supabase/migrations/0003_user_roles.sql
```

This adds the `role` enum, `banned_at`, keeps `is_admin` in sync, and creates
the admin-only `admin_users` view. The function and the UI both depend on it.

## 2. Set the service-role secret

Find your **service_role** key in the dashboard:
Project Settings → API → Project API keys → `service_role` (click reveal).

> ⚠️ This key bypasses RLS. Never put it in `.env`, the frontend, or git.
> It only ever lives as a function secret.

```bash
supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into Edge Functions
automatically — you do **not** need to set those.

## 3. Deploy

```bash
supabase functions deploy admin-users
```

## 4. Verify

The function is called by the Users page in the app. To smoke-test manually
(replace the token with an **admin** user's access token):

```bash
curl -i -X POST \
  "https://<project-ref>.functions.supabase.co/admin-users" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"setRole","user_id":"<some-user-id>","role":"staff"}'
```

A non-admin token must return `403 Admin privileges required`.

## Notes

- The function authenticates the caller with the anon client (RLS applies) and
  refuses anyone whose profile role isn't `admin`, **then** switches to the
  service-role client to act. A leaked anon key still can't use it.
- Self-protection is built in: you can't delete, ban, or de-admin your own
  account through it.
- `invite` sends Supabase's invite email; `create` with a password makes a
  ready-to-use account. Configure the email templates/SMTP in the dashboard for
  invites to actually send.
