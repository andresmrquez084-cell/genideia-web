# GENIDEIA video slots

The website uses the public Supabase Storage bucket `genideia-videos` in project `dbwuubabafzsinaokawe`.

## Fixed destinations

| Purpose | Storage path | Website destination |
| --- | --- | --- |
| GENIDEIA TMS technical walkthrough | `portfolio/tms.mp4` | Portfolio → GENIDEIA TMS → Ver recorrido técnico |
| GENIDEIA OS technical walkthrough | `portfolio/os.mp4` | Portfolio → GENIDEIA OS → Ver recorrido técnico |
| WhatsApp + IA walkthrough | `portfolio/bot.mp4` | Portfolio → WhatsApp + IA → Ver recorrido técnico |
| Client onboarding welcome | `onboarding/default.mp4` | Client Hub welcome/onboarding |

## Rules

- Upload MP4 files only.
- Use the exact paths above.
- Replacements must keep the same path so the website updates without a new deployment.
- The admin UI at `/clientes/videos` uses resumable TUS uploads and upsert.
- For `onboarding/default.mp4`, after upload the media registry slot is `onboarding.default`. Existing client profiles without a custom `video_url` receive the default, and new client profiles inherit it through the database trigger.
- Do not replace a client-specific `video_url`; those are deliberate overrides.

## Public URL pattern

`https://dbwuubabafzsinaokawe.supabase.co/storage/v1/object/public/genideia-videos/<storage-path>`

No service-role key or secret is stored in this repository. Uploads from the web UI require an authenticated GENIDEIA admin session and Storage RLS policies enforce admin-only writes.
