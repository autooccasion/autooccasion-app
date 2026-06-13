# AUDIT SITE INTERNET — garagegpcars.be
## Document de travail pour François — Intégration des agents IA GP-CARS

**Préparé par :** Agent IA (contexte projet GP-CARS)  
**Date :** Juin 2026  
**Destinataire :** François (responsable site internet)  
**Priorité :** Haute — prerequis pour le lancement des agents

---

## 1. ÉTAT ACTUEL DU SITE

### Ce que nous savons du site actuel

**URL officielle :** https://garagegpcars.be/

**Pages identifiées :**
| Page | URL | Description |
|------|-----|-------------|
| Accueil | `/` | Page principale du garage |
| Véhicules | `/nos-vehicules/` | Catalogue des voitures disponibles |
| Contact | `/contactez-nous/` et `/contact` | Formulaire de contact |

**Informations affichées actuellement :**
- Adresse : Avenue de la Résistance 506, 4630 Soumagne
- Téléphone Michael : +32 (0)498 77 36 11
- Téléphone Francisco : +32 (0)496 76 95 86
- Email : info.gpcars@gmail.com
- Horaires : Lundi–Vendredi 8h30–18h00
- Services : véhicules sélectionnés, garantie 1 an minimum, reprise, financement sur place

**Présence externe détectée :**
- AutoScout24 : https://www.autoscout24.be/fr/professional/gp-cars-soumagne
- Golden Pages : fiche entreprise listée
- Bolid.be : fiche garage avec avis
- Facebook : GPcars.be

**Type de CMS probable :** WordPress (structure d'URLs `/nos-vehicules/`, `/contactez-nous/` avec slashes finaux = permaliens WordPress typiques)

> **⚠️ Important pour François :** Confirme le CMS utilisé (WordPress, Wix, Webflow, autre?) car les instructions d'intégration ci-dessous varient selon la plateforme.

---

## 2. CE QUI DOIT ÊTRE MODIFIÉ

### 2.1 Priorité CRITIQUE — Widget MADORE (chat IA commercial)

**Qu'est-ce que MADORE ?**  
MADORE est l'agent commercial IA de GP-CARS. Un visiteur du site peut discuter avec lui 24h/24 comme avec un vrai conseiller. MADORE connaît le stock en temps réel et qualifie automatiquement les prospects.

**Résultat attendu :** Un bouton de chat flottant (bas-droite de toutes les pages) qui ouvre une conversation avec MADORE.

**Comment l'intégrer :**

**Option A — Iframe popup (la plus simple, recommandée)**

Ajouter ce code dans le footer de TOUTES les pages du site (avant `</body>`) :

```html
<!-- Widget MADORE GP-CARS -->
<style>
  #madore-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    background: #000;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    border: 2px solid #fff;
  }
  #madore-btn svg { width: 28px; height: 28px; fill: white; }
  #madore-popup {
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 380px;
    height: 600px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    z-index: 9998;
    display: none;
    border: 1px solid #333;
  }
  #madore-popup iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  @media (max-width: 480px) {
    #madore-popup { width: calc(100vw - 16px); right: 8px; height: 70vh; }
  }
</style>

<div id="madore-btn" onclick="toggleMadore()" title="Parler à MADORE, conseiller GP-CARS">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>
</div>

<div id="madore-popup">
  <iframe id="madore-frame" src="" allow="microphone" loading="lazy"></iframe>
</div>

<script>
  var madoreOpen = false;
  var madoreLoaded = false;
  function toggleMadore() {
    madoreOpen = !madoreOpen;
    var popup = document.getElementById('madore-popup');
    popup.style.display = madoreOpen ? 'block' : 'none';
    if (madoreOpen && !madoreLoaded) {
      document.getElementById('madore-frame').src = 'https://autooccasion-app.vercel.app/madore';
      madoreLoaded = true;
    }
  }
</script>
<!-- Fin Widget MADORE -->
```

> **⚠️ Remplacer `https://autooccasion-app.vercel.app`** par l'URL Vercel réelle du projet (Francisco/Michael peuvent la trouver dans leur dashboard Vercel).

**Option B — Lien direct (temporaire, en attendant l'iframe)**

Ajouter un bouton dans le menu de navigation et dans la page contact :

```html
<a href="https://autooccasion-app.vercel.app/madore" target="_blank" 
   style="background:#000; color:#fff; padding:10px 20px; border-radius:8px; font-weight:bold; text-decoration:none;">
  💬 Parler à MADORE — Conseiller en ligne
</a>
```

---

### 2.2 Priorité HAUTE — Bouton "Demander une analyse" sur les fiches véhicules

Sur la page `/nos-vehicules/` et chaque fiche de véhicule, ajouter un bouton qui ouvre MADORE avec un contexte pré-rempli :

```html
<a href="https://autooccasion-app.vercel.app/madore?ref=site" 
   target="_blank"
   style="...">
  💬 Je suis intéressé — Parler à MADORE
</a>
```

Cela permet à un visiteur qui regarde un véhicule de démarrer immédiatement une conversation commerciale.

---

### 2.3 Priorité HAUTE — Page de contact : remplacer ou compléter le formulaire

**Situation actuelle :** formulaire de contact classique (email)  
**Cible :** rediriger vers MADORE pour une réponse instantanée 24h/24

**Modifications à apporter sur `/contactez-nous/` :**

1. **Ajouter au-dessus du formulaire existant :**
```html
<div style="background:#f9f9f9; border:2px solid #000; border-radius:12px; padding:24px; margin-bottom:32px; text-align:center;">
  <h3 style="margin:0 0 8px;">Réponse instantanée — 24h/24</h3>
  <p style="color:#555; margin:0 0 16px;">MADORE, notre conseiller en ligne, peut répondre à toutes vos questions maintenant.</p>
  <a href="https://autooccasion-app.vercel.app/madore" target="_blank" 
     style="background:#000; color:#fff; padding:12px 24px; border-radius:8px; font-weight:bold; text-decoration:none; display:inline-block;">
    Démarrer une conversation avec MADORE →
  </a>
</div>

<p style="text-align:center; color:#888; font-size:14px;">— ou envoyez-nous un message via le formulaire ci-dessous —</p>
```

2. **Garder le formulaire email existant** comme alternative pour ceux qui préfèrent.

---

### 2.4 Priorité MOYENNE — Page d'accueil : modernisation et call-to-action

**Modifications recommandées sur la page d'accueil (`/`) :**

**A. Section hero / bannière principale**
- Ajouter une phrase courte sur MADORE : *"Notre conseiller en ligne vous aide à trouver le bon véhicule"*
- Bouton CTA visible : "Parler à notre conseiller →"

**B. Section "Nos services" — ajouter un bloc MADORE :**
```
🤖 Conseiller en ligne 24h/24
Parlez directement avec MADORE, notre agent commercial IA. 
Il connaît notre stock, répond à vos questions et vous aide 
à trouver le bon véhicule selon votre budget.
[Démarrer une conversation]
```

**C. Ajouter les avis clients** (Google, Facebook) si pas déjà présents — ça renforce la confiance avant de démarrer un chat avec un agent IA.

---

### 2.5 Priorité BASSE — Synchronisation du stock

**Situation actuelle :** le stock est visible sur `/nos-vehicules/` et sur AutoScout24 (affiché séparément)  
**Cible à terme :** que le stock de `garagegpcars.be` soit alimenté depuis la plateforme GP-CARS (Vercel)

**Note :** Cette intégration est plus technique et doit être planifiée avec Michael/Francisco. Elle n'est pas obligatoire pour le lancement de MADORE.

Options possibles :
1. **Export manuel** : François exporte le stock depuis la plateforme GP-CARS en CSV et l'importe dans le CMS du site — faisable tous les jours ou toutes les semaines
2. **API automatique** : la plateforme GP-CARS expose une API publique `/api/stock/public` que le site appelle pour afficher le stock en temps réel (développement nécessaire, ~2-3h)
3. **Redirection** : supprimer `/nos-vehicules/` du site et rediriger vers la plateforme ou AutoScout24

---

## 3. MODIFICATIONS SPÉCIFIQUES SELON LE CMS

### Si le site est sous WordPress

**Pour le widget MADORE :**
1. Admin WP → Apparence → Éditeur de thème → `footer.php`
2. Coller le code widget MADORE juste avant `</body>`
3. Sauvegarder

**Ou utiliser un plugin :**
- Admin WP → Extensions → Ajouter → chercher "Insert Headers and Footers" ou "WPCode"
- Coller le code dans la section "Footer Scripts"
- Avantage : survit aux mises à jour du thème

**Pour les boutons sur les fiches véhicules :**
- Utiliser l'éditeur de blocs Gutenberg : ajouter un bloc "HTML personnalisé" avec le bouton
- Ou modifier le template de page véhicule dans le thème

**Pour la page contact :**
- Éditer la page directement dans Gutenberg
- Ajouter un bloc HTML avant le formulaire existant

### Si le site est sous Wix / Squarespace / autre

Me contacter pour les instructions spécifiques à la plateforme utilisée.

### Si le site est sous Webflow

1. Paramètres du projet → Intégrations personnalisées → Code de pied de page
2. Coller le code widget MADORE
3. Publier

---

## 4. CHECKLIST D'INTÉGRATION POUR FRANÇOIS

```
ÉTAPE 1 — PRÉPARATION (15 min)
□ Confirmer le CMS utilisé pour le site
□ Récupérer l'URL Vercel de la plateforme GP-CARS auprès de Michael/Francisco
□ Remplacer "autooccasion-app.vercel.app" par l'URL réelle dans tous les codes ci-dessus
□ Tester que l'URL https://[url-vercel]/madore fonctionne dans le navigateur

ÉTAPE 2 — WIDGET CHAT (30 min)
□ Ajouter le code widget MADORE dans le footer du site (toutes les pages)
□ Vérifier que le bouton flottant apparaît sur mobile ET desktop
□ Tester qu'une conversation avec MADORE démarre correctement
□ Vérifier que le chat fonctionne sur la page accueil, véhicules et contact

ÉTAPE 3 — PAGE CONTACT (20 min)
□ Ajouter le bloc "Réponse instantanée MADORE" avant le formulaire
□ Vérifier que le lien vers MADORE fonctionne
□ Garder le formulaire email existant en dessous

ÉTAPE 4 — PAGE VÉHICULES (20 min)
□ Ajouter le bouton "Je suis intéressé — Parler à MADORE" sur chaque fiche
□ Ou l'ajouter globalement dans le template de liste

ÉTAPE 5 — PAGE ACCUEIL (30 min)
□ Ajouter la mention MADORE dans la section services
□ Ajouter un CTA visible vers le chat
□ Vérifier le rendu sur mobile (test responsive)

ÉTAPE 6 — TESTS FINAUX (30 min)
□ Tester sur mobile (iPhone + Android)
□ Tester sur tablette
□ Tester sur desktop
□ Démarrer une vraie conversation avec MADORE depuis chaque page modifiée
□ Vérifier que les leads apparaissent dans la plateforme GP-CARS (/gp/leads)
```

**Durée estimée totale : ~2h30 à 3h**

---

## 5. CE QU'IL NE FAUT PAS TOUCHER

- Les fiches véhicules existantes sur AutoScout24 → MADORE peut y faire référence mais ne pas les remplacer
- Le formulaire de contact existant → le garder en complément de MADORE
- Le référencement SEO actuel → ne pas changer les URLs existantes

---

## 6. CE QUE MADORE FAIT AUTOMATIQUEMENT (sans action de François)

Une fois le widget installé, MADORE fonctionne seul :

| Action | Automatique |
|--------|-------------|
| Répondre aux visiteurs 24h/24 | ✓ |
| Connaître le stock GP-CARS en temps réel | ✓ |
| Qualifier les prospects (score 0-100) | ✓ |
| Envoyer une alerte email à info.gpcars@gmail.com pour les leads chauds | ✓ |
| Sauvegarder les conversations dans la plateforme | ✓ |
| Proposer les bons véhicules selon le budget du visiteur | ✓ |

---

## 7. QUESTIONS À POSER À MICHAEL / FRANCISCO

Avant de commencer, François doit confirmer ces points :

1. **Quel est le CMS du site ?** (WordPress ? Wix ? Webflow ? autre ?)
2. **Qui a accès à l'administration du site ?** (identifiants admin nécessaires)
3. **Quelle est l'URL exacte de la plateforme Vercel ?** (pour configurer les liens)
4. **Le nom de domaine `garagegpcars.be` — est-il hébergé où ?** (OVH, Combell, autre ?)
5. **Y a-t-il un thème premium payant sur le site ?** (important pour savoir si on peut modifier le footer sans casser le thème)

---

## 8. ÉVOLUTIONS FUTURES (optionnel — post-lancement)

Ces modifications ne sont pas nécessaires pour le lancement mais amélioreront l'expérience à terme :

1. **Chat bubble personnalisé** avec photo d'un conseiller GP-CARS au lieu de l'icône générique
2. **Pré-qualification sur le site** : formulaire rapide (budget, type de véhicule) qui transmet le contexte à MADORE avant d'ouvrir le chat
3. **Page dédiée "Notre assistant IA"** qui explique MADORE aux visiteurs
4. **Synchronisation stock automatique** : API entre plateforme GP-CARS et site (nécessite développeur, ~3h)
5. **Pixel de tracking** : mesurer combien de visiteurs du site ouvrent MADORE et deviennent des leads

---

## CONTACT EN CAS DE PROBLÈME

Si François rencontre des difficultés techniques lors de l'intégration :
- Contacter Michael ou Francisco pour l'URL Vercel et les accès
- Pour les problèmes de code : rouvrir une session Claude Code avec le détail du problème
- L'équipe peut aussi créer une page dédiée à l'intégration si nécessaire
