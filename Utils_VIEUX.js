/**
 * Fonctions utilitaires pour le système de répartition
 */

/**
 * idx — Trouve l’index d’un nom de colonne dans un tableau d’en-têtes
 * @param {string[]} headerArray
 * @param {string} name
 * @param {number} def (optionnel) — valeur par défaut si non trouvé
 * @return {number} — index (1-based) ou def
 * @maintenance: Utiliser cette fonction partout, supprimer les variantes locales.
 */
function idx(headerArray, name, def = -1) {
  const i = headerArray.indexOf(name);
  return i >= 0 ? i + 1 : def;
}

/**
 * logAction — Journalise une action dans l’onglet _REGISTRE
 * @param {string} action
 * @maintenance: Utiliser cette fonction partout, supprimer les variantes locales.
 */
function logAction(action) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.REGISTRE);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.REGISTRE);
    sheet.getRange(1, 1, 1, 3)
      .setValues([['Date', 'Utilisateur', 'Action']])
      .setFontWeight('bold')
      .setBackground('#d5dbdb');
  }
  const date = new Date();
  const user = Session.getActiveUser().getEmail();
  sheet.appendRow([date, user, action]);
}

/**
 * validationRuleDEF — Crée une règle de validation DEF standardisée
 * @return {DataValidation}
 * @maintenance: Utiliser cette fonction partout, supprimer les variantes locales.
 */
function validationRuleDEF() {
  try {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(['DEF'], true)
      .setAllowInvalid(false)
      .build();
  } catch (e) {
    Logger.log('Validation DEF KO: ' + e.message);
    return null;
  }
}

/**
 * getSheetOrCreate — Récupère ou crée une feuille spéciale (utilitaire)
 * @param {string} name
 * @return {Sheet}
 * @maintenance: Utiliser cette fonction partout, supprimer les variantes locales.
 */
function getSheetOrCreate(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Retourne les feuilles « sources » :
 *   • celles dont le nom suit le motif 3°1, 4°5, 6°2, etc.
 *   • + celles listées dans _STRUCTURE (ex. ECOLE1, ECOLE2…)
 *   • toujours en excluant celles qui contiennent TEST ou DEF
 */
function getSourceSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();

  /* --- 1) Récupérer toutes les origines déclarées dans _STRUCTURE --- */
  const structNames = new Set();
  const struct = ss.getSheetByName('_STRUCTURE');
  if (struct) {
    const data   = struct.getDataRange().getValues();
    const header = data.shift().map(String);
    const iOrig  = header.indexOf('CLASSE_ORIGINE');
    if (iOrig !== -1) {
      data.forEach(r => {
        (r[iOrig] || '')
          .toString()
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(name => structNames.add(name));
      });
    }
  }

  /* --- 2) Motif pour classes sources ------------------------------- */
  // Tous les formats avec °: 1°1, 6°1, 5°3, 3°4, GAMARRA°7, ECOLE°1, etc.
  const sourcePattern = /.+°\d+$/; // ✅ Pattern universel

  /* --- 3) Filtrer les feuilles -------------------------------------- */
  return allSheets.filter(sh => {
    const name = sh.getName();
    const hasCorrectFormat = sourcePattern.test(name);
    const inStructure = structNames.has(name);
    const isTestDef = /TEST|DEF/i.test(name);
    return (hasCorrectFormat || inStructure) && !isTestDef;
  });
}

/**
 * Récupère les onglets TEST
 * @return {Sheet[]} Liste des onglets TEST
 */
function getTestSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  return sheets.filter(sheet => {
    const name = sheet.getName();
    return name.includes("TEST");
  });
}

/**
 * Récupère les onglets DEF
 * @return {Sheet[]} Liste des onglets DEF
 */
function getDefSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  return sheets.filter(sheet => {
    const name = sheet.getName();
    return name.includes("DEF") && !name.includes("BILAN") && !name.includes("STATISTIQUES");
  });
}

/**
 * Calcule l'écart type d'un ensemble de valeurs
 * @param {number[]} values - Tableau de valeurs numériques
 * @return {number} Écart type
 */
function ecartType(values) {
  if (values.length <= 1) return 0;
  
  const moyenne = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - moyenne, 2), 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Formatage conditionnel d'une valeur (rouge à vert)
 * @param {number} valeur - Valeur à formater
 * @param {number} min - Valeur minimum (rouge)
 * @param {number} max - Valeur maximum (vert)
 * @return {string} Code couleur HTML
 */
function getFormatColor(valeur, min, max) {
  // Normaliser entre 0 et 1
  const normalized = Math.max(0, Math.min(1, (valeur - min) / (max - min)));
  
  // Rouge à vert en passant par jaune
  let r, g;
  if (normalized < 0.5) {
    r = 255;
    g = Math.round(normalized * 2 * 255);
  } else {
    r = Math.round((1 - normalized) * 2 * 255);
    g = 255;
  }
  
  return `rgb(${r}, ${g}, 0)`;
}

/**
 * Enregistre une action dans le journal
 * @param {string} action - Description de l'action
 */
function logAction(action) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const journalSheet = ss.getSheetByName(CONFIG.SHEETS.JOURNAL);

  if (journalSheet) {
    const timestamp = new Date().toISOString();

    // ✅ FIX: Gestion des autorisations manquantes pour Session.getEffectiveUser()
    let user = 'Utilisateur';
    try {
      user = Session.getEffectiveUser().getEmail();
    } catch (e) {
      // Si l'autorisation userinfo.email n'est pas accordée, utiliser un fallback
      try {
        user = Session.getActiveUser().getEmail() || 'Utilisateur';
      } catch (e2) {
        user = 'Utilisateur';
      }
    }

    const newRow = journalSheet.getLastRow() + 1;
    journalSheet.getRange(newRow, 1, 1, 3).setValues([[timestamp, action, user]]);
  }
}

/**
 * Crée ou récupère un onglet par son nom
 * @param {string} nomOnglet - Nom de l'onglet
 * @return {Sheet} L'onglet créé ou récupéré
 */
function getOrCreateSheet(nomOnglet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nomOnglet);
  
  if (!sheet) {
    sheet = ss.insertSheet(nomOnglet);
  }
  
  return sheet;
}

/**
 * Corrige la notation scientifique dans tous les onglets du classeur
 * Convertit par exemple 6,00E+05 en 6E5
 */
function corrigerNotationScientifique() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Confirmation avant exécution
  const response = ui.alert(
    "Correction de la notation scientifique",
    "Cette opération va corriger les notations scientifiques dans tous les onglets (6,00E+05 -> 6E5).\n\nVoulez-vous continuer ?",
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) return;
  
  // Récupérer tous les onglets
  const allSheets = ss.getSheets();
  let totalCorrections = 0;
  
  for (const sheet of allSheets) {
    // Traitement spécifique de l'onglet _STRUCTURE
    if (sheet.getName() === CONFIG.SHEETS.STRUCTURE) {
      const dataRange = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1); // Colonne B (Nom)
      const values = dataRange.getValues();
      const formattedValues = [];
      
      let hasChanges = false;
      for (const row of values) {
        const cellValue = String(row[0]);
        // Rechercher un motif comme 6,00E+05 et le remplacer par 6E5
        const newValue = cellValue.replace(/(\d+),00E\+0(\d+)/g, '$1E$2');
        formattedValues.push([newValue]);
        
        if (newValue !== cellValue) {
          hasChanges = true;
          totalCorrections++;
        }
      }
      
      if (hasChanges) {
        dataRange.setValues(formattedValues);
        dataRange.setNumberFormat('@'); // Forcer le format texte
      }
    }
  }
  
  ui.alert(`Correction terminée. ${totalCorrections} valeurs ont été corrigées.`);
}

/**
 * Vérifie le mot de passe d'administration
 * @param {string} action - L'action qui nécessite une vérification de mot de passe
 * @return {boolean} - true si le mot de passe est correct, false sinon
 */
function verifierMotDePasse(action) {
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();
  const motDePasseAdmin = config.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD_DEFAULT;
  
  const reponse = ui.prompt(
    action + " - Vérification",
    "Veuillez entrer le mot de passe administrateur :",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (reponse.getSelectedButton() !== ui.Button.OK) {
    return false;
  }
  
  const motDePasse = reponse.getResponseText();
  
  if (motDePasse !== motDePasseAdmin) {
    ui.alert("Mot de passe incorrect");
    return false;
  }
  
  return true;
}

/**
 * Vérifie le mot de passe envoyé depuis le client (pour Console.html)
 * @param {string} password - Le mot de passe entré par l'utilisateur
 * @return {boolean} - true si le mot de passe est correct, false sinon
 */
function verifierMotDePasseServeur(password) {
  const config = getConfig();
  const motDePasseAdmin = config.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD_DEFAULT;
  
  return password === motDePasseAdmin;
}

/**
 * Fonction utilitaire pour trouver l'index d'une colonne basé sur des noms d'en-tête possibles.
 * @param {string[]} headers - Tableau des chaînes d'en-tête en minuscules et nettoyées (trim()).
 * @param {string[]} possibleNames - Tableau des noms possibles en minuscules pour la colonne.
 * @return {number} L'index (base 0) ou -1 si non trouvé.
 */
function findColumnIndex(headers, possibleNames) {
  // Recherche d'une correspondance exacte d'abord
  for (const name of possibleNames) {
    const index = headers.indexOf(name);
    if (index !== -1) {
      // Logger.log(`Correspondance exacte trouvée pour '${name}' à l'index ${index}`); // Décommentez pour débogage
      return index; // Retourne dès qu'un nom exact est trouvé
    }
  }

  // Optionnel : Si aucune correspondance exacte, rechercher une correspondance partielle (plus risqué)
  // À n'utiliser que si les en-têtes peuvent vraiment varier beaucoup.
  /*
  Logger.log(`Aucune correspondance exacte trouvée pour [${possibleNames.join(', ')}]. Tentative de recherche partielle.`);
  for (const name of possibleNames) {
    for (let i = 0; i < headers.length; i++) {
      // Vérifie si l'en-tête inclut un des noms possibles (ex: 'comportement général' inclut 'comportement')
      if (headers[i].includes(name)) {
         Logger.log(`Correspondance partielle trouvée pour '${name}' dans l'en-tête '${headers[i]}' à l'index ${i}`);
         return i;
      }
    }
  }
  */

  // Si toujours pas trouvé après la recherche exacte (et la recherche partielle si activée)
  // Logger.log(`Aucune colonne trouvée pour les noms possibles : [${possibleNames.join(', ')}]`); // Décommentez pour débogage
  return -1; // Retourne -1 si aucun nom n'est trouvé
}

/**
 * Détermine si un nom de feuille correspond à une classe source
 * @param {string} name - Nom de la feuille
 * @return {boolean} - True si c'est une classe source
 */
function isSourceClassName(name) {
  if (!name || typeof name !== 'string') return false;
  
  // Nettoyer le nom : supprimer espaces et normaliser les caractères
  const cleanName = String(name).toUpperCase()
    .replace(/\s+/g, '') // Supprimer TOUS les espaces
    .replace(/[ºo]/g, '°') // Normaliser les caractères de degré
    .trim();
  
  // Exclure tout ce qui est test, def, config, etc.
  if (
    cleanName.includes('TEST') || cleanName.includes('TST') ||
    cleanName.includes('DEF') || cleanName.includes('CONFIG') ||
    cleanName.includes('CONSOLE') || cleanName.includes('PARAM') ||
    cleanName.includes('BILAN') || cleanName.includes('STAT')
  ) {
    return false;
  }
  
  // REGEX CORRIGÉ : Accepte 3°1, 4°2, 5°10, 6°15, etc.
  // ^[3-6] = commence par 3, 4, 5, ou 6
  // ° = caractère degré OBLIGATOIRE
  // [1-9]\d* = chiffre de 1-9 suivi de 0 ou plus de chiffres (1, 2, 10, 11, 123, etc.)
  const sourcePattern = /^[3-6]°[1-9]\d*$/;
  
  if (sourcePattern.test(cleanName)) {
    Logger.log(`✅ Classe source détectée: "${name}" -> "${cleanName}"`);
    return true;
  }
  
  // Accepte aussi SRC/SOURCE si nécessaire
  if (cleanName.includes('SRC') || cleanName.includes('SOURCE')) {
    Logger.log(`✅ Classe source (SRC) détectée: "${name}" -> "${cleanName}"`);
    return true;
  }
  
  Logger.log(`❌ Classe source rejetée: "${name}" -> "${cleanName}"`);
  return false;
}

/**
 * Fonction de logging UNIFIÉE pour les statistiques de répartition.
 * Affiche les statistiques de base et optionnellement les statistiques "extra".
 * 
 * @param {string} label - Un libellé pour identifier les stats (ex: "Initiales V14", "Finales Phase 5").
 * @param {object} stats - L'objet de statistiques à logger. Doit contenir au moins:
 *                         stats.tetesDeClasse = { moyenne, ecartType }
 *                         stats.niveau1 = { moyenne, ecartType }
 *                         stats.distribution = { ecartMoyen }
 *                         stats.extra (optionnel) = { key1: { moyenne, ecartType }, key2: ... }
 * @param {string[]} [extraKeys] - (Optionnel) Tableau des clés des statistiques "extra" à afficher.
 *                                Si non fourni ou vide, les stats extra ne sont pas logguées dynamiquement.
 *                                Si fourni, seules les clés de ce tableau présentes dans stats.extra seront logguées.
 */
function logStats(label, stats, extraKeys) { // Un seul nom : logStats
    Logger.log(`--- Statistiques ${label} ---`); // Ou Utils.logAction(`--- Statistiques ${label} ---`);
    try { 
        if (!stats || !stats.tetesDeClasse || !stats.niveau1 || !stats.distribution) {
            Logger.log(`logStats (Utils): Objet 'stats' ou ses propriétés clés sont manquantes/invalides pour le label '${label}'.`); 
            return; 
        }
        
        Logger.log(` Têtes Classe ET = ${stats.tetesDeClasse.ecartType?.toFixed(3) ?? "N/A"} (Moy: ${stats.tetesDeClasse.moyenne?.toFixed(2) ?? "N/A"})`); 
        Logger.log(` Niveau 1 ET     = ${stats.niveau1.ecartType?.toFixed(3) ?? "N/A"} (Moy: ${stats.niveau1.moyenne?.toFixed(2) ?? "N/A"})`); 
        Logger.log(` Distribution RMSE = ${stats.distribution.ecartMoyen?.toFixed(3) ?? "N/A"}`); 
        
        if (stats.extra) {
            const keysToLog = Array.isArray(extraKeys) && extraKeys.length > 0 
                              ? extraKeys 
                              : Object.keys(stats.extra); // Si extraKeys non fourni, loggue toutes les clés de stats.extra

            if (keysToLog.length > 0) {
                Logger.log(" Stats supplémentaires :");
                keysToLog.forEach(key => { 
                    if (stats.extra[key]) { 
                        const keyLabel = String(key).toUpperCase().padEnd(7); // Ex: "COM1   "
                        Logger.log(`  ${keyLabel} ET = ${stats.extra[key].ecartType?.toFixed(3) ?? "N/A"} (Moy: ${stats.extra[key].moyenne?.toFixed(2) ?? "N/A"})`); 
                    } else if (Array.isArray(extraKeys) && extraKeys.includes(key)) { // Si la clé était demandée mais non trouvée
                        Logger.log(`  ${String(key).toUpperCase().padEnd(7)} ET = N/A (clé non trouvée dans stats.extra)`);
                    }
                });
            } else if (Object.keys(stats.extra).length > 0 && (!Array.isArray(extraKeys) || extraKeys.length === 0) ) {
                Logger.log(" (stats.extra existe mais aucune clé spécifique demandée via extraKeys et Object.keys(stats.extra) est vide après filtrage implicite - étrange)");
            }
        }
    } catch (e) { 
        Logger.log(`WARN logStats (Utils) (${label}): ${e.message}`); 
        // Logger.log(`Stats problématiques: ${JSON.stringify(stats)}`); // Peut être trop verbeux
    } 
}
// Dans Utils.gs (ou votre fichier d'utilitaires global)

/**
 * Loggue les améliorations entre des statistiques initiales et finales.
 * Utilisé pour évaluer l'efficacité d'un processus d'optimisation.
 * 
 * @param {object} statsInitiales - L'objet de statistiques avant l'optimisation.
 * @param {object} statsFinales - L'objet de statistiques après l'optimisation.
 * @param {string[]} [extraKeys] - (Optionnel) Tableau des clés des statistiques "extra" à comparer.
 * @return {object} Un objet contenant { comparaisonEquilibre: object } pour l'affichage UI.
 */
function logAmeliorations(statsInitiales, statsFinales, extraKeys) { 
    // Fonction interne pour calculer le delta pour une métrique donnée
    const calcDelta = (k, sk = null, m = 'ecartType') => {
      const iS = sk ? statsInitiales?.[k]?.[sk] : statsInitiales?.[k];
      const fS = sk ? statsFinales?.[k]?.[sk] : statsFinales?.[k];
      const iV = iS?.[m]; 
      const fV = fS?.[m];
      
      if (typeof iV !== 'number' || isNaN(iV) || typeof fV !== 'number' || isNaN(fV)) {
        // Logger.log(`WARN calcDelta: Données invalides pour ${k}${sk ? '.'+sk : ''}.${m} (Initial: ${iV}, Final: ${fV})`);
        return { avant: NaN, apres: NaN, amelioration: NaN, evolutionPercent: NaN };
      }
      const am = iV - fV;
      const evolutionPercent = iV !== 0 ? (am / Math.abs(iV)) * 100 : (am === 0 ? 0 : (am > 0 ? Infinity : -Infinity));
      return { avant: iV, apres: fV, amelioration: am, evolutionPercent: evolutionPercent };
    };

    const deltas = {
        tetesDeClasse: calcDelta('tetesDeClasse'),
        niveau1: calcDelta('niveau1'),
        distribution: calcDelta('distribution', null, 'ecartMoyen')
    }; 
    
    (extraKeys || []).forEach(key => {
        if (key && typeof key === 'string') { // S'assurer que la clé est valide
            deltas[key] = calcDelta('extra', key); // Compare statsInitiales.extra[key] avec statsFinales.extra[key]
        }
    });
    
    const fmt = (l, d) => {
        if (!d || isNaN(d.amelioration)) return `${String(l).padEnd(18)} : N/A`; 
        return `${String(l).padEnd(18)} : ${d.amelioration.toFixed(3)} (${d.avant.toFixed(3)} → ${d.apres.toFixed(3)}) Évol: ${d.evolutionPercent.toFixed(1)}%`;
    };
    
    Logger.log(`--- Améliorations (calculées par Utils.logAmeliorations) ---`); 
    Logger.log(fmt('Δ Têtes É.T.', deltas.tetesDeClasse)); 
    Logger.log(fmt('Δ Niveau 1 É.T.', deltas.niveau1)); 
    Logger.log(fmt('Δ Distrib. RMSE', deltas.distribution)); 
    
    (extraKeys || []).forEach(key => {
        if (key && deltas[key]) { // Vérifie que deltas[key] existe (si calcDelta a retourné un objet valide)
            Logger.log(fmt(`Δ ${String(key).toUpperCase()} É.T.`, deltas[key]));
        }
    });
    
    const comparaisonPourUI = {}; 
    for (const key in deltas) { 
        if (deltas.hasOwnProperty(key) && deltas[key]) { 
            comparaisonPourUI[key] = {
                avant: !isNaN(deltas[key].avant) ? deltas[key].avant : 0, 
                apres: !isNaN(deltas[key].apres) ? deltas[key].apres : 0, 
                amelioration: !isNaN(deltas[key].amelioration) ? deltas[key].amelioration : 0, 
                evolutionPercent: !isNaN(deltas[key].evolutionPercent) ? deltas[key].evolutionPercent : 0
            }; 
        }
    } 
    return { comparaisonEquilibre: comparaisonPourUI };
}

// Potentiellement, votre fonction logStats unifiée est aussi dans ce fichier Utils.gs
/*
function logStats(label, stats, extraKeys) {
    // ... (corps de la fonction logStats unifiée) ...
}
*/

// ... autres fonctions utilitaires de votre fichier Utils.gs ...
// Dans Utils.js - Proposition d'évolution pour idx
function idx(headerArray, nameOrAliases, def = -1) {
  const namesToSearch = Array.isArray(nameOrAliases) ? nameOrAliases : [nameOrAliases];
  for (const name of namesToSearch) {
    const i = headerArray.map(h => String(h).trim().toUpperCase()).indexOf(String(name).trim().toUpperCase());
    if (i >= 0) return i + 1; // Toujours 1-basé
  }
  return def;
}

/**
 * Récupère la première ligne d'une feuille comme tableau d'en-têtes.
 * Normalise optionnellement les en-têtes (trim, toUpperCase).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet L'objet feuille.
 * @param {boolean} [normalize=true] Optionnel. Si true, normalise les en-têtes.
 * @return {string[]} Un array des en-têtes (0-basé), ou un array vide si erreur ou feuille vide.
 */
function getHeaders(sheet, normalize = true) {
  if (!sheet || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    Logger.log(`WARN getHeaders: Feuille invalide, vide ou sans colonnes: ${sheet ? sheet.getName() : 'Feuille NULL'}`);
    return [];
  }
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (normalize) {
      // S'assurer que normalizeHeader est aussi une fonction globale dans Utils.gs
      const normalizeFn = typeof normalizeHeader === 'function' ? normalizeHeader : function(s) { return String(s||"").replace(/[\s\u00A0\u200B-\u200D]/g, "").toUpperCase(); };
      return headers.map(h => normalizeFn(String(h || "")));
    }
    return headers.map(h => String(h || "")); // Retourne les chaînes brutes si pas de normalisation
  } catch (e) {
    Logger.log(`ERREUR getHeaders pour feuille ${sheet.getName()}: ${e.message}`);
    return []; // Retourne un array vide en cas d'erreur
  }
}

// Assurez-vous que normalizeHeader existe aussi si getHeaders(..., true) est utilisé
function normalizeHeader(s) {
  return String(s||"").replace(/[\s\u00A0\u200B-\u200D]/g, "").toUpperCase();
}
// Utilisation:
// Utils.idx(headers, CFG.COLUMN_NAMES.COM) // Si COM est le nom direct
// Utils.idx(headers, CFG.COLUMN_ALIASES.COM) // Si COM_ALIASES est ["COM", "COMPORTEMENT"]

// ===================================================================
// FONCTIONS POUR CONSOLE.HTML (à ajouter dans un fichier existant)
// ===================================================================

/**
 * Charger la structure en distinguant LV2 et Options
 * Remplace ou complète chargerStructure()
 */
function chargerStructureAvecTypes() {
  try {
    Logger.log("=== CHARGEMENT STRUCTURE AVEC TYPES LV2/OPTIONS ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getConfig();
    
    const result = {
      classes: [],
      lv2Disponibles: [],
      optionsDisponibles: [],
      general: {}
    };
    
    // 1. PARAMÈTRES GÉNÉRAUX
    result.general = {
      niveau: config.NIVEAU || "4°",
      motDePasse: config.ADMIN_PASSWORD || "",
      maxSwaps: config.MAX_SWAPS || 30,
      toleranceParite: config.PARITY_TOLERANCE || 2
    };
    
    // 2. CHARGER LV2 ET OPTIONS DEPUIS _CONFIG
    const configSheet = ss.getSheetByName("_CONFIG");
    if (configSheet) {
      const data = configSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const param = String(data[i][0]).trim().toUpperCase();
        const value = data[i][1];
        
        if (param === "LV2" && value) {
          // LV2 définies lors de l'initialisation
          result.lv2Disponibles = String(value).split(',')
            .map(item => item.trim().toUpperCase())
            .filter(Boolean);
          Logger.log(`✅ LV2 disponibles: ${result.lv2Disponibles.join(', ')}`);
          
        } else if (param === "OPT" && value) {
          // Options définies lors de l'initialisation  
          result.optionsDisponibles = String(value).split(',')
            .map(item => item.trim().toUpperCase())
            .filter(Boolean);
          Logger.log(`✅ Options disponibles: ${result.optionsDisponibles.join(', ')}`);
        }
      }
    }
    
    // 3. FALLBACK si LV2/Options pas trouvées dans _CONFIG
    if (result.lv2Disponibles.length === 0) {
      // Chercher dans config.OPTIONS du niveau
      const niveau = result.general.niveau;
      const niveauKey = niveau.toLowerCase().replace('°', 'e');
      
      if (config.OPTIONS && config.OPTIONS[niveauKey]) {
        // Pour l'instant, on met tout dans optionsDisponibles
        // L'utilisateur devra clarifier via l'interface
        result.optionsDisponibles = config.OPTIONS[niveauKey];
        Logger.log(`⚠️ Pas de distinction LV2/OPT trouvée, tout mis dans options: ${result.optionsDisponibles.join(', ')}`);
      }
    }
    
    // 4. CHARGER LA STRUCTURE DES CLASSES (identique à avant)
    const structureSheet = ss.getSheetByName("_STRUCTURE");
    if (structureSheet && structureSheet.getLastRow() > 1) {
      const headers = structureSheet.getRange(1, 1, 1, structureSheet.getLastColumn()).getValues()[0];
      const data = structureSheet.getRange(2, 1, structureSheet.getLastRow() - 1, headers.length).getValues();
      
      // Trouver les colonnes (format actuel préservé)
      const origineIndex = headers.findIndex(h => String(h).toUpperCase().includes('ORIGINE') || String(h).toUpperCase().includes('CLASSE'));
      const destIndex = headers.findIndex(h => String(h).toUpperCase().includes('DEST'));
      const effectifIndex = headers.findIndex(h => String(h).toUpperCase().includes('EFFECTIF'));
      const optionsIndex = headers.findIndex(h => String(h).toUpperCase().includes('OPTIONS'));
      
      data.forEach(row => {
        if (row[origineIndex] && String(row[origineIndex]).trim()) {
          const classeData = {
            origine: String(row[origineIndex] || '').trim(),
            destination: String(row[destIndex] || '').trim(),
            effectif: parseInt(row[effectifIndex]) || 28,
            options: [] // Format unifié (comme avant)
          };
          
          // Parser les options (format identique : "ITA=12,CHAV=8")
          if (optionsIndex >= 0 && row[optionsIndex]) {
            const optionsStr = String(row[optionsIndex]).trim();
            if (optionsStr) {
              const optionsParts = optionsStr.split(',');
              optionsParts.forEach(part => {
                const match = part.trim().match(/^([A-Z]+)[=:]\s*(\d+)$/i);
                if (match) {
                  classeData.options.push({
                    nom: match[1].toUpperCase(),
                    quota: parseInt(match[2]) || 0
                  });
                }
              });
            }
          }
          
          result.classes.push(classeData);
        }
      });
    }
    
    Logger.log(`Structure chargée: ${result.classes.length} classes`);
    Logger.log(`LV2: [${result.lv2Disponibles.join(', ')}]`);
    Logger.log(`Options: [${result.optionsDisponibles.join(', ')}]`);
    
    return result;
    
  } catch (e) {
    Logger.log(`❌ Erreur chargerStructureAvecTypes: ${e.message}`);
    return {
      classes: [],
      lv2Disponibles: [],
      optionsDisponibles: [],
      general: { niveau: "4°", motDePasse: "", maxSwaps: 30, toleranceParite: 2 },
      error: e.message
    };
  }
}

/**
 * Sauvegarder en préservant le format _STRUCTURE
 * (Cette fonction peut remplacer ou compléter sauvegarderStructure)
 */
function sauvegarderStructureAvecTypes(structureData) {
  try {
    Logger.log("=== SAUVEGARDE AVEC PRÉSERVATION FORMAT _STRUCTURE ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Sauvegarder LV2 et Options séparément dans _CONFIG
    if (structureData.lv2Disponibles && structureData.lv2Disponibles.length > 0) {
      updateConfig("LV2", structureData.lv2Disponibles.join(','));
      Logger.log(`LV2 sauvegardées: ${structureData.lv2Disponibles.join(',')}`);
    }
    
    if (structureData.optionsDisponibles && structureData.optionsDisponibles.length > 0) {
      updateConfig("OPT", structureData.optionsDisponibles.join(','));
      Logger.log(`Options sauvegardées: ${structureData.optionsDisponibles.join(',')}`);
    }
    
    // 2. Sauvegarder la structure des classes dans _STRUCTURE (FORMAT IDENTIQUE)
    if (structureData.classes && structureData.classes.length > 0) {
      const structureSheet = ss.getSheetByName("_STRUCTURE");
      if (structureSheet) {
        // Effacer les données existantes (garder les en-têtes)
        if (structureSheet.getLastRow() > 1) {
          structureSheet.getRange(2, 1, structureSheet.getLastRow() - 1, structureSheet.getLastColumn()).clearContent();
        }
        
        // Écrire les nouvelles données (FORMAT IDENTIQUE À AVANT)
        const dataToWrite = [];
        structureData.classes.forEach(classe => {
          // Combiner toutes les options dans le format unifié : "ITA=12,CHAV=8"
          const optionsStr = classe.options && classe.options.length > 0
            ? classe.options
                .filter(opt => opt.nom && opt.quota > 0)
                .map(opt => `${opt.nom}=${opt.quota}`)
                .join(',')
            : '';
          
          dataToWrite.push([
            classe.origine || '',
            classe.destination || '',
            classe.effectif || 28,
            optionsStr,  // ← FORMAT IDENTIQUE : "ITA=12,CHAV=8"
            ''           // Observations
          ]);
          
          if (optionsStr) {
            Logger.log(`Classe ${classe.origine}: OPTIONS="${optionsStr}"`);
          }
        });
        
        if (dataToWrite.length > 0) {
          structureSheet.getRange(2, 1, dataToWrite.length, 5).setValues(dataToWrite);
        }
      }
    }
    
    // 3. Sauvegarder les paramètres généraux
    if (structureData.general) {
      if (structureData.general.niveau) updateConfig("NIVEAU", structureData.general.niveau);
      if (structureData.general.maxSwaps) updateConfig("MAX_SWAPS", structureData.general.maxSwaps);
      if (structureData.general.toleranceParite) updateConfig("PARITY_TOLERANCE", structureData.general.toleranceParite);
      if (structureData.general.motDePasse) updateConfig("ADMIN_PASSWORD", structureData.general.motDePasse);
    }
    
    logAction("Sauvegarde Console avec types LV2/Options réussie");
    
    return {
      success: true,
      message: `Configuration sauvegardée avec succès !\n\n✅ _STRUCTURE préservée (format identique)\n✅ LV2 et Options distinguées dans _CONFIG\n✅ Interface utilisateur améliorée`
    };
    
  } catch (e) {
    Logger.log(`❌ Erreur sauvegarderStructureAvecTypes: ${e.message}`);
    return {
      success: false,
      message: `Erreur lors de la sauvegarde: ${e.message}`
    };
  }
}
/**
 * Fonction de diagnostic pour vérifier la détection des classes sources
 * À exécuter depuis l'éditeur de script pour diagnostiquer les problèmes
 */
function diagnostiquerDetectionClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  Logger.log("=== DIAGNOSTIC DÉTECTION CLASSES SOURCES ===");
  Logger.log(`Total d'onglets dans le classeur: ${sheets.length}`);
  
  let sourcesDetectees = 0;
  let testDetectees = 0;
  let defDetectees = 0;
  let autresDetectees = 0;
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    const isSource = isSourceClassName(name);
    const isTest = name.toUpperCase().includes('TEST') || name.toUpperCase().includes('TST');
    const isDef = name.toUpperCase().includes('DEF');
    
    if (isSource) {
      sourcesDetectees++;
      Logger.log(`✅ SOURCE: "${name}"`);
    } else if (isTest) {
      testDetectees++;
      Logger.log(`🧪 TEST: "${name}"`);
    } else if (isDef) {
      defDetectees++;
      Logger.log(`✅ DEF: "${name}"`);
    } else {
      autresDetectees++;
      Logger.log(`📁 AUTRE: "${name}"`);
    }
  });
  
  Logger.log("=== RÉSUMÉ ===");
  Logger.log(`Classes SOURCES détectées: ${sourcesDetectees}`);
  Logger.log(`Classes TEST détectées: ${testDetectees}`);
  Logger.log(`Classes DEF détectées: ${defDetectees}`);
  Logger.log(`Autres onglets: ${autresDetectees}`);
  
  if (sourcesDetectees === 0) {
    Logger.log("❌ PROBLÈME: Aucune classe source détectée !");
    Logger.log("Vérifiez le nommage de vos onglets (format attendu: 6°1, 5°2, etc.)");
  }
  
  return {
    sources: sourcesDetectees,
    test: testDetectees,
    def: defDetectees,
    autres: autresDetectees
  };
}
/**
 * Fonction de test complète pour valider la détection et l'extraction des données
 * À exécuter depuis l'éditeur de script pour tester
 */
function testerDetectionCompleteClasses() {
  Logger.log("=== TEST COMPLET DE DÉTECTION DES CLASSES ===");
  
  // Test 1: Diagnostic des classes
  const diagnostic = diagnostiquerDetectionClasses();
  
  // Test 2: Extraction des données sources
  Logger.log("\n=== TEST EXTRACTION DONNÉES SOURCES ===");
  try {
    const sourceData = obtenirDonneesDetailleesPlageEleves('sources');
    Logger.log(`Données sources extraites: ${sourceData.length} classes`);
    sourceData.forEach(classe => {
      const totalEleves = classe.female + classe.male;
      Logger.log(`  - ${classe.class}: ${totalEleves} élèves (F:${classe.female}, M:${classe.male})`);
    });
  } catch (e) {
    Logger.log(`❌ Erreur extraction sources: ${e.message}`);
  }
  
  // Test 3: Extraction des données test
  Logger.log("\n=== TEST EXTRACTION DONNÉES TEST ===");
  try {
    const testData = obtenirDonneesDetailleesPlageEleves('test');
    Logger.log(`Données test extraites: ${testData.length} classes`);
    testData.forEach(classe => {
      const totalEleves = classe.female + classe.male;
      Logger.log(`  - ${classe.class}: ${totalEleves} élèves (F:${classe.female}, M:${classe.male})`);
    });
  } catch (e) {
    Logger.log(`❌ Erreur extraction test: ${e.message}`);
  }
  
  // Test 4: Extraction des données def
  Logger.log("\n=== TEST EXTRACTION DONNÉES DEF ===");
  try {
    const defData = obtenirDonneesDetailleesPlageEleves('def');
    Logger.log(`Données def extraites: ${defData.length} classes`);
    defData.forEach(classe => {
      const totalEleves = classe.female + classe.male;
      Logger.log(`  - ${classe.class}: ${totalEleves} élèves (F:${classe.female}, M:${classe.male})`);
    });
  } catch (e) {
    Logger.log(`❌ Erreur extraction def: ${e.message}`);
  }
  
  Logger.log("\n=== FIN DU TEST ===");
  return {
    diagnostic: diagnostic,
    testComplete: true
  };
}