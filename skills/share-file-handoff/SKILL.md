---
name: share-file-handoff
repo: LIghtJUNction/lightjunction
description: >
  File handoff workflow using share.lmm.best. Use this skill when the user asks
  to deliver files, share downloads, send work products to customers, create a
  file link, DM a finished file, or manage the lmm.best file transfer service.
---

# Share File Handoff

Use `share.lmm.best` to deliver non-secret files to customers or social contacts
with direct download links.

## Service Facts

- Public service URL: `https://share.lmm.best/`
- Login helper URL: `https://share.lmm.best/?h`
- Software: `copyparty`
- systemd service: `share-lmm-best.service`
- Local listener: `127.0.0.1:8095`
- Nginx config: `/etc/nginx/conf.d/share.lmm.best.conf`
- File root: `/srv/share-lmm-best/files`
- Admin password file: `/root/.kimaki/secrets/share-lmm-best-admin-password.txt`
- Certificate path: `/etc/letsencrypt/live/share.lmm.best/`

## Security Rules

Never use the share service for:

- Private keys.
- Seed phrases.
- Passwords.
- OAuth tokens.
- Cookies.
- Account recovery codes.
- Production credentials.
- Sensitive customer data unless the user explicitly approves a safer channel.

Treat every shared URL as public to anyone who has the link. The root directory
is not publicly listable, but individual files are accessible by URL.

## Delivery Model

The intended flow is:

1. Create or receive a non-secret deliverable file.
2. Put it under `/srv/share-lmm-best/files/` using a hard-to-guess folder name.
3. Verify the URL returns `HTTP 200`.
4. Send the URL to the recipient by Bluesky DM, Discord, email, or public reply
   when public delivery is acceptable.
5. Record the handoff in the daily diary if it is part of paid/customer work.

## Quick Manual Handoff

Use a random directory per customer/delivery:

```bash
token=$(openssl rand -hex 16)
mkdir -p "/srv/share-lmm-best/files/$token"
cp -- ./deliverable.zip "/srv/share-lmm-best/files/$token/deliverable.zip"
chmod 0644 "/srv/share-lmm-best/files/$token/deliverable.zip"
printf 'https://share.lmm.best/%s/deliverable.zip\n' "$token"
```

Verify:

```bash
curl -I "https://share.lmm.best/$token/deliverable.zip"
```

Expected result: `HTTP/2 200`.

## Admin Access

Use the web UI only when needed:

```text
https://share.lmm.best/?h
```

The admin password is stored locally at:

```text
/root/.kimaki/secrets/share-lmm-best-admin-password.txt
```

Do not paste the password into chat, posts, commits, or public logs.

## Health Checks

Run these checks after changes:

```bash
systemctl is-active share-lmm-best.service
systemctl is-enabled share-lmm-best.service
curl -I https://share.lmm.best/health.txt
curl -I https://share.lmm.best/
```

Expected:

- Service is `active` and `enabled`.
- `health.txt` returns `HTTP/2 200`.
- Root path returns `HTTP/2 403` for anonymous users.

Check certificate renewal:

```bash
certbot renew --dry-run --cert-name share.lmm.best
```

## DM Delivery

Bluesky DMs require app-password DM access and recipient permission. Before
sending a DM, make sure the recipient asked for or clearly welcomed private
handoff.

Good DM template:

```text
Here is the file/link I prepared:
https://share.lmm.best/<token>/<file>

It is a public-by-link download. Please do not send secrets through this link.
```

## Public Post Language

When promoting this capability, say:

```text
I can deliver finished files through share.lmm.best links: static pages, small
reports, copy drafts, checklists, or zipped assets. Public-by-link delivery only;
no secrets or private keys.
```
