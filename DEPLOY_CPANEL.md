# Deploying Elevate U to cPanel

This app is **Next.js 15 (App Router) + Prisma + Server Actions**. It needs a live
Node.js process — it is **not** a static site, so it must run through cPanel's
**Setup Node.js App** feature (Phusion Passenger), not plain HTML hosting.

---

## 0. Prerequisites on the cPanel server
- cPanel with **Setup Node.js App** available (Node 18+; this app is tested on Node 20/22).
- SSH/Terminal access (strongly recommended — the build step needs it).
- The MySQL/MariaDB `ndhr` database reachable from the server.

---

## 1. Database connection string

The server settings you gave:

```
DB_HOST=167.86.105.17   DB_PORT=3306   DB_USER=root   DB_PASSWORD=<DB_PASSWORD>   DB=ndhr
```

Prisma uses a **single `DATABASE_URL`**, not separate fields. Pick one:

**A. If the app runs on the SAME server as MySQL (most likely — recommended):**
connect over the local socket, no TLS needed, and don't expose root to the internet.
```
DATABASE_URL="mysql://root:<DB_PASSWORD>@localhost:3306/ndhr?connection_limit=5&pool_timeout=30&connect_timeout=30"
```

**B. If the app runs on a different host** (connecting to 167.86.105.17 over the public
internet). That server presents a self-signed TLS cert, so Prisma must be told to accept it:
```
DATABASE_URL="mysql://root:<DB_PASSWORD>@167.86.105.17:3306/ndhr?connection_limit=5&pool_timeout=30&connect_timeout=30&sslaccept=accept_invalid_certs"
```

> Security: connecting as `root` over a public IP is risky. Prefer option A, or create a
> dedicated MySQL user limited to the `ndhr` database. Change `AUTH_SECRET` for production.

---

## 2. Upload the app

Upload the whole project to a folder **outside** `public_html`, e.g. `/home/<user>/elevateu`.
Do **not** upload `node_modules`, `.next`, or `.env` (they're built/created on the server).

You can zip locally (excluding those), upload via File Manager, and extract — or `git clone`
on the server.

---

## 3. Create the Node.js app in cPanel

cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
| --- | --- |
| Node.js version | 20.x or 22.x |
| Application mode | **Production** |
| Application root | `elevateu` (the folder from step 2) |
| Application URL | your domain / subdomain |
| Application startup file | `server.js`  ← (already in the repo, written for Passenger) |

Click **Create**.

---

## 4. Environment variables

In the same screen, add these (or put them in a `.env` file in the app root — both work):

```
DATABASE_URL = (the string from step 1)
AUTH_SECRET  = (a long random value — generate with: openssl rand -hex 32)
APP_NAME     = Elevate U
APP_URL      = https://your-domain
NODE_ENV     = production
```

---

## 5. Install, migrate, build (via Terminal)

cPanel shows an "Enter to the virtual environment" command at the top of the Node.js app
page — run it first so `npm`/`node` use the right version, then:

```bash
cd ~/elevateu
npm install                 # installs deps + runs prisma generate
npx prisma db push          # create the 22 tables in the ndhr database
npm run db:seed             # OPTIONAL: load demo users/data (WIPES existing data!)
npm run build               # produces the production .next build
```

> Skip `db:seed` if the `ndhr` database already has real data — it resets the tables.

If the shared host kills `npm run build` for memory, run the build **locally** and upload
the resulting `.next` folder.

---

## 6. Start

Back on the **Setup Node.js App** page, click **Restart**. Passenger runs `server.js`,
which boots Next.js on the port it assigns. Visit your Application URL.

Demo login (if you seeded): any account from the README, password `Elevate@123`.

---

## Troubleshooting
- **502 / "Application failed to start"** → check the app's `stderr.log` (path shown in the
  Node.js app panel). Usually a bad `DATABASE_URL` or missing `npm run build`.
- **Prisma "Can't reach database server"** → wrong host/port, firewall, or (option B)
  missing `sslaccept=accept_invalid_certs`.
- **Styles missing** → the `.next` build wasn't generated or wasn't uploaded; re-run `npm run build`.
- **Changes not showing** → click **Restart** in the Node.js app panel after each new build.
