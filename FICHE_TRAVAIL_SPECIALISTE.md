# FICHE DE TRAVAIL — GP-CARS
## Mise en production de la plateforme IA

**Client :** GP-CARS (Francisco Gomez) — Soumagne, Belgique
**Email professionnel :** info.gpcars@gmail.com
**Date :** juin 2026
**Repository :** autooccasion/autooccasion-app (GitHub privé)
**Branche à déployer :** `claude/ai-agent-status-QzWo1`

---

## CONTEXTE

La plateforme GP-CARS est une application web Next.js 14 complète avec plusieurs agents IA intégrés. Le code est **100% terminé et pushé** sur la branche indiquée. Il reste uniquement la mise en production, la configuration des services tiers et les tests end-to-end.

---

## STACK TECHNIQUE

| Élément | Technologie |
|---|---|
| Framework | Next.js 14 App Router (TypeScript) |
| UI | Tailwind CSS |
| Base de données | PostgreSQL (Neon — serverless) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 (credentials) |
| IA | Anthropic Claude API (Opus 4.8 + Haiku 4.5) |
| Hébergement | Vercel (4 projets) |
| Emails | Resend API |
| Scraping | ScraperAPI (proxy headless Chrome) |

---

## CE QUI EST DÉJÀ FAIT (code terminé)

### Agents IA
- **CARMELO** — Analyse d'achat de véhicules (Claude Opus, streaming, V3)
- **Contrôleur** — Validation automatique post-analyse (règles dures)
- **Marketing** — Rédaction d'annonces automatique (Claude Haiku)
- **Scanner** — Scraping AutoScout24 + analyse batch quotidienne
- **MADORE** — Agent commercial IA pour qualifier les prospects

### Interface GP-CARS (interne)
- `/gp/stock` — Gestion du stock complet
- `/gp/dashboard` — KPIs et analytics
- `/gp/leads` — Tableau de bord des leads MADORE
- `/gp/vehicle/[id]` — Fiche détail véhicule

### Interface Carmelo (interne)
- `/carmelo` — Analyse manuelle
- `/carmelo/scanner` — Lancement scanner
- `/carmelo/marche` — Étude de marché
- `/carmelo/opportunites` — Suivi opportunités
- `/carmelo/history` — Historique analyses
- `/carmelo/import` — Import CSV historique

### Interface publique
- `/madore` — Chat conseiller commercial (accessible sans connexion)

### Infrastructure
- Cron quotidien 06h00 — Digest email récapitulatif
- Cron quotidien 08h00 — Scanner AutoScout24 automatique
- Alertes email immédiates si opportunité détectée
- Endpoint `/api/status` — Vérification config

---

## TRAVAIL À RÉALISER PAR LE SPÉCIALISTE

### 1. MERGE ET DÉPLOIEMENT (priorité absolue)

```
Branche source : claude/ai-agent-status-QzWo1
Branche cible  : main
```

- Créer une Pull Request de `claude/ai-agent-status-QzWo1` vers `main`
- Vérifier qu'il n'y a pas de conflits
- Merger
- Vérifier que Vercel déclenche le déploiement automatiquement sur les 4 projets

---

### 2. CONFIGURATION VERCEL — VARIABLES D'ENVIRONNEMENT

À configurer sur **chacun des 4 projets Vercel** (Settings → Environment Variables) :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `NOTIFY_EMAIL` | `info.gpcars@gmail.com` | ✅ Critique |
| `NEXT_PUBLIC_BASE_URL` | URL de production (ex: `https://app.gp-cars.be`) | ✅ Critique |
| `SCRAPERAPI_KEY` | `80c6ceda6eb1dd8e55b73c4da8800ed9` | ✅ Scanner |
| `CRON_SECRET` | Valeur secrète à générer (ex: uuid) | ✅ Sécurité |
| `RESEND_API_KEY` | Voir section Resend ci-dessous | ✅ Emails |
| `RESEND_FROM_EMAIL` | `GP-CARS <notifications@gp-cars.be>` | ✅ Emails |
| `ANTHROPIC_API_KEY` | Déjà configuré normalement | Vérifier |
| `POSTGRES_URL` | Déjà configuré normalement | Vérifier |

> **Important :** `NOTIFY_EMAIL` doit être `info.gpcars@gmail.com` sur tous les projets sans exception.

---

### 3. CRÉATION COMPTE RESEND (envoi d'emails)

1. Créer un compte sur **resend.com** (gratuit jusqu'à 3 000 emails/mois)
2. Ajouter et vérifier le domaine `gp-cars.be` (ou domaine existant du client)
3. Créer une clé API → coller dans `RESEND_API_KEY`
4. Configurer l'expéditeur → `RESEND_FROM_EMAIL`
5. Tester l'envoi via `/api/cron/daily-digest` (appel manuel avec le header `Authorization: Bearer CRON_SECRET`)

---

### 4. CRÉATION DU COMPTE UTILISATEUR GP-CARS

L'application utilise une authentification par email/mot de passe.
Il faut créer le compte administrateur en base :

- **Email :** `info.gpcars@gmail.com`
- **Mot de passe :** à définir par le client (communiqué de façon sécurisée)

Via l'interface `/login` → créer le compte, ou directement via l'endpoint d'inscription si existant.

---

### 5. DOMAINE PERSONNALISÉ (optionnel mais recommandé)

Configurer un domaine propre sur Vercel :
- `app.gp-cars.be` ou `gestion.gp-cars.be` → application principale
- `conseiller.gp-cars.be` → redirection vers `/madore` (page publique MADORE)

---

### 6. INTÉGRATION MADORE SUR LE SITE WEB GP-CARS

La page `/madore` est publique et prête à partager.
Deux options pour l'intégrer sur le site existant :

**Option A — Lien direct**
Ajouter un bouton "Parler à un conseiller" pointant vers `https://app.gp-cars.be/madore`

**Option B — iFrame embed**
```html
<iframe
  src="https://app.gp-cars.be/madore"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius:12px"
></iframe>
```

---

### 7. IMPORT DE L'HISTORIQUE GP-CARS

Pour que les agents IA (Carmelo + MADORE) bénéficient de la mémoire historique :

1. Le client prépare un fichier CSV de ses transactions passées
2. Import via `/carmelo/import` (interface disponible)
3. Colonnes : `marque, modele, annee, km, carburant, boite, couleur, prix_demande, prix_achat_reel, prix_vente_reel, jours_en_stock, date_achat, date_vente, statut`
4. Template téléchargeable directement sur la page

---

### 8. TEST END-TO-END (checklist de recette)

- [ ] Connexion avec `info.gpcars@gmail.com`
- [ ] Analyse d'un véhicule via `/carmelo` (lien AutoScout24)
- [ ] Scanner manuel via `/carmelo/scanner`
- [ ] Conversation MADORE via `/madore` → vérifier que le lead apparaît dans `/gp/leads`
- [ ] Appel manuel du digest : `GET /api/cron/daily-digest` avec header `Authorization: Bearer CRON_SECRET`
- [ ] Vérification réception email digest sur `info.gpcars@gmail.com`
- [ ] Import CSV test (1-2 lignes)
- [ ] Vérification `/api/status` → toutes les variables au vert

---

## TRAVAIL FUTUR (hors scope immédiat)

| Tâche | Description | Effort estimé |
|---|---|---|
| Intégration GoCar B2B | API prix marché belge temps réel — contact: data@gocar.be | 1-2 jours |
| Widget MADORE embeddable | Script JS standalone pour site externe | 1 jour |
| Notifications WhatsApp | Alertes leads chauds via WhatsApp Business API | 2 jours |
| Application mobile | PWA ou React Native pour gestion stock terrain | 5-10 jours |

---

## CONTACTS SERVICES TIERS

| Service | Usage | Contact/URL |
|---|---|---|
| Vercel | Hébergement | vercel.com |
| Neon | Base de données PostgreSQL | neon.tech |
| Anthropic | API Claude (IA) | console.anthropic.com |
| Resend | Envoi emails transactionnels | resend.com |
| ScraperAPI | Scraping AutoScout24 | scraperapi.com |
| GoCar | Données marché belge (futur) | data@gocar.be |

---

## ESTIMATION TRAVAIL

| Tâche | Durée estimée |
|---|---|
| Merge branche + vérification déploiement | 1h |
| Configuration variables Vercel (4 projets) | 1h |
| Création compte Resend + vérification domaine | 2h |
| Création compte utilisateur GP-CARS | 30min |
| Configuration domaine personnalisé Vercel | 1h |
| Intégration MADORE sur site existant | 1h |
| Tests end-to-end + recette | 2h |
| **TOTAL** | **~8-9h** |

---

*Document généré le 10 juin 2026 — GP-CARS / autooccasion-app*
