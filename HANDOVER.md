# GP-CARS — Handover Technique
**Branche active :** `claude/ai-agent-status-QzWo1`  
**Dernière mise à jour :** 2026-06-20  
**Stack :** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · PostgreSQL (Neon) · Vercel

---

## 1. Vue d'ensemble

GP-CARS est une plateforme d'IA multi-agents pour un garage belge de véhicules d'occasion. Elle centralise l'ensemble du cycle de vie d'un véhicule : de la détection d'opportunité d'achat jusqu'à la gestion des litiges de garantie, en passant par l'atelier mécanique, les leads clients et les publications marketing.

Le système est composé de **7 agents IA** indépendants, tous enregistrés dans un kernel central. Chaque agent :
- possède un **contrat** (`lib/agents/<nom>/contract.ts`) déclarant les événements qu'il émet et consomme
- possède ses propres tables de base de données (principe d'isolation)
- expose un endpoint `/api/<nom>/health` pour la supervision
- communique avec les autres agents via le bus d'événements `SystemEvent`

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js App Router — /app/gp/)                       │
│  Stock · Dashboard · Leads · Atelier · Garantie · Système        │
└────────────────────┬────────────────────────────────────────────┘
                     │ API routes (/app/api/)
┌────────────────────▼────────────────────────────────────────────┐
│  KERNEL (lib/kernel/registry.ts)                                 │
│  Registry des 7 agents · validateRegistry() · getConsumersOf()  │
└──┬──────────┬───────────┬──────────┬───────────┬───────────┬───┘
   │          │           │          │           │           │
CARMELO   MADORE    MARKETING  CONTROLLER  SCANNER  ATELIER  GARANTIE
/api/     /api/     /api/      /api/       /api/    /api/    /api/
carmelo/  madore/   marketing/ agents/     scanner/ atelier/ garantie/
                               controller/
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE  (PostgreSQL Neon — /app/db.ts)                        │
│  15 tables · ensureSchema() auto-init · email-scoped isolation   │
└─────────────────────────────────────────────────────────────────┘
```

### Bus d'événements
Tous les agents communiquent de façon asynchrone via la table `SystemEvent`. Chaque agent déclare dans son contrat les événements qu'il émet (`emits`) et ceux qu'il consomme (`consumes`). La fonction `validateRegistry()` détecte au démarrage :
- les événements émis par plusieurs agents (conflit)
- les événements consommés mais jamais émis (orphelins)

---

## 3. Agents en production

| Agent | Rôle | IA utilisée | Statut |
|---|---|---|---|
| **Carmelo** | Analyse d'achat de véhicules d'occasion | Claude claude-opus-4-8 | ✅ Opérationnel |
| **MADORE** | Gestion des leads clients | Claude claude-opus-4-8 (chat) | ✅ Opérationnel |
| **Marketing** | Génération d'annonces | Claude claude-opus-4-8 | ✅ Opérationnel |
| **Controller** | Validation prix & marge | Claude claude-opus-4-8 | ✅ Opérationnel |
| **Scanner** | Détection d'opportunités marché | ScraperAPI | ✅ Opérationnel |
| **Atelier** | Mécanique, pièces & RDV | Aucune (logique métier) | ✅ **Nouveau** |
| **Garantie** | SAV, litiges & droit belge | Claude claude-opus-4-8 | ✅ **Nouveau** |

---

## 4. Ce qui a été créé dans cette session

### 4.1 Agent Atelier (`lib/agents/atelier/`)

**Contrat** (`lib/agents/atelier/contract.ts`) :
```typescript
emits:    ['atelier.intervention_creee', 'atelier.frais_reels', 'rdv.confirme', 'rdv.rappel']
consumes: []
owns:     ['AtelierIntervention', 'PieceCommande', 'RdvAtelier']
reads:    ['Vehicle', 'MadoreLead', 'SystemEvent']
```

**3 nouvelles tables dans `app/db.ts`** :

| Table | Rôle |
|---|---|
| `AtelierIntervention` | Fiches d'intervention (statuts : planifie → en_cours → termine → facture) |
| `PieceCommande` | Pièces à commander (a_commander → commande → recu → monte) |
| `RdvAtelier` | Rendez-vous clients (diagnostic, intervention, livraison, reprise, essai) |

**4 nouvelles routes API** :

| Route | Méthodes | Description |
|---|---|---|
| `/api/atelier/interventions` | GET, POST | CRUD interventions (create, update_status, update_notes, update_cost) |
| `/api/atelier/pieces` | GET, POST | CRUD pièces par intervention (add, update_status) |
| `/api/atelier/rdvs` | GET, POST | CRUD rendez-vous (create, update_status), fenêtre 14 jours par défaut |
| `/api/atelier/health` | GET | Health check de l'agent |

**Hook d'auto-création** dans `app/api/agents/vehicle/route.ts` :
Quand un véhicule passe en statut `achete`, le système crée automatiquement une intervention de type `preparation_vente` dans l'Atelier et émet l'événement `atelier.intervention_creee`.

**Interface client** (`app/gp/atelier/AtelierClient.tsx`) — composant `'use client'` ~450 lignes :
- Kanban interactif à 4 colonnes (Planifié / En cours / Terminé / Facturé)
- Transition de statut par bouton sur chaque carte
- Gestion des pièces par intervention (ajout, avancement statut)
- Formulaire de création de RDV (type, date/heure, durée, véhicule, client)
- Calendrier des 14 prochains RDVs avec indicateur "✓ Rappel auto" si email client présent
- Tableau des pièces à commander (récapitulatif global)
- Champ coût réel + notes mécanicien

---

### 4.2 Agent Garantie (`lib/agents/garantie/`)

**Contrat** (`lib/agents/garantie/contract.ts`) :
```typescript
emits:    ['garantie.dossier_cree', 'garantie.decision', 'garantie.litige_detecte']
consumes: []
owns:     ['GarantieDossier', 'GarantieDocument', 'GarantiePiece']
reads:    ['Vehicle', 'AtelierIntervention', 'SystemEvent']
externalDeps: [{ name: 'Anthropic Claude Opus', envVar: 'ANTHROPIC_API_KEY' }]
```

**3 nouvelles tables dans `app/db.ts`** :

| Table | Rôle |
|---|---|
| `GarantieDossier` | Dossier principal (véhicule, vente, réclamation, analyse IA) |
| `GarantieDocument` | Pièces jointes (email, photo, devis, facture, expertise…) |
| `GarantiePiece` | Pièces analysées avec vétusté calculée |

**4 nouvelles routes API** :

| Route | Méthodes | Description |
|---|---|---|
| `/api/garantie/dossiers` | GET, POST | CRUD dossiers (create, update, add_document) |
| `/api/garantie/analyze` | POST | Analyse IA par Claude claude-opus-4-8 — droit belge, catégorisation 1-7, communications |
| `/api/garantie/send-email` | POST | Envoi d'un email généré par l'IA via Resend, archivage en document |
| `/api/garantie/health` | GET | Health check (vérifie présence de ANTHROPIC_API_KEY) |

**Système prompt** (`lib/agents/garantie/system-prompt.ts`) :
L'agent est expert en droit belge de la consommation (Code de droit économique, Directive 2019/771/UE). Il produit une analyse structurée JSON incluant :
- **Catégorie 1 à 7** (de "prise en charge totale" à "expertise judiciaire")
- **4 scores de risque** : juridique, financier, réputation, récidive (0-100 chacun)
- **Calcul de vétusté** : `max(taux_km, taux_age) × coût_pièce`
- **4 communications clés-en-main** : email SAV, WhatsApp court, lettre de refus, proposition transactionnelle
- **Package litige** : éléments de preuve, stratégie défense, jurisprudence applicable
- Seuil `litigationProbability > 70` → statut automatique `litige` + événement `garantie.litige_detecte`

**Interface client** (`app/gp/garantie/GarantieClient.tsx`) — composant `'use client'` ~500 lignes :
- Formulaire de création de dossier (véhicule, vente, client, réclamation)
- Filtres : Tous / Actifs / Litiges / Résolus
- Cartes dossiers extensibles avec onglets :
  - **Analyse** : catégorie, scores visuels (barres colorées), texte IA, forces/faiblesses, prochaines étapes
  - **Email** : texte généré + bouton "Envoyer" (envoi direct via Resend)
  - **WhatsApp** : texte court + copie presse-papiers (envoi manuel)
  - **Refus** : lettre de refus motivée + envoi
  - **Transaction** : proposition de règlement amiable + envoi
  - **Litige** : package de preuves complet
  - **Actions** : changement de statut, notes internes

---

### 4.3 Cron RDV Reminders (`app/api/cron/rdv-reminders/route.ts`)

Tourne chaque jour à **07h00** (Vercel Cron).  
Interroge la table `RdvAtelier` pour les RDV du lendemain avec `status IN ('planifie', 'confirme')` et `reminder_sent = false`.

Pour chaque RDV :
1. Envoie un email récapitulatif au garage (`NOTIFY_EMAIL`)
2. Si le client a un email, envoie un email de rappel personnalisé
3. Marque `reminder_sent = true` en base

Sécurisé par `CRON_SECRET` (header `x-cron-secret` ou paramètre `?secret=`).

---

### 4.4 Email Garantie (`app/api/garantie/send-email/route.ts`)

Permet d'envoyer depuis l'interface une des communications générées par l'IA :
- `type: 'email'` → communication SAV standard
- `type: 'refus'` → lettre de refus motivée
- `type: 'transaction'` → proposition transactionnelle

Convertit le texte plain-text en HTML dark-theme et envoie via Resend.  
Archive l'envoi comme `GarantieDocument` avec `type = 'email'`.  
Le type `'whatsapp'` retourne 400 (envoi manuel requis).

---

### 4.5 Navigation mobile (`app/gp/nav.tsx`)

Ajout de `overflow-x-auto scrollbar-none` sur le conteneur et `whitespace-nowrap flex-shrink-0` sur chaque lien pour que les 8 onglets restent accessibles sur mobile par défilement horizontal.

---

### 4.6 Vercel Cron (`vercel.json`)

Ajout du job `rdv-reminders` :
```json
{ "path": "/api/cron/rdv-reminders", "schedule": "0 7 * * *" }
```

4 crons au total : 06h00 (digest), **07h00 (RDV)**, 08h00 (scanner), 09h00 (stock-review).

---

## 5. Ce qui existait avant cette session (non modifié)

### 5.1 Structure des pages admin (`/app/gp/`)

| Page | Route | Description |
|---|---|---|
| Stock | `/gp/stock` | Tableau de bord véhicules (source de vérité centrale) |
| Dashboard | `/gp/dashboard` | Métriques financières et KPIs |
| Leads | `/gp/leads` | Gestion des prospects via agent MADORE |
| Formation | `/gp/training` | Interface d'entraînement des agents |
| Système | `/gp/system` | Santé de tous les agents (health checks) |
| Véhicule | `/gp/vehicle/[id]` | Fiche détaillée avec historique et feedback |

### 5.2 Agents existants

**Carmelo** — Analyse l'opportunité d'achat d'un véhicule scrappé via URL. Envoie la fiche au Controller pour validation financière. Stocke dans `CarmeloAnalysis` et `CarmeloOpportunity`.

**MADORE** — Chatbot de gestion de leads. Stocke dans `MadoreLead`. Utilise la mémoire des DemandSignals pour personnaliser les réponses.

**Marketing** — Génère des annonces texte + description HTML pour les plateformes de vente. Stocke le brouillon dans `Vehicle.marketingDraft`.

**Controller** — Valide la marge nette, les frais atelier et la cohérence du prix de vente. Stocke le résultat dans `Vehicle.controllerResult`.

**Scanner** — Scrape les sites automobiles belges (ScraperAPI), détecte les opportunités et émet `prix.baisse`. Tourne via cron à 08h00.

### 5.3 Infrastructure commune

**`app/db.ts`** — Fichier central avec `ensureSchema()` (singleton Promise) qui crée automatiquement toutes les tables si elles n'existent pas. Toutes les fonctions CRUD y sont définies. Les données sont isolées par email utilisateur.

**`lib/email.ts`** — Service d'envoi d'email via l'API REST de Resend (pas de SDK). Prend `{ to, subject, html, replyTo? }`.

**`lib/validation.ts`** — Fonctions de validation des inputs API : `assertBody`, `requirePositiveInt`, `optionalString`, etc.

**`lib/rate-limit.ts`** — Rate limiting en mémoire par clé.

---

## 6. Variables d'environnement requises

Toutes ces variables doivent être définies dans **Vercel → Settings → Environment Variables** pour les environnements Production et Preview.

| Variable | Description | Obligatoire |
|---|---|---|
| `POSTGRES_URL` | URL de connexion Neon PostgreSQL (`postgresql://...?sslmode=require`) | ✅ Critique |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude claude-opus-4-8) | ✅ Critique |
| `AUTH_SECRET` | Secret NextAuth v5 (chaîne aléatoire ≥ 32 chars) | ✅ Critique |
| `RESEND_API_KEY` | Clé API Resend pour l'envoi d'emails | ✅ Pour les emails |
| `RESEND_FROM_EMAIL` | Expéditeur email (`GP-CARS <noreply@votre-domaine.be>`) | ✅ Pour les emails |
| `NOTIFY_EMAIL` | Email du garage pour les rappels et notifications | ✅ Pour les crons |
| `CRON_SECRET` | Secret pour sécuriser les endpoints cron | ✅ Pour les crons |
| `NEXT_PUBLIC_BASE_URL` | URL publique du site (`https://xxx.vercel.app`) | ✅ Pour les liens email |
| `SCRAPERAPI_KEY` | Clé ScraperAPI pour le Scanner (ne jamais committer) | ✅ Pour le Scanner |

> **Note sécurité :** La clé `SCRAPERAPI_KEY` (`80c6ceda6eb1dd8e55b73c4da8800ed9`) est valide — elle ne doit **jamais** apparaître dans le code source, uniquement dans les variables Vercel.

---

## 7. Schéma complet de la base de données

### Tables par agent

```
User               ← Auth (NextAuth)
Vehicle            ← Source de vérité centrale (tous les agents)
SystemEvent        ← Bus d'événements inter-agents
VehicleEvent       ← Journal d'audit des transitions de statut

[Carmelo]
  CarmeloAnalysis
  CarmeloOpportunity

[MADORE]
  MadoreLead
  DemandSignal

[Scanner / Marketing]
  PriceHistory

[Atelier — NOUVEAU]
  AtelierIntervention
  PieceCommande
  RdvAtelier

[Garantie — NOUVEAU]
  GarantieDossier
  GarantieDocument
  GarantiePiece
```

### Colonne `reminder_sent` dans `RdvAtelier`

La table `RdvAtelier` a une colonne `reminder_sent BOOLEAN DEFAULT false` utilisée par le cron `rdv-reminders`. Si cette colonne n'existe pas dans une base de données existante, il faut l'ajouter manuellement :
```sql
ALTER TABLE "RdvAtelier" ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;
```
> `ensureSchema()` dans `db.ts` utilise `CREATE TABLE IF NOT EXISTS` — elle crée les tables mais ne migre pas les tables existantes.

---

## 8. Flux de données — cycle de vie d'un véhicule

```
1. CARMELO analyse une annonce URL
   → crée CarmeloAnalysis + CarmeloOpportunity
   → décision VERT/ORANGE/ROUGE

2. Si décision d'achat → statut Vehicle = 'achete'
   → HOOK AUTO : crée AtelierIntervention (type: preparation_vente)
   → émet événement : atelier.intervention_creee

3. ATELIER gère la préparation
   → pièces commandées → reçues → montées
   → coût réel saisi → émet atelier.frais_reels
   → CONTROLLER recalcule marge nette

4. Véhicule prêt → statut 'en_stock' puis 'publie'
   → MARKETING génère l'annonce

5. SCANNER surveille les prix concurrents
   → émet prix.baisse si opportunité détectée

6. Vente → statut 'vendu'
   → Si réclamation client → GARANTIE ouvre un dossier
   → Analyse IA → catégorie 1-7 → communication générée
   → Si litigationProbability > 70 → émet garantie.litige_detecte
```

---

## 9. Architecture des composants UI

### Pattern Server/Client (important)

Toutes les pages interactives suivent ce pattern strict :

```
app/gp/<page>/page.tsx       ← Server Component (auth + layout)
app/gp/<page>/<Page>Client.tsx  ← Client Component ('use client', tout le state)
```

**Les Client Components ne peuvent pas importer `app/db.ts`** (qui utilise le driver Node.js `postgres`). Ils doivent toujours passer par les routes API (`/api/...`).

### Pages actuelles

| Page server | Client component | Pattern |
|---|---|---|
| `app/gp/atelier/page.tsx` | `AtelierClient.tsx` | ✅ Thin wrapper |
| `app/gp/garantie/page.tsx` | `GarantieClient.tsx` | ✅ Thin wrapper |
| `app/gp/stock/page.tsx` | *(server rendering)* | Liste simple |
| `app/gp/leads/page.tsx` | *(server rendering)* | Liste simple |

---

## 10. Ce que le développeur doit faire

### Étape 1 — Setup local

```bash
git clone <repo>
cd autooccasion-app
git checkout claude/ai-agent-status-QzWo1
npm install
```

Créer un fichier `.env.local` :
```env
POSTGRES_URL=postgresql://...?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
AUTH_SECRET=<random 32+ chars>
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=GP-CARS <noreply@votre-domaine.be>
NOTIFY_EMAIL=info.gpcars@gmail.com
CRON_SECRET=<random secret>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SCRAPERAPI_KEY=80c6ceda6eb1dd8e55b73c4da8800ed9
```

```bash
npm run dev
```

L'accès à `/gp/*` nécessite un compte. Pour en créer un :
```bash
# Via l'interface /register, ou directement en base :
# INSERT INTO "User" (email, password) VALUES ('info.gpcars@gmail.com', '<bcrypt hash>');
```

### Étape 2 — Merger et déployer

```bash
git checkout main
git merge claude/ai-agent-status-QzWo1
git push origin main
```

Vercel déploie automatiquement depuis `main`. Configurer toutes les variables d'environnement dans Vercel avant le premier déploiement.

### Étape 3 — Tester les endpoints critiques

Après déploiement, vérifier chaque health check :

```
GET https://votre-domaine.vercel.app/api/atelier/health
GET https://votre-domaine.vercel.app/api/garantie/health
GET https://votre-domaine.vercel.app/api/carmelo/health
GET https://votre-domaine.vercel.app/api/madore/health
GET https://votre-domaine.vercel.app/api/scanner/health
GET https://votre-domaine.vercel.app/api/marketing/health
GET https://votre-domaine.vercel.app/api/controller/health
```

Chaque endpoint retourne `{ status: 'ok', agent: '...', version: '...', timestamp: '...' }`.

### Étape 4 — Tester le cron manuellement

```bash
curl -H "x-cron-secret: <CRON_SECRET>" \
  https://votre-domaine.vercel.app/api/cron/rdv-reminders
```

Doit retourner `{ ok: true, rdvsProcessed: N, emailsSent: N }`.

---

## 11. Limitations actuelles et chantiers futurs

| Limitation | Priorité | Solution envisagée |
|---|---|---|
| Upload de documents (photos, devis) pour Garantie | Haute | Intégrer Vercel Blob ou AWS S3 |
| WhatsApp Business API (envoi automatique) | Haute | API Meta Business, nécessite compte vérifié |
| Migrations de schéma BDD | Haute | Remplacer `ensureSchema()` par Drizzle Kit + `drizzle-kit migrate` |
| Tests automatisés | Moyenne | Vitest est installé, aucun test d'agent n'existe encore |
| Monitoring d'erreurs | Moyenne | Intégrer Sentry (`@sentry/nextjs`) |
| Connexion Atelier ↔ Garantie | Moyenne | L'agent Garantie peut lire les interventions Atelier — à afficher dans l'UI |
| Application mobile | Basse | PWA ou React Native — la nav mobile est scrollable mais le design n'est pas natif |
| Multi-utilisateurs | Basse | Aujourd'hui 1 compte = 1 garage. Support multi-garage = ajouter concept `organization` |

---

## 12. Conventions de code à respecter

### Ajouter un nouvel agent

1. Créer `lib/agents/<nom>/contract.ts` avec le pattern :
   ```typescript
   export const MON_AGENT_CONTRACT = {
     name: 'mon_agent' as const,
     displayName: '...',
     version: '1.0',
     emits: ['mon_agent.evenement'] as const,
     consumes: [] as const,
     owns: ['MaTable'] as const,
     reads: ['Vehicle', 'SystemEvent'] as const,
     healthEndpoint: '/api/mon_agent/health' as const,
     externalDeps: [],
   } as const;
   ```

2. L'enregistrer dans `lib/kernel/registry.ts` :
   ```typescript
   import { MON_AGENT_CONTRACT } from '@/lib/agents/mon_agent/contract';
   export const AGENT_REGISTRY = [..., MON_AGENT_CONTRACT] as const;
   ```

3. Créer ses tables dans `app/db.ts` et les ajouter à `ensureSchema()`.

4. Créer les routes API sous `app/api/mon_agent/`.

5. Créer la page UI sous `app/gp/mon_agent/`.

6. Ajouter l'onglet dans `app/gp/nav.tsx`.

### Règles d'isolation

- Un agent ne doit **jamais** importer directement depuis le module d'un autre agent
- Les agents communiquent uniquement via `SystemEvent` (bus d'événements) ou en lisant les tables déclarées dans `reads`
- Toutes les données sont filtrées par `userEmail` — ne jamais requêter sans ce filtre

### Email

Toujours utiliser `sendEmail()` depuis `lib/email.ts`. Ne jamais instancier directement Resend ou tout autre SDK email.

---

## 13. Structure des fichiers (arborescence complète)

```
autooccasion-app/
├── app/
│   ├── auth.ts                    ← NextAuth v5 config
│   ├── db.ts                      ← Schéma + toutes les fonctions CRUD
│   ├── api/
│   │   ├── agents/
│   │   │   ├── vehicle/route.ts   ← CRUD Vehicle (hook auto-atelier)
│   │   │   ├── controller/route.ts
│   │   │   ├── marketing/route.ts
│   │   │   └── analytics/route.ts
│   │   ├── carmelo/
│   │   │   ├── analyze/route.ts
│   │   │   ├── opportunities/route.ts
│   │   │   ├── contact/route.ts
│   │   │   ├── market/route.ts
│   │   │   └── health/route.ts
│   │   ├── madore/
│   │   │   ├── chat/route.ts
│   │   │   └── health/route.ts
│   │   ├── atelier/               ← NOUVEAU
│   │   │   ├── interventions/route.ts
│   │   │   ├── pieces/route.ts
│   │   │   ├── rdvs/route.ts
│   │   │   └── health/route.ts
│   │   ├── garantie/              ← NOUVEAU
│   │   │   ├── dossiers/route.ts
│   │   │   ├── analyze/route.ts
│   │   │   ├── send-email/route.ts
│   │   │   └── health/route.ts
│   │   ├── scanner/
│   │   │   ├── run/route.ts
│   │   │   └── health/route.ts
│   │   ├── marketing/health/route.ts
│   │   ├── controller/health/route.ts
│   │   ├── gocar/comparables/route.ts
│   │   ├── import/route.ts
│   │   └── cron/
│   │       ├── daily-digest/route.ts
│   │       ├── rdv-reminders/route.ts   ← NOUVEAU
│   │       ├── scanner/route.ts
│   │       └── stock-review/route.ts
│   └── gp/
│       ├── nav.tsx                ← Nav mobile scrollable (MODIFIÉ)
│       ├── atelier/
│       │   ├── page.tsx           ← Thin wrapper (RÉÉCRIT)
│       │   └── AtelierClient.tsx  ← NOUVEAU
│       ├── garantie/
│       │   ├── page.tsx           ← Thin wrapper (RÉÉCRIT)
│       │   └── GarantieClient.tsx ← NOUVEAU
│       ├── stock/page.tsx + actions.tsx
│       ├── dashboard/page.tsx
│       ├── leads/page.tsx
│       ├── system/page.tsx
│       ├── training/page.tsx
│       └── vehicle/[id]/page.tsx + feedback.tsx
├── lib/
│   ├── agents/
│   │   ├── shared-types.ts        ← Tous les types TypeScript partagés
│   │   ├── analytics.ts
│   │   ├── carmelo/contract.ts
│   │   ├── madore/contract.ts
│   │   ├── marketing/contract.ts + system-prompt.ts
│   │   ├── controller/contract.ts + system-prompt.ts + validate.ts
│   │   ├── scanner/contract.ts
│   │   ├── atelier/contract.ts    ← NOUVEAU
│   │   ├── garantie/
│   │   │   ├── contract.ts        ← NOUVEAU
│   │   │   └── system-prompt.ts   ← NOUVEAU
│   │   └── _template/contract.ts
│   ├── kernel/
│   │   └── registry.ts            ← Registry des 7 agents (MODIFIÉ)
│   ├── email.ts                   ← Service email Resend
│   ├── validation.ts
│   └── rate-limit.ts
├── vercel.json                    ← 4 crons (MODIFIÉ)
└── HANDOVER.md                    ← Ce document
```

---

*Document généré le 2026-06-20. Pour toute question sur l'architecture, se référer aux contrats d'agents dans `lib/agents/*/contract.ts` et au kernel dans `lib/kernel/registry.ts`.*
