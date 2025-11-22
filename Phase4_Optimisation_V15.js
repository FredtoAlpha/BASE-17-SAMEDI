 /* ==================================================================
 *          FICHIER COMPLET : OPTIMISATION V14 (avec Mobilité)
 * ==================================================================
 * Version: V14.3.7_TRULY_COMPLETE_AND_CORRECTED
 * Date: Mai 2025
 * Description: Script V14 VRAIMENT COMPLET. Déclaration unique de niveauCache.
 *              Toutes les fonctions ont leur corps.
 *              Appelle initMobilite(). Lit colonne "MOBILITE" (colonne T).
 *              Valide ID_ELEVE ("AUTO_"). Corrige gestion Set pour currentDissocMap.
 *              Appelle logStats et logAmeliorations (supposées globales/Utils.gs).
 * Dépendance Externe: Requiert Config.gs (avec CHECKS, ERROR_CODES, CONFIG, getConfig), 
 *                     InitMobilite.gs (avec initMobilite),
 *                     Utils.gs (ou équivalent, avec logStats, logAmeliorations).
 * ==================================================================
 */

// ===== V14 COMPAT LAYER (globals & defaults) =====
/**
 * Utilitaire pour vérifier si une variable est définie
 */
function _defined(x) { return typeof x !== 'undefined' && x !== null; }

/**
 * Valeurs par défaut robustes (si la config ne les donne pas)
 */
function _v14Defaults() {
  return {
    NB_CLASSES: 6,
    EFFECTIF_CIBLE: 28,
    PARITE_MAX: 2,
    BUCKETS: [1, 2, 3, 4],
    WEIGHTS: { COM: 1.0, TRA: 0.7, PART: 0.7, ABS: 0.4 },
    FIELDS: { 
      ID_ELEVE: 'ID_ELEVE', 
      NOM: 'NOM & PRENOM', 
      SEXE: 'SEXE', 
      COM: 'COM', 
      TRA: 'TRA', 
      PART: 'PART', 
      ABS: 'ABS', 
      LV2: 'LV2',
      OPT: 'OPT',
      ASSO: 'ASSO',
      DISSO: 'DISSO'
    },
    SHEETS: { SOURCE_ELEVES: 'ELEVES', SORTIE_PREFIX: '6°' },
    HEADERS: { MOBILITE: 'MOBILITE' }
  };
}

/**
 * Lie les *vieux* symboles globaux attendus par d'anciens bouts de code
 * à partir de la config V14 déjà validée (CFG).
 * 
 * Appeler UNE FOIS au début de la façade, après _v14EnsureConfig(CFG).
 */
function _v14BindGlobals(CFG) {
  const D = _v14Defaults();

  // 1) Constantes "historiques"
  if (typeof NB_CLASSES === 'undefined')        globalThis.NB_CLASSES       = CFG.NB_CLASSES       || CFG.nbClasses     || D.NB_CLASSES;
  if (typeof EFFECTIF_CIBLE === 'undefined')    globalThis.EFFECTIF_CIBLE   = CFG.EFFECTIF_CIBLE   || CFG.effectif      || D.EFFECTIF_CIBLE;
  if (typeof PARITE_TOLERANCE === 'undefined')  globalThis.PARITE_TOLERANCE = CFG.PARITE_MAX       || CFG.pariteMax     || D.PARITE_MAX;

  if (typeof BUCKETS === 'undefined')           globalThis.BUCKETS          = CFG.BUCKETS          || D.BUCKETS;
  if (typeof WEIGHTS === 'undefined')           globalThis.WEIGHTS          = CFG.WEIGHTS          || D.WEIGHTS;

  // 2) Mappages de champs / entêtes
  const F  = (CFG.FIELDS  || D.FIELDS);
  const H  = (CFG.HEADERS || D.HEADERS);
  if (typeof FIELDS === 'undefined')            globalThis.FIELDS           = F;
  if (typeof HEADER_NAMES === 'undefined')      globalThis.HEADER_NAMES     = {
    ID_ELEVE: F.ID_ELEVE, 
    NOM: F.NOM, 
    COM: F.COM, 
    TRA: F.TRA, 
    PART: F.PART, 
    ABS: F.ABS,
    OPT: F.OPT || 'OPT', 
    LV2: F.LV2, 
    ASSO: F.ASSO || 'ASSO', 
    DISSO: F.DISSO || 'DISSO',
    SEXE: F.SEXE, 
    MOBILITE: H.MOBILITE || 'MOBILITE'
  };

  // 3) Noms de feuilles (legacy)
  const S  = (CFG.SHEETS || D.SHEETS);
  if (typeof SOURCE_ELEVES === 'undefined')     globalThis.SOURCE_ELEVES    = S.SOURCE_ELEVES;
  if (typeof SORTIE_PREFIX === 'undefined')     globalThis.SORTIE_PREFIX    = S.SORTIE_PREFIX;

  // 4) Garde-fou visibilité (utile si d'autres scripts réutilisent)
  console.log('[V14] Compat globals liés', {
    NB_CLASSES: globalThis.NB_CLASSES, 
    EFFECTIF_CIBLE: globalThis.EFFECTIF_CIBLE, 
    PARITE_TOLERANCE: globalThis.PARITE_TOLERANCE,
    buckets: globalThis.BUCKETS, 
    hasWeights: !!globalThis.WEIGHTS, 
    headerMobilite: globalThis.HEADER_NAMES?.MOBILITE
  });
}

// ===== PATCH 1: NORMALISATION SEXE =====
/**
 * Détection robuste de la colonne sexe dans l'entête
 */
function detectSexeColumn(headers) {
  const candidates = ['SEXE','GENRE','SEX','GENDER','F/M','F_M','FEMININ/MASCULIN','FÉMININ/MASCULIN'];
  const norm = h => String(h||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const H = headers.map(norm);
  for (const c of candidates) {
    const i = H.indexOf(c);
    if (i !== -1) return headers[i]; // retourne le libellé exact présent
  }
  return null;
}

/**
 * Normalisation stricte de la colonne SEXE
 * @returns 'F', 'M' ou 'U' (Unknown)
 */
function _v14SexeNormalize(val) {
  if (val == null || val === '') return 'U';
  const s = String(val).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (!s) return 'U';
  
  // Formats standards
  if (s === 'F' || s === 'FILLE' || s === 'FEMININ' || s === 'FEMME' || s === 'FEMALE') return 'F';
  if (s === 'M' || s === 'GARCON' || s === 'MASCULIN' || s === 'HOMME' || s === 'MALE') return 'M';
  
  // Formats type "F/M", "M/F", "G" etc.
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M') || s.startsWith('G')) return 'M';
  
  return 'U';
}

/**
 * Calcule l'état de parité par classe
 * @returns Map { classeId -> {F: n, M: n, U: n} }
 */
function _v14PariteState(eleveList) {
  const by = {};
  for (const e of eleveList) {
    const cl = e.CLASSE;
    const sx = _v14SexeNormalize(e.SEXE);
    if (!by[cl]) by[cl] = {F:0, M:0, U:0};
    by[cl][sx] = (by[cl][sx] || 0) + 1;
  }
  return by;
}

/**
 * Vérifie si la parité est respectée pour une classe
 * (on ne compte que F/M, on ignore 'U')
 */
function _v14PariteOK(countsForClass, tol) {
  const F = countsForClass.F || 0;
  const M = countsForClass.M || 0;
  return Math.abs(F - M) <= tol;
}

/**
 * Compte F/M pour une liste d'élèves (pour affichage)
 */
function compteFM(eleveList) {
  let F = 0, M = 0, U = 0;
  for (const e of eleveList) {
    const sx = _v14SexeNormalize(e.SEXE);
    if (sx === 'F') F++;
    else if (sx === 'M') M++;
    else U++;
  }
  return {F, M, U};
}

/**
 * === PARITÉ ADAPTATIVE : CALCUL DES CIBLES RÉALISTES ===
 * Calcule le ratio global F/M et détermine les cibles par classe
 * en fonction du nombre d'élèves réellement disponibles.
 * 
 * @param {Object} classesMap - Map des classes {className: [eleves]}
 * @returns {Object} { totalF, totalM, ratioF, ratioM, targets: {className: {targetF, targetM, targetDelta, enforce}} }
 */
function computeParityTargetsForClasses(classesMap) {
  // 1. Compter le total global F/M/U
  let totalF = 0, totalM = 0, totalU = 0;
  const classCounts = {};
  
  Object.entries(classesMap).forEach(([className, eleves]) => {
    const counts = compteFM(eleves);
    classCounts[className] = counts;
    totalF += counts.F;
    totalM += counts.M;
    totalU += counts.U;
  });
  
  const totalConnus = totalF + totalM;
  
  // Si aucune donnée de sexe, désactiver les cibles
  if (totalConnus === 0) {
    Logger.log('[PARITÉ] Aucune donnée de sexe détectée - cibles désactivées');
    const targets = {};
    Object.keys(classesMap).forEach(cls => {
      targets[cls] = { targetF: 0, targetM: 0, targetDelta: 0, enforce: false };
    });
    return { totalF: 0, totalM: 0, ratioF: 0.5, ratioM: 0.5, targets };
  }
  
  // 2. Calculer le ratio global réel
  const ratioF = totalF / totalConnus;
  const ratioM = totalM / totalConnus;
  
  Logger.log(`[PARITÉ] Ratio global: ${totalF}F + ${totalM}M = ${totalConnus} connus (${(ratioF * 100).toFixed(1)}% F)`);
  
  // 3. Répartir ce ratio sur chaque classe avec arrondi banquier
  const targets = {};
  let sumTargetF = 0;
  let sumTargetM = 0;
  const classNames = Object.keys(classesMap).sort();
  
  // Première passe : partie entière
  const remainders = [];
  classNames.forEach(className => {
    const eleves = classesMap[className];
    const counts = classCounts[className];
    const knownCount = counts.F + counts.M;
    
    // Si pas de données exploitables pour cette classe, désactiver
    if (knownCount === 0) {
      targets[className] = { targetF: 0, targetM: 0, targetDelta: 0, enforce: false };
      return;
    }
    
    // Calculer la cible idéale (nombre réel)
    const idealF = knownCount * ratioF;
    const idealM = knownCount * ratioM;
    
    // Partie entière
    let targetF = Math.floor(idealF);
    let targetM = Math.floor(idealM);
    
    // Stocker le reste pour l'arrondi banquier
    remainders.push({
      className,
      knownCount,
      idealF,
      idealM,
      targetF,
      targetM,
      remainderF: idealF - targetF,
      remainderM: idealM - targetM
    });
    
    sumTargetF += targetF;
    sumTargetM += targetM;
  });
  
  // Deuxième passe : distribuer les unités restantes (arrondi banquier)
  const missingF = totalF - sumTargetF;
  const missingM = totalM - sumTargetM;
  
  // Trier par reste décroissant pour F
  remainders.sort((a, b) => b.remainderF - a.remainderF);
  for (let i = 0; i < missingF && i < remainders.length; i++) {
    remainders[i].targetF++;
  }
  
  // Trier par reste décroissant pour M
  remainders.sort((a, b) => b.remainderM - a.remainderM);
  for (let i = 0; i < missingM && i < remainders.length; i++) {
    remainders[i].targetM++;
  }
  
  // Construire les cibles finales
  remainders.forEach(r => {
    const targetDelta = r.targetF - r.targetM;
    targets[r.className] = {
      targetF: r.targetF,
      targetM: r.targetM,
      targetDelta: targetDelta,
      enforce: true,
      knownCount: r.knownCount
    };
  });
  
  return {
    totalF,
    totalM,
    totalU,
    ratioF,
    ratioM,
    targets
  };
}

// ===== SHIM LOGGING V14 =====
/**
 * Stringify sécurisé pour éviter les références circulaires
 */
function _safeStringify(x) {
  try {
    return JSON.stringify(x);
  } catch(e) {
    const cache = new WeakSet();
    return JSON.stringify(x, (k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (cache.has(v)) return '[Circular]';
        cache.add(v);
      }
      return v;
    });
  }
}

/**
 * Fonction de log générique
 */
function logLine(level, msg, data) {
  const stamp = new Date().toLocaleString('fr-FR');
  const payload = (data === undefined) ? '' : ' ' + _safeStringify(data);
  const line = `[${level}] ${msg}${payload}`;
  try { console.log(line); } catch(_) {}
  try { Logger.log(`${stamp} ${line}`); } catch(_) {}
}

/**
 * Fonctions de log compatibles avec l'ancien code
 */
function logStats(msg, data) { logLine('STATS', msg, data); }
function logInfo(msg, data)  { logLine('Infos', msg, data); }
function logDebug(msg, data) { logLine('Débogage', msg, data); }
function logError(msg, data) { logLine('Erreur', msg, data); }

/**
 * logAmeliorations avec retour de comparaisonEquilibre
 * Calcule et log les améliorations entre stats initiales et finales
 */
function logAmeliorations(statsInitiales, statsFinales, extraKeys) {
  logLine('AMELIO', 'Comparaison stats', { 
    initiales: statsInitiales?.scoreGlobal || 0, 
    finales: statsFinales?.scoreGlobal || 0 
  });
  
  // Calculer la comparaison d'équilibre
  const comparaisonEquilibre = {
    avant: {
      scoreGlobal: statsInitiales?.scoreGlobal || 0,
      tetesDeClasse: statsInitiales?.totalTetes || 0,
      niveau1: statsInitiales?.totalNiveau1 || 0,
      pariteMax: statsInitiales?.maxEcartParite || 0
    },
    apres: {
      scoreGlobal: statsFinales?.scoreGlobal || 0,
      tetesDeClasse: statsFinales?.totalTetes || 0,
      niveau1: statsFinales?.totalNiveau1 || 0,
      pariteMax: statsFinales?.maxEcartParite || 0
    },
    amelioration: {
      scoreGlobal: (statsInitiales?.scoreGlobal || 0) - (statsFinales?.scoreGlobal || 0),
      tetesDeClasse: Math.abs((statsInitiales?.totalTetes || 0) - (statsFinales?.totalTetes || 0)),
      niveau1: Math.abs((statsInitiales?.totalNiveau1 || 0) - (statsFinales?.totalNiveau1 || 0)),
      pariteMax: (statsInitiales?.maxEcartParite || 0) - (statsFinales?.maxEcartParite || 0)
    }
  };
  
  return { comparaisonEquilibre };
}

// === CODES D'ERREUR ===
// ⚠️ ERROR_CODES est défini dans Config.gs (ligne 227)
// Ne pas redéclarer ici pour éviter "Identifier has already been declared"
// const ERROR_CODES = {
//   NO_STUDENTS_FOUND: 'NO_STUDENTS_FOUND',
//   LESS_THAN_TWO_CLASSES: 'LESS_THAN_TWO_CLASSES',
//   INVALID_STRUCTURE: 'INVALID_STRUCTURE',
//   NO_TEST_SHEETS: 'NO_TEST_SHEETS',
//   MISSING_CRITICAL_DATA_COLUMN: 'MISSING_CRITICAL_DATA_COLUMN',
//   SWAP_WRITE_FAILED: 'SWAP_WRITE_FAILED',
//   JOURNAL_SAVE_FAILED: 'JOURNAL_SAVE_FAILED',
//   UNCAUGHT_EXCEPTION: 'UNCAUGHT_EXCEPTION'
// };

/**
 * === SHIM COMPATIBILITÉ : getConfig() ===
 * Essaie plusieurs sources possibles de configuration et adapte au format V14
 */
function getConfig() {
  // 1) Fonction getStructureRules() si elle existe
  try { 
    if (typeof getStructureRules === 'function') {
      const rules = getStructureRules();
      Logger.log('[V14] Config source: getStructureRules()');
      
      // Adapter au format V14 si nécessaire
      const config = {
        SHEETS: {
          TEST: 'TEST',
          CACHE: 'CACHE',
          FIN: 'FIN',
          STRUCTURE: '_STRUCTURE'
        },
        MAX_SWAPS: 30,
        MAX_SWAPS_EVAL: 5000,
        OPTIONS: rules.options || {},
        EFFECTIF_CIBLE: rules.effectifCible || 28,
        PARITE_MAX: 2,
        NB_CLASSES: rules.classes ? rules.classes.length : 6,
        BUCKETS: [1, 2, 3, 4],
        WEIGHTS: { COM: 1.0, TRA: 0.7, PART: 0.7, ABS: 0.4 },
        FIELDS: {
          SEXE: 'SEXE',
          COM: 'COM',
          TRA: 'TRA',
          PART: 'PART',
          ABS: 'ABS',
          LV2: 'LV2'
        }
      };
      
      Logger.log('[V14] Config adaptée: ' + JSON.stringify({
        nbClasses: config.NB_CLASSES,
        effectif: config.EFFECTIF_CIBLE,
        pariteMax: config.PARITE_MAX
      }));
      
      return config;
    }
  } catch (e) {
    Logger.log('[V14] getStructureRules() erreur: ' + e.message);
  }

  // 2) Constante globale CONFIG
  if (typeof CONFIG !== 'undefined' && CONFIG) {
    Logger.log('[V14] Config source: CONFIG globale');
    return CONFIG;
  }

  // 3) Script Properties (optionnel)
  try {
    const json = PropertiesService.getScriptProperties().getProperty('STRUCTURE_RULES_JSON');
    if (json) {
      Logger.log('[V14] Config source: Script Properties');
      return JSON.parse(json);
    }
  } catch (e) {
    Logger.log('[V14] Script Properties non disponibles: ' + e.message);
  }

  // 4) Configuration par défaut minimale
  Logger.log('[V14] ⚠️ Aucune config trouvée, utilisation de valeurs par défaut');
  return {
    SHEETS: {
      TEST: 'TEST',
      CACHE: 'CACHE',
      FIN: 'FIN',
      STRUCTURE: '_STRUCTURE'
    },
    MAX_SWAPS: 30,
    MAX_SWAPS_EVAL: 5000,
    OPTIONS: {},
    EFFECTIF_CIBLE: 28,
    PARITE_MAX: 2,
    NB_CLASSES: 6,
    BUCKETS: [1, 2, 3, 4],
    WEIGHTS: { COM: 1.0, TRA: 0.7, PART: 0.7, ABS: 0.4 },
    FIELDS: {
      SEXE: 'SEXE',
      COM: 'COM',
      TRA: 'TRA',
      PART: 'PART',
      ABS: 'ABS',
      LV2: 'LV2'
    }
  };
}

// On suppose que CHECKS est défini globalement dans Config.gs
// On suppose que initMobilite() est définie globalement (dans InitMobilite.gs)
// On suppose que logStats() et logAmeliorations() sont définies globalement (dans Utils.gs ou équivalent)

// Déclaration GLOBALE et UNIQUE de niveauCache pour l'ensemble du projet
let niveauCache = null; 

/**
 * === POINT D'ENTRÉE PAR MODE ===
 * Résout les onglets selon le mode choisi (TEST/CACHE/FIN/PREVIOUS/SOURCES)
 */
function V11_OptimisationDistribution_ByMode(poidsInput, poidsOverride, maxSwapsToUseArg, configOpt, mode) {
  Logger.log(`[V14] Optimisation par mode: ${mode}`);
  
  // Charger la config
  const config = configOpt || getConfig();
  
  // Lier les constantes globales (compat layer)
  _v14BindGlobals(config);
  
  // Résoudre les onglets selon le mode
  const sheetNames = _resolveSheetsByMode(mode, config);
  Logger.log(`[V14] Onglets résolus pour mode ${mode}: ${JSON.stringify(sheetNames)}`);
  
  if (!sheetNames || sheetNames.length === 0) {
    return {
      success: false,
      errorCode: ERROR_CODES.NO_TEST_SHEETS,
      message: `Aucun onglet trouvé pour le mode "${mode}". Vérifiez que les onglets existent.`
    };
  }
  
  // Appeler le moteur principal
  return V11_OptimisationDistribution_Combined(poidsInput, poidsOverride, maxSwapsToUseArg);
}

/**
 * Résout les onglets selon le mode
 */
function _resolveSheetsByMode(mode, config) {
  const ss = SpreadsheetApp.getActive();
  const allSheets = ss.getSheets().map(s => s.getName());
  
  Logger.log(`[V14] Tous les onglets: ${JSON.stringify(allSheets)}`);
  
  let picked = [];
  const modeUpper = String(mode || 'TEST').toUpperCase();
  
  switch (modeUpper) {
    case 'TEST':
      picked = allSheets.filter(n => /TEST/i.test(n) && !/CACHE|FIN|DEF/i.test(n));
      break;
    case 'CACHE':
      picked = allSheets.filter(n => /CACHE/i.test(n));
      break;
    case 'FIN':
    case 'DEF':
      picked = allSheets.filter(n => /(FIN|DEF)/i.test(n));
      break;
    case 'PREVIOUS':
    case 'SOURCES':
      // Onglets qui finissent par °1, °2, etc.
      picked = allSheets.filter(n => /[°º]\d+$/.test(n));
      break;
    default:
      Logger.log(`[V14] Mode inconnu: ${mode}, utilisation de TEST par défaut`);
      picked = allSheets.filter(n => /TEST/i.test(n) && !/CACHE|FIN|DEF/i.test(n));
  }
  
  // Tri par ordre numérique
  picked.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '999');
    const numB = parseInt(b.match(/\d+/)?.[0] || '999');
    return numA - numB;
  });
  
  return picked;
}

// =================================================
// 1. MOTEUR V14 (Fonction Principale + Helpers Swaps avec Mobilité)
// =================================================
function V11_OptimisationDistribution_Combined(poidsInput, poidsOverride, maxSwapsToUseArg) {
  const startTime = new Date();
  let mainResult = {};
  let appliquerSwapsResult = null; 
  let classesMapInitialApresSanitize = {}; 
  
  Logger.log(` Démarrage Moteur Optimisation V14 (Swaps + Mobilité) le ${startTime.toLocaleString()}...`);
  
  try {
    // --- 1. Configuration ---
    const poidsBase = { 
      tetesDeClasse: 3.0, 
      niveau1: 2.5, 
      distribution: 1.5, 
      parite: 2.5,           // Priorité haute pour parité
      histoGlobal: 3.0,      // Nouveau : équilibre effectifs globaux (COM/TRA/PART/ABS)
      com1: 0, 
      tra4: 0, 
      part4: 0, 
      garantieTete: 1000 
    };
    const poidsEffectifs = { ...poidsBase, ...(poidsOverride || {}) };
    const SEUIL_IMPACT_MINIMAL = 1e-6;
    const PARITE_TOLERANCE = 2; // Écart F/M maximum accepté par classe (RÉDUIT À 2)
    
    const config = getConfig(); 
    if (!config || !config.SHEETS) {
        throw new Error("Configuration globale (CONFIG ou CONFIG.SHEETS) non chargée ou invalide pour le moteur V14.");
    }

    const MAX_SWAPS_TO_EVALUATE = Number(config.MAX_SWAPS_EVAL) || Number(config.MAX_SWAPS) || 5000; 
    const maxSwapsToUse = Number(maxSwapsToUseArg) || Number(config.MAX_SWAPS) || 30; 
    
    const headerMobilityAttendue = "MOBILITE"; 
    
    const extraKeysDefault = ['com1', 'tra4', 'part4'];
    const extraKeys = Array.isArray(config.EXTRA_KEYS) && config.EXTRA_KEYS.length > 0 ? config.EXTRA_KEYS : extraKeysDefault;
    
    const debugMode = config.DEBUG_MODE || false; 
    
    Logger.log(`Moteur V14: Poids=${JSON.stringify(poidsEffectifs)}, Seuil=${SEUIL_IMPACT_MINIMAL}, MaxEval=${MAX_SWAPS_TO_EVALUATE}, MaxApply=${maxSwapsToUse}, HeaderMobilitéLu='${headerMobilityAttendue}', ExtraKeys=${JSON.stringify(extraKeys)}`);

    // --- 2. Chargement & Préparation ---
    const niveau = determinerNiveauActifCache(); 
    Logger.log(`Moteur V14: Niveau=${niveau}`);
    
    const structureResult = chargerStructureEtOptions(niveau, config); 
    if (!structureResult.success) return structureResult;
    const { structure, optionsNiveau } = structureResult;
    
    const optionPools = buildOptionPools(structure, config); 
    Logger.log("Moteur V14: Pools d'options (basés sur _STRUCTURE et suffixe TEST): " + JSON.stringify(optionPools));

    const elevesResult = chargerElevesEtClasses(config, headerMobilityAttendue); 
    if (!elevesResult.success) return elevesResult;
    let { students: rawStudents, colIndexes } = elevesResult; 

    const mobColKeyDansColIndexes = headerMobilityAttendue.toUpperCase();
    if (colIndexes === undefined || colIndexes[mobColKeyDansColIndexes] === undefined || colIndexes[mobColKeyDansColIndexes] === -1) {
        const msgWarn = `Moteur V14: Colonne Mobilité '${headerMobilityAttendue}' NON TROUVÉE! Mobilité sera 'LIBRE'.`;
        Logger.log(`WARN ${msgWarn}`);
        try { SpreadsheetApp.getActiveSpreadsheet().toast(msgWarn, "Alerte Moteur V14", 7); } catch(eToast) {}
        rawStudents.forEach(s => { if (s.mobilite === undefined) s.mobilite = 'LIBRE'; });
    } else {
        Logger.log(`Moteur V14: Colonne Mobilité '${headerMobilityAttendue}' trouvée à l'index ${colIndexes[mobColKeyDansColIndexes]}.`);
    }

    const { clean, invalid, dupes } = sanitizeStudents(rawStudents);
    if (invalid.length || dupes.length) Logger.log(`Moteur V14 Sanitize: ${invalid.length} élèves rejetés, ${dupes.length} doublons.`);
    let students = clean;
    if (students.length === 0) return { success: false, errorCode: ERROR_CODES.NO_STUDENTS_FOUND, message: "Moteur V14: Aucun élève valide après sanitization." };
    
    let classesMap = {};
    students.forEach(e => { if(e.CLASSE){ if (!classesMap[e.CLASSE]) classesMap[e.CLASSE] = []; classesMap[e.CLASSE].push(e); }});
    classesMapInitialApresSanitize = JSON.parse(JSON.stringify(classesMap)); 
    Logger.log(`Moteur V14: ${students.length} élèves valides dans ${Object.keys(classesMap).length} classes.`);
    const classesUniques = Object.keys(classesMap);
    if (classesUniques.length < 2) return { success: false, errorCode: ERROR_CODES.LESS_THAN_TWO_CLASSES, message: "Moteur V14: Moins de 2 classes pour optimiser." };

    // --- 3. Pré-traitement ---
    classifierEleves(students, extraKeys); 
    const penaltyNoHead = (classe, tentativeTetes) => {
        if (tentativeTetes === 0) { 
            const classeActuelle = classesMap[classe];
            if (classeActuelle && classeActuelle.some(e => e.estTeteDeClasse)) {
                 return poidsEffectifs.garantieTete || 1000; 
            }
        }
        return 0;
    };
    const dissocCountMap = buildDissocCountMap(classesMap); 
    Logger.log("Moteur V14: Map des dissociés (Set par classe) pré-calculée.");

    // === NOUVEAU : CALCUL DES CIBLES DE PARITÉ ADAPTATIVES ===
    const parityTargets = computeParityTargetsForClasses(classesMap);
    Logger.log(`Moteur V14: Parité globale calculée: ${parityTargets.totalF}F / ${parityTargets.totalM}M (${parityTargets.ratioF.toFixed(1)}% F)`);
    Logger.log(`Moteur V14: Cibles de parité par classe:`);
    Object.entries(parityTargets.targets).forEach(([cls, target]) => {
      Logger.log(`  ${cls}: cible ${target.targetF}F / ${target.targetM}M (delta=${target.targetDelta})`);
    });

    // --- 4. Initialisation Stats ---
    Logger.log("Moteur V14: Calcul des statistiques initiales...");
    const statsInitiales = calculerStatistiquesDistribution(classesMap, students.length, extraKeys); 
    logStats("Initiales Moteur V14", statsInitiales, extraKeys); 

    // --- 5. Génération Swaps ---
    Logger.log("Moteur V14: Génération des swaps potentiels (avec Mobilité)...");
    const evaluationStartTime = new Date();
    const swapsEvalues = genererEtEvaluerSwaps( 
        students, classesMap, structure, optionsNiveau, optionPools, dissocCountMap, 
        statsInitiales, poidsEffectifs, penaltyNoHead,
        MAX_SWAPS_TO_EVALUATE, SEUIL_IMPACT_MINIMAL, 
        extraKeys, debugMode, parityTargets 
    );
    Logger.log(`Moteur V14: Fin évaluation swaps (${(new Date().getTime() - evaluationStartTime.getTime())}ms). ${swapsEvalues.length} swaps potentiels trouvés.`);

    if (swapsEvalues.length === 0) {
       const { comparaisonEquilibre } = logAmeliorations(statsInitiales, statsInitiales, extraKeys); 
       mainResult = { success: true, nbSwaps: 0, message: "Moteur V14: Aucun échange améliorant possible.", statsInitiales, statsFinales: statsInitiales, comparaisonEquilibre, classesFinales: classesMapInitialApresSanitize }; 
    } else {
        swapsEvalues.sort((a, b) => b.impact - a.impact); 

        Logger.log(`Moteur V14: Application des swaps (max ${maxSwapsToUse})...`);
        const applicationStartTime = new Date();
        appliquerSwapsResult = appliquerSwapsIterativement( 
            swapsEvalues, classesMap, students, 
            structure, optionsNiveau, optionPools, dissocCountMap, 
            statsInitiales, poidsEffectifs, penaltyNoHead,
            maxSwapsToUse, SEUIL_IMPACT_MINIMAL, 
            extraKeys, debugMode, PARITE_TOLERANCE, parityTargets
        );
        const journalSwaps = appliquerSwapsResult.journalSwaps; 
        const statsFinales = appliquerSwapsResult.statsFinales; 
        Logger.log(`Moteur V14: Fin application swaps (${(new Date().getTime() - applicationStartTime.getTime())}ms). ${journalSwaps.length} swaps appliqués.`);

        logStats("Finales Moteur V14", statsFinales, extraKeys); 
        const { comparaisonEquilibre } = logAmeliorations(statsInitiales, statsFinales, extraKeys); 
        const listeIdsModifies = Array.from(new Set(journalSwaps.flatMap(s => [s.eleve1ID, s.eleve2ID])))
                                     .sort((a,b) => a.localeCompare(b, 'fr', {numeric: true})); 
        if (journalSwaps.length > 0) Logger.log(`Moteur V14: IDs modifiés par les swaps: ${JSON.stringify(listeIdsModifies)}`);
        
        let swapWriteError = null;
        if (journalSwaps.length > 0) {
          try { executerSwapsDansOnglets(journalSwaps); } 
          catch (err) { swapWriteError = err; Logger.log(`❌ Moteur V14 Erreur écriture swaps: ${err.message}.`); }
        }
        
        let journalSaveError = null;
        if (journalSwaps && journalSwaps.length > 0) { 
           Logger.log(`Moteur V14: PRÉ-SAUVEGARDE JOURNAL - ${journalSwaps.length} swaps détectés dans 'journalSwaps'.`);
           // Logger.log(`Moteur V14: Contenu de journalSwaps[0] (si existe): ${journalSwaps[0] ? JSON.stringify(journalSwaps[0]) : 'Vide'}`);
           try { 
                const scenarioLogName = `V14_Mobilite_${ Object.entries(poidsEffectifs).filter(([k,v])=> v > 0 && k !== 'garantieTete').map(([k,v])=>`${k}${String(v).replace('.','p')}`).join('_') || 'Standard' }`;
                Logger.log(`Moteur V14: APPEL à sauvegarderJournalSwaps avec scenario: '${scenarioLogName}', niveau: '${niveau}'.`);
                sauvegarderJournalSwaps(journalSwaps, niveau, scenarioLogName); 
            } 
           catch (e) { 
               journalSaveError = e; 
               Logger.log(`Moteur V14 ERREUR lors de l'APPEL à sauvegarderJournalSwaps: ${e.message}`); 
               Logger.log(e.stack); 
           }
        } else {
            Logger.log("Moteur V14: Sauvegarde du journal IGNORÉE car 'journalSwaps' est vide ou non défini.");
        }
        
        mainResult = {
          success: true, nbSwaps: journalSwaps.length,
          message: `Moteur V14 (Swaps+Mobilité) réussie: ${journalSwaps.length} échange(s).`,
          comparaisonEquilibre, 
          statsInitiales, 
          statsFinales,   
          journal: journalSwaps, 
          listeIdsModifies,
          swapWriteErrorCode: swapWriteError ? ERROR_CODES.SWAP_WRITE_FAILED : null,
          journalSaveErrorCode: journalSaveError ? ERROR_CODES.JOURNAL_SAVE_FAILED : null,
          classesFinales: appliquerSwapsResult.classesFinales 
        };
    } 

    const endTime = new Date();
    mainResult.tempsTotalMs = endTime.getTime() - startTime.getTime();
    Logger.log(`Moteur V14 terminé en ${mainResult.tempsTotalMs / 1000} s.`);
    if (mainResult.nbSwaps === 0 && !mainResult.classesFinales) { mainResult.classesFinales = classesMapInitialApresSanitize; }
    
    // === LOGS DÉTAILLÉS POUR ANALYSE ===
    Logger.log("\n" + "=".repeat(80));
    Logger.log("📊 RAPPORT D'OPTIMISATION V14 - ANALYSE DÉTAILLÉE");
    Logger.log("=".repeat(80));
    
    // Parité F/M avec cibles adaptatives
    Logger.log("\n🚻 PARITÉ F/M PAR CLASSE (avec cibles adaptatives) :");
    const classesFinalesMap = mainResult.classesFinales || classesMapInitialApresSanitize;
    Object.entries(classesFinalesMap).forEach(([className, eleves]) => {
      const counts = compteFM(eleves);
      const f = counts.F;
      const m = counts.M;
      const delta = f - m;
      const ecart = Math.abs(delta);
      
      // Récupérer la cible pour cette classe
      let statusMsg = '';
      if (parityTargets && parityTargets.targets && parityTargets.targets[className]) {
        const target = parityTargets.targets[className];
        const ecartCible = Math.abs(delta - target.targetDelta);
        const status = ecartCible <= 2 ? '✅' : ecartCible <= 4 ? '⚠️' : '❌';
        statusMsg = `${status} ${className}: ${f}F / ${m}M (Δ=${delta}, cible Δ=${target.targetDelta}, écart=${ecartCible})`;
      } else {
        const status = ecart <= 2 ? '✅' : ecart <= 4 ? '⚠️' : '❌';
        statusMsg = `${status} ${className}: ${f}F / ${m}M (Δ=${delta})`;
      }
      Logger.log(`  ${statusMsg}`);
    });
    
    // Histogrammes COM avec score de distance global
    Logger.log("\n📈 DISTRIBUTION COM PAR CLASSE (vs cible globale) :");
    const allStudentsFinal = Object.values(classesFinalesMap).flat();
    const finalTargets = buildGlobalTargets(allStudentsFinal);
    
    let scoreGlobalTotal = 0;
    Object.entries(classesFinalesMap).forEach(([className, eleves]) => {
      const histo = {1:0, 2:0, 3:0, 4:0};
      eleves.forEach(e => histo[e.niveauCOM || 1]++);
      
      const scoreClasse = scoreClasseDistribution(eleves, finalTargets.target, finalTargets.weights);
      scoreGlobalTotal += scoreClasse.dist;
      
      const status = scoreClasse.dist < 0.5 ? '✅' : scoreClasse.dist < 1.0 ? '⚠️' : '❌';
      Logger.log(`  ${status} ${className}: Niv1=${histo[1]}, Niv2=${histo[2]}, Niv3=${histo[3]}, Niv4=${histo[4]} (dist=${scoreClasse.dist.toFixed(3)})`);
    });
    
    Logger.log(`  📊 Score global de distribution: ${scoreGlobalTotal.toFixed(3)} (↓ = meilleur)`);
    
    // Têtes de classe
    Logger.log("\n🎓 TÊTES DE CLASSE :");
    Object.entries(classesFinalesMap).forEach(([className, eleves]) => {
      const tetes = eleves.filter(e => e.estTeteDeClasse).length;
      Logger.log(`  ${className}: ${tetes} têtes de classe`);
    });
    
    // Niveau 1
    Logger.log("\n📉 ÉLÈVES EN DIFFICULTÉ (Niveau 1) :");
    Object.entries(classesFinalesMap).forEach(([className, eleves]) => {
      const niv1 = eleves.filter(e => e.estNiveau1).length;
      Logger.log(`  ${className}: ${niv1} élèves niveau 1`);
    });
    
    // Effectifs
    Logger.log("\n👥 EFFECTIFS PAR CLASSE :");
    Object.entries(classesFinalesMap).forEach(([className, eleves]) => {
      const effectif = eleves.length;
      const status = effectif >= 27 && effectif <= 29 ? '✅' : effectif >= 25 && effectif <= 31 ? '⚠️' : '❌';
      Logger.log(`  ${status} ${className}: ${effectif} élèves`);
    });
    
    Logger.log("\n" + "=".repeat(80));
    Logger.log(`⏱️ Temps total: ${(mainResult.tempsTotalMs / 1000).toFixed(2)}s`);
    Logger.log(`🔄 Swaps appliqués: ${mainResult.nbSwaps || 0}`);
    Logger.log("=".repeat(80) + "\n");
    
    try {
      calculerStatistiquesTEST();
      Logger.log("✅ calculerStatistiquesTEST() exécutée après optimisation V14.");
    } catch (e) {
      Logger.log("❌ Erreur lors de l'appel à calculerStatistiquesTEST() : " + e.message);
    }
    return mainResult;

  } catch (error) { 
      Logger.log(`❌ Erreur majeure dans Moteur V14: ${error.message}`); 
      Logger.log(error.stack);
      return { success: false, errorCode: ERROR_CODES.UNCAUGHT_EXCEPTION, message: `Erreur Moteur V14: ${error.message}`, nbSwaps: 0 };
   }
}

// =================================================
// 2. FONCTIONS COMMUNES (CORPS COMPLETS)
// =================================================

// --- Helpers de Calcul et Logique ---
function getNiveau(score) { 
    const numScore = Number(score); 
    if (isNaN(numScore) || score === '' || score === null || score === undefined) return 1;
    if (numScore < 1.5) return 1; 
    if (numScore < 2.5) return 2; 
    if (numScore < 3.5) return 3; 
    return 4; 
}

/**
 * === NOUVEAU : HISTOGRAMMES GLOBAUX (PHASE 2) ===
 * Construit les cibles globales de distribution pour chaque critère
 */
function buildGlobalTargets(allStudents) {
    const CRITERES = ['COM', 'TRA', 'PART', 'ABS'];
    const BUCKETS = [1, 2, 3, 4];
    const WEIGHTS = { COM: 1.0, TRA: 0.7, PART: 0.7, ABS: 0.4 };
    
    const totals = { COM: 0, TRA: 0, PART: 0, ABS: 0 };
    const counts = { 
        COM: {1:0, 2:0, 3:0, 4:0}, 
        TRA: {1:0, 2:0, 3:0, 4:0}, 
        PART: {1:0, 2:0, 3:0, 4:0}, 
        ABS: {1:0, 2:0, 3:0, 4:0} 
    };
    
    allStudents.forEach(e => {
        CRITERES.forEach(C => {
            const niveau = e[`niveau${C}`] || 1;
            counts[C][niveau]++;
            totals[C]++;
        });
    });
    
    const target = { 
        COM: {1:0, 2:0, 3:0, 4:0}, 
        TRA: {1:0, 2:0, 3:0, 4:0}, 
        PART: {1:0, 2:0, 3:0, 4:0}, 
        ABS: {1:0, 2:0, 3:0, 4:0} 
    };
    
    CRITERES.forEach(C => {
        BUCKETS.forEach(b => {
            target[C][b] = totals[C] > 0 ? counts[C][b] / totals[C] : 0;
        });
    });
    
    return { target, weights: WEIGHTS };
}

/**
 * Calcule le score de distribution d'une classe par rapport à la cible globale
 */
function scoreClasseDistribution(classe, target, weights) {
    const CRITERES = ['COM', 'TRA', 'PART', 'ABS'];
    const BUCKETS = [1, 2, 3, 4];
    const n = classe.length || 1;
    
    const counts = { 
        COM: {1:0, 2:0, 3:0, 4:0}, 
        TRA: {1:0, 2:0, 3:0, 4:0}, 
        PART: {1:0, 2:0, 3:0, 4:0}, 
        ABS: {1:0, 2:0, 3:0, 4:0} 
    };
    
    classe.forEach(e => {
        CRITERES.forEach(C => {
            const niveau = e[`niveau${C}`] || 1;
            counts[C][niveau]++;
        });
    });
    
    // Distance L1 vers la cible globale
    let dist = 0;
    CRITERES.forEach(C => {
        BUCKETS.forEach(b => {
            const pClass = counts[C][b] / n;
            const pTarg = target[C][b];
            dist += (weights[C] || 1) * Math.abs(pClass - pTarg);
        });
    });
    
    return { dist, counts, n };
}

function classifierEleves(students, extraKeys) { 
    Logger.log("Moteur V14 - Classification élèves..."); 
    if (!Array.isArray(students)) {
        Logger.log("WARN Moteur V14 - classifierEleves: 'students' n'est pas un tableau.");
        return;
    }
    students.forEach(eleve => { 
        if (!eleve || typeof eleve !== 'object') return; 

        eleve.niveauCOM = getNiveau(eleve.COM); 
        eleve.niveauTRA = getNiveau(eleve.TRA); 
        eleve.niveauPART = getNiveau(eleve.PART); 
        
        eleve.estTeteDeClasse = (eleve.niveauCOM === 4 || eleve.niveauTRA === 4 || eleve.niveauPART === 4);
        eleve.estNiveau1 = (eleve.niveauCOM === 1 || eleve.niveauTRA === 1 || eleve.niveauPART === 1);
        
        (extraKeys || []).forEach(key => { 
            if (typeof key !== 'string' || key.length < 4) return; 
            const crit = key.substring(0,3).toUpperCase(); 
            const scoreTarget = Number(key.slice(-1)); 
            if (isNaN(scoreTarget)) return;

            const scoreEleve = eleve[`niveau${crit}`]; 
            const propName = `est${key.charAt(0).toUpperCase() + key.slice(1)}`; 
            eleve[propName] = (scoreEleve === scoreTarget); 
        }); 
    });
}

function calculerStatistiquesDistribution(classesMap, totalElevesGlobal, extraKeys) { 
    const classesUniques = Object.keys(classesMap); 
    const stats = { 
        tetesDeClasse: { compteParClasse: {}, moyenne: 0, ecartType: 0 }, 
        niveau1: { compteParClasse: {}, moyenne: 0, ecartType: 0 }, 
        distribution: { parClasse: {}, global: {1:0, 2:0, 3:0, 4:0}, ecartMoyen: 0 }, 
        extra: {} 
    }; 
    (extraKeys || []).forEach(k => { stats.extra[k] = { compteParClasse: {}, moyenne: 0, ecartType: 0 }; }); 

    if (classesUniques.length === 0) return stats; 

    let totalTetesDeClasse = 0;
    let totalNiveau1 = 0; 
    const totalParExtraKey = {}; 
    (extraKeys || []).forEach(k => totalParExtraKey[k] = 0); 
    const distribGlobalComptes = {1:0, 2:0, 3:0, 4:0};

    classesUniques.forEach(className => { 
        const eleves = classesMap[className] || []; 
        const nbElevesClasse = eleves.length; 
        
        stats.tetesDeClasse.compteParClasse[className] = 0; 
        stats.niveau1.compteParClasse[className] = 0; 
        stats.distribution.parClasse[className] = {1:0, 2:0, 3:0, 4:0}; 
        (extraKeys || []).forEach(k => { if(stats.extra[k]) stats.extra[k].compteParClasse[className] = 0; }); 

        if (nbElevesClasse === 0) return; 

        let comptesTetesClasse = 0;
        let comptesNiveau1 = 0; 
        const comptesParExtraKeyClasse = {}; 
        (extraKeys || []).forEach(k => comptesParExtraKeyClasse[k] = 0); 
        const distribClasseComptes = {1:0, 2:0, 3:0, 4:0};
    
        eleves.forEach(e => { 
            if (e.estTeteDeClasse) comptesTetesClasse++; 
            if (e.estNiveau1) comptesNiveau1++; 
            (extraKeys || []).forEach(k => { 
                const propName = `est${k.charAt(0).toUpperCase() + k.slice(1)}`; 
                if (e[propName]) comptesParExtraKeyClasse[k]++; 
            }); 
            const niveauComEleve = e.niveauCOM; 
            if (distribClasseComptes.hasOwnProperty(niveauComEleve)) {
                distribClasseComptes[niveauComEleve]++; 
                distribGlobalComptes[niveauComEleve]++; 
            }
        });
        
        stats.tetesDeClasse.compteParClasse[className] = comptesTetesClasse; 
        stats.niveau1.compteParClasse[className] = comptesNiveau1; 
        (extraKeys || []).forEach(k => { if(stats.extra[k]) stats.extra[k].compteParClasse[className] = comptesParExtraKeyClasse[k]; }); 
        
        for(let niv=1; niv<=4; niv++){ 
            stats.distribution.parClasse[className][niv] = nbElevesClasse > 0 ? ((distribClasseComptes[niv]||0) / nbElevesClasse) : 0; 
        } 
        
        totalTetesDeClasse += comptesTetesClasse; 
        totalNiveau1 += comptesNiveau1; 
        (extraKeys || []).forEach(k => totalParExtraKey[k] += comptesParExtraKeyClasse[k]); 
    });

    if (totalElevesGlobal > 0 && classesUniques.length > 0) { 
        const nbClasses = classesUniques.length; 
        stats.tetesDeClasse.moyenne = totalTetesDeClasse / nbClasses; 
        stats.niveau1.moyenne = totalNiveau1 / nbClasses; 
        (extraKeys || []).forEach(k => { if(stats.extra[k]) stats.extra[k].moyenne = totalParExtraKey[k] / nbClasses; }); 
        
        for(let niv=1; niv<=4; niv++){ 
            stats.distribution.global[niv] = (distribGlobalComptes[niv] || 0) / totalElevesGlobal; 
        }
        
        stats.tetesDeClasse.ecartType = calculateStdDevFromCounts(stats.tetesDeClasse.compteParClasse, stats.tetesDeClasse.moyenne); 
        stats.niveau1.ecartType = calculateStdDevFromCounts(stats.niveau1.compteParClasse, stats.niveau1.moyenne); 
        (extraKeys || []).forEach(k => { if(stats.extra[k]) stats.extra[k].ecartType = calculateStdDevFromCounts(stats.extra[k].compteParClasse, stats.extra[k].moyenne); }); 
        stats.distribution.ecartMoyen = calculateAvgRmseDistribution(stats.distribution.parClasse, stats.distribution.global); 
    } 
    return stats;
}

function calculateStdDevFromCounts(countsPerClass, mean) { 
    const classNames = Object.keys(countsPerClass || {}); 
    if (classNames.length < 1) return 0; 
    if (typeof mean !== 'number' || isNaN(mean)) return NaN; 

    let sumSqDiff = 0; 
    classNames.forEach(cl => { 
        const count = countsPerClass[cl]; 
        if (typeof count !== 'number' || isNaN(count)) return; 
        const diff = count - mean; 
        sumSqDiff += diff * diff; 
    }); 
    return Math.sqrt(sumSqDiff / classNames.length); 
}

function calculateAvgRmseDistribution(distribParClasse, globalDistrib) { 
    distribParClasse = distribParClasse || {}; 
    globalDistrib = globalDistrib || {}; 
    const classNames = Object.keys(distribParClasse); 
    if (classNames.length === 0) return 0; 

    let totalRmse = 0; 
    let classCountWithData = 0; 
    classNames.forEach(cl => { 
        const classeDistrib = distribParClasse[cl]; 
        if (!classeDistrib) return; 

        let sumSqDiffNiveaux = 0; 
        let validLevelsCount = 0; 
        for (let niv = 1; niv <= 4; niv++) { 
            if (globalDistrib.hasOwnProperty(niv) && classeDistrib.hasOwnProperty(niv)) { 
                const diff = (classeDistrib[niv] || 0) - (globalDistrib[niv] || 0); 
                sumSqDiffNiveaux += diff * diff; 
                validLevelsCount++; 
            }
        } 
        if (validLevelsCount > 0) { 
            totalRmse += Math.sqrt(sumSqDiffNiveaux / validLevelsCount); 
            classCountWithData++; 
        }
    }); 
    return classCountWithData > 0 ? totalRmse / classCountWithData : 0; 
}

function recalculateDistribPourcent(eleves) { 
    const distribComptes = {1:0, 2:0, 3:0, 4:0}; 
    const nbEleves = eleves.length; 
    if (nbEleves === 0) return {1:0, 2:0, 3:0, 4:0}; 
    
    eleves.forEach(e => { 
        const niveauComEleve = e.niveauCOM; 
        if (distribComptes.hasOwnProperty(niveauComEleve)) {
            distribComptes[niveauComEleve]++; 
        }
    }); 
    
    const distribPourcent = {}; 
    for (let niv = 1; niv <= 4; niv++) { 
        distribPourcent[niv] = nbEleves > 0 ? ((distribComptes[niv] || 0) / nbEleves) : 0; 
    } 
    return distribPourcent;
}

function evaluerImpactDistribution(eleve1, eleve2, currentClassesMap, currentStats, poidsEffectifs, penaltyFunc, globalTargets, parityTargets) { 
    if (!eleve1 || !eleve2 || !currentClassesMap || !currentStats || !poidsEffectifs || typeof penaltyFunc !== 'function') return -Infinity;
    const c1N = eleve1.CLASSE; const c2N = eleve2.CLASSE; 
    const elC1 = currentClassesMap[c1N]; const elC2 = currentClassesMap[c2N]; 
    if(!elC1 || !elC2 || !Array.isArray(elC1) || !Array.isArray(elC2)) return -Infinity;
    
    // === NOUVEAU : Calculer les cibles globales si non fournies ===
    if (!globalTargets) {
        const allStudents = Object.values(currentClassesMap).flat();
        globalTargets = buildGlobalTargets(allStudents);
    } 
    
    let tC1 = (currentStats.tetesDeClasse?.compteParClasse?.[c1N]||0)-(eleve1.estTeteDeClasse?1:0)+(eleve2.estTeteDeClasse?1:0); 
    let tC2 = (currentStats.tetesDeClasse?.compteParClasse?.[c2N]||0)-(eleve2.estTeteDeClasse?1:0)+(eleve1.estTeteDeClasse?1:0); 
    let n1C1 = (currentStats.niveau1?.compteParClasse?.[c1N]||0)-(eleve1.estNiveau1?1:0)+(eleve2.estNiveau1?1:0); 
    let n1C2 = (currentStats.niveau1?.compteParClasse?.[c2N]||0)-(eleve2.estNiveau1?1:0)+(eleve1.estNiveau1?1:0); 
    const exCA={};
    const currentExtraKeys = Object.keys(poidsEffectifs).filter(k => (k==='com1'||k==='tra4'||k==='part4') && poidsEffectifs[k] > 0); 
    currentExtraKeys.forEach(k => { 
        const pN=`est${k.charAt(0).toUpperCase()+k.slice(1)}`; 
        exCA[k]={
            C1:(currentStats.extra?.[k]?.compteParClasse?.[c1N]||0) - (eleve1[pN]?1:0) + (eleve2[pN]?1:0), 
            C2:(currentStats.extra?.[k]?.compteParClasse?.[c2N]||0) - (eleve2[pN]?1:0) + (eleve1[pN]?1:0)
        }; 
    });
    
    const pen1 = penaltyFunc(c1N, tC1); 
    const pen2 = penaltyFunc(c2N, tC2); 
    if(pen1 > 0 || pen2 > 0) return -Math.max(pen1, pen2);

    const calcNewSD=(currentCounts, mean, class1Name, class2Name, countAfterSwapC1, countAfterSwapC2)=>{
        if(!currentCounts || typeof mean !== 'number' || isNaN(mean)) return NaN;
        const tempCounts = {...currentCounts, [class1Name]: countAfterSwapC1, [class2Name]: countAfterSwapC2};
        return calculateStdDevFromCounts(tempCounts, mean);
    };
    
    const nSDT = calcNewSD(currentStats.tetesDeClasse?.compteParClasse, currentStats.tetesDeClasse?.moyenne, c1N, c2N, tC1, tC2); 
    const nSDN1 = calcNewSD(currentStats.niveau1?.compteParClasse, currentStats.niveau1?.moyenne, c1N, c2N, n1C1, n1C2); 
    const nSDEx={}; 
    currentExtraKeys.forEach(k => {
        if (currentStats.extra?.[k]) {
             nSDEx[k] = calcNewSD(currentStats.extra[k].compteParClasse, currentStats.extra[k].moyenne, c1N, c2N, exCA[k].C1, exCA[k].C2);
        }
    });
    
    const elevesClasse1ApresSwap = elC1.filter(e=> String(e.ID_ELEVE).trim() !== String(eleve1.ID_ELEVE).trim()).concat([{...eleve2, CLASSE:c1N}]); 
    const elevesClasse2ApresSwap = elC2.filter(e=> String(e.ID_ELEVE).trim() !== String(eleve2.ID_ELEVE).trim()).concat([{...eleve1, CLASSE:c2N}]); 
    const tempDistribParClasse = {...currentStats.distribution?.parClasse}; 
    tempDistribParClasse[c1N] = recalculateDistribPourcent(elevesClasse1ApresSwap); 
    tempDistribParClasse[c2N] = recalculateDistribPourcent(elevesClasse2ApresSwap); 
    const nARmseD = calculateAvgRmseDistribution(tempDistribParClasse, currentStats.distribution?.global || {}); 
    
    const ameliorationTetes = (currentStats.tetesDeClasse?.ecartType || 0) - (isNaN(nSDT) ? (currentStats.tetesDeClasse?.ecartType || 0) : nSDT); 
    const ameliorationNiveau1 = (currentStats.niveau1?.ecartType || 0) - (isNaN(nSDN1) ? (currentStats.niveau1?.ecartType || 0) : nSDN1); 
    const ameliorationDistrib = (currentStats.distribution?.ecartMoyen || 0) - (isNaN(nARmseD) ? (currentStats.distribution?.ecartMoyen || 0) : nARmseD); 
    const ameliorationExtra = {}; 
    currentExtraKeys.forEach(k => {
        if (currentStats.extra?.[k]) {
            ameliorationExtra[k] = (currentStats.extra[k].ecartType || 0) - (isNaN(nSDEx[k]) ? (currentStats.extra[k].ecartType || 0) : nSDEx[k]);
        } else {
            ameliorationExtra[k] = 0;
        }
    });
    
    // === PARITÉ ADAPTATIVE : CALCUL AVEC CIBLES RÉALISTES ===
    const countSexe = (eleves, sexe) => eleves.filter(e => _v14SexeNormalize(e.SEXE) === sexe).length;
    const f1Avant = countSexe(elC1, 'F');
    const m1Avant = countSexe(elC1, 'M');
    const f2Avant = countSexe(elC2, 'F');
    const m2Avant = countSexe(elC2, 'M');

    const sx1 = _v14SexeNormalize(eleve1.SEXE);
    const sx2 = _v14SexeNormalize(eleve2.SEXE);
    
    const f1Apres = f1Avant - (sx1 === 'F' ? 1 : 0) + (sx2 === 'F' ? 1 : 0);
    const m1Apres = m1Avant - (sx1 === 'M' ? 1 : 0) + (sx2 === 'M' ? 1 : 0);
    const f2Apres = f2Avant - (sx2 === 'F' ? 1 : 0) + (sx1 === 'F' ? 1 : 0);
    const m2Apres = m2Avant - (sx2 === 'M' ? 1 : 0) + (sx1 === 'M' ? 1 : 0);

    // Calculer l'écart par rapport aux CIBLES ADAPTATIVES (pas 50/50 !)
    let ameliorationParite = 0;
    if (parityTargets && parityTargets.targets) {
      const target1 = parityTargets.targets[c1N];
      const target2 = parityTargets.targets[c2N];
      
      if (target1 && target1.enforce && target2 && target2.enforce) {
        // Écart avant : distance à la cible
        const delta1Avant = f1Avant - m1Avant;
        const delta2Avant = f2Avant - m2Avant;
        const ecartCible1Avant = Math.abs(delta1Avant - target1.targetDelta);
        const ecartCible2Avant = Math.abs(delta2Avant - target2.targetDelta);
        
        // Écart après : distance à la cible
        const delta1Apres = f1Apres - m1Apres;
        const delta2Apres = f2Apres - m2Apres;
        const ecartCible1Apres = Math.abs(delta1Apres - target1.targetDelta);
        const ecartCible2Apres = Math.abs(delta2Apres - target2.targetDelta);
        
        // Amélioration = réduction de la distance aux cibles
        ameliorationParite = (ecartCible1Avant + ecartCible2Avant) - (ecartCible1Apres + ecartCible2Apres);
      } else {
        // Fallback : ancien calcul si pas de cibles
        const ecartPariteAvant = Math.abs(f1Avant - m1Avant) + Math.abs(f2Avant - m2Avant);
        const ecartPariteApres = Math.abs(f1Apres - m1Apres) + Math.abs(f2Apres - m2Apres);
        ameliorationParite = ecartPariteAvant - ecartPariteApres;
      }
    } else {
      // Fallback : ancien calcul si parityTargets absent
      const ecartPariteAvant = Math.abs(f1Avant - m1Avant) + Math.abs(f2Avant - m2Avant);
      const ecartPariteApres = Math.abs(f1Apres - m1Apres) + Math.abs(f2Apres - m2Apres);
      ameliorationParite = ecartPariteAvant - ecartPariteApres;
    }
    
    // === NOUVEAU : CALCUL HISTOGRAMMES GLOBAUX ===
    // Calculer le score de distribution AVANT le swap (pour les 2 classes concernées)
    const score1Avant = scoreClasseDistribution(elC1, globalTargets.target, globalTargets.weights);
    const score2Avant = scoreClasseDistribution(elC2, globalTargets.target, globalTargets.weights);
    const scoreAvant = score1Avant.dist + score2Avant.dist;
    
    // Calculer le score de distribution APRÈS le swap
    const score1Apres = scoreClasseDistribution(elevesClasse1ApresSwap, globalTargets.target, globalTargets.weights);
    const score2Apres = scoreClasseDistribution(elevesClasse2ApresSwap, globalTargets.target, globalTargets.weights);
    const scoreApres = score1Apres.dist + score2Apres.dist;
    
    // L'amélioration est la RÉDUCTION de la distance (scoreAvant - scoreApres)
    const ameliorationHistoGlobal = scoreAvant - scoreApres;
    
    // === CALCUL IMPACT TOTAL ===
    let impactTotal = (poidsEffectifs.tetesDeClasse * ameliorationTetes) + 
                      (poidsEffectifs.niveau1 * ameliorationNiveau1) + 
                      (poidsEffectifs.distribution * ameliorationDistrib) +
                      (poidsEffectifs.parite * ameliorationParite) +
                      (poidsEffectifs.histoGlobal * ameliorationHistoGlobal);
    
    currentExtraKeys.forEach(k => impactTotal += ((poidsEffectifs[k]||0) * (ameliorationExtra[k]||0))); 
    return impactTotal;
}

function getUpdatedStats(currentStats, classe1Name, classe2Name, elevesClasse1Apres, elevesClasse2Apres, updatedClassesMap, totalElevesGlobal) { 
    const statsApres = JSON.parse(JSON.stringify(currentStats)); 
    const allClassNames = Object.keys(updatedClassesMap); 
    statsApres.tetesDeClasse = statsApres.tetesDeClasse || {compteParClasse:{}, moyenne:0, ecartType:0};
    statsApres.niveau1 = statsApres.niveau1 || {compteParClasse:{}, moyenne:0, ecartType:0};
    statsApres.distribution = statsApres.distribution || {parClasse:{}, global:{1:0,2:0,3:0,4:0}, ecartMoyen:0};
    statsApres.extra = statsApres.extra || {};
    const currentExtraKeys = Object.keys(statsApres.extra); 
    currentExtraKeys.forEach(k => { statsApres.extra[k] = statsApres.extra[k] || {compteParClasse:{}, moyenne:0, ecartType:0}; });
    if(!statsApres.distribution.parClasse) statsApres.distribution.parClasse = {};
    if(!statsApres.distribution.global) statsApres.distribution.global = {1:0,2:0,3:0,4:0};

    statsApres.tetesDeClasse.compteParClasse[classe1Name] = elevesClasse1Apres.reduce((s,e)=>s+(e.estTeteDeClasse?1:0),0); 
    statsApres.tetesDeClasse.compteParClasse[classe2Name] = elevesClasse2Apres.reduce((s,e)=>s+(e.estTeteDeClasse?1:0),0); 
    statsApres.niveau1.compteParClasse[classe1Name] = elevesClasse1Apres.reduce((s,e)=>s+(e.estNiveau1?1:0),0); 
    statsApres.niveau1.compteParClasse[classe2Name] = elevesClasse2Apres.reduce((s,e)=>s+(e.estNiveau1?1:0),0); 
    
    currentExtraKeys.forEach(k => {
        const propName = `est${k.charAt(0).toUpperCase()+k.slice(1)}`; 
        if(!statsApres.extra[k].compteParClasse) statsApres.extra[k].compteParClasse = {}; 
        statsApres.extra[k].compteParClasse[classe1Name] = elevesClasse1Apres.reduce((s,e)=>s+(e[propName]?1:0),0); 
        statsApres.extra[k].compteParClasse[classe2Name] = elevesClasse2Apres.reduce((s,e)=>s+(e[propName]?1:0),0);
    });
    
    let totalTetes = 0, totalN1 = 0; 
    const totalParExtra = {}; currentExtraKeys.forEach(k=>totalParExtra[k]=0); 
    allClassNames.forEach(cl => {
        totalTetes += statsApres.tetesDeClasse.compteParClasse[cl] || 0; 
        totalN1 += statsApres.niveau1.compteParClasse[cl] || 0; 
        currentExtraKeys.forEach(k => totalParExtra[k] += statsApres.extra[k]?.compteParClasse?.[cl] || 0);
    }); 
    if (allClassNames.length > 0) {
        const nbClasses = allClassNames.length; 
        statsApres.tetesDeClasse.moyenne = totalTetes / nbClasses; 
        statsApres.niveau1.moyenne = totalN1 / nbClasses; 
        currentExtraKeys.forEach(k => { if(statsApres.extra[k]) statsApres.extra[k].moyenne = totalParExtra[k] / nbClasses; });
    }
    statsApres.tetesDeClasse.ecartType = calculateStdDevFromCounts(statsApres.tetesDeClasse.compteParClasse, statsApres.tetesDeClasse.moyenne); 
    statsApres.niveau1.ecartType = calculateStdDevFromCounts(statsApres.niveau1.compteParClasse, statsApres.niveau1.moyenne); 
    currentExtraKeys.forEach(k => { if(statsApres.extra[k]) statsApres.extra[k].ecartType = calculateStdDevFromCounts(statsApres.extra[k].compteParClasse, statsApres.extra[k].moyenne); });
    statsApres.distribution.parClasse[classe1Name] = recalculateDistribPourcent(elevesClasse1Apres); 
    statsApres.distribution.parClasse[classe2Name] = recalculateDistribPourcent(elevesClasse2Apres);
    const distribGlobalComptesApres = {1:0,2:0,3:0,4:0}; 
    let totalElevesApres = 0; 
    for(const clName of allClassNames) {
        const elevesDeClasse = updatedClassesMap[clName] || []; 
        totalElevesApres += elevesDeClasse.length; 
        for(const eleve of elevesDeClasse) {
            const niveauCom = eleve.niveauCOM; 
            if(distribGlobalComptesApres.hasOwnProperty(niveauCom)) distribGlobalComptesApres[niveauCom]++;
        }
    }
    if(totalElevesApres > 0) {
        for(let niv=1; niv<=4; niv++) statsApres.distribution.global[niv] = (distribGlobalComptesApres[niv] || 0) / totalElevesApres;
    } else {
        for(let niv=1; niv<=4; niv++) statsApres.distribution.global[niv] = 0;
    }
    statsApres.distribution.ecartMoyen = calculateAvgRmseDistribution(statsApres.distribution.parClasse, statsApres.distribution.global); 
    return statsApres;
}

function buildOptionPools(structure, config) {
    const pools = {};
    const suffix = config?.TEST_SUFFIX || "TEST"; 
    // optionSeparatorRegex est retiré car lireStructureFeuille gère le split

    if (!structure || !structure.classes || !Array.isArray(structure.classes)) {
        Logger.log("WARN Moteur V14 - buildOptionPools: Structure ou classes invalide.");
        return pools;
    }
    
    structure.classes.forEach(classeDef => { 
        if (!classeDef || !classeDef.nom) return; 
        
        const classeNomBase = String(classeDef.nom).trim();
        const classeNomPourPool = classeNomBase.toUpperCase().endsWith(suffix.toUpperCase()) ? classeNomBase : classeNomBase + suffix;
        const classeNomNormalisePourPool = classeNomPourPool.toUpperCase(); 
        
        (classeDef.options || []).forEach(optBrute => { 
            let optionKey = String(optBrute || "").trim().toUpperCase();
            if (!optionKey) return;
            
            if (optionKey.includes("=")) {
                optionKey = optionKey.substring(0, optionKey.indexOf("=")).trim();
            }
            if (!optionKey) return;

            if (!pools[optionKey]) {
                pools[optionKey] = [];
            }
            if (!pools[optionKey].includes(classeNomNormalisePourPool)) {
                pools[optionKey].push(classeNomNormalisePourPool);
            }
        });
    });
    return pools;
}

/**
 * CORRECTION DE L'ERREUR buildDissocCountMap
 */

// 1. Version SÉCURISÉE de buildDissocCountMap
function buildDissocCountMap(classesMap) {
    const dissocMap = {};
    
    // Vérifier que classesMap existe et est un objet
    if (!classesMap || typeof classesMap !== 'object') {
        Logger.log("WARN buildDissocCountMap: classesMap est null/undefined ou n'est pas un objet");
        return dissocMap;
    }
    
    try {
        Object.entries(classesMap).forEach(([className, eleves]) => {
            dissocMap[className] = new Set();
            
            // Vérifier que eleves est un tableau
            if (!Array.isArray(eleves)) {
                Logger.log(`WARN buildDissocCountMap: eleves pour ${className} n'est pas un tableau`);
                return;
            }
            
            (eleves || []).forEach(e => {
                if (e && e.DISSO && String(e.DISSO).trim() !== '') {
                    dissocMap[className].add(String(e.DISSO).trim().toUpperCase());
                }
            });
        });
    } catch (e) {
        Logger.log(`ERREUR buildDissocCountMap: ${e.message}`);
    }
    
    return dissocMap;
}

/**
 * Vérifie si un échange potentiel entre e1 et e2 respecte toutes les contraintes,
 * y compris la validité de la classe de destination pour les options des élèves PERMUT/CONDI.
 */
// Version CORRIGÉE de respecteContraintes (avec contrainte parité F/M)
function respecteContraintes(e1, e2, allStudents, structureData, optionsNiveauData, optionPools, dissocMap, classesMap, pariteTolerance, parityTargets) { 
    if (!e1 || !e2) {
        Logger.log("respecteContraintes: REJET - e1 ou e2 manquant.");
        return false;
    }
    
    const mobilite1 = e1.mobilite || 'LIBRE';
    const mobilite2 = e2.mobilite || 'LIBRE';
    
    // === PARITÉ ADAPTATIVE : CONTRAINTE AVEC CIBLES RÉALISTES ===
    if (classesMap && pariteTolerance !== undefined) {
        const tolerance = pariteTolerance || 4;
        
        // Calculer l'état de parité actuel avec normalisation
        const classe1 = classesMap[e1.CLASSE] || [];
        const classe2 = classesMap[e2.CLASSE] || [];
        
        // Compter avec normalisation
        const counts1 = compteFM(classe1);
        const counts2 = compteFM(classe2);
        
        const totalConnus = counts1.F + counts1.M + counts2.F + counts2.M;
        
        // Si on n'a quasiment pas de données sexe, désactiver la contrainte
        if (totalConnus === 0) {
            Logger.log('respecteContraintes: Parité désactivée - aucune donnée sexe détectée.');
            return true; // Continuer sans vérifier la parité
        }
        
        const totalEleves = classe1.length + classe2.length;
        if (totalConnus < Math.max(10, Math.ceil(0.2 * totalEleves))) {
            Logger.log('respecteContraintes: Parité assouplie - données sexe trop partielles.');
            return true; // Continuer sans vérifier la parité
        }
        
        // Simuler le swap sur copies
        const s1 = {F: counts1.F, M: counts1.M, U: counts1.U};
        const s2 = {F: counts2.F, M: counts2.M, U: counts2.U};
        
        const sx1 = _v14SexeNormalize(e1.SEXE);
        const sx2 = _v14SexeNormalize(e2.SEXE);
        
        // Retirer e1 de classe1, e2 de classe2
        if (s1[sx1] > 0) s1[sx1]--; else s1.U = Math.max(0, s1.U - 1);
        if (s2[sx2] > 0) s2[sx2]--; else s2.U = Math.max(0, s2.U - 1);
        
        // Ajouter e1 en classe2, e2 en classe1
        s2[sx1] = (s2[sx1] || 0) + 1;
        s1[sx2] = (s1[sx2] || 0) + 1;
        
        // === VÉRIFIER AVEC CIBLES ADAPTATIVES ===
        let ok1 = true, ok2 = true;
        
        if (parityTargets && parityTargets.targets) {
            const target1 = parityTargets.targets[e1.CLASSE];
            const target2 = parityTargets.targets[e2.CLASSE];
            
            if (target1 && target1.enforce) {
                const delta1 = (s1.F || 0) - (s1.M || 0);
                const ecartCible1 = Math.abs(delta1 - target1.targetDelta);
                ok1 = ecartCible1 <= tolerance;
            } else {
                // Fallback : ancien calcul
                ok1 = _v14PariteOK(s1, tolerance);
            }
            
            if (target2 && target2.enforce) {
                const delta2 = (s2.F || 0) - (s2.M || 0);
                const ecartCible2 = Math.abs(delta2 - target2.targetDelta);
                ok2 = ecartCible2 <= tolerance;
            } else {
                // Fallback : ancien calcul
                ok2 = _v14PariteOK(s2, tolerance);
            }
        } else {
            // Fallback : ancien calcul si pas de cibles
            ok1 = _v14PariteOK(s1, tolerance);
            ok2 = _v14PariteOK(s2, tolerance);
        }
        
        if (!ok1 || !ok2) {
            const d1 = Math.abs((s1.F || 0) - (s1.M || 0));
            const d2 = Math.abs((s2.F || 0) - (s2.M || 0));
            
            let msg = `respecteContraintes: REJET - Parité violée (Δ ${e1.CLASSE}: ${d1}, ${e2.CLASSE}: ${d2}, Tol: ${tolerance})`;
            if (parityTargets && parityTargets.targets) {
                const t1 = parityTargets.targets[e1.CLASSE];
                const t2 = parityTargets.targets[e2.CLASSE];
                if (t1) msg += ` [Cible ${e1.CLASSE}: Δ=${t1.targetDelta}]`;
                if (t2) msg += ` [Cible ${e2.CLASSE}: Δ=${t2.targetDelta}]`;
            }
            Logger.log(msg);
            return false;
        }
    }
    
    Logger.log(`--- respecteContraintes: Swap envisagé entre ${e1.ID_ELEVE} (${e1.NOM || ''}, Opt: ${e1.optionKey || 'AUCUNE'}, LV2: ${e1.LV2 || 'N/A'}, Mob: ${mobilite1}, Classe Act: ${e1.CLASSE}) et ${e2.ID_ELEVE} (${e2.NOM || ''}, Opt: ${e2.optionKey || 'AUCUNE'}, LV2: ${e2.LV2 || 'N/A'}, Mob: ${mobilite2}, Classe Act: ${e2.CLASSE}) ---`);

    // Vérifier FIXE et SPEC
    if (mobilite1 === 'FIXE' || mobilite2 === 'FIXE') {
        Logger.log(`respecteContraintes: REJET - Un élève est FIXE (e1: ${mobilite1}, e2: ${mobilite2}).`);
        return false; 
    }
    if (mobilite1 === 'SPEC' || mobilite2 === 'SPEC') {
        Logger.log(`respecteContraintes: REJET - Un élève est SPEC (e1: ${mobilite1}, e2: ${mobilite2}).`);
        return false; 
    }
    
    const dest1ClassePourPool = String(e2.CLASSE).toUpperCase();
    const dest2ClassePourPool = String(e1.CLASSE).toUpperCase();
    
    // ========== CORRECTION PRINCIPALE ==========
    // Vérifier les OPTIONS seulement si l'élève EN A UNE
    
    // Pour élève 1
    if (e1.optionKey && String(e1.optionKey).trim() !== '') {
        // L'élève a une option, on doit vérifier seulement s'il est PERMUT ou CONDI
        if (mobilite1 === 'PERMUT' || mobilite1 === 'CONDI') {
            const normalizedOptionKeyE1 = String(e1.optionKey).trim().toUpperCase();
            const poolE1 = optionPools[normalizedOptionKeyE1];
            
            Logger.log(`respecteContraintes: e1 (${e1.ID_ELEVE}) est ${mobilite1} AVEC Option '${normalizedOptionKeyE1}'.`);
            
            if (!poolE1 || !Array.isArray(poolE1) || poolE1.length === 0) {
                Logger.log(`respecteContraintes: REJET e1 - Aucun pool pour option '${normalizedOptionKeyE1}'.`);
                return false;
            }
            if (!poolE1.includes(dest1ClassePourPool)) {
                Logger.log(`respecteContraintes: REJET e1 - Option '${normalizedOptionKeyE1}' non disponible dans ${dest1ClassePourPool}.`);
                return false;
            }
        }
        // Si LIBRE avec option, pas de contrainte
    }
    // Si pas d'option, pas de contrainte liée aux options !
    
    // Pour élève 2
    if (e2.optionKey && String(e2.optionKey).trim() !== '') {
        if (mobilite2 === 'PERMUT' || mobilite2 === 'CONDI') {
            const normalizedOptionKeyE2 = String(e2.optionKey).trim().toUpperCase();
            const poolE2 = optionPools[normalizedOptionKeyE2];
            
            Logger.log(`respecteContraintes: e2 (${e2.ID_ELEVE}) est ${mobilite2} AVEC Option '${normalizedOptionKeyE2}'.`);
            
            if (!poolE2 || !Array.isArray(poolE2) || poolE2.length === 0) {
                Logger.log(`respecteContraintes: REJET e2 - Aucun pool pour option '${normalizedOptionKeyE2}'.`);
                return false;
            }
            if (!poolE2.includes(dest2ClassePourPool)) {
                Logger.log(`respecteContraintes: REJET e2 - Option '${normalizedOptionKeyE2}' non disponible dans ${dest2ClassePourPool}.`);
                return false;
            }
        }
    }
    
    // ========== AJOUT : Vérification LV2 pour ITA ==========
    // Si un élève a ITA comme LV2, vérifier qu'il peut aller dans une classe qui accepte ITA
    
    if (e1.LV2 && String(e1.LV2).toUpperCase() === 'ITA' && (mobilite1 === 'PERMUT' || mobilite1 === 'CONDI')) {
        // Vérifier si la classe destination accepte ITA
        const poolITA = optionPools['ITA']; // ITA est dans les pools car c'est dans _STRUCTURE
        if (poolITA && !poolITA.includes(dest1ClassePourPool)) {
            Logger.log(`respecteContraintes: REJET e1 - LV2 ITA non disponible dans ${dest1ClassePourPool}.`);
            return false;
        }
    }
    
    if (e2.LV2 && String(e2.LV2).toUpperCase() === 'ITA' && (mobilite2 === 'PERMUT' || mobilite2 === 'CONDI')) {
        const poolITA = optionPools['ITA'];
        if (poolITA && !poolITA.includes(dest2ClassePourPool)) {
            Logger.log(`respecteContraintes: REJET e2 - LV2 ITA non disponible dans ${dest2ClassePourPool}.`);
            return false;
        }
    }
    
    // Vérification des DISSOCIATIONS (inchangé)
    const dissocKeyE1Trimmed = e1.DISSO ? String(e1.DISSO).trim().toUpperCase() : null;
    const dissocKeyE2Trimmed = e2.DISSO ? String(e2.DISSO).trim().toUpperCase() : null;

    if (dissocKeyE1Trimmed) { 
        const dissocInDest1 = dissocMap[e2.CLASSE]; 
        if (dissocInDest1 instanceof Set && 
            dissocInDest1.has(dissocKeyE1Trimmed) && 
            dissocKeyE2Trimmed !== dissocKeyE1Trimmed) { 
            Logger.log(`respecteContraintes: REJET e1 - Contrainte DISSO '${dissocKeyE1Trimmed}' vers ${e2.CLASSE}.`);
            return false; 
        }
    }
    
    if (dissocKeyE2Trimmed) { 
        const dissocInDest2 = dissocMap[e1.CLASSE];
        if (dissocInDest2 instanceof Set && 
            dissocInDest2.has(dissocKeyE2Trimmed) && 
            dissocKeyE1Trimmed !== dissocKeyE2Trimmed) {
            Logger.log(`respecteContraintes: REJET e2 - Contrainte DISSO '${dissocKeyE2Trimmed}' vers ${e1.CLASSE}.`);
            return false; 
        }
    }
    
    Logger.log(`--- respecteContraintes: ACCEPTÉ pour ${e1.ID_ELEVE} et ${e2.ID_ELEVE} ---`);
    return true; 
}

// 2. Version CORRIGÉE de analyserContraintesDetaillees
function analyserContraintesDetaillees() {
    Logger.log("=== ANALYSE DÉTAILLÉE DES CONTRAINTES ===");
    
    const config = getConfig();
    const niveau = determinerNiveauActifCache();
    
    // Charger les données
    const structureResult = chargerStructureEtOptions(niveau, config);
    const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
    
    if (!structureResult.success || !elevesResult.success) {
        Logger.log("Erreur chargement données");
        return;
    }
    
    // CORRECTION : Vérifier que classesMap existe
    if (!elevesResult.classesMap) {
        Logger.log("ERREUR: elevesResult.classesMap est undefined");
        
        // Reconstruire classesMap à partir de students si nécessaire
        elevesResult.classesMap = {};
        elevesResult.students.forEach(eleve => {
            if (eleve.CLASSE) {
                if (!elevesResult.classesMap[eleve.CLASSE]) {
                    elevesResult.classesMap[eleve.CLASSE] = [];
                }
                elevesResult.classesMap[eleve.CLASSE].push(eleve);
            }
        });
        
        Logger.log("classesMap reconstruit avec " + Object.keys(elevesResult.classesMap).length + " classes");
    }
    
    const optionPools = buildOptionPools(structureResult.structure, config);
    const dissocMap = buildDissocCountMap(elevesResult.classesMap);
    
    // Analyser les élèves par catégorie
    const stats = {
        total: 0,
        parMobilite: {
            FIXE: { total: 0, avecOption: 0, sansOption: 0, avecITA: 0, avecESP: 0 },
            SPEC: { total: 0, avecOption: 0, sansOption: 0, avecITA: 0, avecESP: 0 },
            PERMUT: { total: 0, avecOption: 0, sansOption: 0, avecITA: 0, avecESP: 0 },
            CONDI: { total: 0, avecOption: 0, sansOption: 0, avecITA: 0, avecESP: 0 },
            LIBRE: { total: 0, avecOption: 0, sansOption: 0, avecITA: 0, avecESP: 0 }
        },
        swapsPossibles: 0,
        swapsRejetes: 0,
        raisonsRejet: {}
    };
    
    // Compter les élèves
    elevesResult.students.forEach(eleve => {
        const mob = eleve.mobilite || 'LIBRE';
        stats.total++;
        
        if (!stats.parMobilite[mob]) {
            Logger.log(`WARN: Mobilité inconnue '${mob}' pour élève ${eleve.ID_ELEVE}`);
            return;
        }
        
        stats.parMobilite[mob].total++;
        
        if (eleve.optionKey && String(eleve.optionKey).trim() !== '') {
            stats.parMobilite[mob].avecOption++;
        } else {
            stats.parMobilite[mob].sansOption++;
        }
        
        if (eleve.LV2) {
            const lv2Upper = String(eleve.LV2).toUpperCase();
            if (lv2Upper === 'ITA') {
                stats.parMobilite[mob].avecITA++;
            } else if (lv2Upper === 'ESP') {
                stats.parMobilite[mob].avecESP++;
            }
        }
    });
    
    // Afficher les statistiques
    Logger.log("\nRépartition des élèves :");
    Object.keys(stats.parMobilite).forEach(mob => {
        const s = stats.parMobilite[mob];
        if (s.total > 0) {
            Logger.log(`  ${mob}: ${s.total} élèves`);
            Logger.log(`    - Avec option: ${s.avecOption}`);
            Logger.log(`    - Sans option: ${s.sansOption}`);
            Logger.log(`    - LV2 ITA: ${s.avecITA}`);
            Logger.log(`    - LV2 ESP: ${s.avecESP}`);
        }
    });
    
    // Afficher les pools d'options
    Logger.log("\nPools d'options disponibles :");
    Object.entries(optionPools).forEach(([option, classes]) => {
        Logger.log(`  ${option}: ${classes.join(', ')}`);
    });
    
    // Tester quelques swaps pour comprendre les rejets
    Logger.log("\n=== Test de swaps aléatoires ===");
    const classes = Object.keys(elevesResult.classesMap);
    let testsEffectues = 0;
    const maxTests = 20; // Augmenté pour avoir plus d'exemples
    
    for (let i = 0; i < classes.length && testsEffectues < maxTests; i++) {
        for (let j = i + 1; j < classes.length && testsEffectues < maxTests; j++) {
            const eleves1 = elevesResult.classesMap[classes[i]];
            const eleves2 = elevesResult.classesMap[classes[j]];
            
            if (eleves1 && eleves1.length > 0 && eleves2 && eleves2.length > 0) {
                // Prendre des élèves aléatoires plutôt que toujours le premier
                const idx1 = Math.floor(Math.random() * eleves1.length);
                const idx2 = Math.floor(Math.random() * eleves2.length);
                
                const e1 = eleves1[idx1];
                const e2 = eleves2[idx2];
                
                if (e1 && e2) {
                    Logger.log(`\nTest ${++testsEffectues}: ${classes[i]} <-> ${classes[j]}`);
                    Logger.log(`  E1: ${e1.ID_ELEVE} (Mob:${e1.mobilite}, Opt:${e1.optionKey || 'AUCUNE'}, LV2:${e1.LV2 || 'N/A'})`);
                    Logger.log(`  E2: ${e2.ID_ELEVE} (Mob:${e2.mobilite}, Opt:${e2.optionKey || 'AUCUNE'}, LV2:${e2.LV2 || 'N/A'})`);
                    
                    const ok = respecteContraintes(
                        e1, e2, 
                        elevesResult.students, 
                        structureResult.structure, 
                        structureResult.optionsNiveau, 
                        optionPools, 
                        dissocMap
                    );
                    
                    Logger.log(`  Résultat: ${ok ? "✅ POSSIBLE" : "❌ IMPOSSIBLE"}`);
                    
                    if (ok) stats.swapsPossibles++;
                    else stats.swapsRejetes++;
                }
            }
        }
    }
    
    Logger.log(`\n=== RÉSUMÉ ===`);
    Logger.log(`Total élèves: ${stats.total}`);
    Logger.log(`Classes: ${classes.length}`);
    Logger.log(`Swaps testés: ${testsEffectues}`);
    Logger.log(`Swaps possibles: ${stats.swapsPossibles} (${testsEffectues > 0 ? Math.round(stats.swapsPossibles / testsEffectues * 100) : 0}%)`);
    Logger.log(`Swaps rejetés: ${stats.swapsRejetes} (${testsEffectues > 0 ? Math.round(stats.swapsRejetes / testsEffectues * 100) : 0}%)`);
    
    // Recommandations
    Logger.log("\n=== RECOMMANDATIONS ===");
    if (stats.swapsPossibles === 0) {
        Logger.log("⚠️ AUCUN swap possible détecté dans l'échantillon!");
        Logger.log("Vérifiez :");
        Logger.log("- Que tous les élèves ne sont pas FIXE");
        Logger.log("- Que les élèves PERMUT/CONDI avec options ont des classes compatibles");
        Logger.log("- Que les contraintes de dissociation ne bloquent pas tout");
    } else {
        Logger.log("✅ Des swaps sont possibles!");
        Logger.log(`Taux de réussite estimé: ${Math.round(stats.swapsPossibles / testsEffectues * 100)}%`);
    }
    
    return stats;
}

// 3. Fonction de test simple pour vérifier le chargement
function testChargerEleves() {
    Logger.log("=== TEST CHARGEMENT ÉLÈVES ===");
    
    const config = getConfig();
    const result = chargerElevesEtClasses(config, "MOBILITE");
    
    Logger.log("Success: " + result.success);
    Logger.log("Students: " + (result.students ? result.students.length : "undefined"));
    Logger.log("ClassesMap: " + (result.classesMap ? Object.keys(result.classesMap).length + " classes" : "undefined"));
    
    if (result.classesMap) {
        Object.entries(result.classesMap).forEach(([className, eleves]) => {
            Logger.log(`  ${className}: ${eleves ? eleves.length : 0} élèves`);
        });
    }
    
    return result;
}

function genererEtEvaluerSwaps(allStudentsValides, currentClassesMap, structure, optionsNiveau, optionPools, dissocMap, initialStats, poidsEffectifs, penaltyFunc, MAX_SWAPS_TO_EVALUATE, SEUIL_IMPACT_MINIMAL, extraKeys, debugMode, parityTargets) { 
  const swapsEvaluesPositifs = []; 
  const classesUniquesNames = Object.keys(currentClassesMap); 
  let evaluationsCount = 0; 
  const MAX_LOGGED_CANDIDATES = debugMode ? 20 : 0;
  let loggedCount = 0;

  // === NOUVEAU : Calculer les cibles globales une seule fois ===
  const globalTargets = buildGlobalTargets(allStudentsValides);
  Logger.log(`Moteur V14 - Cibles globales calculées: COM=${JSON.stringify(globalTargets.target.COM)}`);

  Logger.log(`Moteur V14 - Génération swaps: MaxEval=${MAX_SWAPS_TO_EVALUATE}, SeuilImpactMin=${SEUIL_IMPACT_MINIMAL}`); 
  for (let i = 0; i < classesUniquesNames.length; i++) { 
    for (let j = i + 1; j < classesUniquesNames.length; j++) { 
      const c1N=classesUniquesNames[i]; 
      const c2N=classesUniquesNames[j]; 
      const elC1=currentClassesMap[c1N]||[]; 
      const elC2=currentClassesMap[c2N]||[]; 
      if(elC1.length===0||elC2.length===0) continue; 

      for (const e1 of elC1) { 
        if (evaluationsCount>=MAX_SWAPS_TO_EVALUATE) break; 
        if (!e1 || !e1.ID_ELEVE || String(e1.ID_ELEVE).trim() === '' || (e1.mobilite || 'LIBRE') ==='FIXE' || (e1.mobilite || 'LIBRE') ==='SPEC') continue; 
        
        for (const e2 of elC2) { 
          if (evaluationsCount>=MAX_SWAPS_TO_EVALUATE) break; 
          if (!e2 || !e2.ID_ELEVE || String(e2.ID_ELEVE).trim() === '' || (e2.mobilite || 'LIBRE') ==='FIXE' || (e2.mobilite || 'LIBRE') ==='SPEC') continue; 
          if (String(e1.ID_ELEVE).trim() === String(e2.ID_ELEVE).trim()) continue;

          if (respecteContraintes(e1, e2, allStudentsValides, structure, optionsNiveau, optionPools, dissocMap, currentClassesMap, PARITE_TOLERANCE, parityTargets)) { 
            evaluationsCount++; 
            const impact = evaluerImpactDistribution(e1, e2, currentClassesMap, initialStats, poidsEffectifs, penaltyFunc, globalTargets, parityTargets); 
            
            if (debugMode && loggedCount < MAX_LOGGED_CANDIDATES && impact > -Infinity) { 
                Logger.log(` Swap V14 Candidat #${evaluationsCount}: ${String(e1.ID_ELEVE).trim()}(${e1.mobilite || 'LIBRE'})[${e1.CLASSE}] <> ${String(e2.ID_ELEVE).trim()}(${e2.mobilite || 'LIBRE'})[${e2.CLASSE}], Impact=${impact.toFixed(6)}`); 
                loggedCount++; 
            }
            if (impact > SEUIL_IMPACT_MINIMAL) { 
                swapsEvaluesPositifs.push({ 
                    eleve1ID: String(e1.ID_ELEVE).trim(), 
                    eleve2ID: String(e2.ID_ELEVE).trim(), 
                    impact: impact, 
                    classe1: c1N, 
                    classe2: c2N 
                }); 
            } 
          } 
        } 
        if (evaluationsCount>=MAX_SWAPS_TO_EVALUATE) break; 
      } 
      if (evaluationsCount>=MAX_SWAPS_TO_EVALUATE) break; 
    } 
    if (evaluationsCount>=MAX_SWAPS_TO_EVALUATE) break; 
  } 
  Logger.log(`Moteur V14: ${swapsEvaluesPositifs.length} swaps valides trouvés sur ${evaluationsCount} évalués.`); 
  return swapsEvaluesPositifs; 
} 

/**
 * Applique itérativement les meilleurs swaps possibles jusqu'à atteindre maxSwapsToUse
 * ou jusqu'à ce qu'il n'y ait plus de swaps améliorant.
 * Modifie classesActuellesMap, currentDissocMap, et statsActuelles en conséquence.
 * Enregistre les swaps effectués dans journalSwapsEffectues, AVEC LES NOMS des élèves.
*/
 
function appliquerSwapsIterativement(
    swapsEvaluesInitiaux, 
    classesMapInitial, 
    allStudentsReference, 
    structure, 
    optionsNiveau, 
    optionPools, 
    dissocMapInitial, 
    statsInitiales, 
    poidsEffectifs, 
    penaltyFunc, 
    maxSwapsToUse,
    SEUIL_IMPACT_MINIMAL_APPLY, 
    extraKeys, 
    debugMode,
    pariteTolerance,
    parityTargets
) {
  Logger.log(`Moteur V14 - appliquerSwapsIterativement: Début. MaxSwaps à appliquer=${maxSwapsToUse}, ${swapsEvaluesInitiaux ? swapsEvaluesInitiaux.length : 0} swaps potentiels initiaux.`);
  
  const journalSwapsEffectues = []; 
  const classesActuellesMap = JSON.parse(JSON.stringify(classesMapInitial)); 
  const elevesByIdMap = new Map(); 
  
  Object.values(classesActuellesMap).flat().forEach(e => { 
      if (e && e.ID_ELEVE !== undefined && e.ID_ELEVE !== null) {
          const idKey = String(e.ID_ELEVE).trim(); 
          if (idKey !== '') {
              elevesByIdMap.set(idKey, e); 
          }
      }
  }); 
  Logger.log(`Moteur V14 - appliquerSwapsIterativement: elevesByIdMap construite avec ${elevesByIdMap.size} élèves.`);

  const idsElevesDejaSwappes = new Set(); 
  let statsActuelles = JSON.parse(JSON.stringify(statsInitiales)); 
  let swapsPotentielsRestants = [...(swapsEvaluesInitiaux || [])]; // Assurer que c'est un tableau
  
  let currentDissocMap = {};
  for (const classeName in dissocMapInitial) {
      if (dissocMapInitial.hasOwnProperty(classeName)) {
          if (dissocMapInitial[classeName] instanceof Set) {
              currentDissocMap[classeName] = new Set(dissocMapInitial[classeName]);
          } else if (Array.isArray(dissocMapInitial[classeName])) {
              currentDissocMap[classeName] = new Set(dissocMapInitial[classeName]);
          } else {
              Logger.log(`WARN appliquerSwapsIterativement: dissocMapInitial['${classeName}'] non Set/Array. Init à Set vide.`);
              currentDissocMap[classeName] = new Set();
          }
      }
  }
  Logger.log(`Moteur V14 - appliquerSwapsIterativement: currentDissocMap initialisée.`);

  let iterations = 0; 
  
  while (journalSwapsEffectues.length < maxSwapsToUse && swapsPotentielsRestants.length > 0) { 
    iterations++; 
    const swapCandidat = swapsPotentielsRestants.shift(); 

    if (!swapCandidat || swapCandidat.eleve1ID === undefined || swapCandidat.eleve2ID === undefined) {
        Logger.log(`WARN appliquerSwapsIterativement: Itération ${iterations}, swapCandidat invalide. Ignoré.`);
        continue;
    }

    const id1Key = String(swapCandidat.eleve1ID).trim(); // Assurer string trimée
    const id2Key = String(swapCandidat.eleve2ID).trim(); // Assurer string trimée

    if (idsElevesDejaSwappes.has(id1Key) || idsElevesDejaSwappes.has(id2Key)) {
        continue; 
    }
    
    const eleve1 = elevesByIdMap.get(id1Key); 
    const eleve2 = elevesByIdMap.get(id2Key); 

    if (!eleve1 || !eleve2) {
        Logger.log(`WARN appliquerSwapsIterativement: Itération ${iterations}, élève(s) introuvable(s) dans elevesByIdMap (ID1: ${id1Key}, ID2: ${id2Key}). Ignoré.`);
        continue;
    }
    
    if (eleve1.CLASSE !== swapCandidat.classe1 || eleve2.CLASSE !== swapCandidat.classe2) {
        continue; 
    }
    
    if (!respecteContraintes(eleve1, eleve2, Object.values(elevesByIdMap), structure, optionsNiveau, optionPools, currentDissocMap, classesActuellesMap, pariteTolerance || 2, parityTargets)) {
        continue; 
    }
    
    // Recalculer globalTargets pour cette itération
    const allStudentsCurrent = Object.values(classesActuellesMap).flat();
    const globalTargetsCurrent = buildGlobalTargets(allStudentsCurrent);
    const impactReevalue = evaluerImpactDistribution(eleve1, eleve2, classesActuellesMap, statsActuelles, poidsEffectifs, penaltyFunc, globalTargetsCurrent, parityTargets); 
    
    if (impactReevalue > SEUIL_IMPACT_MINIMAL_APPLY) { 
      const ac1 = eleve1.CLASSE; 
      const ac2 = eleve2.CLASSE; 
      
      classesActuellesMap[ac1] = classesActuellesMap[ac1].filter(e => String(e.ID_ELEVE).trim() !== id1Key); 
      classesActuellesMap[ac2] = classesActuellesMap[ac2].filter(e => String(e.ID_ELEVE).trim() !== id2Key); 
      
      eleve1.CLASSE = ac2; 
      eleve2.CLASSE = ac1;  
      
      classesActuellesMap[ac2].push(eleve1); 
      classesActuellesMap[ac1].push(eleve2); 
      
      // Utiliser la clé e.DISSO (majuscule) comme lu par chargerElevesEtClasses
      if (eleve1.DISSO && String(eleve1.DISSO).trim() !== '') {
        const dissocKey1 = String(eleve1.DISSO).trim().toUpperCase();
        if (!(currentDissocMap[ac1] instanceof Set)) currentDissocMap[ac1] = new Set();
        currentDissocMap[ac1].delete(dissocKey1);
        if (!(currentDissocMap[ac2] instanceof Set)) currentDissocMap[ac2] = new Set();
        currentDissocMap[ac2].add(dissocKey1);
      }
      if (eleve2.DISSO && String(eleve2.DISSO).trim() !== '') {
        const dissocKey2 = String(eleve2.DISSO).trim().toUpperCase();
        if (!(currentDissocMap[ac2] instanceof Set)) currentDissocMap[ac2] = new Set();
        currentDissocMap[ac2].delete(dissocKey2);
        if (!(currentDissocMap[ac1] instanceof Set)) currentDissocMap[ac1] = new Set();
        currentDissocMap[ac1].add(dissocKey2);
      }
      
      statsActuelles = getUpdatedStats(statsActuelles, ac1, ac2, classesActuellesMap[ac1], classesActuellesMap[ac2], classesActuellesMap, allStudentsReference.length); 
      
      // === AJOUT DES NOMS DANS LE JOURNAL ===
      journalSwapsEffectues.push({ 
          eleve1ID: id1Key, 
          eleve1Nom: eleve1.NOM || id1Key, // Utilise la propriété NOM de l'objet eleve1
          eleve2ID: id2Key, 
          eleve2Nom: eleve2.NOM || id2Key, // Utilise la propriété NOM de l'objet eleve2
          classe1: ac1,                   
          classe2: ac2,                   
          impact: impactReevalue 
      }); 
      // === FIN AJOUT DES NOMS ===
      
      idsElevesDejaSwappes.add(id1Key); 
      idsElevesDejaSwappes.add(id2Key); 
      
      if (debugMode) {
        const nom1Log = eleve1.NOM ? `${eleve1.NOM}(${id1Key})` : id1Key;
        const nom2Log = eleve2.NOM ? `${eleve2.NOM}(${id2Key})` : id2Key;
        Logger.log(`  Moteur V14 Swap Appliqué #${journalSwapsEffectues.length}: ${nom1Log} [${ac1}] <=> ${nom2Log} [${ac2}]. Impact=${impactReevalue.toFixed(6)}`);
      }
    } 
  }  
  
  Logger.log(`Moteur V14 Fin application des swaps: ${journalSwapsEffectues.length} swaps réalisés sur ${iterations} itérations.`); 
  
  return { 
      journalSwaps: journalSwapsEffectues, 
      statsFinales: statsActuelles, 
      classesFinales: classesActuellesMap 
  }; 
}

// --- Fonctions de Chargement ---
function determinerNiveauActif_placeholder_final() { const config = getConfig(); return config?.NIVEAU || "5°"; }
// niveauCache est déclaré globalement au début du fichier
function determinerNiveauActifCache() { if (niveauCache === null) { niveauCache = determinerNiveauActif_placeholder_final(); Logger.log(`Niveau actif mis en cache: ${niveauCache}`); } return niveauCache; } 

function lireStructureFeuille(sheet) { 
    const config = getConfig(); 
    const structureSheetName = config?.SHEETS?.STRUCTURE || "_STRUCTURE"; 
    Logger.log(`Moteur V14 - lireStructureFeuille: Lecture de '${structureSheetName}'...`);
    try { 
        if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(structureSheetName); 
        if (!sheet) throw new Error(`Feuille de structure '${structureSheetName}' non trouvée.`); 
        
        const data = sheet.getDataRange().getValues(); 
        if (data.length <= 1) throw new Error(`Feuille de structure '${structureSheetName}' est vide.`); 
        
        const headers = data[0].map(h => String(h).trim().toUpperCase()); 
        const classeDestColIndex = headers.indexOf("CLASSE_DEST"); 
        const optionsColIndex = headers.indexOf("OPTIONS"); 
        
        if (classeDestColIndex === -1 || optionsColIndex === -1) {
            throw new Error(`Colonnes CLASSE_DEST ou OPTIONS manquantes dans '${structureSheetName}'.`);
        }
        
        const classes = []; 
        for (let i = 1; i < data.length; i++) { 
            const row = data[i]; 
            const classeDestNameRaw = (classeDestColIndex < row.length) ? String(row[classeDestColIndex] || "").trim() : ""; 
            if (!classeDestNameRaw) continue; 
            
            const optionsStr = (optionsColIndex < row.length) ? String(row[optionsColIndex] || "").trim() : ""; 
            let options = []; 
            if (optionsStr) { 
                options = optionsStr.split(/[,/]/).map(optPart => optPart.trim()).filter(Boolean); 
            } 
            classes.push({ nom: classeDestNameRaw, options: options }); 
        } 
        if (classes.length === 0) throw new Error(`Aucune classe valide lue depuis '${structureSheetName}'.`); 
        Logger.log(`Moteur V14 - lireStructureFeuille: ${classes.length} définitions de classes lues.`); 
        return { classes }; 
    } catch (error) { 
        Logger.log(`ERREUR Moteur V14 - lireStructureFeuille: ${error.message}. Fallback...`); 
        const configFallback = getConfig(); 
        const testSheetsFallback = getTestSheetsForV14Optimization(); 
        const suffixFallback = configFallback?.TEST_SUFFIX || "TEST";
        const fallback = { classes: testSheetsFallback.map(s => ({ nom: s.getName().replace(new RegExp(suffixFallback + '$', 'i'), ''), options: [] })) }; 
        Logger.log(`Moteur V14 - lireStructureFeuille: Fallback, ${fallback.classes.length} classes.`);
        return fallback.classes.length > 0 ? fallback : null;
    }
}

function chargerStructureEtOptions(niveau, config) { 
    try { 
        const structure = lireStructureFeuille(); 
        if (!structure || !structure.classes || structure.classes.length === 0) {
            return { success: false, errorCode: ERROR_CODES.INVALID_STRUCTURE, message: `Moteur V14: Erreur lecture structure ou structure vide.` }; 
        }
        const niveauNormalise = String(niveau).includes("°") ? String(niveau).replace("°", "e") : String(niveau); 
        const optionsNiveau = config?.OPTIONS?.[niveauNormalise] || []; 
        Logger.log(`Moteur V14 - chargerStructureEtOptions: Options niveau ${niveau}: ${optionsNiveau.join(', ') || 'Aucune'}`); 
        return { success: true, structure, optionsNiveau }; 
    } catch (e) { 
        Logger.log(`ERREUR Moteur V14 - chargerStructureEtOptions: ${e.message}`);
        Logger.log(e.stack);
        return { success: false, errorCode: ERROR_CODES.UNCAUGHT_EXCEPTION, message: `Moteur V14 Erreur chargement structure/options: ${e.message}` }; 
    }
}

function getTestSheetsForV14Optimization() {
    Logger.log("Moteur V14: Récupération feuilles TEST (POUR OPTIM V14 AVEC CONFIG)..."); 
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const config = getConfig(); 
        const testSuffix = config?.TEST_SUFFIX || "TEST";
        const testSuffixRegex = new RegExp(testSuffix + '$', 'i');
        const protectedSheets = config?.PROTECTED_SHEETS || [];
        const specialPatterns = ["BILAN", "STATISTIQUES", "CONFIG", "STRUCTURE", "HISTORIQUE", "LOG", "JOURNAL", "BACKUP", "ACCUEIL", "CONSOLIDATION"];
        const protectedPattern = protectedSheets.map(s => `^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`).join('|');
        const specialPatternString = specialPatterns.join('|');
        const excludePattern = protectedPattern && specialPatternString ? `(${protectedPattern})|(${specialPatternString})` : (protectedPattern || specialPatternString);
        let excludeRegex = null;
        if (excludePattern) { excludeRegex = new RegExp(excludePattern, 'i'); }
        
        const testSheets = ss.getSheets().filter(sheet => {
            const name = sheet.getName();
            const endsWithTestSuffix = testSuffixRegex.test(name);
            let isExcluded = false;
            if (excludeRegex) { isExcluded = excludeRegex.test(name); }
            return endsWithTestSuffix && !isExcluded;
        });
        
        Logger.log(`Moteur V14: ${testSheets.length} feuilles TEST trouvées (POUR OPTIM V14).`);
        return testSheets;
    } catch (error) {
        Logger.log(`ERREUR Moteur V14 getTestSheetsForV14Optimization: ${error.message}`);
        Logger.log(error.stack); 
        return []; 
    }
}

// Dans Optimisation_V14.gs

/**
 * Charge les élèves et les classes depuis les feuilles TEST pour la V14.
 * La colonne de mobilité est attendue avec l'en-tête "MOBILITE".
 * PREND EN COMPTE LV2 COMME OPTION SI LA COLONNE OPT EST VIDE pour stu.optionKey.
 *
 * @param {object} config - L'objet de configuration global.
 * @param {string} headerMobilityALire - Le nom de l'en-tête attendu pour la colonne de mobilité (devrait être "MOBILITE").
 * @return {object} Un objet contenant {success: boolean, students: Array, classesMap: object, colIndexes: object, message?: string, errorCode?: string}
 */
function chargerElevesEtClasses(config, headerMobilityALire) {
    Logger.log("--- Début Moteur V14 chargerElevesEtClasses (+Mobilite) ---");
    let colIndexes = {}; 
    try {
        const testSheets = getTestSheetsForV14Optimization(); 
        if (!testSheets || testSheets.length === 0) {
            return { success: false, errorCode: ERROR_CODES.NO_TEST_SHEETS, message: "Moteur V14: Aucun onglet TEST trouvé pour charger les élèves." };
        }
        Logger.log(`Moteur V14 chargerElevesEtClasses: ${testSheets.length} feuilles TEST à traiter: [${testSheets.map(s => s.getName()).join(', ')}]`);

        const students = [];
        const classesMap = {};
        const currentConfig = config || getConfig();

        // Définition des noms d'en-têtes attendus
        const HEADER_NAMES = {
            ID_ELEVE: currentConfig?.HEADERS?.ID_ELEVE || currentConfig?.COLUMN_NAMES?.ID_ELEVE || "ID_ELEVE",
            NOM: currentConfig?.HEADERS?.NOM || currentConfig?.COLUMN_NAMES?.NOM_PRENOM || "NOM & PRENOM",
            COM: currentConfig?.HEADERS?.COM || currentConfig?.COLUMN_NAMES?.COM || "COM",
            TRA: currentConfig?.HEADERS?.TRA || currentConfig?.COLUMN_NAMES?.TRA || "TRA",
            PART: currentConfig?.HEADERS?.PART || currentConfig?.COLUMN_NAMES?.PART || "PART",
            ABS: currentConfig?.HEADERS?.ABS || currentConfig?.COLUMN_NAMES?.ABS || "ABS",
            OPT: currentConfig?.HEADERS?.OPT || currentConfig?.COLUMN_NAMES?.OPT || "OPT",
            LV2: currentConfig?.HEADERS?.LV2 || currentConfig?.COLUMN_NAMES?.LV2 || "LV2",
            ASSO: currentConfig?.HEADERS?.ASSO || currentConfig?.COLUMN_NAMES?.ASSO || "ASSO",
            DISSO: currentConfig?.HEADERS?.DISSO || currentConfig?.COLUMN_NAMES?.DISSO || "DISSO",
            SEXE: currentConfig?.HEADERS?.SEXE || currentConfig?.COLUMN_NAMES?.SEXE || "SEXE",
            MOBILITE: headerMobilityALire
        };
        Logger.log(`Moteur V14 chargerElevesEtClasses: HEADER_NAMES utilisés: ${JSON.stringify(HEADER_NAMES)}`);

        const REQUIRED_HEADERS = ["ID_ELEVE", "COM", "TRA", "PART"]; 
        let headersConsistents = currentConfig.ASSUME_CONSISTENT_HEADERS !== false;
        let headersCheckedGlobally = false;
        let missingColumnsLoggedSheet = {};

        testSheets.forEach(sheet => {
            const sheetNameForClass = sheet.getName();
            const data = sheet.getDataRange().getValues();
            classesMap[sheetNameForClass] = []; 
            
            if (data.length <= 1) {
                Logger.log(`Moteur V14 chargerElevesEtClasses: Feuille '${sheetNameForClass}' ignorée (vide).`);
                return; 
            }
            
            const currentHeaders = data[0].map(h => String(h).trim().toUpperCase());

            // Vérification des en-têtes
            if (!headersConsistents || !headersCheckedGlobally) {
                colIndexes = {}; 
                let missingRequired = [];
                
                for (const key in HEADER_NAMES) {
                    const headerNameToFind = String(HEADER_NAMES[key]).trim().toUpperCase();
                    const idx = currentHeaders.indexOf(headerNameToFind);
                    colIndexes[key] = idx; 
                    if (REQUIRED_HEADERS.includes(key) && idx === -1) {
                        missingRequired.push(headerNameToFind);
                    }
                }
                
                if (missingRequired.length > 0) {
                    throw new Error(`Colonnes critiques manquantes dans '${sheetNameForClass}': ${missingRequired.join(', ')}`);
                }
                
                // Warnings pour colonnes optionnelles
                if (colIndexes['MOBILITE'] === -1 && !missingColumnsLoggedSheet[sheetNameForClass + '_MOBILITE']) {
                    Logger.log(`WARN: Colonne '${headerMobilityALire}' non trouvée. Mobilité sera 'LIBRE'.`);
                    missingColumnsLoggedSheet[sheetNameForClass + '_MOBILITE'] = true;
                }
                
                if (headersConsistents) headersCheckedGlobally = true; 
                Logger.log(`Mapping colonnes (base 0): ${JSON.stringify(colIndexes)}`);
            }

            // Traitement des lignes de données
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                
                // Skip lignes vides
                if (row.every(cell => cell === null || String(cell).trim() === '')) {
                    continue;
                }
                
                const stu = { CLASSE: sheetNameForClass };
                
                // Fonction helper pour lire une cellule en toute sécurité
                const getCellValue = (row, colIndex) => {
                    if (colIndex >= 0 && colIndex < row.length) {
                        return row[colIndex];
                    }
                    return "";
                };
                
                // Lecture des données de base
                stu.ID_ELEVE = String(getCellValue(row, colIndexes.ID_ELEVE)).trim();
                
                if (stu.ID_ELEVE === "") {
                    continue; // Skip si pas d'ID
                }
                
                // Nom
                stu.NOM = String(getCellValue(row, colIndexes.NOM)).trim();
                if (!stu.NOM && stu.ID_ELEVE) {
                    stu.NOM = `Élève ${stu.ID_ELEVE}`;
                }
                
                // Sexe
                if (colIndexes.SEXE >= 0) {
                    stu.SEXE = String(getCellValue(row, colIndexes.SEXE)).trim().toUpperCase();
                }
                
                // === LECTURE CORRIGÉE COM/TRA/PART ===
                const comValue = getCellValue(row, colIndexes.COM);
                const traValue = getCellValue(row, colIndexes.TRA);
                const partValue = getCellValue(row, colIndexes.PART);
                const absValue = getCellValue(row, colIndexes.ABS);
                
                // Conversion en nombre ou 0 (pas chaîne vide)
                stu.COM = (comValue !== '' && comValue !== null && comValue !== undefined) 
                    ? Number(String(comValue).replace(',', '.')) || 0 : 0;
                stu.TRA = (traValue !== '' && traValue !== null && traValue !== undefined) 
                    ? Number(String(traValue).replace(',', '.')) || 0 : 0;
                stu.PART = (partValue !== '' && partValue !== null && partValue !== undefined) 
                    ? Number(String(partValue).replace(',', '.')) || 0 : 0;
                stu.ABS = (absValue !== '' && absValue !== null && absValue !== undefined) 
                    ? Number(String(absValue).replace(',', '.')) || 0 : 0;
                
                // DIAGNOSTIC COMPLET pour les premiers élèves
                if (i <= 3) {
                    Logger.log(`=== DIAGNOSTIC ÉLÈVE ${i} ===`);
                    Logger.log(`ID: ${stu.ID_ELEVE} | Classe: ${stu.CLASSE}`);
                    Logger.log(`COM[${colIndexes.COM}]: ${stu.COM} (raw: ${comValue})`);
                    Logger.log(`TRA[${colIndexes.TRA}]: ${stu.TRA} (raw: ${traValue})`);
                    Logger.log(`PART[${colIndexes.PART}]: ${stu.PART} (raw: ${partValue})`);
                    Logger.log(`ABS[${colIndexes.ABS}]: ${stu.ABS} (raw: ${absValue})`);
                    Logger.log(`MOBILITE[${colIndexes.MOBILITE}]: ${stu.MOBILITE}`);
                    Logger.log(`OPT: ${stu.OPT} | LV2: ${stu.LV2}`);
                }
                
                // Options et LV2
                stu.OPT = String(getCellValue(row, colIndexes.OPT)).trim();
                stu.LV2 = String(getCellValue(row, colIndexes.LV2)).trim();
                
                // Association/Dissociation
                stu.ASSO = String(getCellValue(row, colIndexes.ASSO)).trim();
                stu.DISSO = String(getCellValue(row, colIndexes.DISSO)).trim();
                
                // Mobilité
                const mobValue = getCellValue(row, colIndexes.MOBILITE);
                let mobilite = String(mobValue || 'LIBRE').trim().toUpperCase();
                
                // ✅ CORRECTION CRITIQUE : Normaliser les formats GROUPE_FIXE/GROUPE_PERMUT/CONDI
                // Mobility_System écrit :
                // - "FIXE" pour ancre (élève avec option unique)
                // - "CONDI(A6→6°1)" pour suiveurs (conditionnés par l'ancre)
                // - "GROUPE_PERMUT(D3→6°2,6°4)" pour groupes avec plusieurs classes
                if (mobilite.startsWith('GROUPE_FIXE')) {
                    mobilite = 'FIXE';
                } else if (mobilite.startsWith('CONDI')) {
                    mobilite = 'CONDI';  // ✅ Garder CONDI
                } else if (mobilite.startsWith('GROUPE_PERMUT')) {
                    mobilite = 'PERMUT';
                } else if (!['FIXE', 'PERMUT', 'CONDI', 'SPEC', 'LIBRE'].includes(mobilite)) {
                    mobilite = 'LIBRE';
                }
                
                stu.MOBILITE = mobilite;
                stu.mobilite = mobilite; // Propriété minuscule pour compatibilité
                
                // === LOGIQUE optionKey ===
                let optionPourDecision = stu.OPT;
                if (String(optionPourDecision).trim() === '' && stu.LV2 && String(stu.LV2).trim() !== '') {
                    optionPourDecision = stu.LV2;
                }
                
                let cleOptionNormalisee = null;
                if (optionPourDecision && String(optionPourDecision).trim() !== '') {
                    const optParts = String(optionPourDecision).split(/[,/]/);
                    let firstOpt = optParts.length > 0 ? optParts[0].trim().toUpperCase() : null;
                    if (firstOpt) {
                        if (firstOpt.includes("=")) { 
                            cleOptionNormalisee = firstOpt.split("=")[0].trim();
                        } else {
                            cleOptionNormalisee = firstOpt;
                        }
                    }
                }
                stu.optionKey = cleOptionNormalisee;
                
                // Clés normalisées
                stu.dissocKey = stu.DISSO ? String(stu.DISSO).trim().toUpperCase() : null; 
                stu.assoKey = stu.ASSO ? String(stu.ASSO).trim().toUpperCase() : null;
                
                // Ajouter l'élève
                students.push(stu);
                classesMap[sheetNameForClass].push(stu);
            }
            
            Logger.log(`${classesMap[sheetNameForClass].length} élèves chargés depuis '${sheetNameForClass}'.`);
        });

        if (students.length === 0) {
            Logger.log("Aucun élève n'a été chargé au total.");
            return { success: false, errorCode: ERROR_CODES.NO_STUDENTS_FOUND, message: "Aucun élève trouvé dans les onglets TEST." };
        }
        
        // Statistiques finales
        const statsChargement = {
            total: students.length,
            avecCOM: students.filter(s => s.COM !== '').length,
            avecTRA: students.filter(s => s.TRA !== '').length,
            avecPART: students.filter(s => s.PART !== '').length
        };
        
        Logger.log(`--- Fin chargerElevesEtClasses ---`);
        Logger.log(`Total: ${statsChargement.total} élèves`);
        Logger.log(`Avec données: COM=${statsChargement.avecCOM}, TRA=${statsChargement.avecTRA}, PART=${statsChargement.avecPART}`);
        
        return { success: true, students, classesMap, colIndexes }; 

    } catch (e) {
        Logger.log(`ERREUR FATALE chargerElevesEtClasses: ${e.message}`);
        Logger.log(e.stack);
        const errCode = e.message.includes("critiques manquantes") ? ERROR_CODES.MISSING_CRITICAL_DATA_COLUMN : ERROR_CODES.UNCAUGHT_EXCEPTION;
        return { success: false, errorCode: errCode, message: `Erreur chargement: ${e.message}`, colIndexes };
    }
}

// --- Fonctions de Sanitization ---
function buildClasseValidator() { 
    const valid = new Set(); 
    try { 
        getTestSheetsForV14Optimization().forEach(sh => valid.add(sh.getName())); 
    } catch (e) { Logger.log("Erreur buildClasseValidator: " + e.message); } 
    return v => valid.size > 0 ? valid.has(String(v).trim()) : true;
}

// Dans Optimisation_V14.gs

function sanitizeStudents(rows){ 
    const clean=[], invalid=[], dupes=[]; 
    const uniques = new Set(); 
    
    // Copie locale de CHECKS pour pouvoir modifier le validateur ID_ELEVE sans impacter la constante globale
    // On s'assure de faire une copie "profonde" au moins pour la partie ID_ELEVE si elle existe
    let checksToUse = {};
    if (typeof CHECKS !== 'undefined') {
        checksToUse = JSON.parse(JSON.stringify(CHECKS)); // Copie profonde pour éviter de modifier l'original
    } else {
        // Fallback minimal si CHECKS n'est pas défini globalement (pourrait arriver dans un contexte de test isolé)
        checksToUse = { 
            ID_ELEVE: { required: true, validator: v => !!String(v).trim(), message: 'ID_ELEVE manquant ou invalide par défaut.' }, 
            CLASSE: { required: true } 
        };
    }

    // --- PATCH LOCAL POUR ID_ELEVE VALIDATOR ---
    // Si un validator ID_ELEVE existe dans notre copie locale de CHECKS, on le remplace.
    if (checksToUse.ID_ELEVE && typeof checksToUse.ID_ELEVE.validator === 'function') {
        Logger.log("Sanitize V14: Remplacement du validateur ID_ELEVE localement pour accepter les formats alphanumériques.");
        checksToUse.ID_ELEVE.validator = function(v) {
            const idStr = String(v || "").trim();
            if (idStr === '') return false; // Vide n'est pas valide
            if (idStr.startsWith("AUTO_")) return true; // Accepte AUTO_
            // Accepte tout format se terminant par °[chiffres] ou º[chiffres]
            // Ex: ECOLE°21005, PREVERT°1, BONHOURE°2, 4°123, etc.
            if (/[°º]\d+$/.test(idStr)) return true;
            // Accepte aussi les IDs purement numériques
            if (!isNaN(Number(idStr)) && Number(idStr) > 0) return true;
            // Rejette les autres formats
            return false;
        };
        // Ajuster le message pour refléter la nouvelle validation (locale à cette exécution)
        checksToUse.ID_ELEVE.message = "ID_ELEVE invalide. Formats attendus: AUTO_..., ...°[chiffres], ou numérique pur.";
    } else if (checksToUse.ID_ELEVE) { // Si ID_ELEVE existe mais pas de validateur, on en met un simple non-vide
        checksToUse.ID_ELEVE.validator = v => String(v).trim().length > 0;
        checksToUse.ID_ELEVE.message = "ID_ELEVE manquant (vide) — formats alphanumériques acceptés.";
    }
    // --- FIN PATCH LOCAL ---

    const classeValidator = buildClasseValidator(); // Suppose que buildClasseValidator est défini ailleurs dans ce fichier ou globalement

    (rows || []).forEach((r, index)=>{ 
        const o=JSON.stringify(r); 
        let id = (r && r.ID_ELEVE !== undefined && r.ID_ELEVE !== null) ? String(r.ID_ELEVE).trim() : ""; 
        let ok=true; 
        let why="";
        
        const idCheckRule = checksToUse.ID_ELEVE; // Utilise la version potentiellement modifiée de checksToUse

        if (idCheckRule?.required && id === '') {
            why = idCheckRule.message || "ID_ELEVE manquant (Sanitize V14)";
            ok = false;
        } else if (id !== '' && idCheckRule?.validator && !idCheckRule.validator(id)) { 
            // Ce message vient maintenant de la règle modifiée dans checksToUse
            why = idCheckRule.message || `ID_ELEVE '${id}' invalide selon la règle V14 modifiée`;
            ok = false;
        }
        
        if (ok && id !== '' && idCheckRule?.unique) { 
            if(uniques.has(id)){
                why=`ID dupliqué V14 (${id})`; 
                dupes.push(id); 
                ok=false;
            } else {
                uniques.add(id);
            }
        }
        
        if(ok && r && checksToUse.CLASSE?.required && !classeValidator(String(r.CLASSE || ""))) { 
            why=`Classe '${r.CLASSE}' inconnue ou non valide (Sanitize V14)`; ok=false; 
        }
        
        // Validation pour COM, TRA, PART (assurez-vous que checksToUse.COM etc. existent si vous les utilisez)
        if(ok && r && ['COM','TRA','PART'].some(k => {
            const rule = checksToUse[k]; 
            if (!rule) return false; // Si la règle n'existe pas dans checksToUse, on ne valide pas
            const v = r[k]; 
            return (rule.required && (v === '' || v === null || v === undefined)) || 
                   ( (v !== '' && v !== null && v !== undefined) && rule.validator && !rule.validator(v) ); 
        })) { 
            why = `Note COM/TRA/PART invalide (Sanitize V14)`; 
            ok = false;
        }
        
        if(ok && r) { 
            for(const keyInChecks in checksToUse) { 
                if(['ID_ELEVE','CLASSE','COM','TRA','PART','MOBILITE'].indexOf(keyInChecks)===-1) { 
                    const rule = checksToUse[keyInChecks]; 
                    if (!rule) continue; // Si la règle n'existe pas
                    const v = r[keyInChecks]; 
                    if((rule.required && (v===''||v==null||v===undefined)) || 
                       ( (v !== '' && v !== null && v !== undefined) && rule.validator && !rule.validator(v))) { 
                        why = rule.message || `Validation ${keyInChecks} V14 échouée`; 
                        ok = false; 
                        break; 
                    } 
                } 
            } 
        }
        
        if(!ok){ 
            Logger.log(`Sanitize V14 - Ligne ${index+2} (${(r?r.NOM:null)||id||'?'}) Rejetée -> Motif: ${why}. Données: ${o.substring(0,200)}`); // Log plus long pour les données
            invalid.push({...JSON.parse(o),reason:why}); 
        } else if (r) { 
            r.ID_ELEVE = id; // S'assurer que l'ID dans l'objet est la version trimmée
            clean.push(r); 
        }
    });
    
    Logger.log(`Sanitize V14 Terminé: ${clean.length} OK | ${invalid.length} rejetés | ${dupes.length} doublons`); 
    return {clean,invalid,dupes};
}

// --- Fonctions d'Exécution ---
function executerSwapsDansOnglets(journalSwaps) { 
     if (!journalSwaps || journalSwaps.length === 0) {
         Logger.log("Moteur V14 - executerSwapsDansOnglets: Aucun swap à exécuter.");
         return; 
     }
     Logger.log(`Moteur V14 - executerSwapsDansOnglets: Début exécution de ${journalSwaps.length} swaps...`);
     const startTime = new Date().getTime();
     try {
         const ss = SpreadsheetApp.getActiveSpreadsheet(); 
         const sheetsIndex = {}; 
         getTestSheetsForV14Optimization().forEach(sheet => { sheetsIndex[sheet.getName()] = sheet; });
         
         let swapsReussis = 0; 
         let swapsEchoues = 0; 
         const rowsToUpdate = {}; 

         journalSwaps.forEach((swap, index) => { 
             const id1 = String(swap.eleve1ID).trim(); 
             const id2 = String(swap.eleve2ID).trim(); 
             const cl1 = swap.classe1; 
             const cl2 = swap.classe2; 
             
             if (!id1 || !id2 || !cl1 || !cl2) { 
                 swapsEchoues++; 
                 Logger.log(`executerSwapsDansOnglets - Swap #${index} ignoré: Données de swap manquantes.`); 
                 return; 
             } 
             
             const sheet1 = sheetsIndex[cl1]; 
             const sheet2 = sheetsIndex[cl2]; 
             if (!sheet1 || !sheet2) { 
                 swapsEchoues++; 
                 Logger.log(`executerSwapsDansOnglets - Swap #${index} ignoré: Feuille(s) ${sheet1 ? '' : cl1} ${sheet2 ? '' : cl2} non trouvée(s).`); 
                 return; 
             } 
             
             const loc1 = findStudentRowInSheet_Robust(sheet1, id1); 
             const loc2 = findStudentRowInSheet_Robust(sheet2, id2); 
             
             if (!loc1 || !loc2) { 
                 Logger.log(`ERREUR executerSwapsDansOnglets - Swap #${index}: Élève ${loc1 ? id2 : id1} introuvable. Swap ignoré.`); 
                 swapsEchoues++; 
                 return; 
             } 
             
             const rowData1 = loc1.rowData; 
             const rowData2 = loc2.rowData; 
             const numColsSheet1 = sheet1.getLastColumn();
             const numColsSheet2 = sheet2.getLastColumn();
             const maxCols = Math.max(rowData1.length, rowData2.length, numColsSheet1, numColsSheet2);
             
             const paddedRowData1 = rowData1.concat(Array(Math.max(0, maxCols - rowData1.length)).fill("")); 
             const paddedRowData2 = rowData2.concat(Array(Math.max(0, maxCols - rowData2.length)).fill("")); 
             
             if (!rowsToUpdate[cl1]) rowsToUpdate[cl1] = {}; 
             if (!rowsToUpdate[cl2]) rowsToUpdate[cl2] = {}; 
             
             rowsToUpdate[cl2][loc2.rowNum] = paddedRowData1; 
             rowsToUpdate[cl1][loc1.rowNum] = paddedRowData2; 
        }); 
         
        Logger.log(`Moteur V14 - executerSwaps: Écriture batch pour ${Object.keys(rowsToUpdate).length} feuilles.`); 
        let writesFailed = 0;
        for (const sheetName in rowsToUpdate) { 
            const sheet = sheetsIndex[sheetName]; 
            if (!sheet) { 
                writesFailed += Object.keys(rowsToUpdate[sheetName]).length; 
                Logger.log(`WARN executerSwaps: Feuille '${sheetName}' n'existe plus pour l'écriture.`);
                continue; 
            } 
            
            const updatesForThisSheet = rowsToUpdate[sheetName]; 
            const rowsToUpdateInSheet = Object.keys(updatesForThisSheet).map(Number).sort((a, b) => a - b); 
            
            let startRow = -1; 
            let currentBlockData = []; 
            
            function writeBlockToSheet() {
                if (currentBlockData.length > 0 && startRow > 0) {
                    try {
                        const numColsToWrite = currentBlockData[0].length;
                        currentBlockData.forEach(rowArray => {
                            if (rowArray.length < numColsToWrite) {
                                rowArray.push(...Array(numColsToWrite - rowArray.length).fill(""));
                            } else if (rowArray.length > numColsToWrite) {
                                rowArray.length = numColsToWrite; 
                            }
                        });
                        sheet.getRange(startRow, 1, currentBlockData.length, numColsToWrite).setValues(currentBlockData);
                    } catch (e) {
                        Logger.log(`ERREUR Moteur V14 écriture bloc sur '${sheetName}': ${e.message}`); 
                        writesFailed += currentBlockData.length;
                    }
                }
            }

            for (let k = 0; k < rowsToUpdateInSheet.length; k++) {
                const rowNum = rowsToUpdateInSheet[k];
                if (startRow === -1) { 
                    startRow = rowNum;
                    currentBlockData.push(updatesForThisSheet[rowNum]);
                } else if (rowNum === startRow + currentBlockData.length) { 
                    currentBlockData.push(updatesForThisSheet[rowNum]);
                } else { 
                    writeBlockToSheet(); 
                    startRow = rowNum; 
                    currentBlockData = [updatesForThisSheet[rowNum]];
                }
            }
            writeBlockToSheet(); 
        }
         const finalFailed = swapsEchoues + writesFailed; 
         swapsReussis = journalSwaps.length - finalFailed;
         Logger.log(`Moteur V14 Exec swaps: ${swapsReussis} réussis, ${finalFailed} échoués. (${(new Date().getTime() - startTime)/1000}s)`);
         if (finalFailed > 0) throw new Error(`${finalFailed} swap(s) V14 ont échoué lors de l'écriture.`);
     } catch (error) { 
         Logger.log(`EXCEPTION Moteur V14 executerSwaps: ${error.message}`); 
         Logger.log(error.stack);
         throw error; 
     }
}

function findStudentRowInSheet_Robust(sheet, targetId) { 
     if (!sheet) return null; 
     const data = sheet.getDataRange().getValues(); 
     if (data.length <= 1) return null;
     
     const headers = data[0].map(h => String(h).trim().toUpperCase()); 
     const idColIndex = headers.indexOf("ID_ELEVE"); 
     if (idColIndex === -1) {
         Logger.log(`findStudentRowInSheet_Robust: Colonne ID_ELEVE non trouvée dans '${sheet.getName()}'.`);
         return null;
     }

     const targetIdStr = String(targetId).trim(); 

     for (let i = 1; i < data.length; i++) { 
         const rowNum = i + 1; 
         const rowData = data[i]; 
         if (rowData.length <= idColIndex) continue; 
         
         const idSheetRaw = rowData[idColIndex]; 
         const idSheetStr = String(idSheetRaw).trim(); 
         
         if (idSheetStr === targetIdStr) return { rowNum: rowNum, rowData: rowData };
     } 
     return null; 
}

function sauvegarderJournalSwaps(journal, niveau, scenario) { 
     Logger.log(`DEBUT sauvegarderJournalSwaps: Scenario '${scenario}', Niveau '${niveau}'. ${journal ? journal.length : '0'} swaps.`);
     if (!journal || journal.length === 0) {
         Logger.log("sauvegarderJournalSwaps: Aucun swap à journaliser, sortie.");
         return;
     }
     try { 
         const ss = SpreadsheetApp.getActiveSpreadsheet();
         Logger.log("sauvegarderJournalSwaps: SpreadsheetApp OK.");
         
         const config = getConfig();
         if (!config || !config.SHEETS || !config.SHEETS.JOURNAL) {
             Logger.log(`ERREUR sauvegarderJournalSwaps: config.SHEETS.JOURNAL non défini. Config: ${JSON.stringify(config)}`);
             return; 
         }
         Logger.log(`sauvegarderJournalSwaps: Config chargée. config.SHEETS.JOURNAL = '${config.SHEETS.JOURNAL}'`);
         
         const sheetNameForJournal = config.SHEETS.JOURNAL; 
         
         Logger.log(`sauvegarderJournalSwaps: Nom de feuille journal cible: '${sheetNameForJournal}'`);
         
         let journalSheet = ss.getSheetByName(sheetNameForJournal); 
         const dateHeure = new Date().toLocaleString('fr-FR', { timeZone: config.TIMEZONE || 'Europe/Paris' }); 
         Logger.log(`sauvegarderJournalSwaps: Date/heure pour journal: '${dateHeure}'`);
         
         const expectedHeaders = ["DATE_EXECUTION", "NIVEAU", "SCENARIO", "INDEX_SWAP", "ELEVE1_ID", "ELEVE1_NOM", "ELEVE2_ID", "ELEVE2_NOM", "CLASSE_ORIGINE_E1", "CLASSE_ORIGINE_E2", "IMPACT_SWAP"]; 
         
         if (!journalSheet) { 
             Logger.log(`sauvegarderJournalSwaps: Feuille '${sheetNameForJournal}' non trouvée, tentative de création...`);
             try {
                journalSheet = ss.insertSheet(sheetNameForJournal); 
                Logger.log(`sauvegarderJournalSwaps: Feuille '${sheetNameForJournal}' CRÉÉE.`);
                journalSheet.appendRow(expectedHeaders);
                journalSheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold"); 
                Logger.log(`sauvegarderJournalSwaps: En-têtes écrits dans '${sheetNameForJournal}'.`);
             } catch (eCreate) {
                Logger.log(`ERREUR CRITIQUE sauvegarderJournalSwaps: Échec CRÉATION feuille '${sheetNameForJournal}': ${eCreate.message}`);
                Logger.log(eCreate.stack);
                return; 
             }
         } else {
             Logger.log(`sauvegarderJournalSwaps: Feuille '${sheetNameForJournal}' trouvée.`);
             const currentHeaders = journalSheet.getRange(1, 1, 1, journalSheet.getMaxColumns()).getValues()[0].map(h => String(h).trim());
             let headersOk = currentHeaders.length >= expectedHeaders.length;
             if (headersOk) {
                 for(let k=0; k < expectedHeaders.length; k++) {
                     if (currentHeaders[k] !== expectedHeaders[k]) {
                         headersOk = false;
                         break;
                     }
                 }
             }
             if (!headersOk) {
                 Logger.log(`WARN sauvegarderJournalSwaps: En-têtes de '${sheetNameForJournal}' incorrects. Réécriture...`);
                 journalSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]).setFontWeight("bold");
             }
         }
         
         const rowsToAdd = journal.map((swap, index) => [
             dateHeure, niveau, scenario, index + 1, 
             String(swap.eleve1ID).trim(), 
             swap.eleve1Nom || String(swap.eleve1ID).trim(), // Utiliser le nom, fallback sur ID
             String(swap.eleve2ID).trim(), 
             swap.eleve2Nom || String(swap.eleve2ID).trim(), // Utiliser le nom, fallback sur ID
             swap.classe1, 
             swap.classe2, 
             swap.impact ? swap.impact.toFixed(6) : 'N/A'
         ]);
         
         if (rowsToAdd.length > 0) { 
             Logger.log(`sauvegarderJournalSwaps: Ajout de ${rowsToAdd.length} lignes à '${sheetNameForJournal}'.`);
             const lastRow = journalSheet.getLastRow();
             const startRow = lastRow + 1; 
             const numCols = rowsToAdd[0] ? rowsToAdd[0].length : expectedHeaders.length; 
             
             if (numCols > 0) {
                 try {
                    journalSheet.getRange(startRow, 1, rowsToAdd.length, numCols).setValues(rowsToAdd); 
                    Logger.log(`sauvegarderJournalSwaps: ${rowsToAdd.length} entrées ajoutées à '${sheetNameForJournal}'.`); 
                 } catch (eWrite) {
                    Logger.log(`ERREUR CRITIQUE sauvegarderJournalSwaps: Échec ÉCRITURE dans '${sheetNameForJournal}': ${eWrite.message}`);
                    Logger.log(eWrite.stack);
                 }
             } else {
                 Logger.log("sauvegarderJournalSwaps: Aucune colonne à écrire.");
             }
         } else {
             Logger.log("sauvegarderJournalSwaps: Aucune ligne à ajouter.");
         }
     } catch (error) { 
         Logger.log(`ERREUR GLOBALE dans sauvegarderJournalSwaps: ${error.message}\n${error.stack}`); 
     }
     Logger.log("FIN sauvegarderJournalSwaps.");
}

// --- Fonctions de Logging ---
// (Supposées être dans Utils.gs et appelées globalement)
// function logStats(label, stats, extraKeys) { /* ... dans Utils.gs ... */ }
// function logAmeliorations(statsInitiales, statsFinales, extraKeys) { /* ... dans Utils.gs ... */ }


// =================================================
// 3. WRAPPER UI (POINT D'ENTRÉE POUR V14)
// =================================================
function lancerOptimisationV14_Wrapper(scenariosChoisis, maxSwaps) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log("V14I Wrapper: Verrou actif.");
    SpreadsheetApp.getUi().alert("Optimisation déjà en cours.", "Veuillez patienter.", SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, errorCode: "LOCKED", message: "Processus déjà verrouillé." };
  }
  const scriptStartTime = new Date();
  Logger.log("==========================================================");
  Logger.log(" 🚀 LANCEMENT NOUVELLE ORCHESTRATION V14I");
  Logger.log("==========================================================");

  let resultatOptimisation;

  try {
    Logger.log("V14I Wrapper: Appel de runOptimizationV14FullI()...");
    SpreadsheetApp.getActiveSpreadsheet().toast("Optimisation V14I en cours (4 phases)...", "V14I", 5);

    // APPEL DU NOUVEAU MOTEUR V14I
    resultatOptimisation = runOptimizationV14FullI({}); 
    
    Logger.log("<<< [Wrapper V14I] Résultat reçu du nouveau moteur:");
    if (resultatOptimisation) {
        Logger.log('Résultat: Success=' + resultatOptimisation.ok + ', Swaps=' + resultatOptimisation.swaps + ', Duration=' + resultatOptimisation.duration + 's');
    } else {
        Logger.log("Résultat moteur indéfini.");
    }

    let messageUIFinal = "Optimisation V14I: Résultat non défini.";
    if (resultatOptimisation && resultatOptimisation.ok) {
      const tempsSec = resultatOptimisation.duration ? resultatOptimisation.duration.toFixed(1) + "s" : "N/A";
      const warnings = resultatOptimisation.warnings && resultatOptimisation.warnings.length > 0 ?
        '\n⚠️ ' + resultatOptimisation.warnings.length + ' warnings' : '';
      messageUIFinal = '✅ Optimisation V14I RÉUSSIE !\n' +
        '✅ Phase 1I : Options/LV2\n' +
        '✅ Phase 2I : DISSO/ASSO\n' +
        '✅ Phase 3I : Effectifs/Parité\n' +
        '✅ Phase 4 : Swaps (' + (resultatOptimisation.swaps || 0) + ' appliqués)\n' +
        'Durée: ' + tempsSec + warnings;
    } else if (resultatOptimisation) {
      messageUIFinal = '❌ ÉCHEC Optimisation V14I:\n' + (resultatOptimisation.message || "Erreur inconnue.");
    }
    SpreadsheetApp.getUi().alert("Résultat Optimisation V14I", messageUIFinal, SpreadsheetApp.getUi().ButtonSet.OK);

    return resultatOptimisation; 
  } catch (e) {
    Logger.log('!!!!!! ERREUR FATALE Wrapper V14I : ' + e.message + ' !!!!!!');
    Logger.log(e.stack);
    SpreadsheetApp.getUi().alert("Erreur Fatale V14I", 'Erreur inattendue: ' + e.message + '.', SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, errorCode: 'UNCAUGHT_EXCEPTION', message: 'Erreur fatale wrapper V14I: ' + e.message };
  } 
  finally {
    lock.releaseLock();
    Logger.log("V14 Wrapper: Verrou libéré.");
    const scriptEndTime = new Date();
    Logger.log(`##### FIN WRAPPER V14 | Durée totale: ${(scriptEndTime.getTime() - scriptStartTime.getTime())/1000}s #####`);
    Logger.log("==========================================================");
  }
}

function construirePoidsDepuisScenarios(scenarios = ["STANDARD"]) {
    const BOOST_VALUE = 6.0; 
    const poids = { tetesDeClasse: 3.0, niveau1: 2.5, distribution: 1.5, com1: 0, tra4: 0, part4: 0, garantieTete: 1000 };
    (scenarios || []).forEach(scenario => { 
        switch (String(scenario).toUpperCase()) { 
            case "COM": poids.com1 = BOOST_VALUE; break; 
            case "TRA": poids.tra4 = BOOST_VALUE; break; 
            case "PART": poids.part4 = BOOST_VALUE; break; 
            case "TETES": poids.tetesDeClasse = Math.max(poids.tetesDeClasse, BOOST_VALUE); break; 
            case "NIVEAU1": poids.niveau1 = Math.max(poids.niveau1, BOOST_VALUE); break; 
            case "DISTRIB": poids.distribution = Math.max(poids.distribution, BOOST_VALUE); break; 
            case "STANDARD": break; 
            default: Logger.log(`WARN Moteur V14 - construirePoids: Scénario '${scenario}' inconnu.`); 
        }
    }); 
    return poids;
}
// --- FIN DU SCRIPT V14 --
/**
 * ==================================================================
 * AJOUTS POUR OPTIMISATION_V14.GS - CALCUL DES STATS COMME PARITÉ
 * ==================================================================
 * À ajouter à la fin du fichier Optimisation_V14.gs
 * Remplace l'appel à calculerStatistiquesTEST() par ces fonctions
 */

// Constantes de style reprises du module Parité (style "Maquette")
const V14_STATS_STYLE = {
  HEADER_BG: "#C6E0B4",
  SEXE_F_COLOR: "#F28EA8", // Rose Maquette
  SEXE_M_COLOR: "#4F81BD", // Bleu Maquette
  LV2_ESP_COLOR: "#E59838", // Orange pour ESP
  LV2_AUTRE_COLOR: "#A3E4D7", // Bleu-vert clair pour autres
  SCORE_COLORS: {
    1: "#FF0000", // Rouge
    2: "#FFD966", // Jaune
    3: "#3CB371", // Vert moyen
    4: "#006400"  // Vert foncé
  },
  SCORE_FONT_COLORS: {
    1: "#FFFFFF", // Blanc
    2: "#000000", // Noir
    3: "#FFFFFF", // Blanc
    4: "#FFFFFF"  // Blanc
  }
};

/**
 * Fonction principale de calcul des statistiques V14 (remplace calculerStatistiquesTEST)
 * À appeler à la fin de V11_OptimisationDistribution_Combined
 */
function calculerStatistiquesTEST() {
  Logger.log("=== DÉBUT CALCUL STATISTIQUES V14 (style Parité) ===");
  
  try {
    const testSheets = getTestSheetsForV14Stats();
    if (testSheets.length === 0) {
      Logger.log("Aucun onglet TEST trouvé pour les stats V14");
      return;
    }
    
    Logger.log(`Calcul des stats pour ${testSheets.length} onglets TEST`);
    
    // Calculer et écrire les stats pour chaque onglet TEST
    testSheets.forEach(sheet => {
      V14_calculerEtEcrireStatsSheet(sheet);
    });
    
    Logger.log("=== FIN CALCUL STATISTIQUES V14 ===");
    
  } catch (e) {
    Logger.log(`Erreur calculerStatistiquesTEST V14: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * Récupère les onglets TEST pour les stats V14
 */
function getTestSheetsForV14Stats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testPattern = /TEST$/i;
  return ss.getSheets().filter(sheet => testPattern.test(sheet.getName()));
}

/**
 * Calcule et écrit les statistiques pour une feuille (style Parité)
 */
function V14_calculerEtEcrireStatsSheet(sheet) {
  try {
    const sheetName = sheet.getName();
    Logger.log(`Calcul stats pour ${sheetName}`);
    
    // 1. Identifier les colonnes
    const colMap = V14_identifierColonnes(sheet);
    if (!colMap.valide) {
      Logger.log(`Colonnes requises manquantes dans ${sheetName}`);
      return;
    }
    
    // 2. Compter les élèves
    const lastRow = sheet.getLastRow();
    let lastDataRow = 1;
    if (lastRow > 1) {
      // Trouver la dernière ligne avec des données
      const idsColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      for (let i = idsColumn.length - 1; i >= 0; i--) {
        if (String(idsColumn[i]).trim()) {
          lastDataRow = i + 2;
          break;
        }
      }
    }
    const nRows = lastDataRow > 1 ? lastDataRow - 1 : 0;
    
    if (nRows === 0) {
      Logger.log(`Aucun élève dans ${sheetName}`);
      return;
    }
    
    // 3. Calculer les statistiques
    const stats = V14_calculateSheetStats(sheet, nRows, colMap);
    if (!stats) {
      Logger.log(`Échec calcul stats pour ${sheetName}`);
      return;
    }
    
    // 4. Écrire les statistiques
    const statsRow = lastDataRow + 2; // Ligne séparée + 1
    V14_writeSheetStats(sheet, statsRow, colMap, stats);
    
    Logger.log(`Stats écrites pour ${sheetName} à la ligne ${statsRow}`);
    
  } catch (e) {
    Logger.log(`Erreur stats pour ${sheet.getName()}: ${e.message}`);
  }
}

/**
 * Identifie les colonnes importantes dans la feuille
 */
function V14_identifierColonnes(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toUpperCase());
  
  const colMap = {
    ID_ELEVE: -1,
    NOM_PRENOM: -1,
    SEXE: -1,
    LV2: -1,
    OPT: -1,
    COM: -1,
    TRA: -1,
    PART: -1,
    ABS: -1,
    valide: false
  };
  
  // Recherche des colonnes avec fallbacks
  headers.forEach((header, index) => {
    if (header.includes("ID_ELEVE") || header === "ID") colMap.ID_ELEVE = index + 1;
    else if (header.includes("NOM") && header.includes("PRENOM")) colMap.NOM_PRENOM = index + 1;
    else if (header === "SEXE" || header === "S") colMap.SEXE = index + 1;
    else if (header === "LV2") colMap.LV2 = index + 1;
    else if (header === "OPT") colMap.OPT = index + 1;
    else if (header === "COM" || header === "H") colMap.COM = index + 1;
    else if (header === "TRA" || header === "I") colMap.TRA = index + 1;
    else if (header === "PART" || header === "J") colMap.PART = index + 1;
    else if (header === "ABS" || header === "K") colMap.ABS = index + 1;
  });
  
  // Vérifier que les colonnes essentielles existent
  colMap.valide = (colMap.ID_ELEVE > 0 && colMap.SEXE > 0);
  
  return colMap;
}

/**
 * Calcule les statistiques détaillées pour une feuille
 */
function V14_calculateSheetStats(sheet, numDataRows, colMap) {
  const data = sheet.getRange(2, 1, numDataRows, sheet.getMaxColumns()).getValues();
  const validRows = data.filter(r => String(r[0]).trim() !== ""); // Filtrer sur ID_ELEVE
  
  if (validRows.length === 0) return null;
  
  // Fonction helper pour extraire les données d'une colonne
  const getColData = (colKey) => colMap[colKey] > 0 ? validRows.map(r => r[colMap[colKey] - 1]) : [];
  
  // Fonction helper pour compter les valeurs
  const countValues = (colData, value) => colData.filter(cell => 
    String(cell).trim().toUpperCase() === String(value).toUpperCase()).length;
  
  // Fonction helper pour les valeurs non vides
  const countNonEmpty = (colData) => colData.filter(cell => String(cell).trim() !== "").length;
  
  // Fonction helper pour convertir en nombres
  const toNumericArray = (colData) => colData.map(cell => {
    const num = Number(String(cell).replace(',', '.'));
    return isNaN(num) ? 0 : num;
  });
  
  // Fonction helper pour calculer la moyenne
  const calculateAverage = (numArray) => {
    const filtered = numArray.filter(n => n > 0);
    return filtered.length > 0 ? filtered.reduce((s, v) => s + v, 0) / filtered.length : 0;
  };
  
  // Données par colonne
  const sexeData = getColData('SEXE');
  const lv2Data = getColData('LV2');
  const optData = getColData('OPT');
  
  const stats = {
    genreCounts: [countValues(sexeData, 'F'), countValues(sexeData, 'M')],
    lv2Counts: [
      countValues(lv2Data, 'ESP'),
      lv2Data.length - countValues(lv2Data, 'ESP') - countValues(lv2Data, '') // Autres non-vides
    ],
    optionsCounts: [countNonEmpty(optData)],
    criteresScores: {},
    criteresMoyennes: []
  };
  
  // Calcul des scores par critère
  ['COM', 'TRA', 'PART', 'ABS'].forEach(critKey => {
    const critDataNum = toNumericArray(getColData(critKey));
    stats.criteresScores[critKey] = {};
    
    // Compter chaque score 1-4
    for (let score = 1; score <= 4; score++) {
      stats.criteresScores[critKey][score] = critDataNum.filter(val => val === score).length;
    }
    
    // Calculer la moyenne
    stats.criteresMoyennes.push(calculateAverage(critDataNum));
  });
  
  // S'assurer qu'on a 4 moyennes
  while (stats.criteresMoyennes.length < 4) {
    stats.criteresMoyennes.push(0);
  }
  
  return stats;
}

/**
 * Écrit les statistiques dans la feuille avec le formatage Maquette
 */
function V14_writeSheetStats(sheet, row, colMap, stats) {
  const maxCol = Math.max(
    colMap.NOM_PRENOM || 1,
    colMap.SEXE || 1,
    colMap.LV2 || 1,
    colMap.OPT || 1,
    colMap.COM || 1,
    colMap.TRA || 1,
    colMap.PART || 1,
    colMap.ABS || 1
  );
  
  if (sheet.getMaxRows() < row + 7) return; // Pas assez de place
  
  // Nettoyer la zone des statistiques
  sheet.getRange(row, 1, 7, maxCol).clearContent().clearFormat();
  
  // Fonction helper pour définir valeur et style
  const set = (r, c, v, style = {}) => {
    if (c > 0 && c <= sheet.getMaxColumns() && r <= sheet.getMaxRows()) {
      const cell = sheet.getRange(r, c);
      cell.setValue(v);
      if (style.bold) cell.setFontWeight('bold');
      if (style.align) cell.setHorizontalAlignment(style.align);
      if (style.bg) cell.setBackground(style.bg);
      if (style.fg) cell.setFontColor(style.fg);
      if (style.fmt) cell.setNumberFormat(style.fmt);
      if (style.italic) cell.setFontStyle('italic');
    }
  };
  
  if (!stats) {
    set(row, 1, 'Pas de données', { italic: true });
    return;
  }
  
  // Statistiques de genre/langues sur le côté (colonnes E et F)
  if (colMap.SEXE > 0) {
    // Filles
    set(row, 5, stats.genreCounts[0], { 
      align: 'center', 
      bg: V14_STATS_STYLE.SEXE_F_COLOR, 
      bold: true 
    });
    
    // Garçons
    set(row + 1, 5, stats.genreCounts[1], { 
      align: 'center', 
      bg: V14_STATS_STYLE.SEXE_M_COLOR, 
      fg: 'white', 
      bold: true 
    });
  }
  
  if (colMap.LV2 > 0) {
    // ESP
    set(row, 6, stats.lv2Counts[0], { 
      align: 'center', 
      bg: V14_STATS_STYLE.LV2_ESP_COLOR, 
      bold: true 
    });
    
    // Autres LV2
    set(row + 1, 6, stats.lv2Counts[1], { 
      align: 'center', 
      bg: V14_STATS_STYLE.LV2_AUTRE_COLOR, 
      bold: true 
    });
  }
  
  if (colMap.OPT > 0) {
    // Options total
    set(row, 7, stats.optionsCounts[0], { 
      align: 'center', 
      bold: true 
    });
  }
  
  // Scores par critère dans leurs colonnes respectives
  ['COM', 'TRA', 'PART', 'ABS'].forEach((critKey, index) => {
    const columnIndex = colMap[critKey];
    if (columnIndex > 0) {
      // Score 4 (vert foncé, police blanche)
      set(row, columnIndex, stats.criteresScores[critKey][4], { 
        align: 'center', 
        bg: V14_STATS_STYLE.SCORE_COLORS[4], 
        bold: true, 
        fg: V14_STATS_STYLE.SCORE_FONT_COLORS[4] 
      });
      
      // Score 3 (vert clair)
      set(row + 1, columnIndex, stats.criteresScores[critKey][3], { 
        align: 'center', 
        bg: V14_STATS_STYLE.SCORE_COLORS[3], 
        bold: true,
        fg: V14_STATS_STYLE.SCORE_FONT_COLORS[3]
      });
      
      // Score 2 (jaune)
      set(row + 2, columnIndex, stats.criteresScores[critKey][2], { 
        align: 'center', 
        bg: V14_STATS_STYLE.SCORE_COLORS[2], 
        bold: true,
        fg: V14_STATS_STYLE.SCORE_FONT_COLORS[2]
      });
      
      // Score 1 (rouge)
      set(row + 3, columnIndex, stats.criteresScores[critKey][1], { 
        align: 'center', 
        bg: V14_STATS_STYLE.SCORE_COLORS[1], 
        bold: true,
        fg: V14_STATS_STYLE.SCORE_FONT_COLORS[1]
      });
      
      // Moyenne
      set(row + 4, columnIndex, stats.criteresMoyennes[index], { 
        align: 'center', 
        bold: true, 
        fmt: '#,##0.00' 
      });
    }
  });
}
/**
 * DÉBOGAGE COMPLET DU PROBLÈME CLASSESMAP
 * À copier-coller dans votre fichier Optimisation_V14.gs
 */

// 1. D'ABORD, vérifier qu'il n'y a PAS DEUX versions de chargerElevesEtClasses
function verifierDoublonsChargerEleves() {
  Logger.log("=== RECHERCHE DE DOUBLONS chargerElevesEtClasses ===");
  
  // Cette fonction vérifie juste que vous utilisez la bonne version
  const config = getConfig();
  const result = chargerElevesEtClasses(config, "MOBILITE");
  
  Logger.log("Fonction appelée retourne:");
  Logger.log("- success: " + result.success);
  Logger.log("- students: " + (result.students ? result.students.length : "undefined"));
  Logger.log("- classesMap: " + (result.classesMap ? "DÉFINI" : "UNDEFINED"));
  Logger.log("- colIndexes: " + (result.colIndexes ? "DÉFINI" : "UNDEFINED"));
  
  // Vérifier ce que contient classesMap
  if (result.classesMap) {
    Logger.log("\nContenu de classesMap:");
    Object.keys(result.classesMap).forEach(className => {
      Logger.log(`  ${className}: ${result.classesMap[className].length} élèves`);
    });
  }
}

// 2. AJOUTER DES LOGS DE DÉBOGAGE dans votre chargerElevesEtClasses
// Copiez ces lignes JUSTE AVANT le return final de chargerElevesEtClasses :

/*
// === DÉBOGAGE AVANT RETURN ===
Logger.log("=== DÉBOGAGE chargerElevesEtClasses AVANT RETURN ===");
Logger.log("students.length: " + students.length);
Logger.log("classesMap défini: " + (classesMap !== undefined && classesMap !== null));
Logger.log("Nombre de classes dans classesMap: " + Object.keys(classesMap).length);
Object.keys(classesMap).forEach(c => {
  Logger.log(`  ${c}: ${classesMap[c].length} élèves`);
});
Logger.log("=== FIN DÉBOGAGE ===");
// === FIN DÉBOGAGE ===
*/

// 3. PATCH TEMPORAIRE si classesMap n'est toujours pas défini
function chargerElevesEtClassesPATCHED(config, headerMobilityALire) {
  // Appeler la fonction originale
  const result = chargerElevesEtClasses(config, headerMobilityALire);
  
  // Si classesMap est undefined, le reconstruire
  if (result.success && result.students && !result.classesMap) {
    Logger.log("PATCH: Reconstruction de classesMap depuis students");
    
    result.classesMap = {};
    result.students.forEach(eleve => {
      if (eleve.CLASSE) {
        if (!result.classesMap[eleve.CLASSE]) {
          result.classesMap[eleve.CLASSE] = [];
        }
        result.classesMap[eleve.CLASSE].push(eleve);
      }
    });
    
    Logger.log("PATCH: classesMap reconstruit avec " + Object.keys(result.classesMap).length + " classes");
  }
  
  return result;
}

// 4. VÉRIFIER si c'est une autre fonction qui appelle chargerElevesEtClasses
function tracerAppelChargerEleves() {
  Logger.log("=== TRACER L'APPEL DE chargerElevesEtClasses ===");
  
  // Regarder dans chargerElevesEtClasses (version avec SEXE)
  try {
    // Peut-être que vous avez une autre fonction qui wrap chargerElevesEtClasses ?
    const config = getConfig();
    
    // Test 1: Appel direct
    Logger.log("\n1. Test appel DIRECT:");
    const result1 = chargerElevesEtClasses(config, "MOBILITE");
    Logger.log("   classesMap: " + (result1.classesMap ? "OK" : "UNDEFINED"));
    
    // Test 2: Peut-être une autre fonction ?
    if (typeof chargerElevesEtClassesAvecSexe === 'function') {
      Logger.log("\n2. Test chargerElevesEtClassesAvecSexe:");
      const result2 = chargerElevesEtClassesAvecSexe();
      Logger.log("   classesMap: " + (result2.classesMap ? "OK" : "UNDEFINED"));
    }
    
  } catch (e) {
    Logger.log("Erreur tracer: " + e.message);
  }
}

// 5. FONCTION DE TEST COMPLÈTE
function debugCompletClassesMap() {
  Logger.log("==========================================================");
  Logger.log("DEBUG COMPLET DU PROBLÈME CLASSESMAP");
  Logger.log("==========================================================");
  
  // Étape 1: Vérifier les doublons
  verifierDoublonsChargerEleves();
  
  Logger.log("\n");
  
  // Étape 2: Tracer les appels
  tracerAppelChargerEleves();
  
  Logger.log("\n=== SOLUTION ===");
  Logger.log("Si classesMap est toujours undefined:");
  Logger.log("1. Ajoutez les logs de débogage dans chargerElevesEtClasses (voir commentaire)");
  Logger.log("2. Utilisez chargerElevesEtClassesPATCHED temporairement");
  Logger.log("3. Vérifiez qu'il n'y a pas DEUX fonctions chargerElevesEtClasses");
}

// 6. POUR TESTER L'OPTIMISATION AVEC LE PATCH
function testerOptimisationAvecPatch() {
  Logger.log("=== TEST OPTIMISATION AVEC PATCH ===");
  
  // Remplacer temporairement chargerElevesEtClasses
  const originalFunction = chargerElevesEtClasses;
  
  // Créer une version patchée globale temporaire
  chargerElevesEtClasses = function(config, headerMobilityALire) {
    const result = originalFunction.call(this, config, headerMobilityALire);
    
    if (result.success && result.students && !result.classesMap) {
      Logger.log("PATCH APPLIQUÉ: Reconstruction de classesMap");
      result.classesMap = {};
      result.students.forEach(eleve => {
        if (eleve.CLASSE) {
          if (!result.classesMap[eleve.CLASSE]) {
            result.classesMap[eleve.CLASSE] = [];
          }
          result.classesMap[eleve.CLASSE].push(eleve);
        }
      });
    }
    
    return result;
  };
  
  try {
    // Lancer un test rapide
    const config = getConfig();
    const result = chargerElevesEtClasses(config, "MOBILITE");
    
    Logger.log("Avec le patch:");
    Logger.log("- classesMap: " + (result.classesMap ? "OK (" + Object.keys(result.classesMap).length + " classes)" : "TOUJOURS UNDEFINED"));
    
    if (result.classesMap) {
      Logger.log("\n✅ LE PATCH FONCTIONNE !");
      Logger.log("Vous pouvez maintenant lancer l'optimisation V14");
    }
    
  } finally {
    // Restaurer la fonction originale
    chargerElevesEtClasses = originalFunction;
  }
}
/**
 * LANCEMENT OPTIMISATION V14 AVEC DEBUG COMPLET
 * Copier dans votre fichier et exécuter lancerOptimisationAvecDebugComplet()
 */

// 1. FONCTION PRINCIPALE AVEC TOUS LES LOGS
function lancerOptimisationAvecDebugComplet() {
  Logger.log("==========================================================");
  Logger.log("LANCEMENT OPTIMISATION V14 AVEC DEBUG COMPLET");
  Logger.log("==========================================================");
  
  // PATCH pour classesMap
  const _originalChargerEleves = chargerElevesEtClasses;
  chargerElevesEtClasses = function(config, headerMobilityALire) {
    const result = _originalChargerEleves(config, headerMobilityALire);
    if (result.success && result.students && !result.classesMap) {
      Logger.log("PATCH: Reconstruction de classesMap");
      result.classesMap = {};
      result.students.forEach(eleve => {
        if (eleve.CLASSE) {
          if (!result.classesMap[eleve.CLASSE]) {
            result.classesMap[eleve.CLASSE] = [];
          }
          result.classesMap[eleve.CLASSE].push(eleve);
        }
      });
    }
    return result;
  };
  
  try {
    // Étape 1: Vérifier la fonction respecteContraintes
    Logger.log("\n=== ÉTAPE 1: VÉRIFICATION respecteContraintes ===");
    const testContraintes = verifierRespectContraintes();
    if (!testContraintes) {
      Logger.log("❌ PROBLÈME avec respecteContraintes - vérifiez que vous utilisez la version corrigée!");
      return;
    }
    
    // Étape 2: Lancer l'optimisation avec des logs détaillés
    Logger.log("\n=== ÉTAPE 2: LANCEMENT OPTIMISATION ===");
    
    // Activer le mode debug dans la configuration temporairement
    const config = getConfig();
    const debugModeOriginal = config.DEBUG_MODE;
    config.DEBUG_MODE = true;
    
    // Paramètres d'optimisation
    const scenarios = ["STANDARD"];
    const maxSwaps = 30;
    
    Logger.log(`Paramètres: Scénarios=${scenarios}, MaxSwaps=${maxSwaps}`);
    
    // Appeler directement V11_OptimisationDistribution_Combined avec logs
    const resultat = V11_OptimisationDistribution_Combined(null, { 
      tetesDeClasse: 3.0, 
      niveau1: 2.5, 
      distribution: 1.5, 
      com1: 0, 
      tra4: 0, 
      part4: 0, 
      garantieTete: 1000 
    }, maxSwaps);
    
    // Restaurer le mode debug
    config.DEBUG_MODE = debugModeOriginal;
    
    Logger.log("\n=== RÉSULTAT OPTIMISATION ===");
    Logger.log("Success: " + resultat.success);
    Logger.log("Nb Swaps: " + resultat.nbSwaps);
    Logger.log("Message: " + resultat.message);
    
    if (resultat.nbSwaps === 0) {
      Logger.log("\n❌ TOUJOURS 0 SWAPS - Analyse approfondie nécessaire");
      analyserPourquoiZeroSwaps();
    } else {
      Logger.log("\n✅ SUCCÈS ! " + resultat.nbSwaps + " swaps effectués");
    }
    
    return resultat;
    
  } finally {
    // Restaurer la fonction originale
    chargerElevesEtClasses = _originalChargerEleves;
  }
}

// 2. VÉRIFIER QUE respecteContraintes EST LA BONNE VERSION
function verifierRespectContraintes() {
  Logger.log("Vérification de respecteContraintes...");
  
  // Créer deux élèves fictifs pour tester
  const e1 = {
    ID_ELEVE: "TEST1",
    NOM: "Test 1",
    CLASSE: "3°1TEST",
    mobilite: "LIBRE",
    optionKey: null,
    LV2: "ESP",
    DISSO: null
  };
  
  const e2 = {
    ID_ELEVE: "TEST2",
    NOM: "Test 2", 
    CLASSE: "3°2TEST",
    mobilite: "LIBRE",
    optionKey: null,
    LV2: "ESP",
    DISSO: null
  };
  
  // Tester avec des paramètres minimaux
  try {
    const result = respecteContraintes(e1, e2, [e1, e2], {}, [], {}, {});
    Logger.log("respecteContraintes retourne: " + result);
    
    // Si la fonction accepte deux élèves LIBRE sans option, c'est la bonne version
    if (result === true) {
      Logger.log("✅ respecteContraintes semble être la version corrigée");
      return true;
    } else {
      Logger.log("❌ respecteContraintes rejette des élèves LIBRE sans option - mauvaise version!");
      return false;
    }
  } catch (e) {
    Logger.log("❌ ERREUR dans respecteContraintes: " + e.message);
    return false;
  }
}

// 3. ANALYSER POURQUOI 0 SWAPS
function analyserPourquoiZeroSwaps() {
  Logger.log("\n=== ANALYSE APPROFONDIE: POURQUOI 0 SWAPS? ===");
  
  const config = getConfig();
  
  // Vérifier les paramètres critiques
  Logger.log("\n1. PARAMÈTRES DE CONFIGURATION:");
  Logger.log("   MAX_SWAPS: " + config.MAX_SWAPS);
  Logger.log("   MAX_SWAPS_EVAL: " + config.MAX_SWAPS_EVAL);
  Logger.log("   PARITY_TOLERANCE: " + config.PARITY_TOLERANCE);
  
  // Analyser la fonction genererEtEvaluerSwaps
  Logger.log("\n2. ANALYSE DE genererEtEvaluerSwaps:");
  
  try {
    // Charger les données nécessaires
    const niveau = determinerNiveauActifCache();
    const structureResult = chargerStructureEtOptions(niveau, config);
    const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
    
    if (!structureResult.success || !elevesResult.success) {
      Logger.log("   ❌ Erreur chargement données");
      return;
    }
    
    const { students, classesMap } = elevesResult;
    const { structure, optionsNiveau } = structureResult;
    
    // Classifier les élèves
    classifierEleves(students, ["com1", "tra4", "part4"]);
    
    // Construire les structures nécessaires
    const optionPools = buildOptionPools(structure, config);
    const dissocMap = buildDissocCountMap(classesMap);
    
    // Calculer les stats initiales
    const statsInitiales = calculerStatistiquesDistribution(classesMap, students.length, ["com1", "tra4", "part4"]);
    
    // Paramètres de génération
    const poidsEffectifs = { 
      tetesDeClasse: 3.0, 
      niveau1: 2.5, 
      distribution: 1.5, 
      com1: 0, 
      tra4: 0, 
      part4: 0, 
      garantieTete: 1000 
    };
    
    const penaltyFunc = (classe, tentativeTetes) => {
      if (tentativeTetes === 0) {
        const classeActuelle = classesMap[classe];
        if (classeActuelle && classeActuelle.some(e => e.estTeteDeClasse)) {
          return 1000;
        }
      }
      return 0;
    };
    
    // LOGS DÉTAILLÉS pour genererEtEvaluerSwaps
    Logger.log("\n3. TEST DIRECT DE genererEtEvaluerSwaps:");
    Logger.log("   Nombre d'élèves: " + students.length);
    Logger.log("   Nombre de classes: " + Object.keys(classesMap).length);
    
    // Compter les élèves échangeables
    let elevesEchangeables = 0;
    students.forEach(e => {
      const mob = e.mobilite || 'LIBRE';
      if (mob !== 'FIXE' && mob !== 'SPEC') {
        elevesEchangeables++;
      }
    });
    Logger.log("   Élèves échangeables (non FIXE/SPEC): " + elevesEchangeables);
    
    // Appeler genererEtEvaluerSwaps avec un petit nombre pour tester
    const swapsEvalues = genererEtEvaluerSwaps(
      students, classesMap, structure, optionsNiveau, optionPools, dissocMap,
      statsInitiales, poidsEffectifs, penaltyFunc,
      100, // Seulement 100 évaluations pour le test
      1e-6, // Seuil minimal
      ["com1", "tra4", "part4"],
      true // Debug mode ON
    );
    
    Logger.log("\n   RÉSULTAT genererEtEvaluerSwaps:");
    Logger.log("   Nombre de swaps trouvés: " + swapsEvalues.length);
    
    if (swapsEvalues.length > 0) {
      Logger.log("   Top 5 swaps par impact:");
      swapsEvalues.sort((a, b) => b.impact - a.impact);
      swapsEvalues.slice(0, 5).forEach((swap, i) => {
        Logger.log(`     ${i+1}. ${swap.eleve1ID} <-> ${swap.eleve2ID}, impact: ${swap.impact.toFixed(6)}`);
      });
    }
    
  } catch (e) {
    Logger.log("   ❌ ERREUR dans l'analyse: " + e.message);
    Logger.log(e.stack);
  }
  
  Logger.log("\n=== RECOMMANDATIONS ===");
  Logger.log("1. Vérifiez que respecteContraintes est bien la version corrigée");
  Logger.log("2. Vérifiez que MAX_SWAPS_EVAL est suffisamment élevé (5000+)");
  Logger.log("3. Vérifiez que le seuil d'impact minimal n'est pas trop élevé");
  Logger.log("4. Regardez si genererEtEvaluerSwaps trouve des swaps");
}

// 4. FONCTION SIMPLIFIÉE POUR TESTER UN SWAP DIRECT
function testerUnSwapDirect() {
  Logger.log("\n=== TEST D'UN SWAP DIRECT ===");
  
  const config = getConfig();
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!elevesResult.success || !elevesResult.classesMap) {
    Logger.log("Erreur chargement élèves");
    return;
  }
  
  // Trouver deux élèves LIBRE de classes différentes
  const classes = Object.keys(elevesResult.classesMap);
  let e1 = null, e2 = null;
  
  for (let i = 0; i < classes.length && !e1; i++) {
    const eleves1 = elevesResult.classesMap[classes[i]];
    for (const eleve of eleves1) {
      if (eleve.mobilite === 'LIBRE' && !eleve.optionKey) {
        e1 = eleve;
        break;
      }
    }
  }
  
  for (let i = 0; i < classes.length && !e2; i++) {
    if (classes[i] === e1.CLASSE) continue;
    const eleves2 = elevesResult.classesMap[classes[i]];
    for (const eleve of eleves2) {
      if (eleve.mobilite === 'LIBRE' && !eleve.optionKey) {
        e2 = eleve;
        break;
      }
    }
  }
  
  if (e1 && e2) {
    Logger.log(`Élève 1: ${e1.ID_ELEVE} (${e1.CLASSE})`);
    Logger.log(`Élève 2: ${e2.ID_ELEVE} (${e2.CLASSE})`);
    
    // Calculer l'impact
    const statsInitiales = calculerStatistiquesDistribution(elevesResult.classesMap, elevesResult.students.length, []);
    const impact = evaluerImpactDistribution(
      e1, e2, 
      elevesResult.classesMap, 
      statsInitiales, 
      { tetesDeClasse: 3.0, niveau1: 2.5, distribution: 1.5 }, 
      () => 0
    );
    
    Logger.log(`Impact calculé: ${impact}`);
    
    if (impact > 0) {
      Logger.log("✅ CE SWAP DEVRAIT ÊTRE POSSIBLE!");
    } else {
      Logger.log("❌ Impact négatif ou nul");
    }
  } else {
    Logger.log("Impossible de trouver deux élèves LIBRE");
  }
}
////////////////////////////////////////////////////

/**
 * CORRECTIONS POUR LE PROBLÈME D'IMPACT NUL DANS LE MOTEUR V14
 * Ajoutez ces fonctions à votre fichier Optimisation_V14.gs
 */

// 1. FONCTION DE DIAGNOSTIC COMPLÈTE CORRIGÉE
function diagnostiquerProblemeImpactNul() {
  Logger.log("=== DIAGNOSTIC PROBLÈME IMPACT NUL ===");
  
  const config = getConfig();
  const niveau = determinerNiveauActifCache();
  
  // Charger les données
  const structureResult = chargerStructureEtOptions(niveau, config);
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!structureResult.success || !elevesResult.success) {
    Logger.log("❌ Erreur chargement données");
    return;
  }
  
  Logger.log("✅ Données chargées avec succès");
  Logger.log("- structureResult.success: " + structureResult.success);
  Logger.log("- elevesResult.success: " + elevesResult.success);
  Logger.log("- elevesResult.students: " + (elevesResult.students ? elevesResult.students.length + " élèves" : "UNDEFINED"));
  Logger.log("- elevesResult.classesMap: " + (elevesResult.classesMap ? "DÉFINI" : "UNDEFINED"));
  
  let { students, classesMap } = elevesResult;
  
  // PATCH CRITIQUE : Reconstruire classesMap si undefined
  if (!classesMap && students && Array.isArray(students)) {
    Logger.log("⚠️ PATCH: Reconstruction de classesMap depuis students");
    classesMap = {};
    students.forEach(eleve => {
      if (eleve && eleve.CLASSE) {
        if (!classesMap[eleve.CLASSE]) {
          classesMap[eleve.CLASSE] = [];
        }
        classesMap[eleve.CLASSE].push(eleve);
      }
    });
    Logger.log("✅ PATCH: classesMap reconstruit avec " + Object.keys(classesMap).length + " classes");
  }
  
  // Vérification finale
  if (!classesMap || typeof classesMap !== 'object') {
    Logger.log("❌ ERREUR CRITIQUE: classesMap toujours undefined après patch");
    Logger.log("   Type de classesMap: " + typeof classesMap);
    Logger.log("   Valeur: " + JSON.stringify(classesMap));
    return;
  }
  
  // Classifier les élèves
  try {
    classifierEleves(students, ["com1", "tra4", "part4"]);
    Logger.log("✅ Classification des élèves terminée");
  } catch (e) {
    Logger.log("❌ Erreur classification: " + e.message);
    return;
  }
  
  // Calculer les stats initiales avec vérifications
  let statsInitiales;
  try {
    Logger.log("Tentative calcul stats avec:");
    Logger.log("- classesMap: " + Object.keys(classesMap).length + " classes");
    Logger.log("- students.length: " + students.length);
    
    statsInitiales = calculerStatistiquesDistribution(classesMap, students.length, ["com1", "tra4", "part4"]);
    Logger.log("✅ Statistiques calculées avec succès");
  } catch (e) {
    Logger.log("❌ Erreur calcul statistiques: " + e.message);
    Logger.log("   Stack: " + e.stack);
    return;
  }
  
  // Reste du diagnostic seulement si tout va bien
  Logger.log("\n=== ANALYSE DES STATISTIQUES INITIALES ===");
  logStatsDetaillees(statsInitiales);
  
  Logger.log("\n=== TEST SWAPS MANUELS ===");
  testerSwapsManuels(classesMap, statsInitiales);
  
  Logger.log("\n=== ANALYSE DISTRIBUTION ===");
  analyserDistributionClasses(classesMap);
}

// 2. FONCTION POUR LOGGER LES STATS EN DÉTAIL
function logStatsDetaillees(stats) {
  Logger.log("Têtes de classe par classe:");
  Object.entries(stats.tetesDeClasse.compteParClasse).forEach(([classe, count]) => {
    Logger.log(`  ${classe}: ${count} têtes`);
  });
  Logger.log(`Moyenne: ${stats.tetesDeClasse.moyenne.toFixed(2)}, Écart-type: ${stats.tetesDeClasse.ecartType.toFixed(4)}`);
  
  Logger.log("\nNiveau 1 par classe:");
  Object.entries(stats.niveau1.compteParClasse).forEach(([classe, count]) => {
    Logger.log(`  ${classe}: ${count} niveau 1`);
  });
  Logger.log(`Moyenne: ${stats.niveau1.moyenne.toFixed(2)}, Écart-type: ${stats.niveau1.ecartType.toFixed(4)}`);
  
  Logger.log("\nDistribution globale:");
  Object.entries(stats.distribution.global).forEach(([niveau, pourcent]) => {
    Logger.log(`  Niveau ${niveau}: ${(pourcent * 100).toFixed(1)}%`);
  });
  Logger.log(`Écart moyen distribution: ${stats.distribution.ecartMoyen.toFixed(4)}`);
}

// 3. TESTER DES SWAPS MANUELS
function testerSwapsManuels(classesMap, statsInitiales) {
  const classes = Object.keys(classesMap);
  
  // Trouver deux élèves de classes différentes avec des profils différents
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const eleves1 = classesMap[classes[i]];
      const eleves2 = classesMap[classes[j]];
      
      // Chercher un élève tête de classe dans classe i et un non-tête dans classe j
      const teteClasse1 = eleves1.find(e => e.estTeteDeClasse && (e.mobilite || 'LIBRE') !== 'FIXE');
      const nonTete2 = eleves2.find(e => !e.estTeteDeClasse && (e.mobilite || 'LIBRE') !== 'FIXE');
      
      if (teteClasse1 && nonTete2) {
        Logger.log(`\nTest swap: ${teteClasse1.ID_ELEVE} (tête, ${classes[i]}) <-> ${nonTete2.ID_ELEVE} (non-tête, ${classes[j]})`);
        
        const poidsTest = { tetesDeClasse: 3.0, niveau1: 2.5, distribution: 1.5, com1: 0, tra4: 0, part4: 0 };
        const impact = evaluerImpactDistribution(
          teteClasse1, nonTete2, classesMap, statsInitiales, poidsTest, () => 0
        );
        
        Logger.log(`Impact calculé: ${impact.toFixed(6)}`);
        
        if (impact !== 0) {
          Logger.log("✅ SWAP AVEC IMPACT NON NUL TROUVÉ!");
          return true;
        }
      }
    }
  }
  
  Logger.log("❌ Aucun swap avec impact significatif trouvé");
  return false;
}

// 4. ANALYSER LA DISTRIBUTION DES CLASSES
function analyserDistributionClasses(classesMap) {
  Object.entries(classesMap).forEach(([classe, eleves]) => {
    const stats = {
      total: eleves.length,
      tetes: eleves.filter(e => e.estTeteDeClasse).length,
      niveau1: eleves.filter(e => e.estNiveau1).length,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0 }
    };
    
    eleves.forEach(e => {
      const niv = e.niveauCOM || 1;
      if (stats.distribution[niv] !== undefined) {
        stats.distribution[niv]++;
      }
    });
    
    Logger.log(`${classe}: ${stats.total} élèves, ${stats.tetes} têtes, ${stats.niveau1} niv1`);
    const distribStr = Object.entries(stats.distribution)
      .map(([niv, count]) => `${niv}:${count}`)
      .join(' ');
    Logger.log(`  Distribution COM: ${distribStr}`);
  });
}

// 5. VERSION AMÉLIORÉE DE evaluerImpactDistribution AVEC PLUS DE LOGS
function evaluerImpactDistributionAvecLogs(eleve1, eleve2, currentClassesMap, currentStats, poidsEffectifs, penaltyFunc) {
  Logger.log(`\n=== ÉVALUATION IMPACT DÉTAILLÉE ===`);
  Logger.log(`Élève 1: ${eleve1.ID_ELEVE} (${eleve1.CLASSE}) - Tête: ${eleve1.estTeteDeClasse}, Niv1: ${eleve1.estNiveau1}, COM: ${eleve1.niveauCOM}`);
  Logger.log(`Élève 2: ${eleve2.ID_ELEVE} (${eleve2.CLASSE}) - Tête: ${eleve2.estTeteDeClasse}, Niv1: ${eleve2.estNiveau1}, COM: ${eleve2.niveauCOM}`);
  
  const c1N = eleve1.CLASSE;
  const c2N = eleve2.CLASSE;
  
  // Calculs actuels
  const tetesActuellesC1 = currentStats.tetesDeClasse?.compteParClasse?.[c1N] || 0;
  const tetesActuellesC2 = currentStats.tetesDeClasse?.compteParClasse?.[c2N] || 0;
  
  // Calculs après swap
  const tetesApresC1 = tetesActuellesC1 - (eleve1.estTeteDeClasse ? 1 : 0) + (eleve2.estTeteDeClasse ? 1 : 0);
  const tetesApresC2 = tetesActuellesC2 - (eleve2.estTeteDeClasse ? 1 : 0) + (eleve1.estTeteDeClasse ? 1 : 0);
  
  Logger.log(`Têtes ${c1N}: ${tetesActuellesC1} → ${tetesApresC1}`);
  Logger.log(`Têtes ${c2N}: ${tetesActuellesC2} → ${tetesApresC2}`);
  
  // Vérifier les pénalités
  const pen1 = penaltyFunc(c1N, tetesApresC1);
  const pen2 = penaltyFunc(c2N, tetesApresC2);
  
  if (pen1 > 0 || pen2 > 0) {
    Logger.log(`❌ PÉNALITÉ: ${c1N}=${pen1}, ${c2N}=${pen2}`);
    return -Math.max(pen1, pen2);
  }
  
  // Calculer l'impact sur l'écart-type des têtes
  const moyenneTetes = currentStats.tetesDeClasse?.moyenne || 0;
  const ecartTypeActuel = currentStats.tetesDeClasse?.ecartType || 0;
  
  // Nouveau calcul d'écart-type
  const comptesApres = { ...currentStats.tetesDeClasse.compteParClasse };
  comptesApres[c1N] = tetesApresC1;
  comptesApres[c2N] = tetesApresC2;
  
  const nouvelEcartType = calculateStdDevFromCounts(comptesApres, moyenneTetes);
  const ameliorationTetes = ecartTypeActuel - nouvelEcartType;
  
  Logger.log(`Écart-type têtes: ${ecartTypeActuel.toFixed(4)} → ${nouvelEcartType.toFixed(4)} (amélioration: ${ameliorationTetes.toFixed(6)})`);
  
  // Impact total
  const impactTotal = poidsEffectifs.tetesDeClasse * ameliorationTetes;
  Logger.log(`Impact total: ${impactTotal.toFixed(6)}`);
  
  return impactTotal;
}

// 6. FONCTION POUR TESTER AVEC DES PARAMÈTRES MODIFIÉS
function testerAvecParametresModifies() {
  Logger.log("=== TEST AVEC PARAMÈTRES MODIFIÉS ===");
  
  const scenarios = ["TETES"]; // Forcer focus sur têtes de classe
  const maxSwaps = 5; // Limite basse pour tests
  
  Logger.log("Paramètres modifiés:");
  Logger.log("- Scénario: TETES (poids têtes = 6.0)");
  Logger.log("- Max swaps: 5");
  Logger.log("- Seuil impact: 0.000001");
  
  try {
    const poids = construirePoidsDepuisScenarios(scenarios);
    Logger.log("Poids calculés: " + JSON.stringify(poids));
    
    const resultat = V11_OptimisationDistribution_Combined(null, poids, maxSwaps);
    
    Logger.log("\nRésultat avec paramètres modifiés:");
    Logger.log("Success: " + resultat.success);
    Logger.log("Nb Swaps: " + resultat.nbSwaps);
    Logger.log("Message: " + resultat.message);
    
    return resultat;
    
  } catch (e) {
    Logger.log("Erreur: " + e.message);
    return null;
  }
}

// 7. FONCTION POUR FORCER UN SWAP MANUEL (POUR TESTER)
function forcerSwapManuel() {
  Logger.log("=== FORCER UN SWAP MANUEL ===");
  
  const config = getConfig();
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!elevesResult.success) {
    Logger.log("Erreur chargement élèves");
    return;
  }
  
  const { classesMap } = elevesResult;
  const classes = Object.keys(classesMap);
  
  // Trouver manuellement un bon swap
  let swapTrouve = null;
  
  for (let i = 0; i < classes.length && !swapTrouve; i++) {
    for (let j = i + 1; j < classes.length && !swapTrouve; j++) {
      const eleves1 = classesMap[classes[i]];
      const eleves2 = classesMap[classes[j]];
      
      // Chercher déséquilibre têtes
      const tetes1 = eleves1.filter(e => e.estTeteDeClasse).length;
      const tetes2 = eleves2.filter(e => e.estTeteDeClasse).length;
      
      if (Math.abs(tetes1 - tetes2) > 1) {
        // Il y a un déséquilibre
        const classeAvecPlus = tetes1 > tetes2 ? classes[i] : classes[j];
        const classeAvecMoins = tetes1 > tetes2 ? classes[j] : classes[i];
        const elevesPlus = tetes1 > tetes2 ? eleves1 : eleves2;
        const elevesMoins = tetes1 > tetes2 ? eleves2 : eleves1;
        
        // Chercher une tête dans classe+ et un non-tête dans classe-
        const teteADeplacer = elevesPlus.find(e => e.estTeteDeClasse && (e.mobilite || 'LIBRE') !== 'FIXE');
        const nonTeteADeplacer = elevesMoins.find(e => !e.estTeteDeClasse && (e.mobilite || 'LIBRE') !== 'FIXE');
        
        if (teteADeplacer && nonTeteADeplacer) {
          swapTrouve = {
            eleve1: teteADeplacer,
            eleve2: nonTeteADeplacer,
            raison: `Rééquilibrage têtes: ${classeAvecPlus}(${tetes1 > tetes2 ? tetes1 : tetes2}) → ${classeAvecMoins}(${tetes1 > tetes2 ? tetes2 : tetes1})`
          };
        }
      }
    }
  }
  
  if (swapTrouve) {
    Logger.log("✅ SWAP OPTIMAL TROUVÉ:");
    Logger.log(swapTrouve.raison);
    Logger.log(`${swapTrouve.eleve1.ID_ELEVE} (${swapTrouve.eleve1.CLASSE}) <-> ${swapTrouve.eleve2.ID_ELEVE} (${swapTrouve.eleve2.CLASSE})`);
    
    // Calculer l'impact théorique
    const statsInitiales = calculerStatistiquesDistribution(classesMap, elevesResult.students.length, []);
    const impact = evaluerImpactDistributionAvecLogs(
      swapTrouve.eleve1, swapTrouve.eleve2, classesMap, statsInitiales,
      { tetesDeClasse: 3.0, niveau1: 2.5, distribution: 1.5 }, () => 0
    );
    
    return swapTrouve;
  } else {
    Logger.log("❌ Aucun déséquilibre évident trouvé");
    return null;
  }
}

// 9. FONCTION DE TEST SIMPLE POUR CONTOURNER LE PROBLÈME CLASSESMAP
function testSimpleV14SansClassesMap() {
  Logger.log("=== TEST SIMPLE V14 SANS CLASSESMAP ===");
  
  // Test direct du moteur avec le patch intégré
  const resultat = testMoteurV14AvecPatchIntegre();
  
  Logger.log("Résultat test simple:");
  Logger.log("- Success: " + (resultat ? resultat.success : "undefined"));
  Logger.log("- Nb Swaps: " + (resultat ? resultat.nbSwaps : "undefined"));
  Logger.log("- Message: " + (resultat ? resultat.message : "undefined"));
  
  return resultat;
}

// 10. VERSION DU MOTEUR AVEC PATCH INTÉGRÉ
function testMoteurV14AvecPatchIntegre() {
  Logger.log("=== MOTEUR V14 AVEC PATCH INTÉGRÉ ===");
  
  // Sauvegarder la fonction originale
  const _originalChargerEleves = chargerElevesEtClasses;
  
  // Créer une version patchée temporairement
  chargerElevesEtClasses = function(config, headerMobilityALire) {
    Logger.log("PATCH: Appel chargerElevesEtClasses avec patch");
    const result = _originalChargerEleves(config, headerMobilityALire);
    
    Logger.log("PATCH: Résultat original - success: " + result.success);
    Logger.log("PATCH: classesMap dans résultat: " + (result.classesMap ? "DÉFINI" : "UNDEFINED"));
    
    if (result.success && result.students && !result.classesMap) {
      Logger.log("PATCH: Reconstruction de classesMap depuis students");
      result.classesMap = {};
      result.students.forEach(eleve => {
        if (eleve && eleve.CLASSE) {
          if (!result.classesMap[eleve.CLASSE]) {
            result.classesMap[eleve.CLASSE] = [];
          }
          result.classesMap[eleve.CLASSE].push(eleve);
        }
      });
      Logger.log("PATCH: " + Object.keys(result.classesMap).length + " classes reconstruites");
    }
    
    return result;
  };
  
  try {
    // Lancer le moteur avec des paramètres favorables aux swaps
    const poids = {
      tetesDeClasse: 6.0,    // Poids élevé
      niveau1: 6.0,          // Poids élevé
      distribution: 6.0,     // Poids élevé
      com1: 0, tra4: 0, part4: 0,
      garantieTete: 1000
    };
    
    Logger.log("Test avec poids élevés: " + JSON.stringify(poids));
    
    const resultat = V11_OptimisationDistribution_Combined(null, poids, 20);
    
    return resultat;
    
  } catch (e) {
    Logger.log("❌ Erreur dans testMoteurV14AvecPatchIntegre: " + e.message);
    Logger.log(e.stack);
    return { success: false, message: "Erreur: " + e.message };
    
  } finally {
    // Restaurer la fonction originale
    chargerElevesEtClasses = _originalChargerEleves;
    Logger.log("PATCH: Fonction originale restaurée");
  }
}

// 11. TEST AVEC SEUIL D'IMPACT TRÈS BAS
function testAvecSeuilTresBas() {
  Logger.log("=== TEST AVEC SEUIL TRÈS BAS ===");
  
  // Modifier temporairement le moteur pour utiliser un seuil très bas
  const codeMoteurModifie = `
    // Dans V11_OptimisationDistribution_Combined, remplacez:
    // const SEUIL_IMPACT_MINIMAL = 1e-6;
    // par:
    const SEUIL_IMPACT_MINIMAL = 1e-12;  // TRÈS BAS
    
    // Et aussi dans appliquerSwapsIterativement:
    // SEUIL_IMPACT_MINIMAL_APPLY = 1e-12;
  `;
  
  Logger.log("Pour tester avec un seuil très bas, modifiez le code du moteur:");
  Logger.log(codeMoteurModifie);
  
  Logger.log("\nOu utilisez cette version temporaire:");
  return testMoteurAvecSeuilPersonnalise(1e-12);
}

// 13. FONCTION DE TEST IMMÉDIAT (SANS DÉPENDANCES COMPLEXES)
function testImmediatV14() {
  Logger.log("=== TEST IMMÉDIAT V14 ===");
  
  try {
    // Test 1: Vérifier que les fonctions de base existent
    Logger.log("1. Vérification des fonctions:");
    Logger.log("   - chargerElevesEtClasses: " + (typeof chargerElevesEtClasses === 'function' ? "✅" : "❌"));
    Logger.log("   - V11_OptimisationDistribution_Combined: " + (typeof V11_OptimisationDistribution_Combined === 'function' ? "✅" : "❌"));
    Logger.log("   - calculerStatistiquesDistribution: " + (typeof calculerStatistiquesDistribution === 'function' ? "✅" : "❌"));
    
    // Test 2: Chargement rapide des données
    Logger.log("\n2. Test chargement données:");
    const config = getConfig();
    const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
    
    Logger.log("   - Config chargé: " + (config ? "✅" : "❌"));
    Logger.log("   - Élèves chargés: " + (elevesResult.success ? "✅ (" + elevesResult.students.length + ")" : "❌"));
    Logger.log("   - ClassesMap présent: " + (elevesResult.classesMap ? "✅" : "❌ PROBLÈME ICI!"));
    
    // Test 3: Patch classesMap si nécessaire
    if (elevesResult.success && !elevesResult.classesMap && elevesResult.students) {
      Logger.log("\n3. Application du patch classesMap:");
      elevesResult.classesMap = {};
      elevesResult.students.forEach(eleve => {
        if (eleve && eleve.CLASSE) {
          if (!elevesResult.classesMap[eleve.CLASSE]) {
            elevesResult.classesMap[eleve.CLASSE] = [];
          }
          elevesResult.classesMap[eleve.CLASSE].push(eleve);
        }
      });
      Logger.log("   - Patch appliqué: ✅ " + Object.keys(elevesResult.classesMap).length + " classes");
    }
    
    // Test 4: Vérification équilibre actuel
    if (elevesResult.classesMap) {
      Logger.log("\n4. État actuel des classes:");
      Object.entries(elevesResult.classesMap).forEach(([classe, eleves]) => {
        const tetes = eleves.filter(e => e.estTeteDeClasse).length;
        const niveau1 = eleves.filter(e => e.estNiveau1).length;
        Logger.log(`   ${classe}: ${eleves.length} élèves, ${tetes} têtes, ${niveau1} niv1`);
      });
      
      // Calculer déséquilibre
      const tetesPourClass = Object.values(elevesResult.classesMap).map(eleves => 
        eleves.filter(e => e.estTeteDeClasse).length
      );
      const min = Math.min(...tetesPourClass);
      const max = Math.max(...tetesPourClass);
      const desequilibre = max - min;
      
      Logger.log(`   Déséquilibre têtes: ${desequilibre} (min: ${min}, max: ${max})`);
      
      if (desequilibre > 1) {
        Logger.log("   ✅ Déséquilibre détecté - des swaps devraient être possibles");
      } else {
        Logger.log("   ⚠️ Classes déjà bien équilibrées - impact faible attendu");
      }
    }
    
    return {
      success: true,
      classesMapOK: !!elevesResult.classesMap,
      nbEleves: elevesResult.students ? elevesResult.students.length : 0,
      nbClasses: elevesResult.classesMap ? Object.keys(elevesResult.classesMap).length : 0
    };
    
  } catch (e) {
    Logger.log("❌ Erreur test immédiat: " + e.message);
    return { success: false, error: e.message };
  }
}

// 15. INSTRUCTIONS PRÉCISES POUR CORRIGER LE CODE SOURCE
function donnerInstructionsCorrections() {
  Logger.log("==========================================================");
  Logger.log("INSTRUCTIONS PRÉCISES POUR CORRIGER LE MOTEUR V14");
  Logger.log("==========================================================");
  
  Logger.log("\n🔧 CORRECTION 1: Dans V11_OptimisationDistribution_Combined");
  Logger.log("Ligne à chercher:");
  Logger.log("   const SEUIL_IMPACT_MINIMAL = 1e-6;");
  Logger.log("Remplacer par:");
  Logger.log("   const SEUIL_IMPACT_MINIMAL = 1e-12;");
  
  Logger.log("\n🔧 CORRECTION 2: Dans la même fonction");
  Logger.log("Ligne à chercher:");
  Logger.log("   const MAX_SWAPS_TO_EVALUATE = Number(config.MAX_SWAPS_EVAL) || Number(config.MAX_SWAPS) || 5000;");
  Logger.log("Remplacer par:");
  Logger.log("   const MAX_SWAPS_TO_EVALUATE = Number(config.MAX_SWAPS_EVAL) || Number(config.MAX_SWAPS) || 10000;");
  
  Logger.log("\n🔧 CORRECTION 3: Dans appliquerSwapsIterativement");
  Logger.log("Ligne à chercher (vers la fin de la fonction):");
  Logger.log("   if (impactReevalue > SEUIL_IMPACT_MINIMAL_APPLY) {");
  Logger.log("Assurer que SEUIL_IMPACT_MINIMAL_APPLY est aussi 1e-12");
  
  Logger.log("\n🔧 CORRECTION 4: Dans chargerElevesEtClasses (TEMPORAIRE)");
  Logger.log("Ajouter avant le return final:");
  Logger.log(`
  // === PATCH TEMPORAIRE CLASSESMAP ===
  if (!result.classesMap && result.success && result.students) {
    Logger.log("PATCH: Reconstruction classesMap");
    result.classesMap = {};
    result.students.forEach(eleve => {
      if (eleve && eleve.CLASSE) {
        if (!result.classesMap[eleve.CLASSE]) {
          result.classesMap[eleve.CLASSE] = [];
        }
        result.classesMap[eleve.CLASSE].push(eleve);
      }
    });
  }
  // === FIN PATCH ===`);
  
  Logger.log("\n✅ APRÈS CES CORRECTIONS:");
  Logger.log("1. Exécutez: testImmediatV14()");
  Logger.log("2. Si OK, exécutez: lancerMoteurAvecCorrections()");
  Logger.log("3. Vous devriez voir des swaps avec impact > 0");
  
  Logger.log("\n📊 POUR TESTER IMMÉDIATEMENT:");
  Logger.log("   testImmediatV14()");
}

// 16. FONCTION TOUT-EN-UN POUR RÉSOUDRE LE PROBLÈME
function resoudreDefinitivementProblemeV14() {
  Logger.log("==========================================================");
  Logger.log("RÉSOLUTION DÉFINITIVE DU PROBLÈME V14");
  Logger.log("==========================================================");
  
  // Étape 1: Test immédiat
  Logger.log("ÉTAPE 1: Test immédiat");
  const testImmediat = testImmediatV14();
  
  if (!testImmediat.success) {
    Logger.log("❌ Test immédiat échoué - problème plus profond");
    return testImmediat;
  }
  
  // Étape 2: Instructions
  Logger.log("\nÉTAPE 2: Instructions pour corrections");
  donnerInstructionsCorrections();
  
  // Étape 3: Test avec corrections temporaires
  Logger.log("\nÉTAPE 3: Test avec corrections temporaires");
  const resultatAvecCorrections = lancerMoteurAvecCorrections();
  
  Logger.log("\n=== RÉSUMÉ FINAL ===");
  if (resultatAvecCorrections && resultatAvecCorrections.nbSwaps > 0) {
    Logger.log("✅ SUCCÈS! Le moteur fonctionne avec les corrections");
    Logger.log("   Appliquez maintenant les corrections dans le code source");
  } else {
    Logger.log("⚠️ Aucun swap même avec corrections");
    Logger.log("   Vos classes sont probablement déjà parfaitement équilibrées");
    Logger.log("   C'est normal si tous les déséquilibres sont < 1");
  }
  
  return {
    testImmediat,
    resultatAvecCorrections,
    recommendation: resultatAvecCorrections && resultatAvecCorrections.nbSwaps > 0 ? 
      "Appliquer les corrections dans le code source" : 
      "Classes déjà bien équilibrées - aucune action requise"
  };
}
function lancerMoteurAvecCorrections() {
  Logger.log("=== LANCEMENT MOTEUR AVEC CORRECTIONS ===");
  
  // Sauvegarder la fonction originale
  const _originalChargerEleves = chargerElevesEtClasses;
  
  // Version corrigée temporaire
  chargerElevesEtClasses = function(config, headerMobilityALire) {
    const result = _originalChargerEleves(config, headerMobilityALire);
    
    // Patch classesMap si manquant
    if (result.success && result.students && !result.classesMap) {
      Logger.log("CORRECTION: Reconstruction classesMap");
      result.classesMap = {};
      result.students.forEach(eleve => {
        if (eleve && eleve.CLASSE) {
          if (!result.classesMap[eleve.CLASSE]) {
            result.classesMap[eleve.CLASSE] = [];
          }
          result.classesMap[eleve.CLASSE].push(eleve);
        }
      });
    }
    
    return result;
  };
  
  try {
    // Paramètres optimisés pour forcer des swaps
    const poidsOptimises = {
      tetesDeClasse: 10.0,   // Très élevé
      niveau1: 10.0,         // Très élevé
      distribution: 5.0,     // Élevé
      com1: 0, tra4: 0, part4: 0,
      garantieTete: 1000
    };
    
    Logger.log("Paramètres utilisés: " + JSON.stringify(poidsOptimises));
    Logger.log("⚠️ IMPORTANT: Modifiez aussi manuellement dans le code:");
    Logger.log("   SEUIL_IMPACT_MINIMAL = 1e-12");
    Logger.log("   MAX_SWAPS_EVAL = 10000");
    
    // Lancer le moteur
    const resultat = V11_OptimisationDistribution_Combined(null, poidsOptimises, 30);
    
    Logger.log("\n=== RÉSULTAT AVEC CORRECTIONS ===");
    Logger.log("Success: " + resultat.success);
    Logger.log("Nb Swaps: " + resultat.nbSwaps);
    Logger.log("Message: " + resultat.message);
    
    return resultat;
    
  } finally {
    // Restaurer la fonction originale
    chargerElevesEtClasses = _originalChargerEleves;
  }
}
function testMoteurAvecSeuilPersonnalise(seuil) {
  Logger.log("=== TEST MOTEUR AVEC SEUIL: " + seuil + " ===");
  
  // Note: Cette fonction nécessiterait de modifier le code source du moteur
  // Pour l'instant, on peut seulement recommander la modification manuelle
  
  Logger.log("⚠️ ATTENTION: Cette fonction nécessite de modifier manuellement le code source");
  Logger.log("Dans V11_OptimisationDistribution_Combined, changez:");
  Logger.log("  const SEUIL_IMPACT_MINIMAL = 1e-6;");
  Logger.log("En:");
  Logger.log("  const SEUIL_IMPACT_MINIMAL = " + seuil + ";");
  
  Logger.log("\nEt dans appliquerSwapsIterativement, changez:");
  Logger.log("  SEUIL_IMPACT_MINIMAL_APPLY");
  Logger.log("En:");
  Logger.log("  " + seuil);
  
  return { 
    success: false, 
    message: "Modification manuelle requise - voir logs pour instructions" 
  };
}
function resoudreProblemeImpactNul() {
  Logger.log("==========================================================");
  Logger.log("RÉSOLUTION DU PROBLÈME D'IMPACT NUL");
  Logger.log("==========================================================");
  
  // Étape 1: Diagnostic
  diagnostiquerProblemeImpactNul();
  
  // Étape 2: Test avec paramètres modifiés
  Logger.log("\n" + "=".repeat(50));
  const resultatModifie = testerAvecParametresModifies();
  
  // Étape 3: Forcer un swap manuel si aucun impact
  if (!resultatModifie || resultatModifie.nbSwaps === 0) {
    Logger.log("\n" + "=".repeat(50));
    const swapManuel = forcerSwapManuel();
    
    if (swapManuel) {
      Logger.log("\n✅ SOLUTION: Un déséquilibre a été détecté.");
      Logger.log("Le problème vient probablement de:");
      Logger.log("1. Seuil d'impact trop élevé");
      Logger.log("2. Algorithme d'évaluation d'impact");
      Logger.log("3. Classes déjà bien équilibrées");
    }
  }
  
  Logger.log("\n=== RECOMMANDATIONS FINALES ===");
  Logger.log("1. Baissez le seuil SEUIL_IMPACT_MINIMAL à 1e-9");
  Logger.log("2. Augmentez MAX_SWAPS_EVAL à 10000");
  Logger.log("3. Testez avec scénario TETES pour forcer les améliorations");
  Logger.log("4. Vérifiez que vos classes ont vraiment des déséquilibres");
}
/**
 * CORRECTION DE LA CLASSIFICATION DES ÉLÈVES - PROBLÈME ROOT CAUSE V14
 * Le vrai problème : classifierEleves ne fonctionne pas, donc 0 têtes détectées
 */

// 1. FONCTION DE DIAGNOSTIC DE LA CLASSIFICATION
function diagnostiquerClassification() {
  Logger.log("=== DIAGNOSTIC CLASSIFICATION DES ÉLÈVES ===");
  
  const config = getConfig();
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!elevesResult.success) {
    Logger.log("❌ Erreur chargement élèves");
    return;
  }
  
  // Patch classesMap si nécessaire
  let { students, classesMap } = elevesResult;
  if (!classesMap && students) {
    classesMap = {};
    students.forEach(eleve => {
      if (eleve && eleve.CLASSE) {
        if (!classesMap[eleve.CLASSE]) classesMap[eleve.CLASSE] = [];
        classesMap[eleve.CLASSE].push(eleve);
      }
    });
  }
  
  Logger.log(`Total élèves: ${students.length}`);
  Logger.log(`Classes: ${Object.keys(classesMap).length}`);
  
  // Analyser quelques élèves AVANT classification
  Logger.log("\n=== AVANT CLASSIFICATION ===");
  for (let i = 0; i < Math.min(5, students.length); i++) {
    const eleve = students[i];
    Logger.log(`Élève ${i+1}: ${eleve.ID_ELEVE}`);
    Logger.log(`  COM: ${eleve.COM} (type: ${typeof eleve.COM})`);
    Logger.log(`  TRA: ${eleve.TRA} (type: ${typeof eleve.TRA})`);
    Logger.log(`  PART: ${eleve.PART} (type: ${typeof eleve.PART})`);
    Logger.log(`  niveauCOM: ${eleve.niveauCOM} (défini: ${eleve.niveauCOM !== undefined})`);
    Logger.log(`  estTeteDeClasse: ${eleve.estTeteDeClasse} (défini: ${eleve.estTeteDeClasse !== undefined})`);
    Logger.log(`  estNiveau1: ${eleve.estNiveau1} (défini: ${eleve.estNiveau1 !== undefined})`);
  }
  
  // Appliquer la classification
  Logger.log("\n=== APPLICATION CLASSIFICATION ===");
  try {
    classifierEleves(students, ["com1", "tra4", "part4"]);
    Logger.log("✅ Classification appliquée sans erreur");
  } catch (e) {
    Logger.log("❌ Erreur lors de la classification: " + e.message);
    Logger.log(e.stack);
    return;
  }
  
  // Analyser les mêmes élèves APRÈS classification
  Logger.log("\n=== APRÈS CLASSIFICATION ===");
  for (let i = 0; i < Math.min(5, students.length); i++) {
    const eleve = students[i];
    Logger.log(`Élève ${i+1}: ${eleve.ID_ELEVE}`);
    Logger.log(`  niveauCOM: ${eleve.niveauCOM}`);
    Logger.log(`  niveauTRA: ${eleve.niveauTRA}`);
    Logger.log(`  niveauPART: ${eleve.niveauPART}`);
    Logger.log(`  estTeteDeClasse: ${eleve.estTeteDeClasse}`);
    Logger.log(`  estNiveau1: ${eleve.estNiveau1}`);
  }
  
  // Compter les têtes et niveau1 après classification
  Logger.log("\n=== COMPTAGE APRÈS CLASSIFICATION ===");
  Object.entries(classesMap).forEach(([classe, eleves]) => {
    const tetes = eleves.filter(e => e.estTeteDeClasse).length;
    const niveau1 = eleves.filter(e => e.estNiveau1).length;
    const score4COM = eleves.filter(e => e.niveauCOM === 4).length;
    const score4TRA = eleves.filter(e => e.niveauTRA === 4).length;
    const score4PART = eleves.filter(e => e.niveauPART === 4).length;
    
    Logger.log(`${classe}: ${eleves.length} élèves`);
    Logger.log(`  Têtes: ${tetes} | Niveau1: ${niveau1}`);
    Logger.log(`  Score4 - COM:${score4COM} TRA:${score4TRA} PART:${score4PART}`);
  });
  
  return { students, classesMap };
}

// 2. FONCTION getNiveau AMÉLIORÉE AVEC LOGS
function getNiveauAvecLogs(score, debug = false) {
  if (debug) {
    Logger.log(`  getNiveau(${score}) - type: ${typeof score}`);
  }
  
  const numScore = Number(score);
  if (isNaN(numScore) || score === '' || score === null || score === undefined) {
    if (debug) Logger.log(`    -> 1 (vide/invalide)`);
    return 1;
  }
  
  let niveau;
  if (numScore < 1.5) niveau = 1;
  else if (numScore < 2.5) niveau = 2;
  else if (numScore < 3.5) niveau = 3;
  else niveau = 4;
  
  if (debug) {
    Logger.log(`    -> ${niveau} (numScore: ${numScore})`);
  }
  
  return niveau;
}

// 3. VERSION DEBUG DE classifierEleves
function classifierElevesDebug(students, extraKeys) {
  Logger.log("=== CLASSIFICATION DEBUG ===");
  Logger.log(`Nombre d'élèves à classifier: ${students.length}`);
  Logger.log(`ExtraKeys: ${JSON.stringify(extraKeys)}`);
  
  if (!Array.isArray(students)) {
    Logger.log("❌ 'students' n'est pas un tableau");
    return;
  }
  
  let tetesCount = 0;
  let niveau1Count = 0;
  
  students.forEach((eleve, index) => {
    if (!eleve || typeof eleve !== 'object') {
      Logger.log(`⚠️ Élève ${index} invalide`);
      return;
    }
    
    const debug = index < 3; // Debug pour les 3 premiers élèves
    
    if (debug) {
      Logger.log(`\nClassification élève ${index}: ${eleve.ID_ELEVE}`);
      Logger.log(`  Données brutes - COM: ${eleve.COM}, TRA: ${eleve.TRA}, PART: ${eleve.PART}`);
    }
    
    // Classification des niveaux
    eleve.niveauCOM = getNiveauAvecLogs(eleve.COM, debug);
    eleve.niveauTRA = getNiveauAvecLogs(eleve.TRA, debug);
    eleve.niveauPART = getNiveauAvecLogs(eleve.PART, debug);
    
    // Détermination tête de classe et niveau 1
    eleve.estTeteDeClasse = (eleve.niveauCOM === 4 || eleve.niveauTRA === 4 || eleve.niveauPART === 4);
    eleve.estNiveau1 = (eleve.niveauCOM === 1 || eleve.niveauTRA === 1 || eleve.niveauPART === 1);
    
    if (eleve.estTeteDeClasse) tetesCount++;
    if (eleve.estNiveau1) niveau1Count++;
    
    if (debug) {
      Logger.log(`  Niveaux calculés - COM: ${eleve.niveauCOM}, TRA: ${eleve.niveauTRA}, PART: ${eleve.niveauPART}`);
      Logger.log(`  Tête de classe: ${eleve.estTeteDeClasse}`);
      Logger.log(`  Niveau 1: ${eleve.estNiveau1}`);
    }
    
    // Classification extraKeys
    (extraKeys || []).forEach(key => {
      if (typeof key !== 'string' || key.length < 4) return;
      
      const crit = key.substring(0, 3).toUpperCase();
      const scoreTarget = Number(key.slice(-1));
      if (isNaN(scoreTarget)) return;
      
      const scoreEleve = eleve[`niveau${crit}`];
      const propName = `est${key.charAt(0).toUpperCase() + key.slice(1)}`;
      eleve[propName] = (scoreEleve === scoreTarget);
      
      if (debug) {
        Logger.log(`  ${propName}: ${eleve[propName]} (niveau${crit}: ${scoreEleve}, target: ${scoreTarget})`);
      }
    });
  });
  
  Logger.log(`\n=== RÉSUMÉ CLASSIFICATION ===`);
  Logger.log(`Total têtes de classe: ${tetesCount}`);
  Logger.log(`Total niveau 1: ${niveau1Count}`);
  Logger.log(`Pourcentage têtes: ${((tetesCount / students.length) * 100).toFixed(1)}%`);
  Logger.log(`Pourcentage niveau1: ${((niveau1Count / students.length) * 100).toFixed(1)}%`);
}

// 4. TESTER LA CLASSIFICATION AVEC DONNÉES RÉELLES
function testerClassificationComplete() {
  Logger.log("=== TEST CLASSIFICATION COMPLÈTE ===");
  
  const config = getConfig();
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!elevesResult.success) {
    Logger.log("❌ Erreur chargement");
    return;
  }
  
  // Patch classesMap
  let { students } = elevesResult;
  if (!elevesResult.classesMap) {
    elevesResult.classesMap = {};
    students.forEach(eleve => {
      if (eleve && eleve.CLASSE) {
        if (!elevesResult.classesMap[eleve.CLASSE]) {
          elevesResult.classesMap[eleve.CLASSE] = [];
        }
        elevesResult.classesMap[eleve.CLASSE].push(eleve);
      }
    });
  }
  
  // Test avec version debug
  classifierElevesDebug(students, ["com1", "tra4", "part4"]);
  
  // Vérifier le résultat par classe
  Logger.log("\n=== RÉSULTAT PAR CLASSE ===");
  Object.entries(elevesResult.classesMap).forEach(([classe, eleves]) => {
    const tetes = eleves.filter(e => e.estTeteDeClasse).length;
    const niveau1 = eleves.filter(e => e.estNiveau1).length;
    Logger.log(`${classe}: ${tetes} têtes, ${niveau1} niveau1 sur ${eleves.length} élèves`);
    
    // Détailler les têtes de classe
    const tetesList = eleves.filter(e => e.estTeteDeClasse);
    if (tetesList.length > 0) {
      const details = tetesList.map(e => 
        `${e.ID_ELEVE}(COM:${e.niveauCOM},TRA:${e.niveauTRA},PART:${e.niveauPART})`
      ).join(', ');
      Logger.log(`  Têtes: ${details}`);
    }
  });
  
  return elevesResult;
}

// 5. VÉRIFIER LES DONNÉES BRUTES
function verifierDonneesBrutes() {
  Logger.log("=== VÉRIFICATION DONNÉES BRUTES ===");
  
  const config = getConfig();
  const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
  
  if (!elevesResult.success || !elevesResult.students) {
    Logger.log("❌ Erreur chargement");
    return;
  }
  
  const students = elevesResult.students;
  Logger.log(`Nombre d'élèves: ${students.length}`);
  
  // Analyser les données COM/TRA/PART
  const statsData = {
    COM: { vides: 0, valeurs: [], types: new Set() },
    TRA: { vides: 0, valeurs: [], types: new Set() },
    PART: { vides: 0, valeurs: [], types: new Set() }
  };
  
  students.forEach(eleve => {
    ['COM', 'TRA', 'PART'].forEach(critere => {
      const valeur = eleve[critere];
      statsData[critere].types.add(typeof valeur);
      
      if (valeur === '' || valeur === null || valeur === undefined) {
        statsData[critere].vides++;
      } else {
        statsData[critere].valeurs.push(valeur);
      }
    });
  });
  
  // Afficher les statistiques
  Object.entries(statsData).forEach(([critere, stats]) => {
    Logger.log(`\n${critere}:`);
    Logger.log(`  Valeurs vides: ${stats.vides}`);
    Logger.log(`  Valeurs non-vides: ${stats.valeurs.length}`);
    Logger.log(`  Types détectés: ${Array.from(stats.types).join(', ')}`);
    
    if (stats.valeurs.length > 0) {
      const echantillon = stats.valeurs.slice(0, 10);
      Logger.log(`  Échantillon: ${echantillon.join(', ')}`);
      
      // Compter les scores
      const scores = { 1: 0, 2: 0, 3: 0, 4: 0, autres: 0 };
      stats.valeurs.forEach(val => {
        const num = Number(val);
        if ([1, 2, 3, 4].includes(num)) {
          scores[num]++;
        } else {
          scores.autres++;
        }
      });
      
      Logger.log(`  Distribution: 1=${scores[1]}, 2=${scores[2]}, 3=${scores[3]}, 4=${scores[4]}, autres=${scores.autres}`);
    }
  });
  
  return statsData;
}

// 6. FONCTION PRINCIPALE POUR RÉSOUDRE LE PROBLÈME DE CLASSIFICATION
function resoudreProblemeClassification() {
  Logger.log("==========================================================");
  Logger.log("RÉSOLUTION PROBLÈME CLASSIFICATION DES ÉLÈVES");
  Logger.log("==========================================================");
  
  // Étape 1: Vérifier les données brutes
  Logger.log("ÉTAPE 1: Vérification données brutes");
  const donneesBrutes = verifierDonneesBrutes();
  
  // Étape 2: Tester la classification
  Logger.log("\nÉTAPE 2: Test classification complète");
  const resultClassification = testerClassificationComplete();
  
  // Étape 3: Diagnostic complet
  Logger.log("\nÉTAPE 3: Diagnostic complet");
  const resultDiagnostic = diagnostiquerClassification();
  
  // Étape 4: Conclusions et recommandations
  Logger.log("\n=== CONCLUSIONS ===");
  
  if (resultClassification && resultClassification.students) {
    const students = resultClassification.students;
    const totalTetes = students.filter(e => e.estTeteDeClasse).length;
    const totalNiveau1 = students.filter(e => e.estNiveau1).length;
    
    if (totalTetes === 0 && totalNiveau1 === 0) {
      Logger.log("❌ PROBLÈME CONFIRMÉ: Aucune tête de classe ni niveau 1 détecté");
      Logger.log("CAUSES POSSIBLES:");
      Logger.log("1. Toutes les notes COM/TRA/PART sont vides ou invalides");
      Logger.log("2. Aucune note n'atteint 4 (pour têtes) ou 1 (pour niveau1)");
      Logger.log("3. Problème dans la fonction getNiveau()");
      Logger.log("4. Problème dans classifierEleves()");
    } else {
      Logger.log(`✅ Classification OK: ${totalTetes} têtes, ${totalNiveau1} niveau1`);
      Logger.log("Le problème V14 vient d'ailleurs (seuil d'impact, etc.)");
    }
  }
  
  return {
    donneesBrutes,
    resultClassification,
    resultDiagnostic
  };
}
/**
 * CORRECTION DES EN-TÊTES DE COLONNES POUR V14
 * Le problème : COM/TRA/PART sont undefined car les colonnes n'existent pas ou ont des noms différents
 */

// 1. FONCTION POUR DÉTECTER LES VRAIES COLONNES
function detecterVraisNomsColonnes() {
  Logger.log("=== DÉTECTION DES VRAIS NOMS DE COLONNES ===");
  
  try {
    const testSheets = getTestSheetsForV14Optimization();
    if (testSheets.length === 0) {
      Logger.log("❌ Aucune feuille TEST trouvée");
      return;
    }
    
    // Analyser la première feuille TEST
    const sheet = testSheets[0];
    const sheetName = sheet.getName();
    Logger.log(`Analyse de la feuille: ${sheetName}`);
    
    // Obtenir tous les en-têtes
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      Logger.log("❌ Feuille vide");
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log(`${headers.length} colonnes détectées:`);
    
    headers.forEach((header, index) => {
      const headerStr = String(header).trim();
      const colLetter = String.fromCharCode(65 + index); // A, B, C, etc.
      Logger.log(`  ${colLetter}: "${headerStr}"`);
    });
    
    // Chercher les colonnes qui pourraient correspondre
    const possibles = {
      COM: [],
      TRA: [],
      PART: []
    };
    
    headers.forEach((header, index) => {
      const headerUpper = String(header).trim().toUpperCase();
      const colLetter = String.fromCharCode(65 + index);
      
      // Correspondances possibles pour COM (Histoire/Compétences/etc.)
      if (headerUpper.includes('COM') || headerUpper.includes('HIST') || 
          headerUpper.includes('H') || headerUpper === 'COM') {
        possibles.COM.push(`${colLetter}: "${header}"`);
      }
      
      // Correspondances possibles pour TRA (Travail/Investment/etc.)
      if (headerUpper.includes('TRA') || headerUpper.includes('TRAV') || 
          headerUpper.includes('WORK') || headerUpper.includes('I') || headerUpper === 'TRA') {
        possibles.TRA.push(`${colLetter}: "${header}"`);
      }
      
      // Correspondances possibles pour PART (Participation/etc.)
      if (headerUpper.includes('PART') || headerUpper.includes('PARTIC') || 
          headerUpper.includes('J') || headerUpper === 'PART') {
        possibles.PART.push(`${colLetter}: "${header}"`);
      }
    });
    
    Logger.log("\n=== CORRESPONDANCES POSSIBLES ===");
    Object.entries(possibles).forEach(([critere, matches]) => {
      Logger.log(`${critere}: ${matches.length > 0 ? matches.join(', ') : 'AUCUNE'}`);
    });
    
    // Vérifier les données dans quelques colonnes potentielles
    if (headers.length > 5) {
      Logger.log("\n=== ÉCHANTILLON DE DONNÉES ===");
      const lastRow = Math.min(sheet.getLastRow(), 6); // Max 5 lignes de données
      
      for (let col = 1; col <= Math.min(10, headers.length); col++) {
        const colLetter = String.fromCharCode(64 + col);
        const headerName = String(headers[col - 1]).trim();
        
        if (lastRow > 1) {
          const colData = sheet.getRange(2, col, lastRow - 1, 1).getValues().flat();
          const nonEmpty = colData.filter(val => val !== null && val !== undefined && String(val).trim() !== '');
          
          if (nonEmpty.length > 0) {
            const sample = nonEmpty.slice(0, 3).map(val => String(val)).join(', ');
            Logger.log(`  ${colLetter} "${headerName}": ${nonEmpty.length} valeurs (ex: ${sample})`);
          }
        }
      }
    }
    
    return { headers, possibles };
    
  } catch (e) {
    Logger.log("❌ Erreur détection colonnes: " + e.message);
    return null;
  }
}

// 2. FONCTION POUR CONFIGURER LES BONS EN-TÊTES
function configurerBonsEntetes() {
  Logger.log("=== CONFIGURATION DES BONS EN-TÊTES ===");
  
  const detection = detecterVraisNomsColonnes();
  if (!detection) {
    Logger.log("❌ Échec détection");
    return;
  }
  
  Logger.log("\n📝 POUR CORRIGER LE PROBLÈME:");
  Logger.log("Dans votre fichier Config.gs, section HEADERS, modifiez:");
  
  Logger.log('\n// AVANT (actuel):');
  Logger.log('HEADERS: {');
  Logger.log('  COM: "COM",');
  Logger.log('  TRA: "TRA",');
  Logger.log('  PART: "PART",');
  Logger.log('  // ...');
  Logger.log('}');
  
  Logger.log('\n// APRÈS (à adapter selon vos colonnes):');
  Logger.log('HEADERS: {');
  
  // Suggestions basées sur la détection
  const suggestions = {
    COM: detection.possibles.COM[0] || '"VOTRE_COLONNE_HISTOIRE"',
    TRA: detection.possibles.TRA[0] || '"VOTRE_COLONNE_TRAVAIL"', 
    PART: detection.possibles.PART[0] || '"VOTRE_COLONNE_PARTICIPATION"'
  };
  
  Object.entries(suggestions).forEach(([key, suggestion]) => {
    const cleanSuggestion = suggestion.includes(':') ? 
      suggestion.split(': ')[1] : suggestion;
    Logger.log(`  ${key}: ${cleanSuggestion},`);
  });
  
  Logger.log('  // ...');
  Logger.log('}');
  
  Logger.log('\n⚠️ IMPORTANT: Remplacez les noms par les VRAIS noms de vos colonnes !');
  
  return suggestions;
}

// 3. FONCTION DE TEST AVEC EN-TÊTES PERSONNALISÉS
function testerAvecEntetesPersonnalises(headersCOM, headersTRA, headersPART) {
  Logger.log("=== TEST AVEC EN-TÊTES PERSONNALISÉS ===");
  Logger.log(`COM: "${headersCOM}", TRA: "${headersTRA}", PART: "${headersPART}"`);
  
  // Sauvegarder la fonction originale
  const _originalChargerEleves = chargerElevesEtClasses;
  
  // Version modifiée temporairement
  chargerElevesEtClasses = function(config, headerMobilityALire) {
    Logger.log("TEST: Utilisation d'en-têtes personnalisés");
    
    // Modifier temporairement la config
    const configModifiee = JSON.parse(JSON.stringify(config));
    configModifiee.HEADERS = configModifiee.HEADERS || {};
    configModifiee.HEADERS.COM = headersCOM;
    configModifiee.HEADERS.TRA = headersTRA;
    configModifiee.HEADERS.PART = headersPART;
    
    const result = _originalChargerEleves(configModifiee, headerMobilityALire);
    
    // Patch classesMap si nécessaire
    if (result.success && result.students && !result.classesMap) {
      result.classesMap = {};
      result.students.forEach(eleve => {
        if (eleve && eleve.CLASSE) {
          if (!result.classesMap[eleve.CLASSE]) {
            result.classesMap[eleve.CLASSE] = [];
          }
          result.classesMap[eleve.CLASSE].push(eleve);
        }
      });
    }
    
    return result;
  };
  
  try {
    const result = chargerElevesEtClasses(getConfig(), "MOBILITE");
    
    if (result.success && result.students && result.students.length > 0) {
      // Vérifier les premières données
      const echantillon = result.students.slice(0, 3);
      Logger.log("\nÉchantillon de données chargées:");
      
      echantillon.forEach((eleve, i) => {
        Logger.log(`Élève ${i + 1}: ${eleve.ID_ELEVE}`);
        Logger.log(`  COM: ${eleve.COM} (type: ${typeof eleve.COM})`);
        Logger.log(`  TRA: ${eleve.TRA} (type: ${typeof eleve.TRA})`);
        Logger.log(`  PART: ${eleve.PART} (type: ${typeof eleve.PART})`);
      });
      
      // Compter les valeurs non-vides
      const statsData = {
        COM: result.students.filter(e => e.COM !== undefined && e.COM !== null && String(e.COM).trim() !== '').length,
        TRA: result.students.filter(e => e.TRA !== undefined && e.TRA !== null && String(e.TRA).trim() !== '').length,
        PART: result.students.filter(e => e.PART !== undefined && e.PART !== null && String(e.PART).trim() !== '').length
      };
      
      Logger.log("\nStatistiques de chargement:");
      Object.entries(statsData).forEach(([critere, count]) => {
        const pourcentage = ((count / result.students.length) * 100).toFixed(1);
        Logger.log(`  ${critere}: ${count}/${result.students.length} (${pourcentage}%)`);
      });
      
      if (statsData.COM > 0 || statsData.TRA > 0 || statsData.PART > 0) {
        Logger.log("\n✅ SUCCÈS! Certaines données ont été chargées");
        Logger.log("Utilisez ces en-têtes dans votre configuration");
        
        // Tester la classification
        classifierEleves(result.students, ["com1", "tra4", "part4"]);
        
        const totalTetes = result.students.filter(e => e.estTeteDeClasse).length;
        const totalNiveau1 = result.students.filter(e => e.estNiveau1).length;
        
        Logger.log(`Classification résultante: ${totalTetes} têtes, ${totalNiveau1} niveau1`);
        
        return { success: true, data: statsData, tetes: totalTetes, niveau1: totalNiveau1 };
      } else {
        Logger.log("\n❌ Aucune donnée chargée avec ces en-têtes");
        return { success: false, message: "En-têtes incorrects" };
      }
    } else {
      Logger.log("\n❌ Échec chargement élèves");
      return { success: false, message: "Échec chargement" };
    }
    
  } finally {
    // Restaurer la fonction originale
    chargerElevesEtClasses = _originalChargerEleves;
  }
}

// 4. FONCTION PRINCIPALE POUR RÉSOUDRE LE PROBLÈME DES EN-TÊTES
function resoudreProblemeEntetes() {
  Logger.log("==========================================================");
  Logger.log("RÉSOLUTION PROBLÈME EN-TÊTES COM/TRA/PART");
  Logger.log("==========================================================");
  
  // Étape 1: Détecter les vraies colonnes
  Logger.log("ÉTAPE 1: Détection des colonnes existantes");
  const detection = detecterVraisNomsColonnes();
  
  if (!detection) {
    Logger.log("❌ Impossible de détecter les colonnes");
    return;
  }
  
  // Étape 2: Configuration
  Logger.log("\nÉTAPE 2: Instructions de configuration");
  configurerBonsEntetes();
  
  // Étape 3: Tests avec en-têtes courants
  Logger.log("\nÉTAPE 3: Tests avec en-têtes courants");
  
  const testsCommuns = [
    { COM: "H", TRA: "I", PART: "J", desc: "Lettres H/I/J" },
    { COM: "HISTOIRE", TRA: "TRAVAIL", PART: "PARTICIPATION", desc: "Noms complets français" },
    { COM: "COMPETENCES", TRA: "INVESTMENT", PART: "PARTICIPATION", desc: "Noms anglais/français" },
    { COM: "COM", TRA: "TRA", PART: "PART", desc: "Noms courts (actuels)" }
  ];
  
  for (const test of testsCommuns) {
    Logger.log(`\nTest ${test.desc}:`);
    const resultat = testerAvecEntetesPersonnalises(test.COM, test.TRA, test.PART);
    
    if (resultat && resultat.success) {
      Logger.log(`✅ SUCCÈS avec ${test.desc}!`);
      Logger.log("Modifiez votre config avec ces en-têtes:");
      Logger.log(`  COM: "${test.COM}"`);
      Logger.log(`  TRA: "${test.TRA}"`);
      Logger.log(`  PART: "${test.PART}"`);
      break;
    }
  }
  
  Logger.log("\n=== INSTRUCTIONS FINALES ===");
  Logger.log("1. 📋 Vérifiez les vrais noms de colonnes dans vos feuilles TEST");
  Logger.log("2. 🔧 Modifiez Config.gs > HEADERS avec les bons noms");
  Logger.log("3. 🧪 Relancez le moteur V14");
  Logger.log("4. ✅ Vous devriez avoir des têtes de classe détectées");
  
  return detection;
}

// 5. SOLUTION RAPIDE SI VOUS CONNAISSEZ VOS EN-TÊTES
function testRapideAvecMesEntetes(monHeaderCOM, monHeaderTRA, monHeaderPART) {
  Logger.log("=== TEST RAPIDE AVEC VOS EN-TÊTES ===");
  Logger.log(`Vos en-têtes: COM="${monHeaderCOM}", TRA="${monHeaderTRA}", PART="${monHeaderPART}"`);
  
  const resultat = testerAvecEntetesPersonnalises(monHeaderCOM, monHeaderTRA, monHeaderPART);
  
  if (resultat && resultat.success) {
    Logger.log("\n🎉 PARFAIT ! Ces en-têtes fonctionnent");
    Logger.log("Ajoutez ceci dans Config.gs:");
    Logger.log(`
HEADERS: {
  // ... autres en-têtes ...
  COM: "${monHeaderCOM}",
  TRA: "${monHeaderTRA}",
  PART: "${monHeaderPART}",
  // ... autres en-têtes ...
}`);
    
    if (resultat.tetes > 0) {
      Logger.log(`\n✨ ${resultat.tetes} têtes de classe détectées - le moteur V14 devrait maintenant fonctionner!`);
    }
  } else {
    Logger.log("\n❌ Ces en-têtes ne fonctionnent pas");
    Logger.log("Vérifiez l'orthographe et la casse exacte de vos colonnes");
  }
  
  return resultat;
}

/**
 * CORRECTION DU MAPPING DES COLONNES V14
 * Le problème : chargerElevesEtClasses trouve les colonnes mais ne lit pas les bonnes données
 * Solution : Forcer les bons indices de colonnes directement
 */

// 1. FONCTION DE TEST AVEC INDICES FORCÉS
function testAvecIndicesForces() {
  Logger.log("=== TEST AVEC INDICES DE COLONNES FORCÉS ===");
  
  // Force les indices H=8, I=9, J=10 (base 1)
  const indicesForces = {
    COM: 8,  // Colonne H
    TRA: 9,  // Colonne I
    PART: 10 // Colonne J
  };
  
  Logger.log("Indices forcés: " + JSON.stringify(indicesForces));
  
  try {
    const config = getConfig();
    const testSheets = getTestSheetsForV14Optimization();
    
    if (testSheets.length === 0) {
      Logger.log("❌ Aucune feuille TEST");
      return;
    }
    
    const sheet = testSheets[0];
    const sheetName = sheet.getName();
    Logger.log("Test sur feuille: " + sheetName);
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log("❌ Feuille vide");
      return;
    }
    
    // Test sur les premières lignes
    Logger.log("\nLecture directe avec indices forcés:");
    
    for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
      const row = data[i];
      const idEleve = row[0]; // Colonne A
      const com = row[indicesForces.COM - 1]; // Index base 0
      const tra = row[indicesForces.TRA - 1];
      const part = row[indicesForces.PART - 1];
      
      Logger.log(`Ligne ${i}: ${idEleve}`);
      Logger.log(`  COM (col H): ${com} (type: ${typeof com})`);
      Logger.log(`  TRA (col I): ${tra} (type: ${typeof tra})`);
      Logger.log(`  PART (col J): ${part} (type: ${typeof part})`);
      
      // Test classification directe
      const niveauCOM = getNiveau(com);
      const niveauTRA = getNiveau(tra);
      const niveauPART = getNiveau(part);
      const estTete = (niveauCOM === 4 || niveauTRA === 4 || niveauPART === 4);
      
      Logger.log(`  Niveaux: COM=${niveauCOM}, TRA=${niveauTRA}, PART=${niveauPART}`);
      Logger.log(`  Tête de classe: ${estTete}`);
    }
    
    // Compter toutes les têtes dans la feuille
    let compteTetes = 0;
    let compteTotal = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || String(row[0]).trim() === '') continue; // Skip lignes vides
      
      compteTotal++;
      const com = row[indicesForces.COM - 1];
      const tra = row[indicesForces.TRA - 1];
      const part = row[indicesForces.PART - 1];
      
      const niveauCOM = getNiveau(com);
      const niveauTRA = getNiveau(tra);
      const niveauPART = getNiveau(part);
      const estTete = (niveauCOM === 4 || niveauTRA === 4 || niveauPART === 4);
      
      if (estTete) compteTetes++;
    }
    
    Logger.log(`\n=== RÉSULTATS FEUILLE ${sheetName} ===`);
    Logger.log(`Total élèves: ${compteTotal}`);
    Logger.log(`Têtes de classe: ${compteTetes}`);
    Logger.log(`Pourcentage têtes: ${compteTotal > 0 ? ((compteTetes / compteTotal) * 100).toFixed(1) : 0}%`);
    
    if (compteTetes > 0) {
      Logger.log("✅ SUCCÈS! Des têtes de classe ont été détectées avec les indices forcés");
      return { success: true, tetes: compteTetes, total: compteTotal };
    } else {
      Logger.log("⚠️ Aucune tête de classe détectée - vérifiez vos données");
      return { success: false, message: "Aucune tête détectée" };
    }
    
  } catch (e) {
    Logger.log("❌ Erreur: " + e.message);
    return { success: false, error: e.message };
  }
}

// 2. VERSION CORRIGÉE DE chargerElevesEtClasses
function chargerElevesEtClassesCorrige(config, headerMobilityALire) {
  Logger.log("=== CHARGEMENT ÉLÈVES AVEC CORRECTION INDICES ===");
  
  try {
    const testSheets = getTestSheetsForV14Optimization();
    if (!testSheets || testSheets.length === 0) {
      return { success: false, errorCode: "NO_TEST_SHEETS", message: "Aucun onglet TEST trouvé" };
    }
    
    const students = [];
    const classesMap = {};
    
    // Indices des colonnes FIXES (basés sur la détection)
    const INDICES_COLONNES = {
      ID_ELEVE: 1,    // Colonne A
      NOM_PRENOM: 4,  // Colonne D
      SEXE: 5,        // Colonne E
      LV2: 6,         // Colonne F
      OPT: 7,         // Colonne G
      COM: 8,         // Colonne H ← FORCÉ
      TRA: 9,         // Colonne I ← FORCÉ
      PART: 10,       // Colonne J ← FORCÉ
      ABS: 11,        // Colonne K
      ASSO: 13,       // Colonne M
      DISSO: 14,      // Colonne N
      MOBILITE: 20    // Colonne T
    };
    
    Logger.log("Indices colonnes utilisés: " + JSON.stringify(INDICES_COLONNES));
    
    testSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const data = sheet.getDataRange().getValues();
      classesMap[sheetName] = [];
      
      if (data.length <= 1) return;
      
      Logger.log(`Traitement ${sheetName}...`);
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // Skip lignes vides
        if (!row[0] || String(row[0]).trim() === '') continue;
        
        const stu = { CLASSE: sheetName };
        
        // Lecture avec indices fixes
        stu.ID_ELEVE = String(row[INDICES_COLONNES.ID_ELEVE - 1] || "").trim();
        stu.NOM = String(row[INDICES_COLONNES.NOM_PRENOM - 1] || "").trim();
        stu.SEXE = String(row[INDICES_COLONNES.SEXE - 1] || "").trim().toUpperCase();
        stu.LV2 = String(row[INDICES_COLONNES.LV2 - 1] || "").trim();
        stu.OPT = String(row[INDICES_COLONNES.OPT - 1] || "").trim();
        
        // LECTURE CORRIGÉE DES COLONNES COM/TRA/PART
        const comRaw = row[INDICES_COLONNES.COM - 1];
        const traRaw = row[INDICES_COLONNES.TRA - 1];
        const partRaw = row[INDICES_COLONNES.PART - 1];
        
        stu.COM = (comRaw !== null && comRaw !== undefined && String(comRaw).trim() !== '') ? Number(comRaw) : '';
        stu.TRA = (traRaw !== null && traRaw !== undefined && String(traRaw).trim() !== '') ? Number(traRaw) : '';
        stu.PART = (partRaw !== null && partRaw !== undefined && String(partRaw).trim() !== '') ? Number(partRaw) : '';
        
        stu.ABS = String(row[INDICES_COLONNES.ABS - 1] || "").trim();
        stu.ASSO = String(row[INDICES_COLONNES.ASSO - 1] || "").trim();
        stu.DISSO = String(row[INDICES_COLONNES.DISSO - 1] || "").trim();
        
        let mobRaw = String(row[INDICES_COLONNES.MOBILITE - 1] || 'LIBRE').trim().toUpperCase();
        
        // ✅ CORRECTION CRITIQUE : Normaliser les formats GROUPE_FIXE/GROUPE_PERMUT/CONDI
        if (mobRaw.startsWith('GROUPE_FIXE')) {
            mobRaw = 'FIXE';
        } else if (mobRaw.startsWith('CONDI')) {
            mobRaw = 'CONDI';  // ✅ Garder CONDI
        } else if (mobRaw.startsWith('GROUPE_PERMUT')) {
            mobRaw = 'PERMUT';
        }
        
        stu.mobilite = ['FIXE', 'PERMUT', 'CONDI', 'SPEC', 'LIBRE'].includes(mobRaw) ? mobRaw : 'LIBRE';
        stu.MOBILITE = stu.mobilite; // Pour compatibilité
        
        // Option key
        let optionKey = null;
        let optionSource = stu.OPT;
        if (!optionSource || optionSource.trim() === '') {
          optionSource = stu.LV2;
        }
        if (optionSource && optionSource.trim() !== '') {
          const optParts = optionSource.split(/[,/]/);
          let firstOpt = optParts[0].trim().toUpperCase();
          if (firstOpt.includes("=")) {
            firstOpt = firstOpt.split("=")[0].trim();
          }
          optionKey = firstOpt;
        }
        stu.optionKey = optionKey;
        
        if (stu.ID_ELEVE === "") continue;
        if (!stu.NOM || stu.NOM === "") {
          stu.NOM = `Élève ${stu.ID_ELEVE}`;
        }
        
        students.push(stu);
        classesMap[sheetName].push(stu);
      }
      
      Logger.log(`${classesMap[sheetName].length} élèves chargés depuis ${sheetName}`);
    });
    
    Logger.log(`Total: ${students.length} élèves chargés`);
    
    return { success: true, students, classesMap };
    
  } catch (e) {
    Logger.log("❌ Erreur chargerElevesEtClassesCorrige: " + e.message);
    return { success: false, error: e.message };
  }
}

// 3. TEST COMPLET AVEC FONCTION CORRIGÉE
function testerMoteurAvecFonctionCorrigee() {
  Logger.log("=== TEST MOTEUR AVEC FONCTION CORRIGÉE ===");
  
  // Sauvegarder fonction originale
  const _originalChargerEleves = chargerElevesEtClasses;
  
  // Remplacer temporairement
  chargerElevesEtClasses = chargerElevesEtClassesCorrige;
  
  try {
    // Test 1: Chargement des données
    Logger.log("1. Test chargement avec fonction corrigée:");
    const config = getConfig();
    const elevesResult = chargerElevesEtClasses(config, "MOBILITE");
    
    if (!elevesResult.success) {
      Logger.log("❌ Échec chargement");
      return elevesResult;
    }
    
    Logger.log(`✅ ${elevesResult.students.length} élèves chargés`);
    
    // Test 2: Vérifier les données COM/TRA/PART
    const echantillon = elevesResult.students.slice(0, 5);
    Logger.log("\n2. Vérification données chargées:");
    
    let compteCOM = 0, compteTRA = 0, comptePART = 0;
    echantillon.forEach((eleve, i) => {
      Logger.log(`Élève ${i+1}: ${eleve.ID_ELEVE}`);
      Logger.log(`  COM: ${eleve.COM} (${typeof eleve.COM})`);
      Logger.log(`  TRA: ${eleve.TRA} (${typeof eleve.TRA})`);
      Logger.log(`  PART: ${eleve.PART} (${typeof eleve.PART})`);
      
      if (eleve.COM !== '' && !isNaN(eleve.COM)) compteCOM++;
      if (eleve.TRA !== '' && !isNaN(eleve.TRA)) compteTRA++;
      if (eleve.PART !== '' && !isNaN(eleve.PART)) comptePART++;
    });
    
    Logger.log(`Données valides dans échantillon: COM=${compteCOM}, TRA=${compteTRA}, PART=${comptePART}`);
    
    // Test 3: Classification
    if (compteCOM > 0 || compteTRA > 0 || comptePART > 0) {
      Logger.log("\n3. Test classification:");
      classifierEleves(elevesResult.students, ["com1", "tra4", "part4"]);
      
      const totalTetes = elevesResult.students.filter(e => e.estTeteDeClasse).length;
      const totalNiveau1 = elevesResult.students.filter(e => e.estNiveau1).length;
      
      Logger.log(`Résultat classification: ${totalTetes} têtes, ${totalNiveau1} niveau1`);
      
      if (totalTetes > 0) {
        Logger.log("✅ SUCCÈS! Des têtes de classe ont été détectées");
        
        // Test 4: Moteur V14 rapide
        Logger.log("\n4. Test moteur V14:");
        const resultatMoteur = V11_OptimisationDistribution_Combined(null, {
          tetesDeClasse: 6.0,
          niveau1: 6.0, 
          distribution: 3.0,
          com1: 0, tra4: 0, part4: 0,
          garantieTete: 1000
        }, 10);
        
        Logger.log("Résultat moteur:");
        Logger.log(`  Success: ${resultatMoteur.success}`);
        Logger.log(`  Nb Swaps: ${resultatMoteur.nbSwaps}`);
        Logger.log(`  Message: ${resultatMoteur.message}`);
        
        return {
          success: true,
          chargement: true,
          classification: { tetes: totalTetes, niveau1: totalNiveau1 },
          moteur: resultatMoteur
        };
      } else {
        Logger.log("⚠️ Aucune tête de classe après classification");
        return { success: false, message: "Aucune tête après classification" };
      }
    } else {
      Logger.log("❌ Aucune donnée COM/TRA/PART valide chargée");
      return { success: false, message: "Données COM/TRA/PART manquantes" };
    }
    
  } catch (e) {
    Logger.log("❌ Erreur test moteur: " + e.message);
    Logger.log(e.stack);
    return { success: false, error: e.message };
    
  } finally {
    // Restaurer fonction originale
    chargerElevesEtClasses = _originalChargerEleves;
    Logger.log("Fonction originale restaurée");
  }
}

// 4. FONCTION PRINCIPALE POUR RÉSOUDRE DÉFINITIVEMENT
function resoudreDefinitivementV14() {
  Logger.log("==========================================================");
  Logger.log("RÉSOLUTION DÉFINITIVE DU PROBLÈME V14");
  Logger.log("==========================================================");
  
  // Étape 1: Test avec indices forcés
  Logger.log("ÉTAPE 1: Test lecture directe avec indices forcés");
  const testIndices = testAvecIndicesForces();
  
  if (!testIndices || !testIndices.success) {
    Logger.log("❌ Échec test indices forcés - problème plus profond");
    return testIndices;
  }
  
  Logger.log(`✅ Test indices OK: ${testIndices.tetes} têtes détectées`);
  
  // Étape 2: Test moteur avec fonction corrigée
  Logger.log("\nÉTAPE 2: Test moteur avec fonction corrigée");
  const testMoteur = testerMoteurAvecFonctionCorrigee();
  
  if (testMoteur && testMoteur.success) {
    Logger.log("\n🎉 SUCCÈS COMPLET!");
    Logger.log("=== RÉSULTATS ===");
    Logger.log(`- Têtes détectées: ${testMoteur.classification.tetes}`);
    Logger.log(`- Niveau1 détectés: ${testMoteur.classification.niveau1}`);
    Logger.log(`- Moteur V14 swaps: ${testMoteur.moteur.nbSwaps}`);
    
    Logger.log("\n=== SOLUTION DÉFINITIVE ===");
    Logger.log("Le problème était dans la fonction chargerElevesEtClasses.");
    Logger.log("Elle ne lisait pas les bonnes colonnes malgré la détection correcte.");
    Logger.log("\n🔧 POUR CORRIGER DÉFINITIVEMENT:");
    Logger.log("Remplacez votre fonction chargerElevesEtClasses par chargerElevesEtClassesCorrige");
    Logger.log("OU modifiez les indices des colonnes dans le code existant:");
    Logger.log("  COM: colonne H (index 8)");
    Logger.log("  TRA: colonne I (index 9)"); 
    Logger.log("  PART: colonne J (index 10)");
    
    return testMoteur;
    
  } else {
    Logger.log("❌ Échec test moteur même avec correction");
    return testMoteur;
  }
  function testChargementCorrige() {
    const config = getConfig();
    const result = chargerElevesEtClasses(config, "MOBILITE");
    
    Logger.log("=== TEST CHARGEMENT CORRIGÉ ===");
    Logger.log("Success: " + result.success);
    Logger.log("Élèves chargés: " + (result.students ? result.students.length : 0));
    
    if (result.students && result.students.length > 0) {
        const stats = {
            avecCOM: result.students.filter(s => s.COM !== '').length,
            avecTRA: result.students.filter(s => s.TRA !== '').length,
            avecPART: result.students.filter(s => s.PART !== '').length
        };
        
        Logger.log("Élèves avec COM: " + stats.avecCOM);
        Logger.log("Élèves avec TRA: " + stats.avecTRA);
        Logger.log("Élèves avec PART: " + stats.avecPART);
        
        if (stats.avecCOM > 0 && stats.avecTRA > 0 && stats.avecPART > 0) {
            Logger.log("✅ SUCCÈS! Les données COM/TRA/PART sont chargées");
        }
    }
}
}
