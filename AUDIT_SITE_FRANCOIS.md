# BRIEF TECHNIQUE COMPLET — garagegpcars.be
## Pour François — Agence web · Accès administrateur complet

**Client :** GP-CARS Associés · Avenue de la Résistance 506 · 4630 Soumagne  
**Contact client :** Michael +32498773611 · Francisco +32496769586  
**Email client :** info.gpcars@gmail.com  
**Date :** Juin 2026

---

## CONTEXTE

GP-CARS a développé une plateforme IA complète déployée sur Vercel (Next.js 14).  
Cette plateforme contient **5 agents IA** qui doivent être connectés au site `garagegpcars.be`.

**François doit :**
1. Intégrer le widget chat MADORE sur le site existant
2. Moderniser le site pour qu'il reflète le niveau de la plateforme IA
3. Connecter les pages du site à la plateforme back-office

**Ce document contient tout le code nécessaire — copier-coller direct.**

---

## ARCHITECTURE GP-CARS (comprendre avant de modifier)

```
garagegpcars.be              ←  site public (François gère)
       │
       ├── Widget MADORE ────→  [URL-VERCEL]/madore        (chat prospect)
       ├── Lien stock ────────→  [URL-VERCEL]/madore        (via MADORE)
       └── Contact ───────────→  info.gpcars@gmail.com

[URL-VERCEL] = URL Vercel fournie par Michael/Francisco
       │
       ├── /madore            Agent commercial public (MADORE)
       ├── /carmelo           Agent achat privé (Carmelo) 
       ├── /gp/stock          Gestion stock (privé)
       ├── /gp/leads          Leads MADORE (privé)
       ├── /gp/dashboard      Analytics (privé)
       └── /gp/training       Formation agents (privé)
```

**Note sur la sécurité :** `/madore` est la SEULE page publique. Toutes les autres pages nécessitent un compte GP-CARS.

---

## ÉTAPE 1 — RÉCUPÉRER L'URL VERCEL

Avant tout, demander à Michael ou Francisco l'URL exacte de leur plateforme Vercel.  
Format : `https://quelquechose.vercel.app` ou un domaine personnalisé.

**Dans tout ce document, remplacer `[URL-VERCEL]` par cette URL.**

Tester que ça marche : ouvrir `[URL-VERCEL]/madore` dans le navigateur → vous devez voir le chat MADORE.

---

## INTÉGRATION 1 — WIDGET CHAT MADORE (PRIORITÉ ABSOLUE)

### Ce que c'est
Un bouton flottant en bas à droite de toutes les pages du site. Au clic, un panneau de chat s'ouvre. Le visiteur parle directement avec MADORE, l'agent commercial IA de GP-CARS, qui connaît le stock en temps réel.

### Code complet à ajouter dans le `<head>` ou avant `</body>` de toutes les pages

```html
<!-- ═══════════════════════════════════════════════════════
     WIDGET MADORE — Agent commercial IA GP-CARS
     Version 1.0 — Juin 2026
     Remplacer [URL-VERCEL] par l'URL réelle de la plateforme
     ═══════════════════════════════════════════════════════ -->
<style>
  /* Bouton flottant */
  #gpcars-madore-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 64px;
    height: 64px;
    background: #111;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 24px rgba(0,0,0,0.35), 0 0 0 3px #fff;
    transition: transform 0.2s, box-shadow 0.2s;
    border: none;
    outline: none;
  }
  #gpcars-madore-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 32px rgba(0,0,0,0.45), 0 0 0 3px #fff;
  }
  #gpcars-madore-btn svg {
    width: 30px;
    height: 30px;
    fill: white;
  }

  /* Badge notification */
  #gpcars-madore-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    background: #dc2626;
    border-radius: 50%;
    border: 2px solid #fff;
    display: none;
  }

  /* Panneau de chat */
  #gpcars-madore-panel {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 390px;
    height: 620px;
    background: #09090b;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
    z-index: 9998;
    display: none;
    transition: opacity 0.2s, transform 0.2s;
    transform-origin: bottom right;
  }
  #gpcars-madore-panel.open {
    display: block;
    animation: madore-open 0.2s ease-out;
  }
  @keyframes madore-open {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  #gpcars-madore-panel iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Bouton fermer */
  #gpcars-madore-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 16px;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  #gpcars-madore-close:hover { background: rgba(255,255,255,0.2); }

  /* Responsive mobile */
  @media (max-width: 500px) {
    #gpcars-madore-panel {
      width: 100%;
      height: 85vh;
      bottom: 0;
      right: 0;
      border-radius: 20px 20px 0 0;
    }
    #gpcars-madore-btn { bottom: 16px; right: 16px; }
  }
</style>

<!-- Bouton flottant -->
<button id="gpcars-madore-btn" onclick="gpcarsToggleMadore()" title="Parler à MADORE — Conseiller GP-CARS" aria-label="Ouvrir le chat avec MADORE">
  <div id="gpcars-madore-badge"></div>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>
</button>

<!-- Panneau chat -->
<div id="gpcars-madore-panel">
  <button id="gpcars-madore-close" onclick="gpcarsToggleMadore()" aria-label="Fermer">✕</button>
  <iframe id="gpcars-madore-frame" src="" allow="clipboard-read; clipboard-write" loading="lazy" title="MADORE — Conseiller GP-CARS"></iframe>
</div>

<script>
  (function() {
    var MADORE_URL = '[URL-VERCEL]/madore';
    var isOpen = false;
    var isLoaded = false;

    window.gpcarsToggleMadore = function() {
      isOpen = !isOpen;
      var panel = document.getElementById('gpcars-madore-panel');
      var badge = document.getElementById('gpcars-madore-badge');

      if (isOpen) {
        panel.style.display = 'block';
        setTimeout(function() { panel.classList.add('open'); }, 10);
        badge.style.display = 'none';
        if (!isLoaded) {
          document.getElementById('gpcars-madore-frame').src = MADORE_URL;
          isLoaded = true;
        }
      } else {
        panel.classList.remove('open');
        setTimeout(function() { panel.style.display = 'none'; }, 200);
      }
    };

    // Afficher badge après 30 secondes si pas encore ouvert
    setTimeout(function() {
      if (!isOpen) {
        document.getElementById('gpcars-madore-badge').style.display = 'block';
      }
    }, 30000);
  })();
</script>
<!-- FIN WIDGET MADORE GP-CARS -->
```

### Instructions par CMS

**WordPress :**
- Option A (recommandée) : installer le plugin **WPCode** (gratuit) → Code Snippets → Add Snippet → "Footer" → coller le code → Activer
- Option B : Apparence → Éditeur de thème → `footer.php` → coller avant `</body>`
- Option C : si thème avec hooks : `functions.php` → `add_action('wp_footer', function() { ?> [code ici] <?php });`

**Webflow :**
- Project Settings → Custom Code → Footer Code → coller → Publier

**Wix :**
- Paramètres → Paramètres avancés → Code personnalisé → Fin du corps → coller

**Squarespace :**
- Paramètres → Avancé → Injection de code → Pied de page → coller

---

## INTÉGRATION 2 — PAGE CONTACT

### Objectif
Proposer MADORE comme première option avant le formulaire email. Réponse instantanée 24h/24.

### Bloc HTML à insérer EN HAUT de la page `/contactez-nous/`

```html
<div style="
  background: #0a0a0a;
  border: 2px solid #222;
  border-radius: 14px;
  padding: 28px 24px;
  margin-bottom: 32px;
  text-align: center;
  font-family: inherit;
">
  <div style="
    display: inline-block;
    background: #16a34a;
    color: white;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 20px;
    margin-bottom: 12px;
  ">● Disponible maintenant</div>

  <h3 style="color: #fff; font-size: 20px; margin: 0 0 8px; font-weight: 700;">
    Réponse instantanée avec MADORE
  </h3>
  <p style="color: #999; font-size: 14px; margin: 0 0 20px; line-height: 1.5;">
    Notre conseiller en ligne connaît notre stock et peut répondre à toutes vos questions 
    immédiatement — 24h/24, 7j/7.
  </p>
  <a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
    display: inline-block;
    background: white;
    color: black;
    font-weight: 700;
    font-size: 15px;
    padding: 14px 28px;
    border-radius: 10px;
    text-decoration: none;
    transition: background 0.15s;
  ">
    Démarrer une conversation →
  </a>
  <p style="color: #555; font-size: 12px; margin: 16px 0 0;">
    Aucune inscription requise · Réponse en quelques secondes
  </p>
</div>

<p style="text-align:center; color:#888; font-size:13px; margin-bottom:20px;">
  ── ou envoyez-nous un message par email ci-dessous ──
</p>
```

---

## INTÉGRATION 3 — PAGE VÉHICULES `/nos-vehicules/`

### Bouton "Je suis intéressé" sur chaque fiche

Sur chaque fiche véhicule ou dans la sidebar, ajouter :

```html
<div style="
  border: 1.5px solid #111;
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
  background: #fafafa;
  text-align: center;
">
  <p style="font-size: 13px; color: #555; margin: 0 0 12px;">
    Des questions sur ce véhicule ?
  </p>
  <a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
    display: inline-block;
    background: #111;
    color: white;
    font-weight: 700;
    font-size: 14px;
    padding: 12px 22px;
    border-radius: 9px;
    text-decoration: none;
  ">
    💬 Parler à notre conseiller
  </a>
  <p style="font-size: 11px; color: #999; margin: 10px 0 0;">
    Réponse instantanée · Disponible 24h/24
  </p>
</div>
```

### Bannière globale en haut de la liste des véhicules

```html
<div style="
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: white;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
">
  <div>
    <p style="margin:0; font-weight:700; font-size:15px;">MADORE — Conseiller en ligne GP-CARS</p>
    <p style="margin:4px 0 0; font-size:13px; color:#aaa;">
      Trouvez le véhicule qui vous correspond · Budget · Financement · Reprise
    </p>
  </div>
  <a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
    background: white;
    color: black;
    font-weight: 700;
    font-size: 13px;
    padding: 10px 20px;
    border-radius: 8px;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  ">
    Je cherche un véhicule →
  </a>
</div>
```

---

## INTÉGRATION 4 — PAGE D'ACCUEIL

### Bloc service à ajouter dans la section "Nos services" ou "Pourquoi nous choisir"

```html
<div style="
  border: 1.5px solid #e5e5e5;
  border-radius: 14px;
  padding: 24px;
  text-align: center;
  max-width: 320px;
">
  <div style="font-size: 40px; margin-bottom: 12px;">🤖</div>
  <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #111;">
    Conseiller en ligne 24h/24
  </h3>
  <p style="font-size: 13px; color: #666; line-height: 1.5; margin: 0 0 16px;">
    MADORE, notre assistant IA, connaît notre stock et peut vous aider à trouver 
    le bon véhicule selon votre budget — immédiatement, à toute heure.
  </p>
  <a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
    display: inline-block;
    background: #111;
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 8px;
    text-decoration: none;
  ">
    Démarrer une conversation
  </a>
</div>
```

### CTA dans le hero / bannière principale

Ajouter un bouton secondaire à côté du CTA principal existant :

```html
<a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: white;
  border: 2px solid white;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 22px;
  border-radius: 10px;
  text-decoration: none;
  margin-left: 12px;
">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>
  Conseiller en ligne
</a>
```

---

## INTÉGRATION 5 — MENU DE NAVIGATION

Ajouter un lien "💬 Conseiller" dans la navigation principale du site, qui pointe vers MADORE :

```html
<a href="[URL-VERCEL]/madore" target="_blank" rel="noopener"
   style="color: inherit; text-decoration: none; font-weight: 600;">
  💬 Conseiller en ligne
</a>
```

Ou avec style visuel distinctif :

```html
<a href="[URL-VERCEL]/madore" target="_blank" rel="noopener" style="
  background: #111;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
">
  💬 Conseiller IA
</a>
```

---

## CHECKLIST COMPLÈTE — ORDRE D'EXÉCUTION

```
PRÉPARATION (10 min)
□ Confirmer l'URL Vercel avec Michael/Francisco
□ Tester [URL-VERCEL]/madore dans le navigateur (le chat doit s'ouvrir)
□ Remplacer [URL-VERCEL] dans tous les codes ci-dessus

WIDGET GLOBAL (30 min) ← PRIORITÉ 1
□ Ajouter le code "Widget MADORE" dans le footer de TOUTES les pages
□ Tester sur accueil : bouton flottant visible en bas à droite ?
□ Tester au clic : le panneau s'ouvre avec le chat ?
□ Tester sur mobile : le panneau prend toute la largeur ?
□ Démarrer une vraie conversation de test

PAGE CONTACT (20 min) ← PRIORITÉ 2
□ Ajouter le bloc "Réponse instantanée" EN HAUT de /contactez-nous/
□ Vérifier que le bouton "Démarrer une conversation" fonctionne
□ Garder le formulaire email existant EN DESSOUS

PAGE VÉHICULES (30 min) ← PRIORITÉ 3  
□ Ajouter la bannière MADORE en haut de la liste /nos-vehicules/
□ Ajouter le bouton "Parler à notre conseiller" sur au moins 3 fiches véhicule
□ Idéalement : ajouter le bouton sur TOUTES les fiches (template)

PAGE ACCUEIL (20 min) ← PRIORITÉ 4
□ Ajouter le bloc "Conseiller en ligne 24h/24" dans la section services
□ Ajouter le bouton secondaire dans le hero (si le design le permet)

NAVIGATION (10 min) ← PRIORITÉ 5
□ Ajouter le lien "Conseiller en ligne" dans le menu principal

TESTS FINAUX (20 min)
□ Tester TOUT sur iPhone (Safari)
□ Tester TOUT sur Android (Chrome)
□ Tester TOUT sur desktop (Chrome)
□ Démarrer une conversation complète depuis le site : MADORE répond ?
□ Vérifier dans la plateforme GP-CARS (/gp/leads) que le lead apparaît

TOTAL ESTIMÉ : ~2 heures de travail
```

---

## MODERNISATION DU SITE (recommandations complémentaires)

Ces modifications améliorent l'image globale du garage et la cohérence avec la plateforme IA.

### Visuels & Design
- Ajouter des **photos de l'équipe** (Michael et Francisco) → humanise et rassure avant le chat IA
- Section **avis clients Google** intégrée (plugin ou widget Google Reviews)
- **Badge "Conseiller IA disponible 24h/24"** dans le header ou hero
- Footer : ajouter les horaires structurés (lundi-vendredi 8h30-18h, samedi sur RDV si applicable)

### SEO & Performance
- Balise méta description sur toutes les pages (si pas déjà fait)
- Titre de page optimisé : "GP-CARS · Véhicules d'occasion Soumagne · Garantie 1 an"
- Ajouter Schema.org `LocalBusiness` et `AutoDealer` dans le code HTML (améliore Google Maps)

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "name": "GP-CARS Associés",
  "url": "https://garagegpcars.be",
  "telephone": "+32498773611",
  "email": "info.gpcars@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Avenue de la Résistance 506",
    "addressLocality": "Soumagne",
    "postalCode": "4630",
    "addressCountry": "BE"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "08:30",
      "closes": "18:00"
    }
  ],
  "priceRange": "€€"
}
</script>
```

### Page "Nos véhicules" — améliorations optionnelles
- Filtre par budget (slider ou tranches : <10k / 10-15k / 15-20k / +20k)
- Badge "Garantie 1 an" visible sur chaque fiche
- CTA de reprise : "Vous avez un véhicule à reprendre ? Estimez maintenant →" (lien vers MADORE)

---

## CE QU'IL NE FAUT PAS MODIFIER

| Élément | Raison |
|---------|--------|
| URLs existantes (`/nos-vehicules/`, `/contactez-nous/`) | SEO — ne pas changer les slugs |
| Formulaire email actuel | Le garder comme alternative à MADORE |
| Numéros de téléphone affichés | Toujours cliquables en mobile (`tel:`) |
| Adresse affichée | Doit rester cohérente avec Google Maps |

---

## CE QUE MADORE FAIT SEUL (sans configuration supplémentaire)

Une fois le widget installé, tout ce qui suit est **automatique** :

| Fonctionnalité | Automatique |
|---------------|-------------|
| Répondre aux prospects 24h/24 | ✓ |
| Connaître le stock GP-CARS en temps réel | ✓ |
| Proposer les bons véhicules selon le budget | ✓ |
| Demander le téléphone et l'email du prospect | ✓ |
| Qualifier le lead (score 0-100, priorité ROUGE/ORANGE/VERT) | ✓ |
| Sauvegarder la conversation en base de données | ✓ |
| Alerter Michael/Francisco par email pour les leads chauds | ✓ |
| Gérer les questions sur le financement, reprise, garantie | ✓ |

**Michael et Francisco voient tous les leads dans :** `[URL-VERCEL]/gp/leads`

---

## QUESTIONS À POSER À MICHAEL / FRANCISCO AVANT DE COMMENCER

1. **Quelle est l'URL exacte de la plateforme Vercel ?**
2. **Est-ce qu'on peut aller sur `[URL-VERCEL]/madore` et parler à MADORE ?** (confirmer que c'est en ligne)
3. **Y a-t-il un accès admin WordPress** (ou autre CMS) pour modifier le footer ?
4. **Le thème actuel est-il personnalisé** ou un thème premium ? (pour savoir si on peut modifier `footer.php`)
5. **Des plugins de sécurité bloquent-ils** l'intégration d'iframes externes ? (si oui, ajouter l'URL Vercel en whitelist)

---

## EN CAS DE PROBLÈME

| Problème | Solution |
|---------|---------|
| L'iframe ne charge pas | Vérifier que `[URL-VERCEL]` est correct et accessible. Tester l'URL directement. |
| Le chat s'ouvre mais ne répond pas | Les variables d'environnement Vercel doivent être configurées par Michael/Francisco |
| Le bouton flottant est caché derrière un autre élément | Augmenter `z-index` dans le CSS (mettre `z-index: 99999`) |
| Sur mobile, le panneau dépasse de l'écran | Vérifier le CSS responsive (section `@media (max-width: 500px)`) |
| WordPress bloque le code custom | Utiliser le plugin WPCode (gratuit, fiable, sans risque pour le thème) |
| Conflit CSS avec le thème | Préfixer toutes les classes avec `gpcars-` (déjà fait dans ce code) |
