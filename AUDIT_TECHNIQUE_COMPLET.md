# AUDIT TECHNIQUE COMPLET — GP-CARS PLATFORM
## Document de passation pour développeur entrant

**Client :** GP-CARS — Francisco Gomez (`info.gpcars@gmail.com`)
**Localisation :** Soumagne, Belgique
**Repository :** `autooccasion/autooccasion-app` (GitHub privé)
**Branche active :** `claude/ai-agent-status-QzWo1`
**Date audit :** 13 juin 2026

---

## 1. VISION DU PROJET

GP-CARS est un négociant en véhicules d'occasion spécialisé dans les voitures récentes
(2021-2025), peu kilométrées (<80 000 km), principalement des SUV compacts et citadines
premium à boîte automatique.

La plateforme est une **application web interne + publique** avec 5 agents IA qui automatisent
l'ensemble du cycle d'achat-vente :

```
Prospect → MADORE → Achat → CARMELO → Contrôleur → Marketing → Vente → Dashboard
```

L'objectif est que Francisco puisse gérer 10 véhicules en stock simultanément avec
un minimum d'intervention manuelle.

---

## 2. STACK TECHNIQUE

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js App Router | 14.0.4 |
| Langage | TypeScript | 5.3.3 |
| UI | Tailwind CSS | 3.x |
| Base de données | PostgreSQL (Neon serverless) | — |
| ORM | Drizzle ORM | — |
| Authentification | NextAuth v5 (credentials + bcrypt) | — |
| IA principale | Anthropic Claude Opus 4.8 | streaming |
| IA économique | Anthropic Claude Haiku 4.5 | streaming |
| Hébergement | Vercel (4 projets séparés) | — |
| Emails | Resend API | — |
| Scraping | ScraperAPI (proxy headless Chrome) | — |

---

## 3. ARCHITECTURE FICHIERS

```
autooccasion-app/
│
├── app/                          # Next.js App Router
│   ├── db.ts                     ⭐ BASE DE DONNÉES — toutes les tables + fonctions
│   ├── auth.ts / auth.config.ts  # NextAuth v5
│   ├── actions.ts                # Server Actions partagées
│   │
│   ├── login/ register/          # Auth pages
│   ├── settings/                 # Config clé API
│   ├── madore/                   # Interface publique agent commercial
│   │
│   ├── carmelo/                  # Interface interne agent d'achat
│   │   ├── page.tsx              # Analyse manuelle
│   │   ├── scanner/              # Scanner AutoScout24
│   │   ├── marche/               # Étude de marché
│   │   ├── opportunites/         # Suivi opportunités
│   │   ├── history/              # Historique analyses
│   │   └── import/               # Import CSV historique
│   │
│   ├── gp/                       # Interface interne gestion
│   │   ├── stock/                # Stock véhicules
│   │   ├── vehicle/[id]/         # Fiche détail
│   │   ├── dashboard/            # Analytics KPIs
│   │   ├── leads/                # Leads MADORE
│   │   └── training/             # Formation & entraînement agents
│   │
│   └── api/                      # Routes API
│       ├── carmelo/
│       │   ├── analyze/          # POST — Analyse streaming Carmelo
│       │   ├── market/           # POST — Étude marché (sans IA)
│       │   ├── contact/          # POST — Rédaction message contact
│       │   └── opportunities/    # POST — Sauvegarde opportunité
│       ├── agents/
│       │   ├── vehicle/          # POST — Actions stock (statut, vente…)
│       │   ├── marketing/        # POST — Génère annonce (Haiku)
│       │   ├── controller/       # POST — Contrôle véhicule (Haiku)
│       │   └── analytics/        # GET — Stats agrégées
│       ├── scanner/run/          # POST — Lancement scanner manuel
│       ├── import/               # POST — Import CSV
│       ├── madore/chat/          # POST — Chat MADORE streaming
│       ├── gocar/comparables/    # POST — Prix marché GoCar (stub)
│       ├── status/               # GET — Santé variables env
│       └── cron/
│           ├── daily-digest/     # GET — Bilan email quotidien (06h00)
│           └── scanner/          # GET — Scanner automatique (08h00)
│
├── lib/                          # Logique métier pure
│   ├── carmelo/
│   │   ├── config.ts             ⭐ PARAMÈTRES GP-CARS (marges, budget, marques)
│   │   ├── system-prompt.ts      # Prompt principal Carmelo
│   │   ├── analyze-core.ts       # Analyse non-streaming (batch scanner)
│   │   ├── memory.ts             # Mémoire RAG — cas passés + stats marque
│   │   ├── parse.ts              # Extraction données depuis rapport Claude
│   │   ├── fetch-listing.ts      # Scraping annonce + protection SSRF
│   │   ├── market.ts             # Calcul statistiques marché
│   │   ├── decision.ts           # Logique décision VERT/ORANGE/ROUGE/OR
│   │   ├── digest.ts             # Synthèse opportunités
│   │   ├── digest-email.ts       # HTML email digest
│   │   ├── contact-prompt.ts     # Prompt message contact vendeur
│   │   └── modules/              # 10 modules V3 purs (calcul, sans IA)
│   │       ├── exclusions.ts     # Véhicules à exclure absolument
│   │       ├── frais.ts          # Calcul frais incompressibles (405€)
│   │       ├── marge.ts          # Calcul marge nette
│   │       ├── risque.ts         # Score risque
│   │       ├── couleur.ts        # Pénalité couleurs difficiles
│   │       ├── rotation.ts       # Score liquidité marché
│   │       ├── capital.ts        # Contrôle capital immobilisé
│   │       ├── score-carmelo.ts  # Score agrégé 0-100
│   │       ├── verdict.ts        # Décision finale 4 tiers
│   │       └── comparaison-vn.ts # Comparaison prix neuf
│   ├── agents/
│   │   ├── analytics.ts          # KPIs, stats marque, santé stock
│   │   ├── shared-types.ts       # Types partagés (VehicleStatus, etc.)
│   │   ├── controller/           # Règles dures contrôleur
│   │   └── marketing/            # Prompt agent marketing
│   ├── madore/
│   │   ├── system-prompt.ts      # Prompt MADORE + injection stock
│   │   ├── stock-match.ts        # Filtrage/scoring stock vs critères prospect
│   │   └── parse-report.ts       # Extraction rapport MADORE depuis réponse
│   ├── scanner/
│   │   ├── autoscout24.ts        # Scraping AutoScout24 BE
│   │   └── scraper.ts            # Client HTTP + ScraperAPI proxy
│   ├── gocar/
│   │   └── client.ts             # Stub API GoCar B2B (prêt à brancher)
│   ├── email.ts                  # Client Resend (envoi emails)
│   ├── rate-limit.ts             # Rate limiting in-memory
│   └── validation.ts             # Validation inputs
│
├── vercel.json                   # Crons Vercel (06h00 digest, 08h00 scanner)
└── CARMELO_V3_MASTER_SPECIFICATION.md  # Spécification complète Carmelo V3
```

---

## 4. BASE DE DONNÉES — TABLES

Fichier unique : `app/db.ts` — contient le schéma Drizzle ET les fonctions d'accès.
La migration est automatique au démarrage via `ensureSchema()` (CREATE IF NOT EXISTS).

### Tables existantes

| Table | Usage |
|---|---|
| `User` | Comptes utilisateurs (email + bcrypt password) |
| `CarmeloAnalysis` | Historique des analyses brutes de Carmelo |
| `CarmeloOpportunity` | Opportunités sauvegardées depuis l'étude de marché |
| `Vehicle` | ⭐ Table centrale — tout le cycle de vie d'un véhicule |
| `VehicleEvent` | Journal des transitions de statut (qui, quand, quel agent) |
| `MadoreLead` | Prospects qualifiés par MADORE |

### Cycle de vie d'un Vehicle (colonne `status`)

```
[prospect] → [analyse] → [achete] → [en_stock] → [publie] → [vendu]
                ↓                                              ↓
            [refuse]                                       [refuse]
```

### Champs clés Vehicle
- `email` — propriétaire du véhicule (toujours `info.gpcars@gmail.com`)
- `decision` — VERT / ORANGE / ROUGE / INCONNU / OR
- `confidence` — score confiance Carmelo (0-100)
- `requiresHumanValidation` — true si confiance < 85% ou flag bloquant
- `analysisFeedback` — 'correct' / 'incorrect' (feedback 👍/👎)
- `controllerFlags` — JSON array de flags (bloquant/avertissement/info)

---

## 5. LES 5 AGENTS IA — DÉTAIL COMPLET

### AGENT 1 — CARMELO (agent d'achat)
**Rôle :** Analyser un véhicule d'occasion et décider si GP-CARS doit l'acheter.

**Modèle :** Claude Opus 4.8 (streaming)
**Endpoint :** `POST /api/carmelo/analyze`
**Déclenchement :** Manuel via `/carmelo` ou automatique via le scanner

**Fonctionnement :**
1. Reçoit une URL d'annonce ou une description textuelle
2. Scrape l'annonce (via `fetch-listing.ts` + ScraperAPI si configuré)
3. Charge la mémoire GP-CARS (60 véhicules passés pertinents + stats par marque)
4. Envoie tout à Claude Opus avec le prompt système Carmelo V3
5. Stream la réponse vers l'interface
6. Sauvegarde : analyse brute + Vehicle + résultat contrôleur automatique

**Décision 4 tiers :**
- `OR` = Opportunité Rare — achat immédiat sans négociation
- `VERT` = Acheter (avec négociation possible)
- `ORANGE` = Surveiller (conditions à remplir)
- `ROUGE` = Rejeter

**Mémoire (RAG) :** Pas de vecteurs — scoring par pertinence textuelle.
Les véhicules vendus avec marge réelle ont le plus de poids. Le feedback 👍/👎
ajoute/retire des points au score de relevance.

**Paramètres clés** (dans `lib/carmelo/config.ts`) :
- `PLANCHER_FRAIS = 405 €` (CT 105 + prépa 100 + pub 200, incompressible)
- `MARGES.standard.cible = 3 000 €`
- `GP_CARS_PARAMS.plafond_achat_vehicule = 25 000 €`
- `GP_CARS_PARAMS.seuil_confiance_autonome = 85 %`

---

### AGENT 2 — CONTRÔLEUR (validation automatique)
**Rôle :** Vérifier qu'un véhicule respecte les règles absolues GP-CARS.

**Modèle :** Claude Haiku 4.5 (+ règles dures sans IA)
**Endpoint :** `POST /api/agents/controller`
**Déclenchement :** Automatique après chaque analyse Carmelo + Manuel via bouton stock

**Fonctionnement :**
1. Vérifie d'abord les règles dures (sans IA) : km > 120k, prix > plafond, année < 2019
2. Si règle dure = KO → flag `bloquant`, `requiresHumanValidation = true`
3. Envoie ensuite au LLM Haiku pour vérification approfondie
4. Sauvegarde les flags dans `Vehicle.controllerFlags` (JSON array)

**Niveaux de flags :**
- `bloquant` — empêche l'achat automatique
- `avertissement` — signale un risque à évaluer
- `info` — information utile

---

### AGENT 3 — MARKETING (rédaction d'annonces)
**Rôle :** Rédiger automatiquement l'annonce de vente d'un véhicule acheté.

**Modèle :** Claude Haiku 4.5
**Endpoint :** `POST /api/agents/marketing`
**Déclenchement :** Automatique quand statut passe à `en_stock` + Manuel via bouton

**Output :** Remplit dans Vehicle :
- `listingTitle` — titre accrocheur
- `listingDescription` — texte détaillé
- `listingPoints` — 3-5 points forts (JSON array)
- `listingTags` — étiquettes (JSON array)

---

### AGENT 4 — SCANNER (détection automatique d'opportunités)
**Rôle :** Scanner AutoScout24 Belgique chaque matin et analyser automatiquement
les nouvelles annonces correspondant aux critères GP-CARS.

**Critères de recherche :** Kia, Hyundai, Toyota, VW, Audi, BMW, Mercedes /
SUV / 2021+ / <80 000 km / 12 000–20 000 € / boîte automatique / Belgique

**Modèles :** ScraperAPI (scraping) + Claude Opus (analyse)
**Endpoints :**
- `GET /api/cron/scanner` — cron Vercel 08h00 (authentifié via `CRON_SECRET`)
- `POST /api/scanner/run` — lancement manuel depuis l'interface

**Fonctionnement :**
1. Construit URL de recherche AutoScout24 BE
2. Scrape via ScraperAPI (anti-bot, headless Chrome, proxies résidentiels BE)
3. Extrait les URLs d'annonces du JSON `__NEXT_DATA__`
4. Filtre par déduplication (`getVehicleByListingUrl`)
5. Analyse les 3 premières nouvelles annonces via `runCarmeloAnalysis()`
6. Si opportunité OR/VERT → envoie alerte email immédiate à `NOTIFY_EMAIL`

**⚠️ Dépendance critique :** `SCRAPERAPI_KEY` obligatoire sinon AutoScout24 bloque.
Clé disponible : `80c6ceda6eb1dd8e55b73c4da8800ed9`

---

### AGENT 5 — MADORE (agent commercial)
**Rôle :** Qualifier les prospects entrants et générer des leads pour GP-CARS.

**Modèle :** Claude Haiku 4.5 (rapide + économique pour usage commercial)
**Endpoint :** `POST /api/madore/chat`
**Interface publique :** `/madore` (sans authentification)
**Mode test :** `/madore?demo=true` (pas de sauvegarde leads)

**Fonctionnement :**
1. Reçoit l'historique de la conversation (messages[])
2. Charge le stock GP-CARS en temps réel (`getStockVehicles(NOTIFY_EMAIL)`)
3. Score/filtre les véhicules selon le budget détecté dans la conversation
4. Injecte le stock dans le prompt MADORE
5. Pose des questions progressives (1 à la fois) pour qualifier le prospect
6. Génère un `# RAPPORT MADORE` quand assez d'infos collectées
7. Parse le rapport → sauvegarde dans `MadoreLead`
8. Le lead apparaît dans `/gp/leads` avec score (0-100) et priorité ROUGE/ORANGE/VERT

**Scoring leads :**
- 100 = achat immédiat
- 75 = achat < 30 jours
- 50 = intérêt réel
- 25 = curiosité
- 0 = non qualifié

---

## 6. FLUX CRONS AUTOMATIQUES

```
06h00 tous les jours → GET /api/cron/daily-digest
  ├── Charge tous les véhicules GP-CARS
  ├── Identifie nouvelles opportunités + véhicules > 60 jours en stock
  ├── Calcule KPIs financiers (marge moyenne, rotation)
  └── Envoie email HTML à NOTIFY_EMAIL via Resend

08h00 tous les jours → GET /api/cron/scanner
  ├── Scrape AutoScout24 BE (2 pages)
  ├── Déduplique vs stock existant
  ├── Analyse jusqu'à 3 nouvelles annonces avec Carmelo
  └── Si OR/VERT → email alerte immédiate à NOTIFY_EMAIL
```

**Sécurité crons :** Header `Authorization: Bearer CRON_SECRET` obligatoire.
Vercel injecte ce header automatiquement pour ses propres crons.
Pour tester manuellement : `curl -H "Authorization: Bearer VOTRE_SECRET" https://app/api/cron/scanner`

---

## 7. VARIABLES D'ENVIRONNEMENT REQUISES

| Variable | Usage | Obligatoire | Valeur / Source |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Tous les agents IA | ✅ CRITIQUE | console.anthropic.com |
| `POSTGRES_URL` | Base de données Neon | ✅ CRITIQUE | neon.tech |
| `AUTH_SECRET` | Sessions NextAuth | ✅ CRITIQUE | `openssl rand -base64 32` |
| `NOTIFY_EMAIL` | Email propriétaire GP-CARS | ✅ CRITIQUE | `info.gpcars@gmail.com` |
| `NEXT_PUBLIC_BASE_URL` | URLs dans emails | ✅ CRITIQUE | `https://ton-domaine.vercel.app` |
| `CRON_SECRET` | Sécurité crons | ✅ CRITIQUE | Valeur secrète aléatoire |
| `SCRAPERAPI_KEY` | Scanner anti-bot | ✅ Scanner | `80c6ceda6eb1dd8e55b73c4da8800ed9` |
| `RESEND_API_KEY` | Envoi emails | ✅ Emails | resend.com |
| `RESEND_FROM_EMAIL` | Expéditeur emails | ✅ Emails | `GP-CARS <notifications@gp-cars.be>` |
| `GOCAR_API_KEY` | Prix marché GoCar | ⏳ Futur | data@gocar.be |
| `GOCAR_API_URL` | Endpoint GoCar | ⏳ Futur | À confirmer avec GoCar |

> **IMPORTANT :** `NOTIFY_EMAIL` doit être `info.gpcars@gmail.com` sur TOUS les projets Vercel.

---

## 8. ÉTAT ACTUEL — CE QUI EST OPÉRATIONNEL

### ✅ Code 100% terminé (sur branche `claude/ai-agent-status-QzWo1`)

| Fonctionnalité | Route / Page | État |
|---|---|---|
| Connexion GP-CARS | `/login` | ✅ |
| Analyse Carmelo manuelle | `/carmelo` | ✅ |
| Scanner AutoScout24 manuel | `/carmelo/scanner` | ✅ |
| Étude de marché | `/carmelo/marche` | ✅ |
| Suivi opportunités | `/carmelo/opportunites` | ✅ |
| Historique analyses | `/carmelo/history` | ✅ |
| Import CSV historique | `/carmelo/import` | ✅ |
| Gestion du stock | `/gp/stock` | ✅ |
| Fiche détail véhicule | `/gp/vehicle/[id]` | ✅ |
| Dashboard analytics | `/gp/dashboard` | ✅ |
| Leads MADORE | `/gp/leads` | ✅ |
| Formation agents | `/gp/training` | ✅ |
| Chat public MADORE | `/madore` | ✅ |
| Mode test MADORE | `/madore?demo=true` | ✅ |
| Cron digest 06h00 | `/api/cron/daily-digest` | ✅ |
| Cron scanner 08h00 | `/api/cron/scanner` | ✅ |
| Santé config | `/api/status` | ✅ |
| Stub GoCar | `/api/gocar/comparables` | ✅ (stub) |

### ⏳ En attente de configuration Vercel

| Tâche | Bloquant pour |
|---|---|
| Merge branche → main | Tout |
| `NOTIFY_EMAIL=info.gpcars@gmail.com` | MADORE + Scanner + Digest |
| `SCRAPERAPI_KEY` | Scanner automatique |
| `CRON_SECRET` | Crons sécurisés |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Emails alertes + digest |
| Compte utilisateur `info.gpcars@gmail.com` | Connexion |
| Import historique véhicules CSV | Mémoire Carmelo |

---

## 9. DÉMARRAGE LOCAL (développement)

```bash
git clone git@github.com:autooccasion/autooccasion-app.git
cd autooccasion-app
git checkout claude/ai-agent-status-QzWo1

npm install

# Créer .env.local
cp .env.example .env.local
# Remplir : POSTGRES_URL, AUTH_SECRET, ANTHROPIC_API_KEY, NOTIFY_EMAIL

npm run dev
# → http://localhost:3000
```

**Tests unitaires :**
```bash
npm test
# Couvre : carmelo/memory, carmelo/parse, carmelo/market,
#          agents/analytics, rate-limit, validation
```

---

## 10. TÂCHES RESTANTES POUR MISE EN PRODUCTION

### Priorité 1 — Obligatoire (bloquant)

1. **Merger la branche** `claude/ai-agent-status-QzWo1` → `main`
2. **Variables Vercel** (voir section 7) — sur les 4 projets
3. **Créer compte Resend** (resend.com, gratuit 3 000 emails/mois)
   - Vérifier le domaine `gp-cars.be`
   - Récupérer la clé API
4. **Créer le compte utilisateur** `info.gpcars@gmail.com` dans l'app
   - Via `/register` ou directement en base
5. **Redéployer** sur Vercel après chaque variable ajoutée

### Priorité 2 — Entraînement (semaine 1)

6. **Importer l'historique GP-CARS** via `/carmelo/import`
   - Template CSV téléchargeable sur la page
   - Colonnes : marque, modele, annee, km, prix_achat_reel, prix_vente_reel, statut...
   - Minimum recommandé : 10-20 véhicules vendus
7. **Tester les 5 scénarios MADORE** via `/madore?demo=true`
   - Famille 4 personnes, budget 20k
   - Prospect seul citadine 12k
   - Prospect avec reprise 22k urgent
   - Prospect hors budget
   - Prospect sans téléphone
8. **Analyser 3-4 véhicules réels** via `/carmelo` (liens AutoScout24)
9. **Donner 5+ feedbacks** 👍/👎 sur les analyses dans `/gp/stock`

### Priorité 3 — Optimisation (optionnel)

10. **Domaine personnalisé** Vercel : `app.gp-cars.be`
11. **Intégrer MADORE** sur le site web GP-CARS existant
12. **Contacter GoCar** (data@gocar.be) pour l'API données marché belge
    - Le client stub `lib/gocar/client.ts` est prêt — plug & play
13. **NEXT_PUBLIC_BASE_URL** — pour que les liens dans les emails soient corrects

---

## 11. LACUNES CONNUES ET POINTS D'ATTENTION

### Mémoire sans données
Carmelo et MADORE fonctionnent mais sont "à l'aveugle" sans historique GP-CARS.
**Solution :** Import CSV immédiat (point 6 ci-dessus).

### Pas de données marché temps réel
L'étude de marché (`/carmelo/marche`) nécessite que l'utilisateur saisisse les prix
comparables manuellement. GoCar B2B automatiserait cela.
**Solution provisoire :** Recherche manuelle AutoScout24 → copier-coller les prix.

### Immatriculations étrangères
Le contrôleur ne calcule pas automatiquement la TMC (taxe de mise en circulation belge)
pour les véhicules importés. Carmelo le signale textuellement mais sans chiffre précis.

### Emails Gmail vs domaine professionnel
Resend nécessite un domaine vérifié pour envoyer depuis `@gp-cars.be`.
Si pas de domaine, utiliser le domaine sandbox Resend (emails arrivent en spam).

### ScraperAPI quota
La clé fournie est sur le plan gratuit (1 000 crédits/mois).
Chaque scan = ~5-10 crédits. À surveiller si le scanner tourne quotidiennement.

---

## 12. ROADMAP FUTURE (hors scope actuel)

| Fonctionnalité | Valeur | Effort |
|---|---|---|
| Intégration GoCar B2B | Prix marché belge temps réel | 1-2 jours |
| Widget MADORE embeddable | Intégration site externe via `<script>` | 1 jour |
| Alertes WhatsApp Business | Leads chauds → WhatsApp Francisco | 2 jours |
| App mobile PWA | Gestion stock depuis smartphone terrain | 3-5 jours |
| Paramètres éditables UI | Modifier config Carmelo sans code | 1 jour |
| Multi-utilisateur | Plusieurs négociants sur la même plateforme | 5+ jours |

---

## 13. CONTACTS ESSENTIELS

| Service | Usage | Accès |
|---|---|---|
| Vercel | Hébergement (4 projets) | Francisco |
| Neon | PostgreSQL serverless | Francisco |
| Anthropic Console | Clé API Claude | Francisco |
| Resend | Emails | À créer |
| ScraperAPI | Scraping anti-bot | Clé ci-dessus |
| GoCar | Données marché BE | data@gocar.be |

---

*Document généré le 13 juin 2026 — Projet GP-CARS / autooccasion-app*
*Branche : `claude/ai-agent-status-QzWo1` — 15 commits depuis main*
