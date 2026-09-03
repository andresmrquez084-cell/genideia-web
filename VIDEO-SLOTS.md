# GENIDEIA video slots

The website uses the public Supabase Storage bucket `genideia-videos` in project `dbwuubabafzsinaokawe`.

## Fixed destinations

| Purpose | Storage path | Website destination |
| --- | --- | --- |
| GENIDEIA TMS technical walkthrough | `portfolio/tms.mp4` | `/experiencia` → "Sistema destacado" (reproductor embebido en la portada) |
| Client onboarding welcome | `onboarding/default.mp4` | Client Hub welcome/onboarding |

Only GENIDEIA TMS carries a video in the portfolio. The other featured systems
(GENIDEIA OS, WhatsApp + IA) appear only in the filterable project list below.

## Rules

- Upload MP4 files only.
- Use the exact paths above.
- Replacements must keep the same path so the website updates without a new deployment
  (the public page has no cache-busting; a replaced file propagates within ~1 h).
- The admin UI at `/clientes/videos` uses resumable TUS uploads and upsert.
- The project-level "Upload file size limit" (Storage → Settings) must be at least
  as large as the file being uploaded; the bucket limit is 1 GB.
- For `onboarding/default.mp4`, after upload the media registry slot is `onboarding.default`. Existing client profiles without a custom `video_url` receive the default, and new client profiles inherit it through the database trigger.
- Do not replace a client-specific `video_url`; those are deliberate overrides.

## Public URL pattern

`https://dbwuubabafzsinaokawe.supabase.co/storage/v1/object/public/genideia-videos/<storage-path>`

No service-role key or secret is stored in this repository. Uploads from the web UI require an authenticated GENIDEIA admin session and Storage RLS policies enforce admin-only writes.
