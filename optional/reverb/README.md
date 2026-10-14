# OPTIONAL — websockets with Laravel Reverb (not used by the app)

The app does **not** need this. Live updates run on cheap polling (`GET /api/matches/pulse`), which works on
Hostinger shared hosting. These files are here only in case you later move to a VPS where you can keep
`php artisan reverb:start` running.

To enable later, copy the files to the same paths in the project, then:
* `composer require laravel/reverb`, `npm i laravel-echo pusher-js`
* add `->withBroadcasting(__DIR__.'/../routes/channels.php', ['prefix' => 'api', 'middleware' => ['api','auth:sanctum','account.active','require.full_access']])` after `withRouting(...)` in `bootstrap/app.php`
* in `ItemMatchingService`, add an `announce($match, $reason)` method that does `event(MatchUpdated::for($match, $reason))` inside try/catch, and call it after a match is created, its score/level changes, or its status changes (notify / dismiss in `MatchController`)
* in `SecurityMatches.jsx` / `LostItemMatches.jsx`, call `useRealtimeEvent('lost-found.handlers' | `lost-items.${id}`, 'match.updated', reload)` and slow the polling when `connected`
* in `AuthContext.logout`, call `disconnectRealtime()`
* set the `REVERB_*` / `VITE_REVERB_*` values and `BROADCAST_CONNECTION=reverb`

The original setup notes follow.

---

# Real-time matches with Laravel Reverb

Matches now update the instant they are created, re-scored or actioned — no waiting for the next poll.
The pages **still poll as a fallback** (every 10 s if the socket is down, every 60 s if it's up), so if Reverb
isn't running nothing breaks; the "Live" label just reads "Auto-refresh".

## How it works
1. `ItemMatchingService` creates / re-scores a match → fires `App\Events\MatchUpdated`.
2. Reverb pushes it over a **private** channel: `lost-found.handlers` (Security / Admin / Staff) and
   `lost-items.{id}` (the report's owner). Channel access is checked in `routes/channels.php`.
3. The page hears `match.updated` and re-fetches through the normal REST API. The event itself only holds
   `match_id`, `score`, `level`, `status` — never item details.

## One-time setup (any machine)
```bash
composer update            # installs laravel/reverb (already added to composer.json)
npm install                # installs laravel-echo + pusher-js (already in package.json)
php artisan config:clear
```
`.env` already has local development keys. For production generate your own:
`REVERB_APP_ID` (any number), `REVERB_APP_KEY` / `REVERB_APP_SECRET` (random strings, e.g. `openssl rand -hex 16`).

## Local development (XAMPP / Windows included)
```bash
composer dev               # now also starts `php artisan reverb:start --debug`
# …or in separate terminals:
php artisan serve
php artisan reverb:start --debug
npm run dev
```
Open **Matches** as Security and file a lost report as a student in another browser — the score card
flashes yellow with a ▲/▼ change without a refresh. The label top-right shows **Live** when the socket is up.

## Production (sclf.occph.com)
Reverb is a long-running PHP process. It needs a VPS / server where you can keep a process alive — typical
shared cPanel hosting cannot (then keep `BROADCAST_CONNECTION=log` and the pages simply poll).

`.env` on the server:
```
BROADCAST_CONNECTION=reverb
REVERB_HOST="sclf.occph.com"
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8080
REVERB_ALLOWED_ORIGINS="sclf.occph.com"
```
Then `npm run build` (the `VITE_REVERB_*` values are baked in at build time).

**Keep it running (Supervisor):**
```ini
[program:reverb]
command=php /var/www/sclf/artisan reverb:start
directory=/var/www/sclf
autostart=true
autorestart=true
user=www-data
stopasgroup=true
stdout_logfile=/var/log/reverb.log
minfds=10000
```
After deploys: `php artisan reverb:restart`.

**Nginx** — proxy websockets on the same domain so you only expose 443:
```nginx
location /app {
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Scheme $scheme;
    proxy_set_header SERVER_PORT $server_port;
    proxy_set_header REMOTE_ADDR $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_pass http://127.0.0.1:8080;
}
```
(Apache: enable `mod_proxy_wstunnel` and `ProxyPass /app ws://127.0.0.1:8080/app`.)
Raise the open-files limit for the Reverb user if you expect many simultaneous connections.

## Troubleshooting
| Symptom | Check |
|---|---|
| Label says "Auto-refresh", not "Live" | Is `reverb:start` running? Did you rebuild after editing `VITE_REVERB_*`? Browser console → Network → WS. |
| 403 on `/api/broadcasting/auth` | Signed-in user isn't Security/Admin/Staff (handlers channel) or doesn't own that lost report. |
| 401 on `/api/broadcasting/auth` | Expired access token — the app refreshes it and re-subscribes automatically. |
| Pushes never arrive | `BROADCAST_CONNECTION` must be `reverb` (not `log`/`null`); run `php artisan config:clear`. |
| Reverb down | Matches still save (broadcast errors are caught + reported); pages fall back to polling. |
