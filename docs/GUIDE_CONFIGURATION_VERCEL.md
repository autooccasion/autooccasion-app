# GUIDE DE CONFIGURATION — pas à pas
## Mettre la plateforme GP-CARS en ligne et activer les agents IA

Ce guide est écrit pour être suivi **sans connaissances techniques**.
Comptez **1 à 2 heures**. Vous aurez besoin de 4 informations à coller dans Vercel.

---

## ÉTAPE 1 — Créer la base de données (gratuit)

La base de données est l'endroit où Carmelo se souvient de tout (analyses,
véhicules, historique). On utilise **Neon** (gratuit, recommandé).

1. Allez sur **https://neon.tech** → cliquez **« Sign up »** (créez un compte avec votre email).
2. Cliquez **« Create a project »**. Donnez un nom : `gp-cars`.
3. Choisissez la région **« Europe (Frankfurt) »** (la plus proche de la Belgique).
4. Une fois créé, Neon affiche une **« Connection string »** qui ressemble à :
   ```
   postgresql://user:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/gp-cars
   ```
5. **Copiez cette ligne entière.** C'est votre `POSTGRES_URL`. Gardez-la de côté.

---

## ÉTAPE 2 — Récupérer votre clé IA Anthropic

C'est le cerveau des agents. Vous avez déjà votre clé `sk-ant-...`.
Si vous l'avez perdue :
1. Allez sur **https://console.anthropic.com**
2. Menu **« API Keys »** → **« Create Key »**
3. Copiez la clé (`sk-ant-...`). C'est votre `ANTHROPIC_API_KEY`.

> ⚠️ Cette clé est secrète. Ne la partagez avec personne, ne la mettez jamais
> dans un email ou un message. Elle se colle **uniquement** dans Vercel (étape 4).

---

## ÉTAPE 3 — Générer le code de sécurité (AUTH_SECRET)

NextAuth a besoin d'une longue chaîne aléatoire pour sécuriser les connexions.

1. Allez sur **https://generate-secret.vercel.app/32**
2. La page affiche une suite de 32 caractères aléatoires. **Copiez-la.**
   C'est votre `AUTH_SECRET`.

---

## ÉTAPE 4 — Coller les clés dans Vercel

1. Allez sur **https://vercel.com** → connectez-vous → ouvrez le projet **`autooccasion-app`**.
2. En haut, cliquez sur l'onglet **« Settings »**.
3. Dans le menu de gauche, cliquez **« Environment Variables »**.
4. Ajoutez ces variables une par une (champ **Key** = le nom, champ **Value** = la valeur copiée) :

   | Key (nom exact) | Value (ce que vous collez) |
   |-----------------|----------------------------|
   | `POSTGRES_URL` | la ligne de Neon (étape 1) |
   | `ANTHROPIC_API_KEY` | votre clé `sk-ant-...` (étape 2) |
   | `AUTH_SECRET` | les 32 caractères (étape 3) |
   | `RESEND_API_KEY` | *(optionnel — pour les emails, voir étape 6)* |

   Pour chaque variable : laissez les 3 cases cochées (Production, Preview, Development),
   puis cliquez **« Save »**.

---

## ÉTAPE 5 — Relancer le déploiement

1. Toujours dans Vercel, onglet **« Deployments »** (en haut).
2. Sur le déploiement le plus récent, cliquez les **« … »** à droite → **« Redeploy »**.
3. Attendez 1-2 minutes que le statut passe au **vert (Ready)**.
4. Cliquez sur **« Visit »** : votre application est en ligne ! 🎉

L'adresse sera du type **`https://autooccasion-app.vercel.app`**.
- Carmelo : `…/carmelo`
- Stock : `…/gp/stock`
- Tableau de bord : `…/gp/dashboard`

> Au premier démarrage, créez votre compte sur `…/register`, puis connectez-vous.
> (Carmelo `/carmelo` est accessible même sans compte.)

---

## ÉTAPE 6 — (Optionnel) Activer les emails quotidiens

Pour recevoir le résumé matinal des opportunités :
1. Créez un compte sur **https://resend.com** (gratuit).
2. Menu **« API Keys »** → **« Create API Key »** → copiez la clé.
3. Ajoutez-la dans Vercel (étape 4) sous le nom `RESEND_API_KEY`.
4. Optionnel : ajoutez `NOTIFY_EMAIL` avec votre adresse pour recevoir le digest.

---

## EN CAS DE PROBLÈME

- **Le build reste rouge (Error)** : ouvrez le déploiement → onglet « Building »
  → lisez la dernière ligne rouge et envoyez-la moi, je la corrige.
- **« Clé API non configurée »** : la variable `ANTHROPIC_API_KEY` est mal nommée
  ou mal collée — revérifiez l'orthographe exacte à l'étape 4.
- **Page blanche / erreur 500** : souvent `POSTGRES_URL` incorrecte. Recopiez-la
  depuis Neon sans espace au début ni à la fin.
