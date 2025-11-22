# Audit fonctionnel et technique — ConsolePilotageV3 (édition V3)

## Synthèse exécutive
- L'affichage des statistiques et la colonne "STRUCTURE" reposent sur des données issues de la feuille CONSOLIDATION mais manquent de garde-fous en cas de colonnes absentes ou mal nommées.
- Le comptage des profils doubles reste fragile lorsque plusieurs options sont saisies sur la même cellule : les totaux globaux divergent du détail combos.
- Le moteur d'édition des quotas (STRUCTURE) n'affiche pas d'écarts entre besoins réels (stats) et quotas saisis, ce qui rend difficile la détection d'anomalies type ESP+LATIN.

## Constats détaillés

### 1) Résilience insuffisante face aux colonnes manquantes ou mal nommées
- `calculerLV2`, `calculerOptions`, `calculerCombos` et `calculerComptagesGlobaux` utilisent directement les index déduits de l'en-tête, sans vérifier s'ils valent `-1`. En pratique, une colonne LV2/OPT absente ou renommée entraîne des lectures sur la dernière colonne du tableau (index -1), produisant des comptages incohérents et silencieux. 【F:Analytics_Stats.js†L64-L210】
- Côté interface, `loadStats` retourne simplement en cas d'échec (`success` falsy) sans feedback utilisateur, ce qui masque l'origine du problème. 【F:ConsolePilotageV3.html†L781-L810】

**Recommandation :** valider les index avant chaque boucle (ou court-circuiter avec un message clair), et afficher une erreur visible dans le panneau STATS lorsque les colonnes requises sont absentes ou mal détectées.

### 2) Écarts possibles entre détails des combos et comptage global
- Le découpage multi-options fonctionne pour les combos (`split(/[+,;/]|\s+\+\s+/)`), mais `calculerComptagesGlobaux` ne découpe pas : une cellule `"ESP / LATIN"` comptera 1 option au lieu de 2, créant un écart entre `combos` et `global`. 【F:Analytics_Stats.js†L161-L210】
- Les doublons dans une même cellule (ex. `"LATIN + LATIN"`) sont comptés deux fois sans déduplication, ce qui biaise les ratios si la saisie est bruitée. 【F:Analytics_Stats.js†L173-L187】

**Recommandation :** harmoniser la logique de découpe/déduplication entre `combos` et `global`, et contrôler les répétitions au niveau cellule.

### 3) Manque d'alertes dans le moteur STRUCTURE
- `triggerGlobalUpdate` ne signale pas les écarts entre effectifs réels (`cachedStats.global` ou `effectifs.total`) et les quotas saisis par matière ou par capacité totale ; seul le total capacité est coloré en vert quand il matche l'effectif total. 【F:ConsolePilotageV3.html†L813-L879】
- En cas d'absence de stats en cache, les totaux sont calculés sur zéro sans avertissement, ce qui peut laisser croire que les quotas sont conformes alors que les stats n'ont pas chargé. 【F:ConsolePilotageV3.html†L813-L879】

**Recommandation :** afficher des badges d'écart (positif/négatif) par colonne et un toast d'avertissement lorsque `cachedStats` est vide ou incomplet, afin de sécuriser les réglages sensibles (ESP+LATIN notamment).

### 4) UX : absence de logs utilisateur côté STATS
- Les appels `runServerCall` pour les stats et la structure loggent uniquement dans la console (`console.error`) ou via `showModal` pour la structure, mais rien n'est poussé à l'utilisateur lorsqu'une statistique n'est pas disponible ou renvoie un tableau vide. 【F:ConsolePilotageV3.html†L781-L831】

**Recommandation :** introduire des messages non intrusifs (toast) pour informer de l'état de chargement/erreur des stats et éviter les panneaux vides.

## Priorisation rapide
1. **Bloquant :** validation des index de colonnes et feedback utilisateur quand CONSOLIDATION est mal formée.
2. **Majeur :** aligner la logique de découpe multi-options entre `combos` et `global` et dédupliquer les options dans une cellule.
3. **Important :** surfacer les écarts de quotas dans l'onglet STRUCTURE et avertir lorsque les stats ne sont pas chargées.
4. **Confort :** améliorer les messages d'état (chargement/erreur) dans le panneau STATS.

## Périmètre et hypothèses
- Audit limité au front ConsolePilotageV3.html et aux calculs de `Analytics_Stats.js` (version actuelle du dépôt). Pas d'exécution de scripts ni de connexion aux données réelles dans cet environnement.
