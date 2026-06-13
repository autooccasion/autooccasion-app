# DOSSIER DE TRANSMISSION TECHNIQUE
## Projet IA GP-CARS — Plateforme d'agents autonomes

**Destinataire :** Développeur externe entrant
**Commanditaire :** Francisco Gomez — GP-CARS, Soumagne (Belgique)
**Contact professionnel :** info.gpcars@gmail.com
**Repository :** `autooccasion/autooccasion-app` (GitHub privé)
**Branche active :** `claude/ai-agent-status-QzWo1`
**Rédigé par :** CTO IA — Audit du 13 juin 2026

---

## 1. RÉSUMÉ EXÉCUTIF

GP-CARS est un négociant automobile indépendant belge spécialisé dans les véhicules
récents (2021-2025), peu kilométrés, à boîte automatique. Le propriétaire, Francisco
Gomez, gère seul un stock cible de 10 véhicules en rotation permanente.

**Le problème à résoudre :** Sans outillage, Francisco passe un temps considérable à
chercher des véhicules sur les plateformes, évaluer leur pertinence, rédiger des annonces,
et suivre les prospects. Ces tâches sont répétitives, chronophages et sources d'erreurs
de jugement.

**La solution construite :** Une plateforme web Next.js hébergée sur Vercel avec
**5 agents IA spécialisés** qui automatisent l'ensemble du cycle achat → vente.

**État d'avancement réel :**
- Code applicatif : **~90% terminé** — tous les agents sont développés et testés
- Déploiement production : **0% terminé** — en attente de configuration Vercel
- Données d'entraînement : **0%** — base de données vide, aucun historique importé
- Intégrations externes pendantes : ScraperAPI (clé disponible), Resend (à créer),
  GoCar (à contacter), sources additionnelles (Auto1, Mobile.de, 2ememain — non développées)

**Ce que le développeur entrant doit faire en priorité absolue :**
Pas de développement. De la mise en production, de la configuration, et de l'alimentation
en données. Le code est là. Il faut le brancher.

**KPI principal du système :** Vélocité de profit = Profit net estimé ÷ Délai de vente
estimé. Un véhicule à +3 000 € en 15 jours est meilleur qu'un véhicule à +4 500 € en
90 jours. Cette logique est câblée dans le scoring Carmelo.

---

## 2. CE QUI EXISTE DÉJÀ (code terminé)

### 2.1 Infrastructure générale
- Application Next.js 14 App Router complète avec TypeScript strict
- Authentification NextAuth v5 (email + mot de passe bcrypt)
- Base de données PostgreSQL via Neon (serverless) avec Drizzle ORM
- Migration automatique au démarrage (`ensureSchema()` — CREATE IF NOT EXISTS)
- Rate limiting in-memory (par IP et par utilisateur)
- Protection SSRF sur tous les endpoints de scraping

### 2.2 Les 5 agents IA développés

#### CARMELO — Agent d'achat
- Modèle : Claude Opus 4.8 (streaming temps réel)
- Décision 4 tiers : OR (opportunité rare) / VERT (acheter) / ORANGE (surveiller) / ROUGE (refuser)
- Scoring : 10 modules purs TypeScript (exclusions, frais, marge, risque, couleur, rotation,
  capital, score-carmelo, verdict, comparaison-VN)
- Mémoire RAG sans vecteurs : scoring textuel sur 60 véhicules passés + stats par marque
- Frais incompressibles câblés : 405 € (CT 105 + préparation 100 + publicité 200)
- Seuil validation autonome : confidence ≥ 85% → autonome / < 85% → validation humaine
- Feedback loop : boutons 👍/👎 sur chaque analyse pour corriger et affiner la mémoire

#### CONTRÔLEUR — Agent de validation
- Modèle : Claude Haiku 4.5 + règles dures sans IA
- Vérifie km, prix, année, historique, incohérences
- Flags : `bloquant` (empêche l'achat) / `avertissement` / `info`
- Déclenché automatiquement après chaque analyse Carmelo
- Peut être relancé manuellement depuis la fiche véhicule

#### MARKETING — Agent de rédaction
- Modèle : Claude Haiku 4.5
- Génère : titre accrocheur + description + 3-5 points forts + tags SEO
- Déclenché automatiquement quand un véhicule passe en statut `en_stock`
- Peut être régénéré manuellement

#### SCANNER — Agent de détection automatique
- Scraping : AutoScout24 Belgique (2 pages, ~40 annonces/run)
- Anti-bot : ScraperAPI (headless Chrome + proxies résidentiels BE)
- Critères : Kia/Hyundai/Toyota/VW/Audi/BMW/Mercedes / SUV / 2021+ / <80k km / 12-20k€ / auto
- Déduplication vs stock existant avant analyse
- Analyse batch : jusqu'à 3 nouvelles annonces par run (économie tokens)
- Alerte email immédiate si opportunité OR/VERT détectée
- Cron Vercel : tous les jours à 08h00

#### MADORE — Agent commercial (prospects)
- Modèle : Claude Haiku 4.5 (rapide, économique pour volume commercial)
- Interface publique `/madore` — sans authentification (pour prospects externes)
- Mode test `/madore?demo=true` — conversations sans sauvegarde (entraînement)
- Stock injecté dynamiquement dans le prompt à chaque message
- Qualification progressive : besoin / budget / financement / reprise / délai / contact
- Génère un rapport structuré parsé automatiquement → sauvegardé en table `MadoreLead`
- Scoring leads : 0-100 avec priorité ROUGE/ORANGE/VERT

### 2.3 Crons automatiques
```
06h00 quotidien → /api/cron/daily-digest
  Bilan stock + opportunités + KPIs + email HTML Resend → NOTIFY_EMAIL

08h00 quotidien → /api/cron/scanner
  Scraping AutoScout24 → dédup → analyse batch → alerte si opportunité
```

### 2.4 Interfaces utilisateur complètes

| Interface | URL | Accès |
|---|---|---|
| Chat commercial MADORE | `/madore` | Public |
| Analyse Carmelo | `/carmelo` | Interne |
| Scanner | `/carmelo/scanner` | Interne |
| Étude de marché | `/carmelo/marche` | Interne |
| Opportunités | `/carmelo/opportunites` | Interne |
| Historique | `/carmelo/history` | Interne |
| Import CSV | `/carmelo/import` | Interne |
| Stock véhicules | `/gp/stock` | Interne |
| Fiche véhicule | `/gp/vehicle/[id]` | Interne |
| Dashboard KPIs | `/gp/dashboard` | Interne |
| Leads MADORE | `/gp/leads` | Interne |
| Formation agents | `/gp/training` | Interne |
| Config API key | `/settings` | Interne |

### 2.5 Base de données — tables existantes

| Table | Contenu |
|---|---|
| `User` | Comptes utilisateurs |
| `CarmeloAnalysis` | Analyses brutes (texte complet + décision) |
| `CarmeloOpportunity` | Opportunités étude de marché |
| `Vehicle` | ⭐ Table centrale — cycle complet achat→vente |
| `VehicleEvent` | Journal d'audit (qui/quand/quel agent/quel changement) |
| `MadoreLead` | Prospects qualifiés par MADORE |

**Cycle de vie Vehicle :**
`prospect → analyse → achete → en_stock → publie → vendu`
(avec bifurcation `refuse` à tout stade)

### 2.6 Endpoints API complets

```
POST /api/carmelo/analyze          Analyse streaming (Opus)
POST /api/carmelo/market           Étude marché (calcul pur, sans IA)
POST /api/carmelo/contact          Rédaction message contact vendeur (Haiku)
POST /api/carmelo/opportunities    Sauvegarde opportunité
POST /api/agents/vehicle           Actions stock (statut, vente, feedback)
POST /api/agents/marketing         Génère annonce (Haiku)
POST /api/agents/controller        Contrôle véhicule (Haiku)
GET  /api/agents/analytics         Stats agrégées
POST /api/scanner/run              Lancement scanner manuel
POST /api/import                   Import CSV (multipart)
POST /api/madore/chat              Chat MADORE streaming
POST /api/gocar/comparables        Prix marché GoCar (stub prêt)
GET  /api/status                   Santé variables d'environnement
GET  /api/cron/daily-digest        Cron bilan email (auth CRON_SECRET)
GET  /api/cron/scanner             Cron scanner auto (auth CRON_SECRET)
```

---

## 3. CE QUI A ÉTÉ CONÇU ET DÉCIDÉ (non négociable)

### 3.1 Décisions d'architecture confirmées
- **Single-tenant** : la plateforme est construite pour un seul opérateur (GP-CARS). L'email
  `info.gpcars@gmail.com` est l'identifiant propriétaire de toutes les données. Toute
  évolution multi-tenant nécessiterait une refonte partielle de `app/db.ts`.
- **Modèles IA** : Opus 4.8 pour les analyses (qualité maximale), Haiku 4.5 pour tout le
  reste (coût minimum). Ne pas inverser ces choix sans validation.
- **Pas de vecteurs** : la mémoire Carmelo utilise un scoring textuel custom, pas de base
  vectorielle (Pinecone, pgvector...). Décision de simplicité et de maîtrise des coûts.
  À reconsidérer uniquement si le volume dépasse 500 véhicules analysés.
- **Streaming obligatoire** pour Carmelo et MADORE (UX temps réel). Le batch
  (`analyze-core.ts`) est réservé au scanner automatique.
- **Frais incompressibles = 405 €** : CT (105€) + préparation (100€) + publicité (200€).
  Cette constante est dans `lib/carmelo/config.ts`. Ne pas modifier sans accord client.

### 3.2 Règles métier câblées
```typescript
// lib/carmelo/config.ts
PLANCHER_FRAIS = 405 €
MARGES.standard.cible = 3 000 €     // véhicules < 20 000 €
MARGES.premium.cible  = 4 000 €     // véhicules > 20 000 €
GP_CARS_PARAMS.plafond_achat_vehicule = 25 000 €
GP_CARS_PARAMS.seuil_confiance_autonome = 85 %

MARQUES_PREFEREES = ['Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes']

EXCLUSIONS_ABSOLUES = [
  'Moteurs PSA PureTech', 'Historique douteux', 'Kilométrage incohérent',
  'Entretien absent ou non documenté', 'Import douteux',
  'Véhicule accidenté lourdement', 'Couleur difficile (rouge, beige, atypique)',
  'Modèle à risque mécanique connu élevé', 'Marge cible non atteignable'
]
```

### 3.3 KPI principal : vélocité de profit
La formule est intégrée dans le scoring et le prompt système de Carmelo :
> Profit net estimé ÷ Délai de vente estimé
> → 3 000 € / 15 jours = 200 €/j > 4 500 € / 90 jours = 50 €/j

Le score de rotation (0-10) pondère toutes les recommandations d'achat.

---

## 4. CE QUI RESTE À DÉVELOPPER

### 4.1 Urgence 0 — Déploiement (aucun code requis, ~8h)

| Tâche | Détail |
|---|---|
| Merger la branche | `claude/ai-agent-status-QzWo1` → `main` sur GitHub |
| Configurer 8 variables Vercel | Voir section 5 |
| Créer compte Resend | resend.com — vérifier domaine gp-cars.be |
| Créer compte utilisateur | `info.gpcars@gmail.com` via `/register` |
| Tester end-to-end | Checklist complète section 9 |

### 4.2 Urgence 1 — Entraînement agents (~4h)

| Tâche | Détail |
|---|---|
| Import historique GP-CARS | CSV via `/carmelo/import` (min. 15-20 véhicules vendus) |
| Tests MADORE (5 scénarios) | Via `/madore?demo=true` |
| 3-4 analyses réelles Carmelo | Liens AutoScout24 BE réels |
| 5+ feedbacks 👍/👎 | Sur les analyses dans `/gp/stock` |

### 4.3 Urgence 2 — Sources de scraping additionnelles (~3-5j par source)

Le scanner ne couvre aujourd'hui qu'**AutoScout24 Belgique**. Les autres sources
identifiées dans la vision produit restent à implémenter :

| Source | Difficulté | Priorité | Notes |
|---|---|---|---|
| GoCar.be | Faible (API B2B) | ⭐ Haute | Stub prêt dans `lib/gocar/client.ts`. Contacter data@gocar.be. Données prix marché temps réel (200k véhicules BE). |
| Auto1 | Moyenne | Haute | Plateforme B2B professionnelle. Nécessite compte revendeur. |
| 2ememain.be | Faible | Moyenne | ScraperAPI suffit. Structure HTML plus simple qu'AS24. |
| Mobile.de | Moyenne | Moyenne | Vehicules import Allemagne. Utile pour trouver des occasions DE moins chères. |
| Fastback | À évaluer | Basse | Vérifier si plateforme encore active en BE. |

**Comment ajouter une source :**
1. Créer `lib/scanner/[source].ts` sur le modèle de `autoscout24.ts`
2. Exporter `scan[Source](pages)` retournant `ScanResult { listings, total, error }`
3. Intégrer dans `app/api/scanner/run/route.ts` et `app/api/cron/scanner/route.ts`
4. Ajouter un onglet dans `/carmelo/scanner`

### 4.4 Urgence 3 — Intégrations site web (~1-2j)

| Tâche | Détail |
|---|---|
| MADORE sur site GP-CARS | Lien ou iframe vers `/madore` |
| Domaine personnalisé | `app.gp-cars.be` sur Vercel |
| Emails domaine professionnel | Vérifier `gp-cars.be` dans Resend |

### 4.5 Futur — Évolutions non commencées

| Fonctionnalité | Effort estimé | Valeur |
|---|---|---|
| Multi-plateformes publish (AS24 API) | 3-5j | Haute |
| Widget MADORE embeddable (JS standalone) | 1-2j | Moyenne |
| Alertes WhatsApp Business | 2-3j | Haute |
| Monitoring/observabilité (logs structurés) | 1-2j | Haute |
| App mobile PWA | 5-10j | Moyenne |
| Multi-tenant (plusieurs garages) | 10-15j | Basse (hors scope) |

---

## 5. DÉPENDANCES TECHNIQUES

### 5.1 Variables d'environnement — table complète

| Variable | Usage | Obligatoire | Source / Valeur |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Tous les agents IA | ✅ BLOQUANT | console.anthropic.com |
| `POSTGRES_URL` | Base de données | ✅ BLOQUANT | neon.tech (déjà configuré) |
| `AUTH_SECRET` | Sessions NextAuth | ✅ BLOQUANT | `openssl rand -base64 32` |
| `NOTIFY_EMAIL` | Email propriétaire | ✅ BLOQUANT | `info.gpcars@gmail.com` |
| `NEXT_PUBLIC_BASE_URL` | Liens dans emails | ✅ BLOQUANT | URL Vercel production |
| `CRON_SECRET` | Sécurité crons | ✅ BLOQUANT | UUID aléatoire |
| `SCRAPERAPI_KEY` | Scanner anti-bot | ✅ Scanner | `80c6ceda6eb1dd8e55b73c4da8800ed9` |
| `RESEND_API_KEY` | Envoi emails | ✅ Emails | resend.com |
| `RESEND_FROM_EMAIL` | Expéditeur | ✅ Emails | `GP-CARS <notifications@gp-cars.be>` |
| `GOCAR_API_KEY` | Prix marché GoCar | ⏳ Futur | data@gocar.be |
| `GOCAR_API_URL` | Base URL GoCar | ⏳ Futur | À confirmer avec GoCar |

> **CRITIQUE :** `NOTIFY_EMAIL` doit être `info.gpcars@gmail.com` sur les 4 projets Vercel.
> C'est l'identifiant propriétaire qui lie TOUTES les données en base.

### 5.2 Services tiers actifs

| Service | Plan actuel | Limite | Coût estimé/mois |
|---|---|---|---|
| Vercel | Pro (estimé) | 4 projets | ~20-40 €/mois |
| Neon PostgreSQL | Gratuit/Starter | 3 Go | 0-19 €/mois |
| Anthropic API | Pay-per-use | Aucune | 20-80 €/mois selon usage |
| ScraperAPI | Gratuit | 1 000 crédits/mois | 0 € → 49 $/mois si dépassement |
| Resend | Gratuit | 3 000 emails/mois | 0 € → 20 €/mois si dépassement |

**Point d'attention Anthropic :**
- Claude Opus 4.8 : ~15 $/M tokens (Carmelo, scanner)
- Claude Haiku 4.5 : ~0,80 $/M tokens (MADORE, marketing, contrôleur)
- Budget réaliste pour 30 analyses/jour + MADORE actif : **20-50 €/mois**

### 5.3 Dépendances de packages critiques

```json
"next": "^14.0.4"
"@anthropic-ai/sdk": "dernière version"
"drizzle-orm": "avec postgres-js"
"next-auth": "v5 beta"
"bcrypt-ts": "pour le hashage passwords"
"tailwindcss": "^3"
```

---

## 6. PRIORITÉS

### Sprint 1 — Mise en ligne (J1-J3) — ~12h total
```
J1 matin  : Merger branche → main (1h)
J1 après  : Configurer toutes les variables Vercel sur 4 projets (2h)
J1 soir   : Créer compte Resend, vérifier domaine (2h)
J2 matin  : Créer compte utilisateur info.gpcars@gmail.com (30min)
J2 après  : Tests end-to-end complets (3h)
J3        : Corrections éventuelles (3h)
```

### Sprint 2 — Entraînement (J4-J7) — ~8h total
```
J4        : Import historique CSV véhicules GP-CARS (2h)
J5        : Tests MADORE 5 scénarios (2h)
J5-J6     : Analyses réelles Carmelo + feedbacks (2h)
J7        : Vérification score mémoire sur /gp/training (1h)
J7        : Intégration MADORE sur site web (1h)
```

### Sprint 3 — Extensions (J8-J20+) — selon priorités
```
J8-J12  : Intégration GoCar B2B (si accès obtenu)
J12-J15 : Scraper Auto1 ou 2ememain
J15-J17 : Republication automatique annonces (AS24 API)
J17-J20 : Monitoring + alertes WhatsApp
```

---

## 7. RISQUES

### Risque 1 — CRITIQUE : Agents "à l'aveugle" sans données historiques
**Probabilité :** Certaine à J0
**Impact :** Carmelo fait des recommandations génériques, pas calibrées GP-CARS
**Mitigation :** Import CSV immédiat de l'historique (Sprint 2, J4)
**Délai acceptable :** Maximum 1 semaine après mise en ligne

### Risque 2 — ÉLEVÉ : ScraperAPI quota dépassé
**Probabilité :** Moyenne (1 000 crédits gratuits, ~5-10 crédits/scan, 2 scans/jour = ~300/mois)
**Impact :** Scanner s'arrête, plus d'opportunités détectées automatiquement
**Mitigation :** Passer au plan payant ScraperAPI (49 $/mois) ou réduire la fréquence
**Surveillance :** dashboard.scraperapi.com

### Risque 3 — ÉLEVÉ : Changement structure HTML AutoScout24
**Probabilité :** Faible à court terme
**Impact :** Le scraper extrait 0 annonces, scanner silencieusement cassé
**Mitigation :** Logs clairs dans le cron, alerte si `scan.total === 0` plusieurs fois
**À implémenter :** Alerting sur échec répété du scanner

### Risque 4 — MOYEN : Coût API Anthropic non maîtrisé
**Probabilité :** Faible si usage normal
**Impact :** Facture mensuelle élevée si MADORE est spammé ou scanner sur-sollicité
**Mitigation :** Rate limiting déjà en place (30 msg/min MADORE, 10 analyses/min Carmelo)
**Surveiller :** console.anthropic.com → Usage

### Risque 5 — MOYEN : Resend sans domaine vérifié
**Probabilité :** Haute si `gp-cars.be` n'est pas configuré rapidement
**Impact :** Emails digest et alertes arrivent en spam ou ne partent pas
**Mitigation :** Vérifier le domaine dans Resend avant le premier déploiement

### Risque 6 — FAIBLE : Single-tenant limitant
**Probabilité :** Faible à court terme
**Impact :** Si Francisco veut ouvrir la plateforme à d'autres garages, refactoring partiel
**Mitigation :** Documenter clairement la dépendance à `NOTIFY_EMAIL`

---

## 8. QUESTIONS À POSER AU CLIENT AVANT DE COMMENCER

### Questions bloquantes (réponses obligatoires J1)

1. **Accès Vercel** — Avez-vous accès admin aux 4 projets Vercel ? Quel est le nom des projets ?
2. **Domaine** — Possédez-vous le domaine `gp-cars.be` ? Avez-vous accès au DNS ?
3. **Historique données** — Combien de véhicules avez-vous achetés/vendus ces 2 dernières années ? Le fichier existe-t-il (Excel, CSV, autre) ?
4. **Budget API** — Quel est le budget mensuel maximum acceptable pour les APIs (Anthropic + ScraperAPI + Resend) ?

### Questions importantes (réponses avant Sprint 2)

5. **Site web existant** — Avez-vous un site web GP-CARS actuel ? Sur quelle plateforme (WordPress, Wix, etc.) ? Avez-vous accès admin ?
6. **GoCar** — Avez-vous déjà contacté data@gocar.be ? Avez-vous un contrat revendeur Auto1 ?
7. **Sources de trafic MADORE** — Comment prévoyez-vous de partager le lien MADORE avec vos prospects (Facebook, site web, WhatsApp, email...) ?
8. **Volume prospects attendu** — Combien de prospects par mois en moyenne ? (Pour dimensionner le plan Resend et anticiper les coûts Haiku)

### Questions de cadrage (réponses avant Sprint 3)

9. **Publication annonces** — Publiez-vous actuellement manuellement sur AutoScout24 ? Voulez-vous que l'application publie automatiquement (nécessite l'API AS24 revendeur) ?
10. **Notifications** — Préférez-vous les alertes par email ou par WhatsApp ?
11. **Accès mobile** — Utilisez-vous le système depuis un smartphone sur le terrain ? (priorité PWA ?)

---

## 9. PLAN DE DÉPLOIEMENT

### Phase 0 — Prérequis (à valider avec client)
- [ ] Accès GitHub au repository (branche `claude/ai-agent-status-QzWo1`)
- [ ] Accès admin Vercel (4 projets)
- [ ] Accès DNS domaine `gp-cars.be`
- [ ] Réponses aux 4 questions bloquantes (section 8)

### Phase 1 — Merge et configuration (J1, ~4h)
```bash
# 1. Créer la PR GitHub
git checkout main
git merge claude/ai-agent-status-QzWo1
git push origin main

# 2. Vérifier que Vercel déclenche le build automatiquement
# Si non → Settings → Git → Redeploy
```

**Variables Vercel à configurer sur les 4 projets :**
```
NOTIFY_EMAIL          = info.gpcars@gmail.com
NEXT_PUBLIC_BASE_URL  = https://[url-production]
CRON_SECRET           = [générer: openssl rand -hex 32]
SCRAPERAPI_KEY        = 80c6ceda6eb1dd8e55b73c4da8800ed9
RESEND_API_KEY        = [depuis resend.com]
RESEND_FROM_EMAIL     = GP-CARS <notifications@gp-cars.be>
```

### Phase 2 — Compte utilisateur et vérification (J2, ~3h)
```
1. Aller sur https://[url]/register
2. Créer le compte : info.gpcars@gmail.com + mot de passe sécurisé
3. Se connecter → vérifier accès stock/carmelo/dashboard
4. Aller sur /api/status → vérifier que tout est "configured: true"
```

### Phase 3 — Test crons (J2, ~1h)
```bash
# Tester le digest manuellement
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" \
  https://[url]/api/cron/daily-digest

# Tester le scanner manuellement
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" \
  https://[url]/api/cron/scanner

# Vérifier réception email digest sur info.gpcars@gmail.com
```

### Phase 4 — Checklist recette complète (J3)
- [ ] Connexion avec `info.gpcars@gmail.com`
- [ ] `/api/status` → tous les champs `configured: true`
- [ ] Analyse d'un véhicule réel via `/carmelo` (lien AS24)
- [ ] Scanner manuel via `/carmelo/scanner` → au moins 1 annonce trouvée
- [ ] Conversation MADORE via `/madore?demo=true` → rapport généré
- [ ] Vrai lead créé via `/madore` → apparaît dans `/gp/leads`
- [ ] Email digest reçu sur `info.gpcars@gmail.com`
- [ ] Dashboard `/gp/dashboard` charge sans erreur
- [ ] Import CSV 3 lignes test via `/carmelo/import`

### Phase 5 — Entraînement (J4-J7)
- [ ] Import historique complet GP-CARS (fichier CSV client)
- [ ] Score mémoire `/gp/training` ≥ 50/100
- [ ] 5 scénarios tests MADORE validés (mode démo)
- [ ] Première semaine de crons automatiques vérifiée (logs Vercel)

---

## 10. ESTIMATION RÉALISTE DE CHARGE DE TRAVAIL

### Développeur professionnel Next.js/TS (niveau senior)

| Phase | Tâche | Charge |
|---|---|---|
| **Sprint 1** | Merge + Vercel + Resend + compte + recette | **8-10h** |
| **Sprint 2** | Entraînement agents + intégration site | **6-8h** |
| **Sprint 3A** | Intégration GoCar B2B (si API disponible) | **8-12h** |
| **Sprint 3B** | Scraper 2ememain.be | **4-6h** |
| **Sprint 3C** | Scraper Auto1 (B2B) | **8-12h** |
| **Sprint 3D** | Scraper Mobile.de | **6-8h** |
| **Sprint 4** | Publication auto annonces (AS24 API) | **10-15h** |
| **Sprint 5** | Widget MADORE + WhatsApp alertes | **8-12h** |
| **Sprint 6** | Monitoring/observabilité/PWA | **10-15h** |

**Total Sprint 1+2 (mise en prod + entraînement) : 14-18h**
**Total projet complet avec extensions prioritaires : 60-90h**

### Points d'attention pour l'estimation client

1. **Le code existant est de qualité** — pas de dette technique majeure, TypeScript strict,
   tests unitaires présents. Le développeur entrant ne perdra pas de temps à déchiffrer
   du mauvais code.

2. **Les Sprints 1+2 sont du DevOps/configuration, pas du développement.** Un développeur
   fullstack sans expérience Vercel/Neon peut prendre le double du temps.

3. **L'intégration GoCar dépend d'un tiers.** Si l'accès API met 2 semaines à arriver,
   ce Sprint est bloqué indépendamment du développeur.

4. **Les scrapers sont fragiles par nature.** Prévoir une maintenance régulière (1-2h/mois)
   si AutoScout24, 2ememain ou Mobile.de changent leur structure.

5. **Le budget API Anthropic doit être clarifié** avant de lancer le scanner quotidien
   sur plusieurs sources en parallèle.

---

## ANNEXES

### A — Structure fichiers complète (référence rapide)
```
lib/carmelo/config.ts          ← PARAMÈTRES MÉTIER GP-CARS (marges, budget, marques)
lib/carmelo/system-prompt.ts   ← Prompt principal Carmelo
lib/carmelo/memory.ts          ← Mémoire RAG (scoring textuel)
lib/madore/system-prompt.ts    ← Prompt MADORE + injection stock
lib/scanner/autoscout24.ts     ← Scraper AS24 (modèle pour nouvelles sources)
lib/scanner/scraper.ts         ← Client HTTP + ScraperAPI proxy
lib/gocar/client.ts            ← Stub GoCar B2B (prêt à brancher)
app/db.ts                      ← TOUTE LA BASE DE DONNÉES (schéma + fonctions)
app/api/carmelo/analyze/       ← Analyse streaming principale
app/api/madore/chat/           ← Chat MADORE streaming
app/api/cron/scanner/          ← Cron scanner 08h00
app/api/cron/daily-digest/     ← Cron digest 06h00
```

### B — Commande de test rapide santé système
```bash
# Depuis navigateur connecté
https://[url]/api/status
# Doit retourner configured: true pour toutes les variables critiques
```

### C — Pour ajouter un nouveau scraper (patron existant)
```typescript
// lib/scanner/[source].ts
export async function scan[Source](pages = 2): Promise<ScanResult> {
  const { fetchPage } = await import('./scraper');
  // 1. Construire URL de recherche
  // 2. Scraper chaque page via fetchPage()
  // 3. Extraire les URLs d'annonces
  // 4. Retourner { listings: [{url}], total, error? }
}
```

---

*Document rédigé le 13 juin 2026*
*Repository : autooccasion/autooccasion-app — Branche : claude/ai-agent-status-QzWo1*
*Ce document doit être lu en conjonction avec CARMELO_V3_MASTER_SPECIFICATION.md*
