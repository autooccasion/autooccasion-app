# Cadrage — Architecture Multi-Tenant (multi-garage)

> Objectif : passer GP-CARS d'« outil interne » à « plateforme SaaS » utilisable par
> plusieurs garages sans mélange de données, avec une configuration métier propre à chacun.
> Document de cadrage — décisions + plan par phases. Date : 2026-06-30.

---

## 1. État réel aujourd'hui (diagnostic)

**Identité :** `User = { id, email, password }`. Aucune notion d'organisation / garage.
Un login = un email = une partition de données.

**Données :** ✅ **Déjà partitionnées par `email`** sur **toutes** les tables (Vehicle, MadoreLead,
Garantie*, Mandat*, Gae*, SystemEvent…). C'est une multi-tenancy *de fait* au niveau données —
le plus dur est déjà là sans le savoir.

**Config métier :** ❌ En dur dans `lib/carmelo/config.ts` (marges, plafonds, marques, frais,
exclusions). Importée à la compilation dans 6+ endroits (system prompts Carmelo & Contrôleur,
`validate.ts`, `db.ts`, `market.ts`). **Identique pour tout le monde.**

**Tâches de fond :** ❌ Crons (`scanner`, `daily-digest`, `stock-review`, `gae-weekly`,
`mandats-relances`, `leads-relances`, `rdv-reminders`) **tous câblés sur un unique
`process.env.NOTIFY_EMAIL`**. Le travail automatique ne tourne que pour **un seul garage**.

**Chatbot public :** ❌ `MADORE /api/madore/chat` résout le stock via `process.env.NOTIFY_EMAIL`.
Tous les leads d'où qu'ils viennent atterrissent chez **un seul garage**.

### Les 3 verrous durs

| # | Verrou | Conséquence si on vend à 2 garages aujourd'hui |
|---|--------|------------------------------------------------|
| V1 | Config compile-time globale | Garage B hérite des marges/marques de GP-CARS |
| V2 | Crons sur `NOTIFY_EMAIL` unique | Les agents de fond ne tournent que pour GP-CARS |
| V3 | MADORE public sur `NOTIFY_EMAIL` unique | Les leads du site du Garage B vont chez GP-CARS |

**La couche données (scoping `email`) n'est PAS un verrou — elle est déjà prête.**

---

## 2. La décision structurante : « qu'est-ce qu'un tenant ? »

C'est LA décision qui conditionne tout le reste.

### Option A — Tenant = email (le partitionnement actuel)

Le tenant est l'email déjà présent partout. On introduit une table `GarageConfig`
keyée par `email`. Pas de changement d'identité.

- ✅ **Zéro migration de données** (l'email est déjà la clé partout)
- ✅ Rapide — réutilise le pattern Garantie (`build…Prompt(config)`)
- ✅ Débloque V1 immédiatement, V2/V3 ensuite par itération sur la liste des emails-garages
- ❌ **Un garage = un seul login partagé** par toute l'équipe (pas d'identité par employé)
- ❌ Pas de rôles/permissions internes (vendeur vs patron vs mécano)

### Option B — Modèle Organisation (vrai SaaS)

Table `Organization` (le garage) + `User.organizationId`. Données scopées par `orgId`.
Plusieurs employés par garage, rôles, permissions.

- ✅ Modèle SaaS « propre », multi-utilisateurs, rôles
- ✅ Indispensable à terme pour vendre à des groupes / garages avec équipe
- ❌ **Migration lourde** : remplacer `email` par `orgId` comme clé de scoping sur ~15 tables
- ❌ Touche chaque requête DB, l'auth, les crons, MADORE
- ❌ 3–5× l'effort de l'Option A pour une valeur client identique au lancement

### Recommandation : **A maintenant, B quand le besoin réel apparaît**

L'Option A débloque **100 % de la valeur commerciale du Sprint 1** (chaque garage a SA config,
SES données isolées, SES agents qui tournent) pour une fraction de l'effort et **sans aucune
migration de données risquée**. Le multi-utilisateur (Option B) n'est requis que lorsqu'un
garage client demande plusieurs comptes avec rôles — ça se vend très bien **après** la première
vague de clients mono-compte. On garde `email` comme clé de tenant ; migrer vers `orgId` plus
tard restera possible (l'email deviendra un attribut de l'Organisation).

> Principe : ne pas reconstruire l'identité avant d'avoir un client qui paie pour le multi-utilisateur.

---

## 3. Plan par phases (Option A)

### Phase 1 — Config par garage *(débloque V1)* — **le cœur du Sprint 1**

**But :** sortir `lib/carmelo/config.ts` du compile-time vers une config par tenant,
avec valeurs par défaut + overrides en base.

1. Table `GarageConfig` (keyée `email`) : marges, plafonds, budget/jour, seuil confiance,
   marques préférées, exclusions, postes de frais, coussin négociation. Tous nullable →
   `NULL` = on prend la valeur par défaut.
2. `DEFAULT_GARAGE_CONFIG` : les valeurs actuelles de `config.ts` deviennent les défauts typés.
3. `getGarageConfig(email)` : lit la base, fusionne sur les défauts, renvoie un objet typé.
4. Refactor des consommateurs vers l'injection (pattern **déjà éprouvé avec Garantie**) :
   - `buildCarmeloSystemPrompt(config)` au lieu d'importer les globals
   - `buildControllerSystemPrompt(config)`, `validate(config)`, `market.ts`
   - `db.ts` : `PLANCHER_FRAIS` calculé depuis la config (ou laissé en défaut)
5. Écran `/gp/settings` (ou onglet Formation) : éditer la config de SON garage.

**Risque :** faible. Les défauts reproduisent le comportement actuel à l'identique → si un
garage ne configure rien, **rien ne change**. Couvert par les tests existants (`config.test.ts`).
**Effort :** ~1 semaine.

### Phase 2 — Crons & MADORE multi-tenant *(débloque V2 + V3)*

1. `getActiveTenants()` : liste des emails-garages actifs (depuis `User` ou `GarageConfig`).
2. Chaque cron itère sur les tenants au lieu de lire `NOTIFY_EMAIL` :
   `for (const t of tenants) { …work scoped to t… }`. Email de notif = champ du tenant,
   plus `process.env`.
3. MADORE public résout le tenant depuis la requête (sous-domaine, `?site=`, ou un
   `siteId` mappé en base) au lieu de `NOTIFY_EMAIL`.
4. `NOTIFY_EMAIL` devient un *fallback* mono-tenant (rétrocompat), plus la source de vérité.

**Risque :** moyen. Les crons changent de boucle ; bien borner les temps d'exécution
(Vercel) en cas de nombreux tenants → traiter par lots. **Effort :** ~1 semaine.

### Phase 3 (différée) — Organisation & multi-utilisateur *(Option B)*

Quand un client paie pour plusieurs comptes : table `Organization`, `User.organizationId`,
rôles (patron / vendeur / mécano), bascule progressive du scoping `email` → `orgId`
(l'email reste la clé du tenant tant que la migration n'est pas faite). **Effort :** 3–5 semaines.
**À ne lancer que sur demande client réelle.**

---

## 4. Isolation & sécurité (transversal, à verrouiller dès Phase 1)

- ✅ **Déjà bon :** chaque requête filtre par `email` (`where email = session.user.email`).
- ⚠️ **À auditer systématiquement :** qu'AUCUNE requête ne lise sans filtre tenant. Ajouter
  un test d'isolation (créer 2 tenants, vérifier qu'aucun ne voit les données de l'autre).
- ⚠️ **Crons (Phase 2) :** le scoping passe d'`env` à une boucle → risque de fuite si un appel
  oublie le filtre. Test d'isolation obligatoire.
- 🔒 **Secrets :** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc. restent globaux (plateforme),
  jamais par tenant. La clé API d'un garage ne doit jamais transiter en base.

---

## 5. Ce qui NE change PAS (rassurant)

- Le schéma data existant (colonnes `email` partout) — **conservé tel quel**.
- Les analyses, le dashboard, le tableau de preuve — fonctionnent à l'identique.
- Le comportement par défaut d'un garage non configuré = comportement actuel de GP-CARS.
- Le pattern d'injection de config est **déjà prouvé** (Garantie `ruleset`).

---

## 6. Décision attendue avant de coder

**Question unique et bloquante :** valide-t-on l'**Option A** (tenant = email, config par garage,
multi-utilisateur reporté) comme base du Sprint 1 ?

- Si **oui** → je démarre la Phase 1 (table `GarageConfig` + `getGarageConfig` + refactor
  Carmelo/Contrôleur en injection + écran settings).
- Si **non** (on veut le modèle Organisation tout de suite) → on planifie un chantier de
  3–5 semaines avant toute nouvelle vente, et je détaille la migration `email → orgId`.

> Recommandation ferme : **Option A**. Elle rend la plateforme vendable à plusieurs garages
> en ~2 semaines, sans migration risquée, et laisse la porte ouverte à l'Option B plus tard.
