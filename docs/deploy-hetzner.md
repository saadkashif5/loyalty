# Deploying to Hetzner

This puts the whole platform on one Hetzner Cloud server: the API, the worker,
the three web apps, Redis and Caddy (HTTPS). MongoDB runs on MongoDB Atlas.
Every push to `main` builds new images in GitHub Actions and rolls the server
onto them. The server never builds anything.

```
                    ┌────────────── Hetzner server (Docker) ───────────────┐
 stamply…        ──►│ Caddy :443 ─► portal :3000 ─┐                        │
 business.stamply…──►│           ─► web    :3000 ─┼─► api :4000 ─► redis    │──► MongoDB Atlas
 admin.stamply…   ──►│           ─► admin  :3000 ─┘      worker ─┘          │──► SMTP (Brevo)
 api.stamply…     ──►│           ─► api    :4000                            │
                    └───────────────────────────────────────────────────────┘
```

| What | Service | Cost (approx.) |
|---|---|---|
| Server | Hetzner CX23, 2 vCPU, 4 GB, x86 (prices rose June 2026) | ~€6/month with IPv4 |
| Server backups | Hetzner Backups (daily, 7 kept) | +20% of the server |
| Database | MongoDB Atlas M0 (free) to start | free |
| Email | Brevo (300 emails/day free) | free |
| Images and CI | GitHub Container Registry and Actions | free for most private repos |

Files involved: [`Dockerfile`](../Dockerfile), [`deploy/`](../deploy) and
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

Commands marked **(your PC)** run in Git Bash or PowerShell on your machine;
**(server)** runs over SSH on the server.

---

## 1. MongoDB Atlas

1. Sign up at <https://cloud.mongodb.com> and create a project called `Stamply`.
2. **Create cluster → M0 (Free)**. Provider **AWS**, region **Frankfurt
   (eu-central-1)**, the closest to Hetzner's German data centres.
3. **Database Access → Add new database user**: username `stamply`, a long
   generated password, role *Read and write to any database*. Save the password.
4. **Network Access**: leave it for now; you add the server's IP in step 3.
5. **Connect → Drivers** and copy the connection string. Add the database name
   `stamply` before the `?`:

   ```
   mongodb+srv://stamply:PASSWORD@cluster0.xxxxx.mongodb.net/stamply?retryWrites=true&w=majority
   ```

   If the password has symbols such as `@`, `/` or `:`, URL-encode them, or
   generate a password with letters and digits only.

M0 has no backups and a 512 MB limit. It is fine for testing and the first
businesses. Move to M10 (~$57/month, daily backups) before real customers
depend on it (see [Backups](#backups)).

## 2. Hetzner server

1. **(your PC)** Create an SSH key if you do not have one:

   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"
   cat ~/.ssh/id_ed25519.pub
   ```

2. Sign up at <https://console.hetzner.cloud>, create a project, then
   **Add Server**:
   - **Location**: Nuremberg or Falkenstein (Germany).
   - **Image**: Ubuntu 24.04.
   - **Type**: Shared vCPU → **x86** → **CX22** (or CX23). Not the ARM
     (CAX) types: the images are built for x86.
   - **SSH key**: paste the `.pub` key from step 1.
   - **Backups**: on.
   - **Firewall**: create one with inbound rules **TCP 22**, **TCP 80**,
     **TCP 443** and **UDP 443**, all from any IP. Use this firewall, not `ufw`:
     Docker bypasses `ufw`.
   - **Name**: `stamply-prod`.
3. Note the server's **IPv4 address**. In Atlas → **Network Access → Add IP
   address**, add it.

## 3. Prepare the server

**(your PC)** `ssh root@SERVER_IP`, then **(server)**:

```bash
# Updates, and automatic security updates from now on
apt update && apt -y upgrade
apt -y install unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker
curl -fsSL https://get.docker.com | sh

# A user for running and deploying the app
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# 2 GB of swap, as a safety margin
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# SSH: keys only, no root login. The file name must sort before Ubuntu's
# 50-cloud-init.conf: sshd keeps the first value it reads for each setting.
printf 'PasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/00-hardening.conf
systemctl restart ssh

mkdir -p /home/deploy/stamply && chown deploy:deploy /home/deploy/stamply
```

From now on, connect as `ssh deploy@SERVER_IP`. Root login is disabled.

## 4. DNS

At whoever hosts the DNS for `taptapsell.pk`, add four **A** records pointing to
the server's IPv4:

| Name | Type | Value |
|---|---|---|
| `stamply` | A | SERVER_IP |
| `business.stamply` | A | SERVER_IP |
| `admin.stamply` | A | SERVER_IP |
| `api.stamply` | A | SERVER_IP |

If DNS is on Cloudflare, set these to **DNS only** (grey cloud). Caddy then
gets its own certificates and sees real visitor IPs.

Check (your PC): `nslookup admin.stamply.taptapsell.pk` should return the server IP.

For a test deployment on a different domain, use that domain everywhere
`stamply.taptapsell.pk` appears below. Stamper tags must only ever be written
with the final portal host ([stamper-provisioning.md](stamper-provisioning.md)).

## 5. Email (Brevo)

1. Sign up at <https://www.brevo.com>.
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain**:
   `stamply.taptapsell.pk`. Add the DNS records Brevo shows (brevo-code, DKIM,
   DMARC, and SPF), then click **Verify**. Without this, mail lands in spam or
   is rejected.
3. **SMTP & API → SMTP → Generate a new SMTP key**. Note the **login** (looks
   like `xxxxxx@smtp-brevo.com`) and the key.
4. Your `SMTP_URL`, with the `@` in the login written as `%40`:

   ```
   smtp://xxxxxx%40smtp-brevo.com:YOUR_SMTP_KEY@smtp-relay.brevo.com:587
   ```

## 6. Configuration files on the server

**(your PC)**, from the repository folder:

```bash
scp deploy/.env.example deploy/api.env.example deploy/frontend.env.example deploy@SERVER_IP:~/stamply/
```

**(server)**:

```bash
cd ~/stamply
cp .env.example .env
cp api.env.example api.env
cp frontend.env.example frontend.env
chmod 600 .env api.env frontend.env

# Generate the secrets; paste each into the right file
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "INTERNAL_API_SECRET=$(openssl rand -base64 48)"
echo "MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

Edit each file with `nano FILE` (save with Ctrl+O, exit with Ctrl+X):

- **`.env`**:
  - `IMAGE_PREFIX=ghcr.io/<github-owner>/<repo>`, all lowercase, e.g.
    `ghcr.io/saadkashif5/loyalty`.
  - `DOMAIN=stamply.taptapsell.pk`.
  - `ACME_EMAIL` set to your email address.
- **`api.env`**:
  - `MONGODB_URI` from step 1.
  - The four secrets.
  - `SMTP_URL` from step 5.
  - Check the three URL lines match your domain.
- **`frontend.env`**: the **same** `INTERNAL_API_SECRET` as in `api.env`.

Keep a copy of `MFA_ENCRYPTION_KEY` and the JWT secrets in a password manager.
Losing `MFA_ENCRYPTION_KEY` means every user must set up two-step verification
again.

## 7. Connect GitHub to the server

1. **(your PC)** Create a key pair used only by GitHub Actions:

   ```bash
   ssh-keygen -t ed25519 -f stamply-deploy -N "" -C "github-actions"
   ```

2. Allow it on the server:

   ```bash
   cat stamply-deploy.pub | ssh deploy@SERVER_IP "cat >> ~/.ssh/authorized_keys"
   ```

3. Get the server's host key: `ssh-keyscan -t ed25519 SERVER_IP`.
4. On GitHub: **repository → Settings → Secrets and variables → Actions → New
   repository secret**. Add:

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | SERVER_IP |
   | `DEPLOY_SSH_KEY` | the whole contents of the `stamply-deploy` file (private key) |
   | `DEPLOY_KNOWN_HOSTS` | the line printed by `ssh-keyscan` in step 3 |

   Optional: under the **Variables** tab, add `NEXT_PUBLIC_SENTRY_DSN`.

5. Delete the local `stamply-deploy` private key once it is saved in GitHub.

## 8. First deploy

Push or merge to `main`, or run it by hand: **Actions → Deploy → Run
workflow**. The first run takes about 10 minutes. Later runs are faster
because of the build cache.

The workflow builds the `api`, `web`, `admin` and `portal` images, pushes
them to `ghcr.io`, copies `deploy/docker-compose.yml` and `deploy/Caddyfile`
to `~/stamply`, then pulls and starts everything.

Watch it start **(server)**:

```bash
cd ~/stamply
docker compose ps            # every service "running"; api "healthy"
docker compose logs -f api   # Ctrl+C to stop following
```

Caddy gets the HTTPS certificates on the first request to each host. This
takes a few seconds.

## 9. Create the first platform admin

**(server)**. `read -s` keeps the password out of the shell history:

```bash
cd ~/stamply
read -p "Admin email: " ADMIN_EMAIL; read -s -p "Admin password: " ADMIN_PASSWORD; echo
docker compose run --rm \
  -e SEED_ADMIN_EMAIL="$ADMIN_EMAIL" -e SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node dist/scripts/seedAdmin.js
unset ADMIN_PASSWORD
```

## 10. Check it works

1. `https://api.stamply.taptapsell.pk/health` returns OK.
2. Sign in at `https://admin.stamply.taptapsell.pk` and set up two-step
   verification. It is required for platform users.
3. Invite a test business with your own email address. Within a few seconds
   the worker should log the send **(server)**:

   ```bash
   docker compose logs -f worker
   ```

4. Open the invitation email and finish sign-up at
   `https://business.stamply.taptapsell.pk`.
5. Open `https://stamply.taptapsell.pk`.

---

## Day-to-day

**(server)**, in `~/stamply`:

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs (one service) | `docker compose logs -f --tail=200 api` (or `worker`, `web`, `admin`, `portal`, `caddy`) |
| Restart a service | `docker compose restart api` |
| Apply an edited `api.env` / `frontend.env` | `docker compose up -d` (recreates the containers that changed) |
| Roll back to an earlier commit | `TAG=<commit-sha> docker compose up -d` (needs `docker login ghcr.io` first, see below) |
| Disk usage | `df -h` and `docker system df` |

Pulling by hand (for example to roll back) needs a GitHub login once: create a
**classic personal access token** with only `read:packages`, then run
`docker login ghcr.io -u <github-user>` and paste the token as the password.

## Backups

- **Database**: Atlas M0 is **not backed up**. Before real customers rely on
  the platform, upgrade the cluster to M10, which has daily snapshots and
  point-in-time restore.
- **Uploaded receipts and exports** live in the `stamply_storage` Docker volume
  on the server. Hetzner Backups (step 2) covers them. They are lost if the
  server is deleted without a backup.
- **Secrets**: keep the three env files in a password manager.

## Troubleshooting

| Symptom | Look at | Usual cause |
|---|---|---|
| `api` or `worker` keeps restarting | `docker compose logs api` | `Invalid environment configuration` lists the missing or wrong setting in `api.env` |
| `MongoServerSelectionError` / timeout | `docker compose logs api` | Server IP not in Atlas **Network Access**, or a wrong password in `MONGODB_URI` |
| Browser shows a certificate error | `docker compose logs caddy` | DNS not pointing at the server yet, Cloudflare proxy on (orange cloud), or port 80/443 missing from the Hetzner firewall |
| "We emailed the owner" but nothing arrives | `docker compose logs worker` | `Outbox send failed`: wrong `SMTP_URL` (is the `@` written as `%40`?) or the sender domain not verified in Brevo. The worker retries 6 times with growing gaps. |
| Sign-ins rate-limited for everyone | `frontend.env` | `INTERNAL_API_SECRET` differs from `api.env` |
| Deploy job fails at SSH | GitHub Actions log | `DEPLOY_KNOWN_HOSTS` or `DEPLOY_SSH_KEY` wrong, or the key is not in `~deploy/.ssh/authorized_keys` |
