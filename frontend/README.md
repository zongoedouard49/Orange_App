# Admin Renseignements — Next.js App

Application convertie de TanStack Router → **Next.js 15** (App Router).

## Structure

```
app/
├── layout.tsx              # Root layout (métadonnées globales, CSS)
├── globals.css             # Design system Tailwind v4 + tokens CSS
├── page.tsx                # Connexion utilisateur  →  /
├── admin/
│   └── page.tsx            # Panneau administrateur →  /admin
├── renseignements/
│   └── page.tsx            # Formulaire renseignements → /renseignements
└── api/
    └── rapport/
        └── export/
            └── route.ts    # GET /api/rapport/export?service=...&statut=...

components/
├── LoginPage.tsx           # Page de connexion (client)
├── AdminPanel.tsx          # Dashboard admin : Paramètres + Rapport (client)
├── RenseignementsPage.tsx  # Formulaire tâches PC-first (client)
└── ui/                     # Composants shadcn/ui (46 composants)

lib/
└── utils.ts               # cn() helper
hooks/
└── use-mobile.tsx         # Hook useIsMobile
```

## Démarrage

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Export Excel réel (optionnel)

Dans `app/api/rapport/export/route.ts`, dé-commentez le bloc SheetJS et installez :

```bash
npm install xlsx
```

## Changements vs TanStack Router

| Avant | Après |
|---|---|
| `createFileRoute("/admin")` | `export default function Page()` dans `app/admin/page.tsx` |
| `Link` from `@tanstack/react-router` | `Link` from `next/link` |
| `useNavigate()` | `useRouter()` from `next/navigation` |
| `vite dev` | `next dev` |
| `src/routes/*.tsx` | `app/**/page.tsx` + `components/*.tsx` |
| Pas d'API intégrée | `app/api/**/route.ts` (Route Handlers) |
