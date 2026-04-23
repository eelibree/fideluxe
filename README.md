# Fideluxe

Gestore di tessere fedeltà — PWA mobile-first, italiana, con tema greige + oro antico.

## Stack
- HTML / CSS / JavaScript vanilla (no framework)
- Cloudflare Pages per l'hosting statico
- Cloudflare Pages Functions per l'API
- Cloudflare Workers KV per lo storage

---

## Struttura

```
fideluxe/
├── public/                    # asset statici (serviti da Pages)
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── barcode.js
│   │   ├── scanner.js
│   │   └── admin.js
│   └── icons/                 # icone PWA (192, 512)
├── functions/                 # Pages Functions (API)
│   ├── _middleware.js
│   └── api/
│       ├── auth/login.js
│       ├── cards/index.js
│       ├── cards/[id].js
│       ├── categories/index.js
│       ├── categories/[id].js
│       └── admin/backup.js
├── wrangler.toml
└── README.md
```

---

## Setup su Cloudflare

### 1) Crea il namespace KV

Dal dashboard Cloudflare → Workers & Pages → KV → **Create namespace**
Nome suggerito: `FIDELUXE_KV`
Copia l'ID generato.

### 2) Crea il progetto Pages

Dal dashboard → Workers & Pages → **Create** → Pages → Upload assets (oppure collega Git).
- **Build output directory**: `public`
- Nessun build command (è tutto vanilla)

### 3) Collega il KV al progetto Pages

Nel progetto Pages → **Settings** → **Functions** → **KV namespace bindings**
- Variable name: `FIDELUXE_KV`
- KV namespace: quello creato al punto 1

### 4) Imposta le variabili d'ambiente (Secrets)

Nel progetto Pages → **Settings** → **Environment variables** → **Production**
Aggiungi come **Secret** (encrypted):

| Nome               | Valore                              |
|--------------------|-------------------------------------|
| `APP_PASSWORD`     | password utente normale             |
| `ADMIN_PASSWORD`   | password admin (deve essere diversa)|
| `SESSION_SECRET`   | stringa casuale lunga (>= 32 char)  |

Per generare `SESSION_SECRET`:
```bash
openssl rand -hex 32
```

### 5) Deploy

Se fai upload manuale: trascina il contenuto della cartella (NON la cartella stessa) nella UI di Pages.
Se usi Git: fai push, Pages costruisce in automatico.

### 6) Prima apertura

Apri il dominio `*.pages.dev` → inserisci `APP_PASSWORD`.
Per il pannello admin usa il pulsante "Admin" in alto → `ADMIN_PASSWORD`.

---

## Sviluppo locale (opzionale)

```bash
npm install -g wrangler
wrangler pages dev public --kv FIDELUXE_KV
```

Variabili locali in `.dev.vars` (non committare):
```
APP_PASSWORD=test
ADMIN_PASSWORD=admin
SESSION_SECRET=dev-secret-dev-secret-dev-secret-ok
```

---

## Backup

Pannello admin → **Backup** → Esporta JSON. Per ripristino scegli **Unisci** (merge per id)
o **Sostituisci** (wipe + import).
