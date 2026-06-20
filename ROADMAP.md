# GP-CARS — Roadmap vers la commercialisation
**Branche :** `claude/ai-agent-status-QzWo1`  
**Date :** 2026-06-20  
**Score actuel :** 7.5 / 10  
**Objectif :** 9.5 / 10 — produit commercialisable, sans défaut

---

## Ce qui est déjà fait (ne pas retoucher)

| Fait | Détail |
|---|---|
| 7 agents IA opérationnels | Carmelo, MADORE, Marketing, Controller, Scanner, Atelier, Garantie |
| Email scoping sur toutes les tables | MadoreLead, SystemEvent, DemandSignal — corrigé |
| Clé API hors des cookies | Sécurité critique corrigée |
| Auth cron (Bearer header) | Plus de secret dans les URLs |
| Gate de confirmation emails juridiques | Refus/transaction requièrent validation humaine |
| Headers sécurité HTTP | X-Frame-Options, CSP, Referrer-Policy |
| Validation VIN + km | Format ISO 3779 + bornes 0–999 999 |
| Recovery dossier en_analyse | Auto-reset après 5 minutes |
| RGPD notice emails clients | Notice légale dans tous les rappels RDV |

---

## BLOC 1 — Infrastructure critique
> **Objectif : stabilité en production**  
> Durée estimée : **5–7 jours**  
> À faire EN PREMIER — ces problèmes peuvent faire tomber le service

---

### 1.1 — Rate limiter distribué `CRITIQUE`
**Problème :** Le rate limiter actuel (`lib/rate-limit.ts`) est en mémoire. Sur Vercel serverless, chaque instance a sa propre mémoire. Un utilisateur malveillant peut envoyer 100 requêtes en parallèle sur 100 instances et toutes passent. Cela peut vider le quota Anthropic en quelques minutes.

**Solution :** Remplacer par Upstash Redis.

**Étapes :**
1. Créer un compte Upstash (gratuit jusqu'à 10 000 req/jour) sur https://upstash.com
2. Installer : `npm install @upstash/ratelimit @upstash/redis`
3. Ajouter les variables d'environnement Vercel :
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
4. Réécrire `lib/rate-limit.ts` :
   ```typescript
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';
   
   const redis = Redis.fromEnv();
   
   export const rateLimiters = {
     analyze:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
     scanner:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1,  '5 m') }),
     madore:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m') }),
     vehicle:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') }),
     garantie: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '1 m') }),
   };
   ```
5. Remplacer tous les appels `checkRateLimit(...)` dans les routes par le nouveau système.

**Fichiers concernés :**
- `lib/rate-limit.ts` — réécriture complète
- `app/api/carmelo/analyze/route.ts`
- `app/api/scanner/run/route.ts`
- `app/api/madore/chat/route.ts`
- `app/api/agents/vehicle/route.ts`

---

### 1.2 — Pooling de connexions PostgreSQL `CRITIQUE`
**Problème :** Le driver `postgres` (npm) ouvre une connexion TCP persistante par instance Vercel. Avec du trafic simultané, on dépasse les 90 connexions Neon (limite Free tier) et le service tombe avec `too many connections`.

**Solution :** Passer au driver HTTP Neon (sans connexion persistante).

**Étapes :**
1. Installer : `npm install @neondatabase/serverless`
2. Dans `app/db.ts`, remplacer :
   ```typescript
   import postgres from 'postgres';
   // ...
   function getClient() {
     if (!_client) _client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
     return _client;
   }
   ```
   Par :
   ```typescript
   import { neon } from '@neondatabase/serverless';
   import { drizzle } from 'drizzle-orm/neon-http';
   
   function getClient() {
     if (!_client) _client = neon(process.env.POSTGRES_URL!);
     return _client;
   }
   function getDb() {
     if (!_db) _db = drizzle(getClient());
     return _db;
   }
   ```
3. Les requêtes SQL brutes (template literals) devront être adaptées à la syntaxe Neon.

**Fichiers concernés :**
- `app/db.ts` — changement d'import + adaptation des raw SQL queries
- `app/api/cron/rdv-reminders/route.ts` — utilise `import postgres` directement, à migrer aussi

---

### 1.3 — Migrations BDD avec Drizzle Kit `CRITIQUE`
**Problème :** `ensureSchema()` exécute 15+ requêtes DDL à chaque cold start (2–5 secondes de latence). Sur une base existante, les `ALTER TABLE ADD COLUMN IF NOT EXISTS` tournent inutilement à chaque requête.

**Solution :** Remplacer `ensureSchema()` par des fichiers de migration versionnés.

**Étapes :**
1. Installer : `npm install -D drizzle-kit`
2. Créer `drizzle.config.ts` :
   ```typescript
   import type { Config } from 'drizzle-kit';
   export default {
     schema: './app/db.ts',
     out: './drizzle',
     driver: 'pg',
     dbCredentials: { connectionString: process.env.POSTGRES_URL! },
   } satisfies Config;
   ```
3. Générer les migrations : `npx drizzle-kit generate:pg`
4. Appliquer : `npx drizzle-kit push:pg` (une seule fois au déploiement)
5. Dans `app/db.ts`, supprimer la fonction `ensureSchema()` entière (700+ lignes de DDL) et remplacer tous les `await ensureSchema()` par rien.
6. Ajouter dans le script de déploiement Vercel : `npx drizzle-kit push:pg && next build`

**Note importante :** C'est le chantier le plus long mais le plus structurant. Faire en dernier dans ce bloc après avoir stabilisé le driver.

---

### 1.4 — Transactions de base de données `IMPORTANT`
**Problème :** L'analyse Garantie fait 4 opérations DB séquentielles sans transaction. Si le process crash entre deux, les données sont incohérentes.

**Solution :** Envelopper les opérations multi-étapes dans des transactions.

**Fichier :** `app/api/garantie/analyze/route.ts`

```typescript
// Remplacer les 4 appels séquentiels par :
await getDb().transaction(async (tx) => {
  await saveGarantiePiecesInTx(tx, dossierId, email, pieces);
  await updateGarantieDossierInTx(tx, dossierId, email, updates);
});
```

Créer les versions `InTx` des fonctions dans `app/db.ts` qui acceptent un paramètre `tx` (transaction Drizzle).

---

### 1.5 — Worker de traitement des événements `IMPORTANT`
**Problème :** Les événements sont publiés dans `SystemEvent` mais aucun agent ne les consomme automatiquement. `atelier.frais_reels` est émis → le Contrôleur devrait recalculer la marge → il ne le fait pas.

**Solution :** Créer un cron de traitement.

**Nouveau fichier :** `app/api/cron/process-events/route.ts`
```typescript
// GET — tourne toutes les 5 minutes via Vercel Cron
export async function GET(req: NextRequest) {
  // Auth Bearer
  const events = await getPendingEvents(undefined, 50);
  for (const event of events) {
    await routeEvent(event);
    await markEventProcessed(event.id);
  }
}

async function routeEvent(event: SystemEventRecord) {
  switch (event.type) {
    case 'atelier.frais_reels':
      // Recalculer marge Controller
      break;
    case 'garantie.litige_detecte':
      // Envoyer alerte email garage
      break;
    case 'stock.immobilise':
      // Déjà géré par stock-review cron
      break;
  }
}
```

**Ajouter dans `vercel.json` :**
```json
{ "path": "/api/cron/process-events", "schedule": "*/5 * * * *" }
```

---

## BLOC 2 — Sécurité & RGPD
> **Objectif : conformité légale et protection des données**  
> Durée estimée : **4–5 jours**  
> Obligatoire avant tout client payant

---

### 2.1 — Droit à l'effacement RGPD (Article 17) `CRITIQUE`
**Problème :** Des données personnelles clients (nom, email, téléphone) sont stockées dans `GarantieDossier`, `RdvAtelier`, `MadoreLead`. Il n'existe aucune façon de les supprimer ou d'anonymiser sur demande.

**Solution :** Route d'anonymisation + interface dans les paramètres.

**Nouveau fichier :** `app/api/rgpd/erase/route.ts`
```typescript
// POST { customerEmail: string } — anonymise toutes les tables
export async function POST(req: NextRequest) {
  const session = await auth();
  // ... vérifier auth ...
  const { customerEmail } = await req.json();
  await anonymizeCustomerData(session.user.email, customerEmail);
  return NextResponse.json({ ok: true });
}
```

**Fonction dans `app/db.ts` :**
```typescript
export async function anonymizeCustomerData(garageEmail: string, customerEmail: string) {
  const anon = `[supprimé-${Date.now()}]`;
  // Anonymiser dans GarantieDossier
  await getDb().update(garantieDossier)
    .set({ customerName: anon, customerPhone: null, customerEmail: null })
    .where(and(eq(garantieDossier.email, garageEmail), eq(garantieDossier.customerEmail, customerEmail)));
  // Anonymiser dans RdvAtelier
  await getDb().update(rdvAtelier)
    .set({ customerName: anon, customerPhone: null, customerEmail: null })
    .where(and(eq(rdvAtelier.email, garageEmail), eq(rdvAtelier.customerEmail, customerEmail)));
  // Anonymiser dans MadoreLead
  await getDb().update(madoreLead)
    .set({ prospectName: anon, prospectPhone: null, prospectEmail: null })
    .where(and(eq(madoreLead.email, garageEmail), eq(madoreLead.prospectEmail, customerEmail)));
}
```

---

### 2.2 — Audit log des actions Garantie `IMPORTANT`
**Problème :** Quand un email de refus est envoyé, qui l'a envoyé ? Quel texte exact ? À quelle heure ? Cette traçabilité est nécessaire en cas de litige judiciaire.

**Solution :** Table `GarantieAuditLog`.

**Dans `app/db.ts` :**
```typescript
const garantieAuditLog = pgTable('GarantieAuditLog', {
  id:         serial('id').primaryKey(),
  dossierId:  integer('dossier_id').notNull(),
  email:      varchar('email', { length: 64 }).notNull(),
  action:     varchar('action', { length: 64 }).notNull(), // 'email_sent', 'status_changed', 'analyzed', 'refus_sent'
  details:    json('details').$type<Record<string, unknown>>(),
  actorEmail: varchar('actor_email', { length: 64 }),
  createdAt:  timestamp('created_at').defaultNow(),
});
```

Appeler `logGarantieAction(dossierId, email, 'refus_sent', { to: customerEmail, preview: text.slice(0, 200) })` dans `/api/garantie/send-email/route.ts`.

---

### 2.3 — Versioning des analyses IA Garantie `IMPORTANT`
**Problème :** Quand l'IA ré-analyse un dossier, elle écrase l'ancienne décision. En cas de procédure judiciaire, il est impossible de retrouver ce que l'IA avait dit initialement.

**Solution :** Table `GarantieAnalysisHistory`.

```typescript
const garantieAnalysisHistory = pgTable('GarantieAnalysisHistory', {
  id:            serial('id').primaryKey(),
  dossierId:     integer('dossier_id').notNull(),
  email:         varchar('email', { length: 64 }).notNull(),
  promptVersion: varchar('prompt_version', { length: 16 }).notNull(), // ex: '1.0'
  model:         varchar('model', { length: 32 }),
  rawResponse:   text('raw_response'),
  parsedResult:  json('parsed_result').$type<Record<string, unknown>>(),
  createdAt:     timestamp('created_at').defaultNow(),
});
```

Dans `/api/garantie/analyze/route.ts`, avant d'écraser les résultats, insérer dans cette table.

---

### 2.4 — Validation de l'environnement au démarrage `IMPORTANT`
**Problème :** Si une variable comme `ANTHROPIC_API_KEY` est manquante, le système échoue silencieusement à la première utilisation avec une erreur cryptique.

**Nouveau fichier :** `lib/env.ts`
```typescript
const REQUIRED_VARS = [
  'POSTGRES_URL',
  'ANTHROPIC_API_KEY',
  'AUTH_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'NOTIFY_EMAIL',
  'CRON_SECRET',
  'NEXT_PUBLIC_BASE_URL',
] as const;

export function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
}
```

Appeler `validateEnv()` dans `app/db.ts` au-dessus de `getClient()`.

---

### 2.5 — Politique de rétention des données `IMPORTANT`
**Problème :** Il n'existe aucune durée de conservation définie pour les données personnelles (violation RGPD Article 5(1)(e)).

**Solution :**
- Ajouter une colonne `retain_until DATE` dans `GarantieDossier`, `RdvAtelier`, `MadoreLead`
- Créer un cron mensuel qui anonymise les enregistrements dont `retain_until < NOW()`
- Durées recommandées : leads 12 mois, RDV 24 mois, dossiers garantie 5 ans (obligation légale belge)

---

## BLOC 3 — Commercialisation multi-garages
> **Objectif : vendre à d'autres garages**  
> Durée estimée : **15–20 jours**  
> Ce bloc transforme le produit mono-garage en SaaS

---

### 3.1 — Architecture multi-tenant `CRITIQUE`
**Problème :** Toute la sécurité des données repose sur `email VARCHAR(64)`. Si deux utilisateurs ont le même email (improbable mais possible) ou si on veut plusieurs employés par garage, l'architecture casse.

**Solution :** Introduire une table `Organization`.

```typescript
const organization = pgTable('Organization', {
  id:        serial('id').primaryKey(),
  slug:      varchar('slug', { length: 64 }).unique().notNull(), // 'gp-cars-liege'
  name:      varchar('name', { length: 128 }).notNull(),
  email:     varchar('email', { length: 64 }).notNull(), // email de contact garage
  plan:      varchar('plan', { length: 16 }).default('starter'), // 'starter', 'pro', 'enterprise'
  createdAt: timestamp('created_at').defaultNow(),
});

const organizationMember = pgTable('OrganizationMember', {
  id:             serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull(),
  userId:         integer('user_id').notNull(),
  role:           varchar('role', { length: 16 }).default('member'), // 'owner', 'admin', 'member'
  createdAt:      timestamp('created_at').defaultNow(),
});
```

Remplacer `email VARCHAR(64)` dans toutes les tables par `organization_id INTEGER`. C'est un chantier lourd mais indispensable — prévoir 5 jours minimum.

---

### 3.2 — Interface de signup et onboarding `CRITIQUE`
**Problème :** Actuellement, créer un compte nécessite une intervention manuelle en base de données. Impossible de vendre à un garage sans l'aider à s'inscrire.

**Pages à créer :**
- `/register` — formulaire nom garage, email, mot de passe, pays, TVA
- `/onboarding` — wizard en 4 étapes : profil → stock import → premier véhicule → premier scan
- `/settings` — gestion du compte, NOTIFY_EMAIL, clé API personnelle (optionnelle)
- `/billing` — abonnement Stripe (voir 3.3)

---

### 3.3 — Facturation Stripe `CRITIQUE`
**Problème :** Sans facturation, pas de revenus. Le système n'a aucun concept d'abonnement.

**Solution :**

1. Créer un compte Stripe et activer Stripe Billing
2. Installer : `npm install stripe @stripe/stripe-js`
3. Variables d'environnement :
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
4. Plans recommandés :
   - **Starter** — 49€/mois — 1 utilisateur, 50 analyses IA/mois
   - **Pro** — 129€/mois — 3 utilisateurs, 200 analyses IA/mois, MADORE widget
   - **Enterprise** — sur devis — utilisateurs illimités, analyses illimitées, support prioritaire

5. Créer un webhook Stripe qui met à jour `organization.plan` à chaque paiement/annulation.

---

### 3.4 — Quota IA par organisation `IMPORTANT`
**Problème :** Actuellement une seule clé Anthropic est partagée par tous les garages. Un garage peut consommer tout le quota.

**Solution :**
- Ajouter une table `AIUsage(organizationId, month, analyzeCount, madoreCount, garantieCount)`
- Vérifier le quota avant chaque appel IA
- Renvoyer une erreur 402 (Payment Required) si le quota est dépassé
- Afficher la consommation dans `/settings/billing`

---

### 3.5 — API publique pour intégration DMS `CONFORT`
**Problème :** Les garages utilisent des logiciels métier (DMS — Dealer Management System). Ils voudront synchroniser les véhicules automatiquement.

**Solution :**
- Créer `/api/v1/vehicles`, `/api/v1/leads`, `/api/v1/garanties` avec authentification par API Key
- Générer des clés API dans `/settings/developers`
- Documenter avec OpenAPI/Swagger

---

## BLOC 4 — Qualité produit
> **Objectif : zéro bug en production**  
> Durée estimée : **5–7 jours**

---

### 4.1 — Monitoring d'erreurs Sentry `CRITIQUE`
**Problème :** Actuellement, si l'agent Garantie plante en production, personne n'est alerté. Le log Vercel existe mais n'est pas supervisé.

**Étapes :**
1. Créer un compte Sentry (gratuit jusqu'à 5 000 erreurs/mois)
2. Installer : `npm install @sentry/nextjs`
3. Initialiser : `npx @sentry/wizard@latest -i nextjs`
4. Variable : `SENTRY_DSN=https://...@sentry.io/...`
5. Configurer les alertes par email pour les erreurs critiques (500, timeouts Anthropic, échecs cron)

---

### 4.2 — Tests automatisés `IMPORTANT`
**Problème :** Vitest est installé mais aucun test n'existe. Toute modification est un saut dans le vide.

**Tests prioritaires à écrire :**

```
tests/
├── agents/
│   ├── carmelo/decision.test.ts     — teste extractDecision()
│   ├── controller/validate.test.ts  — teste runHardRules()
│   └── garantie/system-prompt.test.ts
├── db/
│   ├── vehicle.test.ts              — CRUD véhicule
│   └── garantie.test.ts             — CRUD dossier
├── api/
│   ├── carmelo-analyze.test.ts      — mock Anthropic, teste la route
│   └── garantie-analyze.test.ts
└── validation.test.ts               — teste validateVin(), validateKm()
```

**Commande pour lancer :** `npm run test`

---

### 4.3 — Contraintes FOREIGN KEY en base de données `IMPORTANT`
**Problème :** Il n'y a aucune contrainte de clé étrangère. Une pièce peut référencer une intervention qui n'existe pas. Un dossier garantie peut référencer un véhicule supprimé.

**À ajouter dans les migrations Drizzle :**
```sql
ALTER TABLE "AtelierIntervention" 
  ADD CONSTRAINT fk_atelier_vehicle 
  FOREIGN KEY (vehicle_id) REFERENCES "Vehicle"(id) ON DELETE CASCADE;

ALTER TABLE "PieceCommande" 
  ADD CONSTRAINT fk_piece_intervention 
  FOREIGN KEY (intervention_id) REFERENCES "AtelierIntervention"(id) ON DELETE CASCADE;

ALTER TABLE "GarantieDossier" 
  ADD CONSTRAINT fk_garantie_vehicle 
  FOREIGN KEY (vehicle_id) REFERENCES "Vehicle"(id) ON DELETE SET NULL;
```

---

### 4.4 — Vérification VIN externe (Carpass / CarVertical) `IMPORTANT`
**Problème :** Le VIN est validé en format uniquement. L'historique réel du véhicule (kilométrage, accidents, entretiens) n'est pas vérifié. Un vendeur peut mentir.

**Solution :**
- Intégrer l'API Carpass (https://www.carpass.be/fr/api) — officielle belge, ~1€/rapport
- Ou CarVertical (API européenne) — ~2€/rapport
- Déclencher la vérification quand Carmelo donne une décision VERT
- Stocker le rapport dans `Vehicle.carpassReport`
- Afficher un badge "✓ Vérifié Carpass" dans la fiche véhicule

---

### 4.5 — Limite dynamique getVehicles `CONFORT`
**Problème :** `getVehicles(email, limit=100)` est codé en dur à 100. Un gros garage avec 150 véhicules en stock ne voit pas tout.

**Fix rapide :**
```typescript
export async function getVehicles(email: string, limit = 500): Promise<VehicleRecord[]>
```
Et ajouter une pagination côté UI avec un paramètre `?page=1&limit=50`.

---

## BLOC 5 — Fonctionnalités produit manquantes
> **Objectif : produit complet**  
> Durée estimée : **10–15 jours**

---

### 5.1 — Upload de documents pour Garantie `IMPORTANT`
**Problème :** `GarantieDocument` a un champ `fileUrl` mais aucune interface d'upload n'existe. Les photos, devis et factures ne peuvent pas être attachés.

**Solution :** Vercel Blob Storage.

**Étapes :**
1. Activer Vercel Blob dans le dashboard Vercel
2. Installer : `npm install @vercel/blob`
3. Variable auto-générée : `BLOB_READ_WRITE_TOKEN`
4. Nouvelle route : `app/api/garantie/upload/route.ts`
5. Ajouter un bouton "📎 Ajouter document" dans `GarantieClient.tsx`

---

### 5.2 — WhatsApp Business API `CONFORT`
**Problème :** Les communications WhatsApp sont générées mais doivent être copiées-collées manuellement. L'envoi automatique n'est pas possible sans l'API Meta.

**Étapes :**
1. Créer un compte Meta Business Manager
2. Demander l'accès WhatsApp Business API (délai : 1–3 semaines de validation Meta)
3. Installer le SDK : `npm install whatsapp-business-api-sdk`
4. Variable : `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
5. Créer `/api/garantie/send-whatsapp/route.ts`

---

### 5.3 — Application mobile (PWA) `CONFORT`
**Problème :** Le site est accessible sur mobile mais n'est pas installable. Il n'y a pas de notifications push.

**Solution minimum (PWA) :**
1. Créer `public/manifest.json` avec icônes GP-CARS
2. Ajouter un Service Worker pour le mode offline basique
3. Configurer dans `next.config.js` : `pwa: { dest: 'public' }`
4. Installer : `npm install next-pwa`

---

### 5.4 — Réinitialisation de mot de passe `IMPORTANT`
**Problème :** Il n'existe aucun flux "mot de passe oublié". Si le propriétaire du garage oublie son mot de passe, il ne peut pas se reconnecter sans intervention manuelle en base.

**Pages à créer :**
- `/forgot-password` — formulaire email
- `/reset-password?token=xxx` — formulaire nouveau mot de passe

**Flux :**
1. Générer un token sécurisé, stocker dans une table `PasswordReset(email, token, expiresAt)`
2. Envoyer un email avec le lien via Resend
3. Vérifier le token à la soumission, mettre à jour le mot de passe hashé

---

### 5.5 — Contrôleur amélioré `IMPORTANT`
**Problème :** Le Contrôleur ne s'exécute qu'une fois (à la création du véhicule). Il ne recalcule pas quand les frais atelier réels arrivent.

**Nouvelles règles à implémenter dans `lib/agents/controller/validate.ts` :**
```typescript
{ code: 'STOCK_45J',           severity: 'avertissement', message: 'En stock depuis 45+ jours — baisser le prix' },
{ code: 'STOCK_75J',           severity: 'bloquant',      message: 'En stock depuis 75+ jours — action urgente' },
{ code: 'MARGE_NEGATIVE',      severity: 'bloquant',      message: 'Marge nette négative après frais atelier réels' },
{ code: 'ACHAT_HORS_MAX',      severity: 'bloquant',      message: 'Prix achat > max recommandé par Carmelo' },
{ code: 'FRAIS_ATELIER_20PCT', severity: 'avertissement', message: 'Frais atelier > 20% du prix d'achat' },
```

**Dans le cron `process-events`** (voir 1.5) : quand l'événement `atelier.frais_reels` arrive, déclencher une ré-évaluation Controller pour ce véhicule.

---

### 5.6 — Versionning du prompt juridique Garantie `CONFORT`
**Problème :** Le prompt contient "mai 2024". Si la loi belge change, le système reste incorrect.

**Solution :**
- Ajouter une constante `GARANTIE_PROMPT_VERSION = '1.0-2024-05'` dans le système prompt
- Stocker cette version dans `GarantieAnalysisHistory.promptVersion`
- Afficher dans l'UI : "Analyse basée sur la loi belge — version prompt 1.0 (mai 2024)"
- Prévoir une revue semestrielle avec un juriste belge

---

## Ordre d'exécution recommandé

```
SEMAINE 1 :
  1.1 Upstash Redis (rate limiter)         ← Sécurité immédiate
  1.2 Neon serverless driver               ← Stabilité
  2.4 Validation environnement au démarrage
  4.1 Sentry                               ← Voir les erreurs en prod

SEMAINE 2 :
  1.3 Drizzle Kit migrations               ← Fin de ensureSchema()
  1.4 Transactions DB
  2.1 RGPD droit à l'effacement
  2.2 Audit log Garantie
  2.3 Versioning analyses IA

SEMAINE 3 :
  3.1 Architecture multi-tenant (Organisation)
  3.2 Signup + onboarding
  4.3 Foreign Keys

SEMAINE 4 :
  3.3 Stripe billing
  3.4 Quota IA par organisation
  4.2 Tests automatisés
  4.4 Carpass VIN externe

SEMAINE 5+ :
  5.1 Upload documents (Vercel Blob)
  5.4 Reset mot de passe
  5.5 Contrôleur amélioré
  3.5 API publique
  5.2 WhatsApp Business API
  5.3 PWA mobile
```

---

## Variables d'environnement à ajouter (nouvelles)

| Variable | Service | Obligatoire pour |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash | Rate limiting réel |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Rate limiting réel |
| `SENTRY_DSN` | Sentry | Monitoring erreurs |
| `STRIPE_SECRET_KEY` | Stripe | Facturation |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Facturation |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Facturation |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Upload documents |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta | WhatsApp auto |
| `WHATSAPP_ACCESS_TOKEN` | Meta | WhatsApp auto |
| `CARPASS_API_KEY` | Carpass BE | Vérif VIN |

---

## Estimation globale

| Bloc | Durée | Priorité |
|---|---|---|
| Bloc 1 — Infrastructure | 5–7 jours | Semaine 1–2 |
| Bloc 2 — Sécurité & RGPD | 4–5 jours | Semaine 2 |
| Bloc 3 — Multi-tenant & SaaS | 15–20 jours | Semaine 3–5 |
| Bloc 4 — Qualité | 5–7 jours | En parallèle |
| Bloc 5 — Fonctionnalités | 10–15 jours | Après Bloc 3 |
| **TOTAL** | **~45–55 jours** | **~8–10 semaines** |

---

*Document généré le 2026-06-20. Branche : `claude/ai-agent-status-QzWo1`. Pour toute question sur l'architecture existante, voir `HANDOVER.md`.*
