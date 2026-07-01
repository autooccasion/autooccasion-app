# Audit approfondi — Agent Garantie GP-CARS

> Audit critique et sans concession. Objectif : trouver les limites, les manques, les risques
> (techniques + juridiques) et les leviers pour en faire une référence SaaS européenne.
> Angle : expert SAV auto + droit belge/UE de la consommation + IA appliquée. Date : 2026-06-30.

---

## 0. Les 3 vérités inconfortables (à lire d'abord)

1. **La conversation client conçue n'existe pas dans le produit.** Le system prompt est bâti pour un
   dialogue en deux phases (recueil → évaluation), en FR/NL, avec le client. **Or il n'y a aucun canal
   client.** Aujourd'hui, **un employé remplit un formulaire** (`GarantieClient.tsx`) et l'agent
   analyse ce formulaire. La phase « recueil » — le cœur de l'expérience — **ne tourne nulle part.**
   C'est le plus grand écart entre le design et la réalité.

2. **L'« apprentissage continu » est fictif.** Le ruleset est **versionné à la main** par Jean-François.
   Aucun dossier ne nourrit l'agent en retour. Pas de base de connaissances, pas de mémoire des pannes,
   pas de détection de défauts récurrents. L'agent ne s'améliore **pas** avec l'usage.

3. **L'agent décide sans le diagnostic de l'atelier.** Le contrat dit qu'il *lit* `AtelierIntervention`,
   mais la route `analyze` **n'utilise aucune donnée atelier**. Il statue sur une garantie **sans le
   diagnostic réel du mécanicien** — l'information la plus importante pour trancher. C'est un angle mort
   technique majeur.

---

## 1. Analyse de l'existant (par catégorie, avec maturité)

| Catégorie | Ce qui existe | Maturité /5 | Limite principale |
|-----------|---------------|:-----------:|-------------------|
| Ouverture de dossier | Formulaire staff (véhicule, vente, réclamation, usage) | 4 | Saisie **manuelle** par l'employé, pas par le client |
| Communication client | Génération email/WhatsApp/refus/transaction (FR/NL) + envoi email (Resend) | 3 | Textes générés mais **envoi WhatsApp = copier-coller** ; pas de dialogue |
| Collecte automatique d'infos | **Conçue (phase recueil) mais non branchée** | 1 | Aucun canal client — la phase recueil ne s'exécute pas |
| Analyse de panne | Analyse LLM du texte de réclamation | 2 | **Sans diagnostic atelier, sans photo, sans historique technique** |
| Vérification des garanties | Ruleset versionné (durées, présomption 6 mois, éligibilité) | 4 | Ruleset **statique**, BE uniquement |
| Calcul de vétusté | Formule km/temps par pièce, seuils du ruleset | 4 | Seuils **génériques**, pas calibrés sur les pannes réelles |
| Prise de décision | A/B/C/D, séquence d'évaluation, `requires_human_validation` | 4 | Solide — le meilleur point de l'agent |
| Génération de réponses | Email client FR/NL, lettre refus, proposition transaction | 4 | Bon, mais non contextualisé par un vrai échange |
| Assistance technicien | **Quasi inexistante** | 1 | L'agent ne parle pas au mécano, ne lit pas son diagnostic |
| Assistance responsable SAV | Scores de risque (juridique/financier/litige), package litige | 3 | Pas de vue portefeuille, pas de priorisation multi-dossiers |
| Apprentissage continu | **Inexistant** (ruleset manuel) | 0 | Aucune boucle d'apprentissage |
| Statistiques | **Inexistantes** | 0 | Aucun dashboard SAV |
| Reporting | **Inexistant** | 0 | Aucun rapport périodique |
| Conformité juridique | CDE belge + Directive 2019/771 encodés, garde-fous humains | 4 | BE seulement, pas de jurisprudence, pas de veille |

**Synthèse maturité :** excellent sur **décision + conformité + garde-fous** (le squelette juridique
est solide et bien pensé). Faible-à-nul sur **collecte réelle, diagnostic technique, apprentissage,
stats, reporting** — c'est-à-dire tout ce qui transforme un « analyseur de formulaire » en véritable
système SAV.

---

## 2. Fonctionnalités manquantes (le meilleur agent garantie au monde)

**Collecte & entrée du dossier**
- **Canal client réel** : le client ouvre lui-même son dossier via WhatsApp / portail / QR code sur
  la facture → la phase recueil s'exécute enfin.
- **Photos / vidéos du défaut** + analyse par vision (fuite, voyant, usure, carrosserie).
- **Enregistrement audio du bruit** (démarrage, freinage) → indice diagnostic.
- **Import automatique** de la facture, du Car-Pass, du carnet d'entretien (OCR).

**Diagnostic**
- **Branchement du diagnostic atelier** (obligatoire) : lire `AtelierIntervention` réellement.
- **Diagnostic différentiel multi-hypothèses** avec probabilités (voir §4).
- **Base de pannes récurrentes par modèle/motorisation** (ex. « ce moteur casse souvent la chaîne à
  120 000 km »).
- **Estimation du coût de réparation** avant décision.

**Décision & juridique**
- **Bibliothèque de jurisprudence** belge/UE consultable et citée.
- **Précédents internes** : « voici 3 dossiers similaires que vous avez tranchés, et leur issue ».
- **Simulateur d'issue de litige** (probabilité + coût espéré) — déjà esquissé via les scores, à
  fiabiliser sur données réelles.

**Suivi & expérience**
- **Portail client de suivi en temps réel** (statut du dossier, étapes, délais légaux).
- **Relances automatiques des délais légaux** (ne pas laisser filer une prescription).
- **Signature électronique** des accords transactionnels.
- **Enquête de satisfaction** post-résolution (NPS SAV).

**Pilotage**
- **Dashboard SAV** : dossiers ouverts, litiges, coût SAV, délai moyen, taux de résolution.
- **Détection fournisseurs/pièces problématiques** (voir §8).
- **Reporting automatique** (hebdo/mensuel) à la direction.

**Apprentissage**
- **Boucle d'apprentissage** : chaque dossier clos alimente les seuils de vétusté, les pannes
  récurrentes, la calibration des scores.

---

## 3. Parcours SAV — étape par étape

| Étape | Aujourd'hui | Pourrait faire | Automatisable | Reste humain |
|-------|-------------|----------------|---------------|--------------|
| Constat du problème | Client appelle/passe | Ouverture self-service (WhatsApp/QR) 24/7 | Oui | — |
| Recueil des faits | **Employé remplit un formulaire** | Dialogue IA FR/NL avec le client + photos | Oui | Validation des faits |
| Diagnostic technique | Absent de l'agent | Lire diagnostic atelier + hypothèses + coût | Partiel | **Diagnostic mécano** |
| Qualification garantie | LLM + ruleset (bon) | + jurisprudence + précédents | Oui | — |
| Décision A/B/C/D | LLM propose, humain tranche | Idem + simulateur litige | Proposition | **Décision (C/D)** |
| Communication client | Génère, envoie l'email | Dialogue continu, suivi temps réel | Oui | **Refus définitif** |
| Réparation | Hors agent | Créer l'intervention atelier auto | Oui | Exécution méca |
| Clôture | Statut manuel | Enquête satisfaction + archivage + apprentissage | Oui | — |
| Litige | Package litige généré | + simulateur + dossier prêt avocat | Oui | **Stratégie juridique** |

**Verdict parcours :** l'agent couvre bien **qualification → décision → communication**, mais laisse
**vides les deux extrémités** (collecte client en amont, réparation/clôture/apprentissage en aval).

---

## 4. IA — raisonnements à intégrer

Les LLM modernes (Claude en tête pour le raisonnement juridique, modèles vision pour les photos)
permettent d'ajouter, tout de suite :

- **Diagnostic multi-hypothèses** : lister 3-4 causes possibles, chacune avec une **probabilité** et
  les vérifications pour trancher (« si X alors garantie, si Y alors usure »).
- **Estimation de probabilité de panne** à partir de la base de pannes par modèle.
- **Détection d'incohérences** : réclamation vs km vs date vs historique (ex. « défaut signalé après
  20 000 km depuis la vente = présomption affaiblie »).
- **Explicabilité** : l'agent expose déjà sa motivation (bien) → aller vers « voici les 3 textes du
  ruleset appliqués et pourquoi ».
- **Apprentissage par dossier** : agrégation statistique (pas fine-tuning) — chaque issue réelle
  ajuste les seuils et enrichit les précédents.

**Point critique :** aujourd'hui l'agent fait un **raisonnement mono-hypothèse** sur un texte de
réclamation. Le passage au **différentiel multi-hypothèses avec probabilités** est le plus gros saut
de qualité de diagnostic possible — et il est faisable immédiatement.

---

## 5. Vision « Garage du futur » (2035)

- Le client filme le défaut → **vision IA** pré-diagnostique avant même l'arrivée à l'atelier.
- **Télémétrie véhicule** (données connectées) → l'agent voit les codes défaut réels, pas le récit.
- **Jumeau numérique** du véhicule (historique complet pièces/interventions) → décision garantie
  instantanée et incontestable.
- **Résolution prédictive** : l'agent alerte *avant* la panne (« cette pièce va lâcher, proposez un
  geste commercial préventif »).
- **Négociation assistée** : l'agent propose le geste optimal (réparation vs participation vs refus)
  qui minimise coût **+** risque de litige **+** perte de réputation, calibré sur les données réelles.

---

## 6. Communication client — expérience exceptionnelle

- **WhatsApp Business** : ouverture de dossier, dialogue de recueil, suivi, notifications — le canal
  n°1 en Belgique. *Aujourd'hui : copier-coller manuel.*
- **Portail de suivi temps réel** : « votre dossier est à l'étape 3/5, réponse sous 48h ».
- **Transparence proactive** : notifier chaque changement d'état sans que le client relance.
- **Ton empathique calibré** : ni juridique ni froid — l'agent le fait déjà bien, à préserver.
- **Enquête de satisfaction** automatique post-clôture.

---

## 7. Communication interne (inter-agents)

| Échange | Aujourd'hui | Devrait être |
|---------|-------------|--------------|
| Garantie ↔ Atelier | **Absent en pratique** | Lire le diagnostic ; créer l'intervention réparation automatiquement |
| Garantie → Achat (Carmelo) | Absent | « Ce modèle génère beaucoup de SAV → prudence à l'achat » (signal qualité !) |
| Garantie → Marketing | Absent | Un litige en cours = ne pas republier / suspendre |
| Garantie → Contrôleur | Absent | Faire valider les refus (D) par le garde-fou avant envoi |
| Garantie → Direction | Absent | Reporting litiges + coût SAV |

**Insight fort :** le SAV est une **mine de signaux qualité pour l'achat**. Un modèle qui casse
souvent devrait **remonter vers Carmelo** (« attention à l'achat »). Cette boucle Garantie→Achat
n'existe pas et serait un différenciateur unique.

---

## 8. Base de connaissances évolutive

Tout est **à construire** (aujourd'hui : rien). Possible et à fort ROI :
- Mémoriser **toutes les réparations** (via Atelier) et les **issues de dossiers**.
- **Pannes similaires** : retrouver les cas passés comparables → décision cohérente.
- **Défauts récurrents par modèle/motorisation** → alimente diagnostic + achat.
- **Fournisseurs/pièces problématiques** : taux de re-panne par référence/fournisseur.
- **Statistiques prédictives** : « ce modèle à ce km → 30 % de risque embrayage ».

C'est le **moat data** de l'agent : un garage seul a peu de dossiers, mais **agrégés (multi-tenant
anonymisé), les défauts récurrents deviennent une base que personne ne peut copier**.

---

## 9. Analyse juridique

- **Existant (bon) :** CDE belge Art. VI.7–VI.10, Directive 2019/771/UE, loi 20/11/2022, présomption
  6 mois, éligibilité acheteur, exclusions, voies de recours. Garde-fous humains sur C/D.
- **Manquant :**
  - **Jurisprudence** consultable et citée (aujourd'hui : aucune).
  - **Veille légale** : le ruleset est figé — qui le met à jour quand la loi change ?
  - **Multi-pays** : BE uniquement → **plafond de marché**. Étendre FR (Code de la consommation,
    garantie légale de conformité 2 ans) et NL pour élargir.
  - **Distinction garantie légale / commerciale** plus fine (extensions payantes, garanties
    constructeur résiduelles).
- **Principe à préserver (excellent) :** « la machine instruit, l'humain tranche » — jamais de refus
  définitif ou de position juridique contraignante sans validation humaine. **Ne jamais lâcher ça** :
  c'est à la fois la conformité et l'argument de confiance.

---

## 10. Priorisation (notation /10)

| Amélioration | Impact co. | Impact client | Impact SAV | Diff. tech | Coût dev | ROI |
|--------------|:---------:|:-------------:|:----------:|:----------:|:--------:|:---:|
| Canal client WhatsApp + recueil réel | 9 | 10 | 9 | 6 | Moyen | **9** |
| Branchement diagnostic atelier | 7 | 6 | 10 | 4 | Faible | **9** |
| Dashboard SAV + reporting | 7 | 4 | 8 | 3 | Faible | **8** |
| Base pannes récurrentes + KB | 8 | 6 | 9 | 7 | Élevé | **7** |
| Diagnostic multi-hypothèses | 6 | 7 | 9 | 4 | Faible | **8** |
| Portail suivi temps réel | 7 | 9 | 6 | 5 | Moyen | **7** |
| Boucle Garantie→Achat (signal qualité) | 8 | 3 | 6 | 4 | Faible | **8** |
| Extension juridique FR/NL | 8 | 5 | 5 | 6 | Moyen | **7** |
| Jurisprudence + précédents | 6 | 5 | 7 | 7 | Élevé | **6** |
| Signature électronique | 5 | 6 | 5 | 4 | Faible | **6** |

---

## 11. Vision SaaS

**Ce qu'ont les meilleurs DMS aujourd'hui :** gestion de tickets SAV, planning atelier, facturation,
suivi garantie constructeur. **Ce qu'ils n'ont pas :** raisonnement juridique automatisé, décision
A/B/C/D motivée, génération de communication, package litige, calibration sur droit de la consommation.

**Indispensable pour devenir une référence :**
1. Canal client (WhatsApp) — sans lui, ce n'est pas un système SAV, c'est un analyseur.
2. Dashboard + reporting SAV — un responsable SAV pilote au tableau de bord.
3. Base de connaissances défauts récurrents — le moat data.
4. Multi-pays juridique — pour dépasser la Belgique.

**Prendre des années d'avance :** la boucle **SAV → qualité d'achat** (aucun concurrent ne relie le
retour SAV à la décision d'achat) + la **base de défauts récurrents agrégée** multi-garages.

---

## 12. Benchmark

| Acteur | Forces | Ce qu'il nous manque vs eux | Ce qu'on a en plus |
|--------|--------|------------------------------|--------------------|
| Groupes OEM (SAV constructeur) | Télémétrie, historique complet, réseau | Données connectées véhicule, jumeau numérique | Raisonnement juridique indépendant du constructeur |
| Réseaux concessionnaires | Process rodés, volume | Standardisation, reporting groupe | IA de décision motivée |
| DMS modernes (planning/SAV) | Intégration atelier/factu, planning | Intégration atelier, dashboard, tickets | Décision juridique + communication auto |
| Solutions IA récentes (chatbots SAV) | Canal client, réponse rapide | **Le canal client** (notre gros manque) | Cadre juridique belge encodé + garde-fous |

**Ce qui nous manque le plus, tous benchmarks confondus : le canal client et l'intégration atelier.**
Ce qu'on a d'unique : **le raisonnement juridique motivé avec garde-fou humain** — personne ne l'a.

---

## 13. Feuille de route

### MVP indispensable (rendre l'agent réellement opérationnel)
- **Brancher le diagnostic atelier** dans `analyze` — *valeur 9, complexité faible, dépend d'Atelier.*
  Corrige l'angle mort le plus grave (décider sans diagnostic).
- **Dashboard SAV + reporting** — *valeur 8, complexité faible, données déjà en base.*
- **Diagnostic multi-hypothèses** dans le prompt — *valeur 8, complexité faible.*
- **Boucle Garantie→Achat** (émettre un signal qualité vers Carmelo) — *valeur 8, complexité faible,
  dépend du bus d'événements (déjà là).*

### Version 2 (expérience client)
- **Canal client WhatsApp + recueil réel** — *valeur 9, complexité moyenne, dépend WhatsApp Business
  API.* Le plus fort en impact client, mais dépend d'une intégration externe.
- **Portail de suivi temps réel** — *valeur 7, moyenne.*
- **Relances des délais légaux** + signature électronique — *valeur 6, faible.*

### Version 3 (intelligence & données)
- **Base de connaissances défauts récurrents** (par modèle, fournisseur, pièce) — *valeur 7, élevée,
  dépend d'un historique atelier suffisant.*
- **Précédents internes + jurisprudence** — *valeur 6, élevée.*
- **Extension juridique FR/NL** — *valeur 8, moyenne, dépend d'un ruleset par pays.*

### Vision long terme
- Vision IA sur photos/vidéos du défaut ; télémétrie véhicule connecté ; résolution prédictive ;
  base de défauts **agrégée multi-garages anonymisée** (le moat ultime).

---

## Conclusion

**Le squelette juridique et décisionnel est excellent** — parmi les meilleurs qu'on puisse concevoir,
avec des garde-fous exemplaires. **Mais aujourd'hui, l'agent est un « analyseur de formulaire »,
pas un système SAV** : il lui manque le **canal client** (pour exister aux yeux du client), le
**diagnostic atelier** (pour décider juste), et **l'apprentissage/reporting** (pour progresser et se
piloter).

**Priorité n°1, la moins chère et la plus corrective : brancher le diagnostic atelier + rendre l'agent
visible côté pilotage (dashboard).** Priorité n°2, la plus impactante côté client : **le canal
WhatsApp** qui fait enfin tourner la phase « recueil » déjà conçue. Ces deux mouvements transforment
un très bon moteur de décision en un véritable produit SAV commercialisable.
