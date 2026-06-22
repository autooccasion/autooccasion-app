# DÉCLARATION DE PROPRIÉTÉ INTELLECTUELLE
## Projet « Agents IA Automobile » — GP-CARS

**Bénéficiaire / Titulaire des droits :** GP-CARS (Soumagne, Belgique)
**Date :** 22 juin 2026
**Objet :** Application web d'agents IA pour l'achat, la vente et le contrôle de véhicules d'occasion (dépôt `autooccasion/autooccasion-app`).

> ⚠️ **Note** : ce document est un modèle factuel à valeur informative. Il doit être
> relu, complété (identités, dates, signatures) et validé par un conseil juridique
> avant signature. Il constitue une base à faire contresigner par tout
> développeur ou prestataire ayant contribué au projet.

---

## 1. ÉLÉMENTS PROPRIÉTÉ EXCLUSIVE DE GP-CARS

Les parties conviennent que les éléments suivants ont été conçus à partir du
savoir-faire métier de GP-CARS et en sont la **propriété exclusive et définitive** :

### 1.1 Règles et savoir-faire métier
- Les seuils de marge (paliers standard et premium).
- Le plafond d'achat par véhicule et le budget journalier.
- La liste des marques préférées.
- La liste des exclusions absolues (motorisations, états, couleurs).
- La liste noire des motorisations à risque (PSA PureTech, Renault 1.2 TCe,
  Ford 1.0 EcoBoost, Mercedes OM651, VW DSG DQ200, etc.).
- Les barèmes de frais (CT/Car-Pass, préparation, publicité, pneus, freins, etc.).

### 1.2 Modèles d'analyse et de décision
- Le **Score Carmelo** à 7 dimensions et sa pondération.
- Les seuils de décision OR / VERT / ORANGE / ROUGE.
- Les algorithmes de calcul de marge, de rotation et de risque mécanique.
- La logique de réconciliation des décisions.

### 1.3 Prompts et contenus des agents
- L'ensemble des prompts système des agents (Achats, Marketing, Contrôleur).
- Les formats de sortie et les gabarits d'annonces.

### 1.4 Données
- Toutes les données saisies, générées, calculées ou collectées par l'application.
- L'intégralité du contenu des bases de données (analyses, véhicules,
  opportunités, historique, événements).

### 1.5 Code source spécifique
- Tout le code applicatif développé spécifiquement pour GP-CARS dans ce dépôt.

**Aucun de ces éléments ne peut être réutilisé, revendu, licencié, reproduit,
ni exploité pour un tiers (notamment un autre garage ou concurrent) sans accord
écrit préalable de GP-CARS.**

---

## 2. BIBLIOTHÈQUES TIERCES (LICENCES LIBRES)

Le projet s'appuie sur des bibliothèques open-source publiques, qui **ne sont la
propriété de personne en exclusivité** et sont utilisées sous licence libre
(principalement MIT). Elles ne sont pas couvertes par la clause d'exclusivité
ci-dessus, leur usage étant libre et gratuit :

| Bibliothèque | Rôle | Licence |
|--------------|------|---------|
| Next.js / React | Cadre applicatif et interface | MIT |
| Drizzle ORM | Accès base de données | Apache-2.0 |
| NextAuth.js | Authentification | ISC |
| Tailwind CSS | Styles | MIT |
| postgres.js | Connexion PostgreSQL | Unlicense |
| @anthropic-ai/sdk | Appels à l'IA Claude | MIT |
| bcrypt-ts | Hachage des mots de passe | MIT |

Les services Anthropic (Claude) et Resend (emails) sont des services externes
utilisés via abonnement payant souscrit par GP-CARS.

---

## 3. ÉLÉMENTS ÉVENTUELLEMENT RÉUTILISABLES PAR LE DÉVELOPPEUR

À compléter et négocier explicitement. Par défaut, et sauf accord écrit contraire :

- Le développeur **ne conserve aucun droit** sur les éléments listés en section 1.
- Le développeur peut réutiliser uniquement son savoir-faire générique
  (techniques de programmation génériques, non spécifiques au métier GP-CARS),
  ce qui n'inclut **jamais** les règles, prompts, scoring ou données de GP-CARS.

---

## 4. ENGAGEMENT

Le(s) développeur(s) / prestataire(s) signataire(s) déclare(nt) :
- Céder à GP-CARS l'intégralité des droits patrimoniaux sur les éléments de la section 1.
- N'avoir conservé aucune copie des données de GP-CARS hors du cadre du projet.
- S'interdire toute réutilisation des éléments de la section 1 pour un tiers.

---

| Pour GP-CARS | Pour le développeur / prestataire |
|--------------|-----------------------------------|
| Nom : ........................... | Nom : ........................... |
| Date : .......................... | Date : .......................... |
| Signature : ..................... | Signature : ..................... |
