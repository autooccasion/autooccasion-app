# CARMELO V3 — Spécification Maître GP-CARS

> Document de référence permanent. Toute évolution s'y ajoute — on ne repart jamais de zéro.  
> Légende : ✅ Implémenté · 📋 Planifié (non encore construit)

---

## 1. Vision

**Objectif principal :** augmenter la rentabilité de GP-CARS.  
**Priorité :** marge et rotation du stock — pas le volume d'analyses.  
**Philosophie :** chaque décision passe par un humain. Carmelo assiste, ne décide pas seul.

---

## 2. Paramètres opérationnels GP-CARS

> Source de vérité : `lib/carmelo/config.ts`

| Paramètre | Valeur |
|---|---|
| Budget cible véhicule | 15 000 – 20 000 € |
| Kilométrage maximum | 80 000 km |
| Année minimum | 2021 |
| Plafond absolu par achat | 25 000 € |
| Budget max engagement quotidien | 40 000 € |
| Marge cible standard (< 20k€) | 3 000 € |
| Marge cible premium (> 25k€) | 4 000 € |
| Marge minimum standard | 2 500 € |
| Marge minimum premium | 3 500 € |
| Coussin négociation client | 3 % du prix de vente |
| Seuil confiance autonome | 85 % |
| Frais plancher incompressibles | 405 € (CT 105 + prépa 100 + pub 200) |

### Marques préférées ✅
Kia · Hyundai · Toyota · Volkswagen · Audi · BMW · Mercedes

### Exclusions absolues ✅
- Moteurs PSA PureTech (EB2, EB2ADT, 1.0/1.2 PureTech)
- Renault 1.2 TCe (problème chaîne de distribution)
- Ford 1.0 EcoBoost courroie humide (avant 2018)
- Année < 2021
- Kilométrage > 80 000 km
- Historique douteux ou incomplet
- Kilométrage incohérent (non vérifiable)
- Véhicule accidenté lourdement
- Marge cible non atteignable

### Grille de frais ✅
| Poste | Montant |
|---|---|
| CT + Car-Pass | 105 € (si non valide) |
| Préparation standard | 100 € |
| Publicité | 200 € |
| Entretien | 250 € (si non récent) |
| Pneus | 500 € (si nécessaires) |
| Freins | 350 € (si nécessaires) |
| Garantie vendue (> 40k km) | 300 € |
| Transport BE < 50 km | 0 € |
| Transport BE 50–150 km | 100 € |
| Transport BE > 150 km | 200 € |
| Transport FR/DE/NL/LU < 300 km | 350 € |
| Transport FR/DE/NL/LU > 300 km | 500 € |
| Transport autres pays | 600 € |
| Carrosserie | Devis réel uniquement |

---

## 3. Univers Achat

### Sources de scanning 📋
- Fastback
- Auto1
- AutoScout24 ✅ (lecture annonce via URL)
- GoCar ✅ (lecture annonce via URL)
- 2dehands ✅ (lecture annonce via URL)
- Facebook Marketplace 📋
- Mobile.de ✅ (lecture annonce via URL)
- Autres plateformes pertinentes

### Fonctions

| Fonction | Statut |
|---|---|
| Analyser une annonce depuis URL | ✅ `/api/carmelo/analyze` |
| Analyser depuis description texte | ✅ `/api/carmelo/analyze` |
| Calculer prix maximum d'achat | ✅ `lib/carmelo/modules/marge.ts` |
| Intégrer frais réels dans le calcul | ✅ `lib/carmelo/modules/frais.ts` |
| Intégrer risques mécaniques | ✅ `lib/carmelo/modules/risque.ts` |
| Intégrer coussin de négociation | ✅ `lib/carmelo/modules/marge.ts` |
| Score de rotation (1–10) | ✅ `lib/carmelo/modules/rotation.ts` |
| Comparaison vs voiture neuve | ✅ `lib/carmelo/modules/comparaison-vn.ts` |
| Score Carmelo 7 dimensions | ✅ `lib/carmelo/modules/score-carmelo.ts` |
| Verdict VERT / ORANGE / ROUGE | ✅ `lib/carmelo/modules/verdict.ts` |
| Verdict OR (opportunité prioritaire) | ✅ `lib/carmelo/types.ts` |
| Scanner quotidien automatique | 📋 (scraping planifié) |
| Détection automatique bonnes affaires | 📋 (lié au scanner) |
| Classer ACHETER / NÉGOCIER / SURVEILLER / REJETER | 📋 (extension du verdict actuel) |

### Formule de calcul (top-down) ✅
```
Prix vente réaliste  = Prix marché × 0,97
Coussin négociation  = Prix vente × 3 %
Prix achat cible     = Prix vente − Marge cible − Frais − Coussin
Prix achat maximum   = Prix vente − Marge minimum − Frais − Coussin
```

---

## 4. Univers Vente

### Plateformes de publication 📋
| Plateforme | Statut |
|---|---|
| GoCar | 📋 |
| AutoScout24 | 📋 |
| Facebook (annonces) | 📋 |
| Instagram | 📋 |
| TikTok | 📋 |
| YouTube | 📋 |
| Google Business Profile | 📋 |

### Fonctions

| Fonction | Statut |
|---|---|
| Surveiller les nouveaux concurrents sur une annonce | 📋 |
| Détecter les baisses de prix concurrentes | 📋 |
| Suivre les véhicules vendus (hors GP-CARS) | 📋 |
| Alerter sur vieillissement du stock (> 60 jours) | ✅ (digest quotidien) |
| Préparer campagnes et contenus | 📋 (partiellement via agent marketing) |

---

## 5. Agent Marketing ✅ (partiel)

> Source : `app/api/agents/marketing/route.ts` · `lib/agents/marketing/system-prompt.ts`  
> Modèle : `claude-haiku-4-5` · Limite : 5 req/min · 1 024 tokens

### Fonctions implémentées ✅
- Génération titre d'annonce (max 80 caractères, marque/modèle/année/km/motorisation)
- Génération description (150–250 mots, français belge, ton professionnel accessible)
- Extraction points forts (liste)
- Génération tags SEO
- **Validation humaine obligatoire avant publication** (jamais publié automatiquement)

### Fonctions planifiées 📋
- Multicanal (adapter le contenu selon la plateforme : annonce longue vs post court vs vidéo)
- Génération vidéo automatique à partir des photos
- Variantes de publications (A/B testing)
- Données structurées Schema.org pour SEO et futurs assistants IA
- Suivi des performances par annonce (vues, contacts, conversion)

---

## 6. Agent Contrôleur ✅ (partiel)

> Source : `app/api/agents/controller/route.ts` · `lib/agents/controller/system-prompt.ts`  
> Architecture : règles dures (sans LLM) → LLM secondaire si aucun bloquant  
> Modèle LLM : `claude-haiku-4-5` · Limite : 10 req/min · 512 tokens

### Règles de blocage implémentées ✅
| Code | Sévérité | Déclencheur |
|---|---|---|
| `EXCLUSION_PSA_PURETECH` | bloquant | Moteur PSA PureTech détecté |
| `EXCLUSION_RENAULT_TCE` | bloquant | Renault 1.2 TCe détecté |
| `EXCLUSION_FORD_ECOBOOST` | bloquant | Ford 1.0 EcoBoost < 2018 détecté |
| `MARGE_INSUFFISANTE` | bloquant | Marge estimée < marge minimum |
| `PLAFOND_ACHAT_DEPASSE` | bloquant | Prix achat > 25 000 € |
| `KM_INCOHERENT` | bloquant | km/an < 3 000 ou > 40 000 |
| `ANALYSE_PERIMEE` | avertissement | Analyse > 72 h (prix marché potentiellement périmé) |
| `CONFIANCE_FAIBLE` | avertissement | Confiance < 85 % → validation humaine |

### Journalisation ✅ (partielle)
- Résultat de chaque contrôle sauvegardé en base (`saveControllerResult`)
- Flags horodatés avec sévérité et message
- Historique consultable par véhicule

### Journalisation planifiée 📋
- Audit trail complet (qui a validé, quand, pourquoi)
- Historique des décisions agrégé par type de blocage
- Rapport hebdomadaire des blocages les plus fréquents
- Détection des patterns d'erreurs répétées

### Blocages planifiés 📋
- Surstock (trop de véhicules du même segment déjà en stock)
- Frais oubliés (détection via comparaison avec historique frais réels)
- Risque trésorerie (engagement dépasse le budget du jour)

---

## 7. Gestion de Trésorerie

### Implémenté ✅
- Calcul du capital total engagé en stock (`computeStockHealth().totalStockValue`)
- Affichage dans le digest quotidien (KPI "Trésorerie engagée")
- Plafond par véhicule : 25 000 €

### Planifié 📋
- Intégrer la capacité financière disponible (budget restant du jour)
- Prioriser les opportunités quand le budget est limité (score composite marge × rotation / capital)
- Tenir compte des véhicules déjà en stock + commandés dans l'évaluation du budget disponible
- Alerte si un achat dépasse le budget journalier restant
- Tableau de bord trésorerie temps réel

---

## 8. Mémoire & Apprentissage

### Implémenté ✅
> Source : `lib/carmelo/memory.ts`

- Sélection des cas passés pertinents (score par marque, ventes réelles, achats en cours)
- Injection dans le contexte Carmelo à chaque analyse (max 8 cas)
- Stats réelles par marque injectées (si ≥ 2 ventes) : marge moy., jours stock moy., taux de vente
- Formule de scoring : vendu + prix réel = 4 pts · acheté = 2 pts · même marque = 3 pts

### Données suivies par véhicule ✅
- Prix d'achat demandé / max conseillé / réel payé
- Prix de vente cible / réel
- Marge estimée / réelle
- Délai de vente réel (jours)
- Décision Carmelo (VERT/ORANGE/ROUGE)
- Statut (prospect → analyse → acheté → en stock → publié → vendu / refusé)
- Date d'analyse, d'achat, de publication, de vente

### Planifié 📋
- Suivi des contacts vendeur (nombre, dates, résultats)
- Suivi des visites acheteur (nombre, dates, retours)
- Détection automatique des erreurs d'achat (véhicule en stock > 90 j → rétro-analyse)
- Identification des modèles les plus rentables (par segment, motorisation, couleur)
- Score de fiabilité des estimations Carmelo (comparaison marge estimée vs réelle)
- Recalibrage automatique des scores de rotation par modèle

---

## 9. Analytics & KPIs

### Implémenté ✅
> Source : `lib/agents/analytics.ts` · `app/api/agents/analytics/route.ts`

| KPI | Calcul |
|---|---|
| Véhicules en stock | statuts : acheté + en_stock + publié |
| Véhicules publiés | statut : publié |
| Vendus (30 j) | statut vendu + soldAt dans les 30 derniers jours |
| Vendus (7 j) | idem sur 7 jours |
| Capital engagé | somme des realBuyPrice des véhicules en stock |
| Marge moyenne (30 j) | moyenne realMargin des véhicules vendus sur 30 j |
| Marge par marque | avgMargin, avgDays, conversionRate par make (si ≥ 2 ventes) |
| Véhicules lents | publiés depuis > 60 jours |
| Délai moyen en stock | moyenne soldInDays des véhicules vendus |
| Meilleure / pire marque | classement par marge moyenne |
| Objectif achat hebdo | cible de volume calculée |

### Planifié 📋
- Performances marketing par canal (vues, contacts, conversion par plateforme)
- Rentabilité par segment (citadine / berline / SUV / break)
- Rentabilité par motorisation (essence / diesel / hybride)
- Évolution mensuelle des marges (courbe)
- Taux de conversion analyse → achat → vente
- Coût réel moyen par type de frais (entretien, pneus, CT…)

---

## 10. Trend Monitor 📋

> Entièrement planifié — pas encore construit

### Objectif
Alimenter l'Agent Achat avec des signaux de marché en temps réel pour améliorer les scores de rotation.

### Fonctions planifiées
- Surveiller les tendances de prix par modèle sur les plateformes (AutoScout24, Gocar…)
- Identifier les catégories de véhicules en hausse de demande (saison, carburant, etc.)
- Détecter les comportements acheteurs (temps moyen d'annonce avant vente)
- Détecter les baisses de prix systématiques (signal = vendeur pressé)
- Transmettre les signaux à l'Agent Achat pour ajuster les scores de rotation

---

## 11. Orchestrateur

### Flux cible (planifié) 📋
```
Scanner Marché (Trend Monitor)
        ↓
Agent Achat (Carmelo)
        ↓
Contrôleur (règles dures + LLM)
        ↓
Validation humaine obligatoire
        ↓
Stock (gestion véhicule)
        ↓
Agent Marketing (annonces)
        ↓
Analytics (performance)
        ↓
Mémoire / Apprentissage (recalibrage)
```

### État actuel ✅
```
Analyse manuelle (Carmelo streaming)
        ↓
Contrôleur automatique (post-analyse)
        ↓
Validation humaine (interface stock)
        ↓
Gestion stock (statuts, prix, dates)
        ↓
Agent Marketing (génération annonce)
        ↓
Analytics + Digest quotidien
        ↓
Mémoire injectée à la prochaine analyse
```

---

## 12. Règles de Sécurité — Non Négociables

### Phase actuelle : toujours valable ✅
```
Analyse
   ↓
Contrôleur automatique
   ↓
Validation humaine (obligatoire)
   ↓
Exécution
```

### Interdictions absolues (maintenant ET futur)
- ❌ Enchère automatique
- ❌ Négociation automatique avec un vendeur
- ❌ Achat automatique
- ❌ Modification automatique de prix en vitrine
- ❌ Publication automatique non validée par un humain
- ❌ Envoi automatique de messages à des acheteurs ou vendeurs

---

## 13. Boucle d'Apprentissage

Chaque véhicule est suivi du **premier signal d'achat jusqu'à la vente finale** afin que Carmelo améliore progressivement ses décisions.

### Cycle complet d'un véhicule
```
Signal détecté (URL annonce ou description)
        ↓
Analyse Carmelo → décision + prix max + confiance
        ↓
Contrôle automatique → flags + validation requise
        ↓
Décision humaine → acheté / refusé
        ↓ (si acheté)
Préparation + publication → frais réels enregistrés
        ↓
Vente → prix réel, délai, marge réelle enregistrés
        ↓
Rétro-analyse → écart estimé/réel → correction scores futurs
```

### Métriques de calibrage ✅ (partiel)
- Marge estimée vs marge réelle → précision financière
- Score de rotation vs délai réel → précision commerciale
- Décision Carmelo vs résultat réel → taux de bonnes décisions

---

## 14. Modèles IA utilisés

| Agent | Modèle | Justification |
|---|---|---|
| Carmelo (analyse achat) | `claude-opus-4-8` | Décision critique — qualité maximale requise |
| Contrôleur (LLM secondaire) | `claude-haiku-4-5` | Vérification rapide après règles dures |
| Marketing (rédaction annonce) | `claude-haiku-4-5` | Génération de texte — qualité suffisante |
| Contact vendeur | `claude-haiku-4-5` | Message court — qualité suffisante |
| Moteur Carmelo TS (analyzer.ts) | Aucun LLM | Calculs déterministes purs |
| Analytics, digest, parsing | Aucun LLM | Fonctions pures, zéro coût |

---

## 15. Architecture technique

- **Framework :** Next.js 14 App Router (TypeScript)
- **Base de données :** PostgreSQL via Drizzle ORM
- **Authentification :** NextAuth v5
- **Déploiement :** Vercel (4 projets miroirs)
- **Email digest :** Cron Vercel à 07h00 heure Bruxelles
- **Rate limiting :** In-memory par utilisateur (5–60 req/min selon l'endpoint)
- **Clé API :** ANTHROPIC_API_KEY (env Vercel) ou clé personnelle via cookie

---

## 16. Roadmap priorisée

### Court terme (prochaines évolutions)
1. Scanner automatique d'annonces (AutoScout24 RSS ou scraping planifié)
2. Classement ACHETER / NÉGOCIER / SURVEILLER / REJETER (extension du verdict)
3. Audit trail complet dans le contrôleur (qui a validé, quand)
4. Blocage surstock dans le contrôleur

### Moyen terme
5. Trend Monitor (signaux marché → ajustement scores rotation)
6. Suivi contacts et visites par véhicule
7. Recalibrage automatique des scores basé sur les résultats réels
8. Gestion trésorerie disponible (budget restant du jour)

### Long terme
9. Multicanal marketing (variantes par plateforme)
10. Génération vidéo depuis photos
11. Données structurées Schema.org pour SEO
12. Tableau de bord analytics avancé (courbes, segments, motorisations)
