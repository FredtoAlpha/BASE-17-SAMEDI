/**
 * ===================================================================
 * ORCHESTRATION V14I - NOUVEAU SYSTÈME
 * ===================================================================
 *
 * Architecture incrémentale correcte :
 *
 * 1. Lit STRUCTURE + QUOTAS depuis l'interface Optimisation
 * 2. Exécute Phase 1 → 2 → 3 → 4 séquentiellement
 * 3. Après CHAQUE phase : écrit uniquement dans ...CACHE
 * 4. Après CHAQUE phase : affiche les onglets CACHE dans l'UI
 * 5. Phase 4 (swaps) respecte TOUS les verrous
 *
 * INVARIANTS :
 * - LECTURE : toujours depuis l'onglet sélectionné (TEST/FIN/CACHE/...)
 * - ÉCRITURE : exclusivement dans ...CACHE
 * - UI : reload forcé après chaque phase
 * - Swaps : ne cassent jamais Options/LV2/DISSO/ASSO/Parité/Quotas
 *
 * ===================================================================
 */

// ===================================================================
// FONCTION SPÉCIALE POUR PIPELINE LEGACY INITIAL
// ===================================================================

/**
 * Détecte automatiquement les onglets sources existants (ECOLE1, 6°1, etc.)
 * et crée un contexte pour le pipeline LEGACY initial (Sources → TEST)
 * @return {Object} Contexte prêt pour les 4 phases LEGACY
 */
function makeCtxFromSourceSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();

  // Détecter les onglets sources (formats multiples supportés)
  const sourceSheets = [];
  // ✅ Pattern universel : 6°1, ALBEXT°7, BONHOURE°2, etc. (toujours avec °)
  const sourcePattern = /^[A-Za-z0-9_-]+°\d+$/;
  // ❌ Exclure les onglets TEST, CACHE, DEF, FIN, etc.
  const excludePattern = /TEST|CACHE|DEF|FIN|SRC|SOURCE|_CONFIG|_STRUCTURE|_LOG/i;

  for (const sheet of allSheets) {
    const name = sheet.getName();
    if (sourcePattern.test(name) && !excludePattern.test(name)) {
      sourceSheets.push(name);
    }
  }

  if (sourceSheets.length === 0) {
    throw new Error(
      '❌ Aucun onglet source trouvé !\n\n' +
      'Formats supportés:\n' +
      '• Classique: 6°1, 5°1, 4°1, 3°1, etc.\n' +
      '• ECOLE: ECOLE1, ECOLE2, etc.\n' +
      '• Personnalisé: GAMARRA°4, NOMECOLE°1, etc.'
    );
  }

  sourceSheets.sort();
  logLine('INFO', `📋 Onglets sources détectés: ${sourceSheets.join(', ')}`);

  // ✅ Lire le mapping CLASSE_ORIGINE → CLASSE_DEST depuis _STRUCTURE
  const sourceToDestMapping = readSourceToDestMapping_();

  // ✅ CORRECTION : Extraire les destinations UNIQUES depuis le MAPPING (pas seulement les sources existantes)
  // Plusieurs sources peuvent mapper vers la même destination (ex: PANASS°5, BUISSON°6, ALBEXT°7 → 6°5)
  const uniqueDestinations = [];
  const seenDest = {};
  const destToSourceMapping = {}; // Mapping inverse pour copier les en-têtes
  const sourceSheetSet = new Set(sourceSheets); // Pour vérifier l'existence rapide

  // D'abord, traiter TOUS les mappings depuis _STRUCTURE
  for (const [sourceName, dest] of Object.entries(sourceToDestMapping)) {
    if (dest && !seenDest[dest]) {
      uniqueDestinations.push(dest);
      seenDest[dest] = true;

      // Trouver la première source qui EXISTE physiquement pour cette destination
      if (!destToSourceMapping[dest]) {
        if (sourceSheetSet.has(sourceName)) {
          destToSourceMapping[dest] = sourceName;
        }
      }
    }
  }

  // Ensuite, traiter les sources détectées qui n'ont PAS de mapping
  for (const sourceName of sourceSheets) {
    if (!sourceToDestMapping[sourceName]) {
      // Pas de mapping → fallback
      let dest;
      const match = sourceName.match(/([3-6]°\d+)/);
      if (match) {
        dest = match[1];
      } else {
        const matchEcole = sourceName.match(/ECOLE(\d+)/);
        if (matchEcole) {
          dest = '6°' + matchEcole[1];
        }
      }

      if (dest && !seenDest[dest]) {
        uniqueDestinations.push(dest);
        seenDest[dest] = true;
        destToSourceMapping[dest] = sourceName;
      }
    }
  }

  // Pour les destinations sans source existante, utiliser la première source du mapping
  for (const dest of uniqueDestinations) {
    if (!destToSourceMapping[dest]) {
      // Trouver n'importe quelle source qui mappe vers cette destination
      for (const [src, d] of Object.entries(sourceToDestMapping)) {
        if (d === dest) {
          destToSourceMapping[dest] = src;
          logLine('WARN', `⚠️ Onglet ${src} introuvable, utilisé comme référence pour ${dest}TEST`);
          break;
        }
      }
    }
  }

  // Générer les noms d'onglets TEST pour les destinations uniques
  const testSheets = uniqueDestinations.map(dest => dest + 'TEST');
  const niveauxDest = uniqueDestinations;

  logLine('INFO', `📋 Onglets TEST à créer: ${testSheets.join(', ')}`);

  // Lire les quotas par classe depuis _STRUCTURE
  const quotas = readQuotasFromUI_();

  // Lire les cibles d'effectifs par classe
  const targets = readTargetsFromUI_();

  // Lire la tolérance de parité
  const tolParite = readParityToleranceFromUI_() || 2;

  // Lire le nombre max de swaps
  const maxSwaps = readMaxSwapsFromUI_() || 500;

  // Lire les autorisations de classes pour options/LV2
  const autorisations = readClassAuthorizationsFromUI_();

  return {
    ss,
    modeSrc: '',  // ✅ FIX: Mode vide pour LEGACY car les sources n'ont pas de suffixe
    writeTarget: 'TEST',
    niveaux: niveauxDest,  // ✅ FIX: Les niveaux de destination (5°1, 5°2, etc.)
    levels: niveauxDest,  // ✅ ALIAS pour compatibilité Phase4_BASEOPTI_V2
    srcSheets: sourceSheets,  // Les onglets sources réels (6°1, 6°2, etc.)
    cacheSheets: testSheets,  // Les onglets TEST à créer (5°1TEST, 5°2TEST, etc.)
    sourceToDestMapping,  // ✅ Mapping source → dest (ex: PREVERT°1 → 6°1)
    destToSourceMapping,  // ✅ Mapping inverse dest → source (ex: 6°1 → PREVERT°1)
    quotas,
    targets,
    tolParite,
    maxSwaps,
    autorisations
  };
}

// ===================================================================
// 0. UTILITAIRES DE GESTION DES ONGLETS
// ===================================================================

/**
 * Toujours suffixer (ex: '6°1' + 'CACHE' -> '6°1CACHE'). Jamais de préfixe.
 */
function buildSheetName_(niveau, suffix) {
  const base = String(niveau || '').trim();
  const sfx = String(suffix || '').trim();
  if (!base) throw new Error('buildSheetName_: niveau vide');
  if (!sfx) throw new Error('buildSheetName_: suffix vide');
  return base + sfx;
}

/**
 * Liste des feuilles sources/targets à partir des niveaux et d'un suffixe.
 */
function makeSheetsList_(niveaux, suffix) {
  return (niveaux || []).map(function(niv) { return buildSheetName_(niv, suffix); });
}

/**
 * getActive() unique point d'entrée pour éviter d'écrire dans le mauvais classeur.
 */
function getActiveSS_() {
  return SpreadsheetApp.getActive();
}

/**
 * Obtient ou crée un onglet
 */
function getOrCreateSheet_(name) {
  const ss = getActiveSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    logLine('INFO', '📄 Création onglet: ' + name);
    sh = ss.insertSheet(name);
  }
  return sh;
}

/**
 * Écrit des valeurs et vérifie. headerRow=1 si tu as des entêtes, sinon 0.
 */
function writeAndVerify_(sheetName, rangeStartRow, rangeStartCol, values, headerRow) {
  const sh = getOrCreateSheet_(sheetName);

  if (headerRow) {
    // On ne touche pas l'entête ; on efface le dessous
    const lastRow = sh.getLastRow();
    if (lastRow > headerRow) {
      sh.getRange(headerRow + 1, 1, lastRow - headerRow, sh.getMaxColumns()).clearContent();
    }
  } else {
    sh.clearContents();
  }

  if (values && values.length && values[0] && values[0].length) {
    sh.getRange(rangeStartRow, rangeStartCol, values.length, values[0].length).setValues(values);
  }

  SpreadsheetApp.flush();
  Utilities.sleep(100);

  // ✅ Vérification: au moins 1 ligne écrite sous l'entête si headerRow=1
  const rows = sh.getLastRow();
  const ok = headerRow ? (rows > headerRow) : (rows > 0);
  if (!ok) {
    throw new Error('WRITE_FAILED: rien d\'écrit dans ' + sheetName);
  }

  logLine('INFO', '✅ Écriture vérifiée dans ' + sheetName + ' (' + (rows - (headerRow || 0)) + ' lignes)');
  return sh;
}

// ===================================================================
// 1. ORCHESTRATEUR PRINCIPAL
// ===================================================================

/**
 * Point d'entrée principal pour l'optimisation V14I
 * @param {Object} options - Options depuis l'interface
 * @returns {Object} Résultat complet avec statut de chaque phase
 */
function runOptimizationV14FullI(options) {
  const startTime = new Date();
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '🚀 LANCEMENT OPTIMISATION V14I - ARCHITECTURE INCRÉMENTALE');
  logLine('INFO', '='.repeat(80));

  try {
    // 1. Construire le contexte depuis _OPTI_CONFIG (Pipeline OPTI)
    const ctx = buildCtx_V2(options);
    logLine('INFO', 'Contexte OPTI créé : Mode=' + ctx.modeSrc + ', Niveaux=' + ctx.niveaux.join(',') + ', Tolérance parité=' + ctx.tolParite);
    logLine('INFO', '  📊 Max swaps: ' + ctx.maxSwaps + ', Runtime: ' + ctx.runtimeSec + 's');
    logLine('INFO', '  📊 Weights: ' + JSON.stringify(ctx.weights));

    const phasesOut = [];
    let ok = true;

    // ===== INIT V3 : VIDER CACHE ET CRÉER _BASEOPTI =====
    logLine('INFO', '\n🔧 INIT V3 : Préparation _BASEOPTI...');
    const initResult = initOptimization_V3(ctx);
    if (!initResult.ok) {
      logLine('ERROR', '❌ INIT V3 échoué');
      return { success: false, error: 'INIT V3 échoué', phases: [] };
    }
    logLine('INFO', '✅ INIT V3 terminé : ' + initResult.total + ' élèves dans _BASEOPTI');

    // ===== PHASE 1 V3 : Options & LV2 (depuis _BASEOPTI) =====
    logLine('INFO', '\n📌 PHASE 1 V3 : Affectation Options & LV2 (depuis _BASEOPTI)...');
    const p1 = Phase1I_dispatchOptionsLV2_BASEOPTI_V3(ctx);

    phasesOut.push(tagPhase_('Phase 1 V3 - Options/LV2', p1));
    announcePhaseDone_('Phase 1 V3 (Options/LV2) écrite dans _BASEOPTI + CACHE');
    forceCacheInUIAndReload_(ctx);
    ok = ok && p1.ok;
    logLine('INFO', '✅ Phase 1 V3 terminée : ' + (p1.counts ? JSON.stringify(p1.counts) : 'OK'));

    // ===== PHASE 2 V3 : DISSO/ASSO (depuis _BASEOPTI) =====
    logLine('INFO', '\n📌 PHASE 2 V3 : Application codes DISSO/ASSO (depuis _BASEOPTI)...');
    const p2 = Phase2I_applyDissoAsso_BASEOPTI_V3(ctx);
    phasesOut.push(tagPhase_('Phase 2 V3 - DISSO/ASSO', p2));
    announcePhaseDone_('Phase 2 V3 (DISSO/ASSO) écrite dans _BASEOPTI + CACHE');
    forceCacheInUIAndReload_(ctx);
    ok = ok && p2.ok;
    logLine('INFO', '✅ Phase 2 V3 terminée : DISSO=' + (p2.disso || 0) + ', ASSO=' + (p2.asso || 0));

    // ===== PHASE 3 V3 : Effectifs + Parité (depuis _BASEOPTI) =====
    logLine('INFO', '\n📌 PHASE 3 V3 : Compléter effectifs & équilibrer parité (depuis _BASEOPTI)...');
    const p3 = Phase3I_completeAndParity_BASEOPTI_V3(ctx);
    phasesOut.push(tagPhase_('Phase 3 V3 - Effectifs/Parité', p3));
    announcePhaseDone_('Phase 3 V3 (Effectifs/Parité) écrite dans _BASEOPTI + CACHE');
    forceCacheInUIAndReload_(ctx);
    ok = ok && p3.ok;
    logLine('INFO', '✅ Phase 3 V3 terminée');

    // ===== PHASE 4 V3 : Swaps COM/TRA/PART/ABS (depuis _BASEOPTI) =====
    logLine('INFO', '\n📌 PHASE 4 V3 : Optimisation par swaps (depuis _BASEOPTI, COM prioritaire)...');
    const p4 = Phase4_balanceScoresSwaps_BASEOPTI_V3(ctx);
    phasesOut.push(tagPhase_('Phase 4 V3 - Swaps', p4));
    announcePhaseDone_('Phase 4 V3 terminée : ' + (p4.swapsApplied || 0) + ' swaps appliqués. Résultat dans _BASEOPTI + CACHE');
    forceCacheInUIAndReload_(ctx);
    ok = ok && (p4.ok !== false);
    logLine('INFO', '✅ Phase 4 V3 terminée : ' + (p4.swapsApplied || 0) + ' swaps appliqués');

    // Basculer l'interface en mode CACHE
    setInterfaceModeCACHE_(ctx);

    const endTime = new Date();
    const durationSec = (endTime - startTime) / 1000;
    const durationLog = durationSec.toFixed(2);

    logLine('INFO', '='.repeat(80));
    logLine('INFO', '✅ OPTIMISATION V14I (PIPELINE OPTI V3) TERMINÉE EN ' + durationLog + 's');
    logLine('INFO', 'Swaps totaux : ' + (p4.swapsApplied || 0));
    logLine('INFO', 'Architecture : _BASEOPTI + _OPTI_CONFIG');
    logLine('INFO', '='.repeat(80));

    // ✅ FORCER L'OUVERTURE DES ONGLETS CACHE AVEC FLUSH STRICT
    logLine('INFO', '📂 Ouverture des onglets CACHE...');
    const openedInfo = openCacheTabs_(ctx);

    // ✅ AUDIT FINAL : Vérifier conformité CACHE vs STRUCTURE
    const cacheAudit = auditCacheAgainstStructure_(ctx);

    // ✅ FINALISATION : Calcul moyennes et mise en forme onglets TEST
    try {
      finalizeTestSheets_(ctx);
    } catch (e) {
      logLine('WARN', '⚠️ Erreur lors de la finalisation des onglets TEST : ' + e.message);
    }

    // ✅ Réponse 100% sérialisable et compatible avec l'UI
    const warningsOut = (collectWarnings_(phasesOut) || []).map(function(w) {
      return String(w);
    });

    const response = {
      success: ok,                              // Contrat UI attend "success"
      ok: ok,                                   // Compatibilité legacy
      nbSwaps: p4.swapsApplied || 0,           // Contrat UI attend "nbSwaps"
      swaps: p4.swapsApplied || 0,             // Compatibilité legacy
      tempsTotalMs: Math.round(durationSec * 1000), // Contrat UI attend "tempsTotalMs"
      durationMs: Math.round(durationSec * 1000),   // Alias explicite pour compatibilité
      duration: durationSec,                    // Durée en secondes (nombre)
      durationSec: durationSec,                 // Alias explicite pour analyse côté client
      warnings: warningsOut,                    // Forcer String[]
      writeSuffix: 'CACHE',
      sourceSuffix: ctx.modeSrc || 'TEST',
      cacheSheets: ctx.cacheSheets.slice(),    // ✅ Liste des onglets CACHE pour l'UI
      quotasLus: ctx.quotas || {},             // ✅ Diagnostic : quotas détectés
      cacheStats: openedInfo.stats || [],      // ✅ Stats détaillées : lignes/colonnes par onglet
      cacheAudit: cacheAudit || {},            // ✅ Audit de conformité par classe
      openedInfo: {                             // ✅ Info sur les onglets activés
        opened: openedInfo.opened || [],
        active: openedInfo.active || null,
        error: openedInfo.error || null
      },
      // ⚠️ NE PAS inclure phasesOut (peut contenir des objets Apps Script)
      message: ok ? 'Optimisation réussie' : 'Optimisation terminée avec warnings'
    };

    // ✅ Garantir la sérialisation JSON (purge undefined, fonctions, objets Apps Script)
    return JSON.parse(JSON.stringify(response));

  } catch (e) {
    logLine('ERROR', '❌ ERREUR FATALE ORCHESTRATION V14I : ' + e.message);
    logLine('ERROR', e.stack);
    throw e;
  }
}

/**
 * Marque une phase avec son nom
 */
function tagPhase_(name, res) {
  return { name, ...res };
}

/**
 * Collecte tous les warnings de toutes les phases
 */
function collectWarnings_(phases) {
  return phases.flatMap(p => p.warnings || []);
}

// ===================================================================
// 2. CONSTRUCTION DU CONTEXTE DEPUIS L'INTERFACE
// ===================================================================

/**
 * Construit le contexte d'exécution depuis l'interface UI
 * Lit TOUS les paramètres : structure, quotas, cibles, tolérances
 */
function makeCtxFromUI_(options) {
  const ss = getActiveSS_();

  // Lire le mode source depuis options ou UI (TEST/FIN/CACHE/...)
  const modeSrc = (options && options.sourceFamily) ? String(options.sourceFamily).trim() : (readModeFromUI_() || 'TEST');

  // Le target est CACHE pour l'optimisation, mais peut être personnalisé (ex: TEST pour pipeline LEGACY)
  const writeTarget = (options && options.targetFamily) ? String(options.targetFamily).trim() : 'CACHE';

  // Lire les niveaux à traiter (dynamiquement depuis _STRUCTURE ou _CONFIG)
  const niveaux = (typeof genererNiveauxDynamiques === 'function')
    ? genererNiveauxDynamiques()
    : (readNiveauxFromUI_() || ['6°1', '6°2', '6°3', '6°4', '6°5']);

  // ✅ Construire les noms de feuilles avec les helpers (suffixe uniquement)
  const srcSheets = makeSheetsList_(niveaux, modeSrc);     // ['6°1TEST', '6°2TEST', ...]
  const cacheSheets = makeSheetsList_(niveaux, writeTarget); // ['6°1CACHE', '6°2CACHE', ...]

  logLine('INFO', '📋 Contexte: Source=' + modeSrc + ', Target=' + writeTarget);
  logLine('INFO', '📋 Onglets source: ' + srcSheets.join(', '));
  logLine('INFO', '📋 Onglets cible: ' + cacheSheets.join(', '));

  // Lire les quotas par classe depuis l'interface
  const quotas = readQuotasFromUI_();

  // Lire les cibles d'effectifs par classe
  const targets = readTargetsFromUI_();

  // Lire la tolérance de parité
  const tolParite = readParityToleranceFromUI_() || 2;

  // Lire le nombre max de swaps depuis options ou UI
  const maxSwaps = (options && options.maxSwaps) ? parseInt(options.maxSwaps) : (readMaxSwapsFromUI_() || 500);

  // Lire les autorisations de classes pour options/LV2
  const autorisations = readClassAuthorizationsFromUI_();

  return {
    ss,
    modeSrc,
    writeTarget,
    niveaux,
    srcSheets,
    cacheSheets,
    quotas,
    targets,
    tolParite,
    maxSwaps,
    autorisations
  };
}

/**
 * @deprecated Cette fonction est obsolète. Le mode est maintenant géré par l'interface web (localStorage).
 * @see InterfaceV2.html - STATE.currentMode
 * 
 * Lit le mode de travail depuis l'interface (legacy).
 * Retourne toujours 'TEST' car la lecture de cellule UI est obsolète.
 * 
 * ⚠️ LEGACY : Cette fonction ne lit plus l'interface réelle.
 * Le mode est maintenant géré côté client dans InterfaceV2.html via localStorage.
 */
function readModeFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uiSheet = ss.getSheetByName('_INTERFACE_V2') || ss.getSheetByName('UI_Config');
  if (!uiSheet) return 'TEST';

  // ⚠️ LEGACY : Lecture de cellule UI obsolète
  // Le mode est maintenant géré par l'interface web (localStorage)
  try {
    const value = uiSheet.getRange('B2').getValue();
    return String(value).trim() || 'TEST';
  } catch (e) {
    return 'TEST';
  }
}

/**
 * @deprecated Cette fonction est obsolète. Utiliser genererNiveauxDynamiques() à la place.
 * @see genererNiveauxDynamiques() dans NiveauxDynamiques.gs
 *
 * Lit les niveaux à traiter depuis l'interface (legacy).
 * Retourne des valeurs codées en dur pour compatibilité.
 *
 * ⚠️ LEGACY : Cette fonction retourne des valeurs hardcodées.
 * Les niveaux doivent maintenant être lus dynamiquement via genererNiveauxDynamiques().
 */
function readNiveauxFromUI_() {
  // ⚠️ LEGACY : Valeurs codées en dur pour compatibilité ascendante
  // IMPORTANT : Cette fonction ne doit plus être utilisée
  // Utiliser genererNiveauxDynamiques() pour une lecture dynamique
  if (typeof logLine === 'function') {
    logLine('WARN', '⚠️ readNiveauxFromUI_() est obsolète, utilisez genererNiveauxDynamiques()');
  }
  return ['6°1', '6°2', '6°3', '6°4', '6°5'];
}

/**
 * Lit les quotas par classe depuis l'interface
 * Format attendu : { "6°1": { ITA: 6, CHAV: 0, LV2_ESP: 3, ... }, ... }
 */
function readQuotasFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Essayer de lire depuis _STRUCTURE
  const structSheet = ss.getSheetByName('_STRUCTURE');
  if (structSheet) {
    return readQuotasFromStructure_(structSheet);
  }

  // Sinon, retour valeurs par défaut
  return {
    "6°1": { ITA: 6 },
    "6°2": {},
    "6°3": { CHAV: 10 },
    "6°4": {},
    "6°5": {}
  };
}

/**
 * Lit les quotas depuis la feuille _STRUCTURE
 * Parse la colonne OPTIONS au format "ITA=6,CHAV=10,ESP=5"
 */
function readQuotasFromStructure_(sheet) {
  const quotas = {};

  try {
    const data = sheet.getDataRange().getValues();
    
    // ✅ CORRECTION : Recherche dynamique de l'en-tête (tolère lignes de garde/metadata)
    let headerRow = -1;
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      // Chercher une ligne contenant CLASSE_DEST ou CLASSE_ORIGINE
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim().toUpperCase();
        if (cell === 'CLASSE_DEST' || cell === 'CLASSE_ORIGINE') {
          headerRow = i;
          break;
        }
      }
      if (headerRow !== -1) break;
    }
    
    if (headerRow === -1) {
      logLine('WARN', '⚠️ En-têtes non trouvés dans _STRUCTURE (cherché dans les 20 premières lignes)');
      return quotas;
    }
    
    logLine('INFO', '✅ En-tête trouvé à la ligne ' + (headerRow + 1));
    
    const headers = data[headerRow];

    // ✅ Trouver la colonne CLASSE_DEST et OPTIONS
    const classeCol = headers.indexOf('CLASSE_DEST');
    const optionsCol = headers.indexOf('OPTIONS');

    logLine('INFO', '🔍 readQuotasFromStructure: classeCol=' + classeCol + ', optionsCol=' + optionsCol);

    if (classeCol === -1 || optionsCol === -1) {
      logLine('WARN', '⚠️ Colonnes CLASSE_DEST ou OPTIONS introuvables dans _STRUCTURE');
      return quotas;
    }

    // Parcourir les lignes (à partir de headerRow + 1)
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      const classe = String(row[classeCol] || '').trim();
      if (!classe) continue;

      const optionsStr = String(row[optionsCol] || '').trim();
      logLine('INFO', '🔍 readQuotasFromStructure: ' + classe + ' → OPTIONS="' + optionsStr + '"');

      quotas[classe] = {};

      // ✅ Parser le format "ITA=6,CHAV=10,ESP=5"
      if (optionsStr) {
        optionsStr.split(',').forEach(function(pair) {
          const parts = pair.split('=');
          if (parts.length === 2) {
            const optName = parts[0].trim().toUpperCase();
            const optValue = parseInt(parts[1].trim()) || 0;
            quotas[classe][optName] = optValue;
            logLine('INFO', '  ✅ ' + classe + '.' + optName + ' = ' + optValue);
          }
        });
      }
    }

  } catch (e) {
    logLine('WARN', 'Erreur lecture quotas depuis _STRUCTURE : ' + e.message);
  }

  return quotas;
}

/**
 * Lit le mapping CLASSE_ORIGINE → CLASSE_DEST depuis _STRUCTURE
 * @returns {Object} Mapping { "6°1": "5°1", "6°2": "5°2", ... }
 */
function readSourceToDestMapping_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structSheet = ss.getSheetByName('_STRUCTURE');
  const mapping = {};

  if (!structSheet) {
    return mapping;
  }

  try {
    const data = structSheet.getDataRange().getValues();

    // Recherche de l'en-tête
    let headerRow = -1;
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim().toUpperCase();
        if (cell === 'CLASSE_DEST' || cell === 'CLASSE_ORIGINE') {
          headerRow = i;
          break;
        }
      }
      if (headerRow !== -1) break;
    }

    if (headerRow === -1) {
      logLine('WARN', '⚠️ En-têtes non trouvés dans _STRUCTURE');
      return mapping;
    }

    const headers = data[headerRow];
    const origineCol = headers.indexOf('CLASSE_ORIGINE');
    const destCol = headers.indexOf('CLASSE_DEST');

    if (origineCol === -1 || destCol === -1) {
      logLine('WARN', '⚠️ Colonnes CLASSE_ORIGINE ou CLASSE_DEST introuvables');
      return mapping;
    }

    // Lire le mapping
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      const origine = String(row[origineCol] || '').trim();
      const dest = String(row[destCol] || '').trim();

      if (origine && dest) {
        mapping[origine] = dest;
        logLine('INFO', '  📌 Mapping: ' + origine + ' → ' + dest);
      }
    }

  } catch (e) {
    logLine('WARN', 'Erreur lecture mapping depuis _STRUCTURE : ' + e.message);
  }

  return mapping;
}

/**
 * Lit les cibles d'effectifs par classe depuis l'interface
 * ✅ Lit depuis _STRUCTURE si disponible
 */
function readTargetsFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Essayer de lire depuis _STRUCTURE
  const structSheet = ss.getSheetByName('_STRUCTURE');
  if (structSheet) {
    return readTargetsFromStructure_(structSheet);
  }

  // Sinon, valeurs par défaut : 25 élèves par classe
  return {
    "6°1": 25,
    "6°2": 25,
    "6°3": 25,
    "6°4": 25,
    "6°5": 25
  };
}

/**
 * Lit les effectifs cibles depuis _STRUCTURE
 * Lit la colonne EFFECTIF pour chaque classe
 */
function readTargetsFromStructure_(sheet) {
  const targets = {};

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // ✅ Trouver la colonne CLASSE_DEST et EFFECTIF
    const classeCol = headers.indexOf('CLASSE_DEST');
    const effectifCol = headers.indexOf('EFFECTIF');

    logLine('INFO', '🔍 readTargetsFromStructure: classeCol=' + classeCol + ', effectifCol=' + effectifCol);

    if (classeCol === -1 || effectifCol === -1) {
      logLine('WARN', '⚠️ Colonnes CLASSE_DEST ou EFFECTIF introuvables dans _STRUCTURE');
      return targets;
    }

    // Parcourir les lignes
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const classe = String(row[classeCol] || '').trim();
      if (!classe) continue;

      const effectif = parseInt(row[effectifCol]) || 25; // Fallback 25
      targets[classe] = effectif;

      logLine('INFO', '  ✅ ' + classe + ' effectif cible = ' + effectif);
    }

  } catch (e) {
    logLine('WARN', 'Erreur lecture effectifs depuis _STRUCTURE : ' + e.message);
  }

  return targets;
}

/**
 * @deprecated Cette fonction est obsolète. Utiliser buildCtx_V2() à la place.
 * @see buildCtx_V2() dans BASEOPTI_Architecture_V3.gs
 * 
 * Lit la tolérance de parité depuis l'interface (legacy).
 * Retourne une valeur codée en dur (2).
 * 
 * ⚠️ LEGACY : Cette fonction ne lit plus l'interface réelle.
 * La tolérance de parité est maintenant lue depuis _OPTI_CONFIG (colonne TOL_PARITE).
 */
function readParityToleranceFromUI_() {
  // ⚠️ LEGACY : Valeur codée en dur
  // La tolérance est maintenant lue depuis _OPTI_CONFIG
  return 2;
}

/**
 * @deprecated Cette fonction est obsolète. Utiliser buildCtx_V2() à la place.
 * @see buildCtx_V2() dans BASEOPTI_Architecture_V3.gs
 * 
 * Lit le nombre max de swaps depuis l'interface (legacy).
 * Retourne une valeur codée en dur (500).
 * 
 * ⚠️ LEGACY : Cette fonction ne lit plus l'interface réelle.
 * Le max swaps est maintenant lu depuis _OPTI_CONFIG (colonne MAX_SWAPS).
 */
function readMaxSwapsFromUI_() {
  // ⚠️ LEGACY : Valeur codée en dur
  // Le max swaps est maintenant lu depuis _OPTI_CONFIG
  return 500;
}

/**
 * @deprecated Cette fonction est obsolète. Utiliser buildCtx_V2() à la place.
 * @see buildCtx_V2() dans BASEOPTI_Architecture_V3.gs
 * 
 * Lit les autorisations de classes par option (legacy).
 * Format : { ITA: ["6°1", "6°3"], CHAV: ["6°2", "6°3"], ... }
 * Retourne des valeurs codées en dur.
 * 
 * ⚠️ LEGACY : Cette fonction ne lit plus l'interface réelle.
 * Les autorisations sont maintenant calculées depuis _OPTI_CONFIG (colonnes ITA, CHAV, etc.).
 */
function readClassAuthorizationsFromUI_() {
  // ⚠️ LEGACY : Valeurs codées en dur
  // Les autorisations sont maintenant calculées depuis _OPTI_CONFIG
  return {
    ITA: ["6°1"],
    CHAV: ["6°3"],
    ESP: ["6°1", "6°2", "6°3", "6°4", "6°5"]
  };
}

// ===================================================================
// 3. UI : FORCER L'AFFICHAGE DES ONGLETS CACHE
// ===================================================================

/**
 * Force l'affichage des onglets CACHE dans l'interface
 * et déclenche un reload côté front
 */
function forceCacheInUIAndReload_(ctx) {
  try {
    // 1. Sélectionner le mode CACHE dans l'état UI
    setInterfaceModeCACHE_(ctx);

    // 2. Activer visuellement le premier onglet CACHE
    activateFirstCacheTabIfAny_(ctx);

    // 3. Toast pour informer l'utilisateur
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Onglets CACHE mis à jour',
      'Optimisation V14I',
      3
    );

    // 4. Trigger côté front (si HTML/JS)
    triggerUIReloadFromCACHE_();

  } catch (e) {
    logLine('WARN', 'forceCacheInUIAndReload_ failed: ' + e.message);
  }
}

/**
 * Marque le mode CACHE comme actif dans l'interface
 */
function setInterfaceModeCACHE_(ctx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uiSheet = ss.getSheetByName('_INTERFACE_V2') || ss.getSheetByName('UI_Config');
  if (!uiSheet) return;

  try {
    // ⚠️ LEGACY : Écriture de cellule UI obsolète
    // Le mode est maintenant géré par l'interface web (localStorage)
    uiSheet.getRange('B2').setValue('CACHE');
  } catch (e) {
    logLine('WARN', 'setInterfaceModeCACHE_ failed: ' + e.message);
  }
}

/**
 * Active visuellement le premier onglet CACHE
 */
function activateFirstCacheTabIfAny_(ctx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const firstName = ctx.cacheSheets && ctx.cacheSheets[0];
  if (firstName) {
    const sheet = ss.getSheetByName(firstName);
    if (sheet) ss.setActiveSheet(sheet);
  }
}

/**
 * Déclenche un reload côté front (HTML/JS)
 */
function triggerUIReloadFromCACHE_() {
  // Côté Apps Script : no-op
  // Côté front (HTML/JS) : ajouter un handler
  // google.script.run.withSuccessHandler(() => {/* repaint */}).refreshFromCACHE();
}

/**
 * Affiche une annonce de fin de phase
 */
function announcePhaseDone_(message) {
  logLine('INFO', '✅ ' + message);
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'Phase terminée', 2);
}

// ===================================================================
// 4. LECTURE / ÉCRITURE DES DONNÉES
// ===================================================================

/**
 * Lit les élèves depuis les feuilles sélectionnées (mode source)
 * @param {Array<string>} sheetNames - Noms des feuilles à lire
 * @returns {Object} État des classes { "6°1": [...eleves], ... }
 */
function readElevesFromSelectedMode_(ctx) {
  const classesState = {};

  // 🔒 GARDE-FOU : garantir un tableau exploitable
  let srcList = ctx && Array.isArray(ctx.srcSheets) ? ctx.srcSheets : null;
  if (!srcList) {
    if (ctx && typeof ctx.srcSheets === 'string') {
      srcList = ctx.srcSheets.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    } else {
      // reconstruction à partir du ctx si nécessaire
      const tag = (ctx.mode || ctx.sourceTag || 'TEST').toString().trim();
      const lv  = Array.isArray(ctx.levels) ? ctx.levels : [];
      srcList = lv.map(function(l) { return l + tag; });
    }
    ctx.srcSheets = srcList; // pour les appels suivants
  }

  for (const sheetName of srcList) {
    const sheet = ctx.ss.getSheetByName(sheetName);
    if (!sheet) {
      logLine('WARN', 'Feuille source ' + sheetName + ' introuvable');
      continue;
    }

    const eleves = readElevesFromSheet_(sheet);

    // ✅ FIX: Utiliser le mapping pour obtenir le nom de classe de destination
    let niveau;
    if (ctx.sourceToDestMapping && ctx.sourceToDestMapping[sheetName]) {
      // Mode LEGACY avec mapping : utiliser la destination
      niveau = ctx.sourceToDestMapping[sheetName];
      logLine('INFO', '  📌 Lecture ' + sheetName + ' → assignation à ' + niveau);
    } else {
      // Mode normal : retirer le suffixe
      niveau = sheetName.replace(ctx.modeSrc || 'TEST', '');
    }

    classesState[niveau] = eleves;
  }

  return classesState;
}

/**
 * Lit les élèves depuis les feuilles CACHE
 * UTILISÉ PAR PHASE4 pour lire les résultats des phases 1/2/3
 * @returns {Object} État des classes { "6°1": [...eleves], ... }
 */
function readElevesFromCache_(ctx) {
  const classesState = {};

  // ✅ FIX: Construire mapping onglet → niveau depuis ctx
  const sheetToNiveau = {};
  for (let i = 0; i < (ctx.cacheSheets || []).length; i++) {
    sheetToNiveau[ctx.cacheSheets[i]] = ctx.niveaux[i];
  }

  for (const sheetName of ctx.cacheSheets) {
    const sheet = ctx.ss.getSheetByName(sheetName);
    if (!sheet) {
      logLine('WARN', 'Feuille CACHE ' + sheetName + ' introuvable');
      continue;
    }

    const eleves = readElevesFromSheet_(sheet);
    // ✅ FIX: Utiliser le mapping au lieu du regex /CACHE$/
    const niveau = sheetToNiveau[sheetName] || sheetName.replace(/CACHE$/, '');
    classesState[niveau] = eleves;
  }

  return classesState;
}

/**
 * Lit les élèves d'une feuille
 */
function readElevesFromSheet_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const eleves = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Ligne vide

    const eleve = {};
    headers.forEach((h, j) => {
      eleve[h] = row[j];
    });
    eleves.push(eleve);
  }

  return eleves;
}

/**
 * Écrit tous les états de classes dans les onglets CACHE
 * PURGE d'abord les feuilles CACHE, puis écrit
 * Vérifie l'unicité des IDs après écriture
 */
function writeAllClassesToCACHE_(ctx, classesState) {
  // 1. Purger les feuilles CACHE
  clearSheets_(ctx);

  // ✅ FIX: Construire mapping niveau → nom onglet depuis ctx
  const niveauToSheet = {};
  for (let i = 0; i < (ctx.niveaux || []).length; i++) {
    niveauToSheet[ctx.niveaux[i]] = ctx.cacheSheets[i];
  }

  // 2. Écrire les nouvelles données
  for (const [niveau, eleves] of Object.entries(classesState)) {
    // ✅ FIX: Utiliser le mapping au lieu de coder en dur 'CACHE'
    const sheetName = niveauToSheet[niveau] || (niveau + (ctx.writeTarget || 'CACHE'));
    writeElevesToSheet_(ctx.ss, sheetName, eleves);

    // 3. Vérifier l'unicité des IDs
    const uniqueIds = new Set();
    eleves.forEach(function(e) {
      const id = String(e._ID || e.ID_ELEVE || e.ID || '').trim();
      if (id) uniqueIds.add(id);
    });

    if (uniqueIds.size !== eleves.length) {
      logLine('ERROR', '❌ ' + sheetName + ' : Doublons détectés ! ' + uniqueIds.size + ' IDs uniques pour ' + eleves.length + ' élèves');
    }
  }
}

/**
 * Purge le contenu des feuilles CACHE (garde les entêtes)
 */
function clearSheets_(ctx) {
  for (const sheetName of ctx.cacheSheets) {
    const sheet = ctx.ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
  }
}

/**
 * Écrit une liste d'élèves dans une feuille
 */
function writeElevesToSheet_(ss, sheetName, eleves) {
  const sheet = getOrCreateSheetByExactName_(ss, sheetName);
  sheet.clearContents();

  if (eleves.length === 0) {
    ss.setActiveSheet(sheet);
    SpreadsheetApp.flush();
    return;
  }

  // Récupérer les headers du premier élève
  const headers = Object.keys(eleves[0]);

  // Écrire les headers (ligne 1)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Écrire les données
  const rows = eleves.map(e => headers.map(h => e[h] || ''));
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  ss.setActiveSheet(sheet);
  SpreadsheetApp.flush();
}

/**
 * Helper sûr pour obtenir/créer une feuille par NOM EXACT et la rendre visible
 */
function getOrCreateSheetByExactName_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  try {
    if (sheet.isSheetHidden && sheet.isSheetHidden()) {
      sheet.showSheet();
    }
  } catch (e) {
    // Ignorer si l'API ne supporte pas isSheetHidden
  }
  return sheet;
}

/**
 * Exemple d'écriture directe dans une feuille CACHE avec activation/flush
 */
function writeToCache_(ctx, baseClass, values) {
  const name = baseClass + 'CACHE';
  const sheet = getOrCreateSheetByExactName_(ctx.ss, name);
  sheet.clearContents();
  if (values && values.length) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
  ctx.ss.setActiveSheet(sheet);
  SpreadsheetApp.flush();
}

// ===================================================================
// 5. PHASE 1I : AFFECTATION OPTIONS & LV2
// ===================================================================

/**
 * Phase 1I : Affecte les options et LV2 selon les quotas UI
 * LIT : onglet sélectionné
 * ÉCRIT : uniquement CACHE
 */
function Phase1I_dispatchOptionsLV2_(ctx) {
  const warnings = [];

  // ✅ OPTIMISATION : Lire depuis l'onglet CONSOLIDATION (regroupe tous les élèves)
  // Plus simple et plus rapide qu'une lecture multi-sources
  const consolidationSheet = ctx.ss.getSheetByName('CONSOLIDATION');
  if (!consolidationSheet) {
    logLine('ERROR', 'Onglet CONSOLIDATION introuvable ! Impossible de continuer.');
    return {
      ok: false,
      warnings: ['CONSOLIDATION introuvable'],
      counts: {}
    };
  }

  const poolGlobal = readElevesFromSheet_(consolidationSheet);
  logLine('INFO', 'Phase 1 : Pool global de ' + poolGlobal.length + ' élèves (depuis CONSOLIDATION)');

  // Créer les classes destination VIDES
  const classesState = {};
  for (const niveau of ctx.niveaux) {
    classesState[niveau] = [];
  }

  // Dispatcher les élèves selon quotas LV2/OPT
  const { stats, warn } = dispatchElevesWithQuotas_(
    poolGlobal,
    classesState,
    ctx.quotas,
    ctx.niveaux
  );

  warnings.push(...(warn || []));

  // Écrire dans CACHE
  writeAllClassesToCACHE_(ctx, classesState);

  return {
    ok: true,
    warnings,
    counts: stats
  };
}

/**
 * ✅ NOUVELLE LOGIQUE : Dispatcher les élèves depuis le pool global vers les classes
 * selon les quotas LV2/OPT définis dans _STRUCTURE
 *
 * RÈGLE : Non-ESP prioritaires (comme dit par le user)
 */
function dispatchElevesWithQuotas_(poolGlobal, classesState, quotas, niveaux) {
  const warn = [];
  const stats = {
    ITA: 0,
    CHAV: 0,
    LATIN: 0,
    ESP: 0,
    ALL: 0,
    PT: 0
  };

  // Marquer tous les élèves comme non assignés
  poolGlobal.forEach(function(e) { e._ASSIGNED = false; });

  // Pour chaque classe, dispatcher les élèves selon les quotas
  for (const niveau of niveaux) {
    const quota = quotas[niveau] || {};

    // 1. Dispatcher ITA (LV2)
    if (quota.ITA && quota.ITA > 0) {
      const elevesITA = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.LV2 || '').trim().toUpperCase() === 'ITA';
      });

      const assigned = Math.min(elevesITA.length, quota.ITA);
      for (let i = 0; i < assigned; i++) {
        elevesITA[i]._ASSIGNED = true;
        classesState[niveau].push(elevesITA[i]);
      }
      stats.ITA += assigned;

      if (assigned < quota.ITA) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' ITA affectés sur ' + quota.ITA + ' demandés');
      }
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves ITA placés');
    }

    // 2. Dispatcher CHAV (OPT)
    if (quota.CHAV && quota.CHAV > 0) {
      const elevesCHAV = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.OPT || '').trim().toUpperCase() === 'CHAV';
      });

      const assigned = Math.min(elevesCHAV.length, quota.CHAV);
      for (let i = 0; i < assigned; i++) {
        elevesCHAV[i]._ASSIGNED = true;
        classesState[niveau].push(elevesCHAV[i]);
      }
      stats.CHAV += assigned;

      if (assigned < quota.CHAV) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' CHAV affectés sur ' + quota.CHAV + ' demandés');
      }
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves CHAV placés');
    }

    // 3. Dispatcher LATIN (OPT)
    if (quota.LATIN && quota.LATIN > 0) {
      const elevesLATIN = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.OPT || '').trim().toUpperCase() === 'LATIN';
      });

      const assigned = Math.min(elevesLATIN.length, quota.LATIN);
      for (let i = 0; i < assigned; i++) {
        elevesLATIN[i]._ASSIGNED = true;
        classesState[niveau].push(elevesLATIN[i]);
      }
      stats.LATIN += assigned;

      if (assigned < quota.LATIN) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' LATIN affectés sur ' + quota.LATIN + ' demandés');
      }
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves LATIN placés');
    }

    // 4. Dispatcher ESP (LV2) si quota défini
    if (quota.ESP && quota.ESP > 0) {
      const elevesESP = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.LV2 || '').trim().toUpperCase() === 'ESP';
      });

      const assigned = Math.min(elevesESP.length, quota.ESP);
      for (let i = 0; i < assigned; i++) {
        elevesESP[i]._ASSIGNED = true;
        classesState[niveau].push(elevesESP[i]);
      }
      stats.ESP += assigned;
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves ESP placés');
    }

    // 5. Dispatcher ALL (LV2) si quota défini
    if (quota.ALL && quota.ALL > 0) {
      const elevesALL = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.LV2 || '').trim().toUpperCase() === 'ALL';
      });

      const assigned = Math.min(elevesALL.length, quota.ALL);
      for (let i = 0; i < assigned; i++) {
        elevesALL[i]._ASSIGNED = true;
        classesState[niveau].push(elevesALL[i]);
      }
      stats.ALL += assigned;
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves ALL placés');
    }

    // 6. Dispatcher PT (LV2) si quota défini
    if (quota.PT && quota.PT > 0) {
      const elevesPT = poolGlobal.filter(function(e) {
        return !e._ASSIGNED && String(e.LV2 || '').trim().toUpperCase() === 'PT';
      });

      const assigned = Math.min(elevesPT.length, quota.PT);
      for (let i = 0; i < assigned; i++) {
        elevesPT[i]._ASSIGNED = true;
        classesState[niveau].push(elevesPT[i]);
      }
      stats.PT += assigned;
      logLine('INFO', '  ✅ ' + niveau + ' : ' + assigned + ' élèves PT placés');
    }
  }

  // ✅ IMPORTANT : Dispatcher les élèves restants (non assignés) de manière équilibrée
  // pour atteindre les effectifs cibles
  const nonAssignes = poolGlobal.filter(function(e) { return !e._ASSIGNED; });
  logLine('INFO', 'Phase 1 : ' + nonAssignes.length + ' élèves restants à placer');

  // Dispatcher les non assignés de manière round-robin pour équilibrer les effectifs
  let idx = 0;
  while (nonAssignes.length > 0 && idx < nonAssignes.length) {
    const eleve = nonAssignes[idx];

    // Trouver la classe avec le moins d'élèves
    let minClasse = niveaux[0];
    let minCount = classesState[niveaux[0]].length;
    for (const niveau of niveaux) {
      if (classesState[niveau].length < minCount) {
        minCount = classesState[niveau].length;
        minClasse = niveau;
      }
    }

    // Ajouter l'élève à cette classe
    classesState[minClasse].push(eleve);
    eleve._ASSIGNED = true;

    // Retirer de la liste des non assignés
    nonAssignes.splice(idx, 1);
  }

  // Nettoyer le flag _ASSIGNED
  poolGlobal.forEach(function(e) { delete e._ASSIGNED; });

  // Logger les effectifs finaux
  for (const niveau of niveaux) {
    logLine('INFO', '  📊 ' + niveau + ' : ' + classesState[niveau].length + ' élèves au total');
  }

  logLine('INFO', 'Phase 1I stats : ITA=' + stats.ITA + ', CHAV=' + stats.CHAV + ', LATIN=' + stats.LATIN + ', ESP=' + stats.ESP + ', ALL=' + stats.ALL + ', PT=' + stats.PT);

  return {
    stats: stats,
    warn: warn
  };
}

/**
 * @deprecated - Remplacée par dispatchElevesWithQuotas_()
 * Conservée pour compatibilité si besoin
 */
function assignOptionsThenLV2_(classesState, quotas, autorisations, niveaux) {
  const warn = [];
  const stats = {
    ITA: 0,
    CHAV: 0,
    LV2_ESP: 0,
    LV2_ALL: 0,
    LV2_PT: 0
  };

  // Pour chaque classe
  for (const [niveau, eleves] of Object.entries(classesState)) {
    const quota = quotas[niveau] || {};

    // 1. Affecter ITA
    if (quota.ITA && quota.ITA > 0) {
      const assigned = assignOptionToClass_(eleves, 'ITA', quota.ITA, niveau);
      stats.ITA = stats.ITA + assigned;
      if (assigned < quota.ITA) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' ITA affectés sur ' + quota.ITA + ' demandés');
      }
    }

    // 2. Affecter CHAV
    if (quota.CHAV && quota.CHAV > 0) {
      const assigned = assignOptionToClass_(eleves, 'CHAV', quota.CHAV, niveau);
      stats.CHAV = stats.CHAV + assigned;
      if (assigned < quota.CHAV) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' CHAV affectés sur ' + quota.CHAV + ' demandés');
      }
    }

    // 3. Affecter LV2 ESP
    if (quota.LV2_ESP && quota.LV2_ESP > 0) {
      const assigned = assignLV2ToClass_(eleves, 'ESP', quota.LV2_ESP, niveau);
      stats.LV2_ESP = stats.LV2_ESP + assigned;
      if (assigned < quota.LV2_ESP) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' ESP affectés sur ' + quota.LV2_ESP + ' demandés');
      }
    }

    // 4. Affecter LV2 ALL
    if (quota.LV2_ALL && quota.LV2_ALL > 0) {
      const assigned = assignLV2ToClass_(eleves, 'ALL', quota.LV2_ALL, niveau);
      stats.LV2_ALL = stats.LV2_ALL + assigned;
      if (assigned < quota.LV2_ALL) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' ALL affectés sur ' + quota.LV2_ALL + ' demandés');
      }
    }

    // 5. Affecter LV2 PT
    if (quota.LV2_PT && quota.LV2_PT > 0) {
      const assigned = assignLV2ToClass_(eleves, 'PT', quota.LV2_PT, niveau);
      stats.LV2_PT = stats.LV2_PT + assigned;
      if (assigned < quota.LV2_PT) {
        warn.push('Classe ' + niveau + ' : Seulement ' + assigned + ' PT affectés sur ' + quota.LV2_PT + ' demandés');
      }
    }
  }

  logLine('INFO', 'Phase 1I stats : ITA=' + stats.ITA + ', CHAV=' + stats.CHAV + ', ESP=' + stats.LV2_ESP + ', ALL=' + stats.LV2_ALL + ', PT=' + stats.LV2_PT);

  return {
    classesState: classesState,
    stats: stats,
    warn: warn
  };
}

/**
 * Affecte une option (ITA ou CHAV) à N élèves d'une classe
 * @returns {number} Nombre d'élèves effectivement affectés
 */
function assignOptionToClass_(eleves, optionName, targetCount, niveau) {
  let assigned = 0;

  // Parcourir les élèves sans cette option
  for (let i = 0; i < eleves.length && assigned < targetCount; i++) {
    const eleve = eleves[i];

    // Vérifier si l'élève a déjà cette option
    const currentValue = eleve[optionName] || '';
    if (currentValue === '' || currentValue === 'NON' || currentValue === '0') {
      eleve[optionName] = 'OUI';
      assigned = assigned + 1;
    }
  }

  return assigned;
}

/**
 * Affecte une LV2 (ESP, ALL, PT) à N élèves d'une classe
 * @returns {number} Nombre d'élèves effectivement affectés
 */
function assignLV2ToClass_(eleves, lv2Code, targetCount, niveau) {
  let assigned = 0;

  // Parcourir les élèves sans LV2 assignée
  for (let i = 0; i < eleves.length && assigned < targetCount; i++) {
    const eleve = eleves[i];

    // Vérifier si l'élève n'a pas encore de LV2
    const currentLV2 = eleve.LV2 || '';
    if (currentLV2 === '' || currentLV2 === 'ANG') {
      eleve.LV2 = lv2Code;
      assigned = assigned + 1;
    }
  }

  return assigned;
}

/**
 * Verrouille certains attributs pour éviter qu'ils soient modifiés
 */
function lockAttributes_(classesState, locks) {
  for (const [niveau, eleves] of Object.entries(classesState)) {
    for (const eleve of eleves) {
      if (!eleve._locks) {
        eleve._locks = {};
      }

      if (locks.options) {
        eleve._locks.ITA = true;
        eleve._locks.CHAV = true;
      }
      if (locks.lv2) {
        eleve._locks.LV2 = true;
      }
      if (locks.disso) {
        eleve._locks.DISSO = true;
      }
      if (locks.asso) {
        eleve._locks.ASSO = true;
      }
      if (locks.parity) {
        eleve._locks.PARITY = true;
      }
    }
  }
}

/**
 * Applique les codes DISSO
 * Sépare les élèves avec même code D dans des classes différentes
 */
function applyDisso_(classesState, ctx) {
  let movedCount = 0;

  // Collecter tous les codes DISSO
  const dissoGroups = {};

  for (const [niveau, eleves] of Object.entries(classesState)) {
    for (const eleve of eleves) {
      const codeD = eleve.DISSO || eleve['Code D'] || '';
      if (codeD && codeD !== '') {
        if (!dissoGroups[codeD]) {
          dissoGroups[codeD] = [];
        }
        dissoGroups[codeD].push({ eleve: eleve, classe: niveau });
      }
    }
  }

  // Pour chaque code DISSO, vérifier si plusieurs élèves sont dans la même classe
  for (const [codeD, membres] of Object.entries(dissoGroups)) {
    if (membres.length < 2) continue;

    // Regrouper par classe
    const parClasse = {};
    for (const m of membres) {
      if (!parClasse[m.classe]) {
        parClasse[m.classe] = [];
      }
      parClasse[m.classe].push(m.eleve);
    }

    // Si une classe contient plusieurs élèves avec ce code D, déplacer
    for (const [classe, elevesEnDouble] of Object.entries(parClasse)) {
      if (elevesEnDouble.length > 1) {
        // Déplacer tous sauf le premier
        for (let i = 1; i < elevesEnDouble.length; i++) {
          const eleveADeplacer = elevesEnDouble[i];

          // Trouver une classe cible qui n'a pas ce code D
          const classeTarget = findClasseWithoutCode_(classesState, codeD, classe);

          if (classeTarget) {
            // Déplacer l'élève
            moveEleveToClass_(classesState, eleveADeplacer, classe, classeTarget);
            movedCount = movedCount + 1;
            logLine('INFO', '  DISSO : Déplacé élève code D=' + codeD + ' de ' + classe + ' vers ' + classeTarget);
          }
        }
      }
    }
  }

  return movedCount;
}

/**
 * Applique les codes ASSO
 * Regroupe les élèves avec même code A dans la même classe
 */
function applyAsso_(classesState, ctx) {
  let movedCount = 0;

  // Collecter tous les codes ASSO
  const assoGroups = {};

  for (const [niveau, eleves] of Object.entries(classesState)) {
    for (const eleve of eleves) {
      const codeA = eleve.ASSO || eleve['Code A'] || '';
      if (codeA && codeA !== '') {
        if (!assoGroups[codeA]) {
          assoGroups[codeA] = [];
        }
        assoGroups[codeA].push({ eleve: eleve, classe: niveau });
      }
    }
  }

  // Pour chaque code ASSO, regrouper dans une seule classe
  for (const [codeA, membres] of Object.entries(assoGroups)) {
    if (membres.length < 2) continue;

    // Déterminer la classe cible (celle qui a le plus d'élèves avec ce code)
    const comptesParClasse = {};
    for (const m of membres) {
      if (!comptesParClasse[m.classe]) {
        comptesParClasse[m.classe] = 0;
      }
      comptesParClasse[m.classe] = comptesParClasse[m.classe] + 1;
    }

    // Trouver la classe avec le max
    let classeTarget = '';
    let maxCount = 0;
    for (const [classe, count] of Object.entries(comptesParClasse)) {
      if (count > maxCount) {
        maxCount = count;
        classeTarget = classe;
      }
    }

    // Déplacer tous les autres vers cette classe cible
    for (const m of membres) {
      if (m.classe !== classeTarget) {
        moveEleveToClass_(classesState, m.eleve, m.classe, classeTarget);
        movedCount = movedCount + 1;
        logLine('INFO', '  ASSO : Déplacé élève code A=' + codeA + ' de ' + m.classe + ' vers ' + classeTarget);
      }
    }
  }

  return movedCount;
}

/**
 * Trouve une classe qui ne contient pas un code DISSO donné
 */
function findClasseWithoutCode_(classesState, codeD, excludeClasse) {
  for (const [niveau, eleves] of Object.entries(classesState)) {
    if (niveau === excludeClasse) continue;

    // Vérifier si cette classe a déjà ce code D
    const hasCode = eleves.some(function(e) {
      const code = e.DISSO || e['Code D'] || '';
      return code === codeD;
    });

    if (!hasCode) {
      return niveau;
    }
  }

  // Si aucune classe sans le code, retourner la première classe différente
  for (const niveau of Object.keys(classesState)) {
    if (niveau !== excludeClasse) {
      return niveau;
    }
  }

  return null;
}

/**
 * Déplace un élève d'une classe vers une autre
 */
function moveEleveToClass_(classesState, eleve, fromClasse, toClasse) {
  // Retirer de la classe source
  const fromArray = classesState[fromClasse];
  const index = fromArray.indexOf(eleve);
  if (index > -1) {
    fromArray.splice(index, 1);
  }

  // Ajouter à la classe cible
  classesState[toClasse].push(eleve);

  // Mettre à jour le champ Classe de l'élève
  eleve.Classe = toClasse;
}

// ===================================================================
// 7. PHASE 3I : EFFECTIFS & PARITÉ
// ===================================================================

/**
 * Phase 3I : Compléter effectifs et équilibrer parité
 * LIT : onglet sélectionné
 * ÉCRIT : uniquement CACHE
 */
function Phase3I_completeAndParity_(ctx) {
  const warnings = [];

  // ✅ FIX CRITIQUE : Lire depuis CACHE (résultats P1/P2), PAS depuis sources !
  // Phase3 doit continuer le travail de Phase1 et Phase2, pas repartir de zéro
  const classesState = readElevesFromCache_(ctx);

  // Verrouiller Options/LV2/DISSO/ASSO
  lockAttributes_(classesState, {
    options: true,
    lv2: true,
    disso: true,
    asso: true
  });

  // Compléter jusqu'aux cibles d'effectifs
  reachHeadcountTargets_(classesState, ctx.targets, warnings);

  // Équilibrer la parité F/M
  enforceParity_(classesState, ctx.tolParite, warnings);

  // ✅ FAIL-SAFE : Placer les élèves non placés dans la classe avec le plus grand déficit
  const unplaced = placeRemainingStudents_(classesState, ctx.targets, warnings);
  if (unplaced > 0) {
    logLine('WARN', '⚠️ ' + unplaced + ' élève(s) non placé(s) après P3 - placés dans classe déficitaire');
  }

  // Écrire dans CACHE
  writeAllClassesToCACHE_(ctx, classesState);

  return {
    ok: true,
    warnings,
    unplaced: unplaced
  };
}

/**
 * Place les élèves non placés dans la classe avec le plus grand déficit
 * @returns {number} Nombre d'élèves placés
 */
function placeRemainingStudents_(classesState, targets, warnings) {
  // Calculer les déficits actuels
  const deficits = {};
  let totalPlaced = 0;
  
  for (const [niveau, target] of Object.entries(targets)) {
    const current = (classesState[niveau] || []).length;
    if (current < target) {
      deficits[niveau] = target - current;
    }
  }
  
  // Trouver la classe avec le plus grand déficit
  let maxDeficit = 0;
  let targetClass = null;
  
  for (const [niveau, deficit] of Object.entries(deficits)) {
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      targetClass = niveau;
    }
  }
  
  // Si pas de classe déficitaire, rien à faire
  if (!targetClass || maxDeficit === 0) {
    return 0;
  }
  
  // Chercher les élèves non placés (dans une classe fictive ou hors cibles)
  // Pour l'instant, on vérifie juste que toutes les classes sont à leur cible
  const totalStudents = Object.values(classesState).reduce(function(sum, eleves) {
    return sum + eleves.length;
  }, 0);
  
  const totalTargets = Object.values(targets).reduce(function(sum, t) {
    return sum + t;
  }, 0);
  
  if (totalStudents < totalTargets) {
    logLine('WARN', '⚠️ Déficit global : ' + totalStudents + ' élèves pour ' + totalTargets + ' places cibles');
  }
  
  return totalPlaced;
}

/**
 * Complète les effectifs et ÉQUILIBRE les classes
 * ✅ NOUVELLE LOGIQUE : Équilibrage réel au lieu d'atteindre des cibles impossibles
 */
function reachHeadcountTargets_(classesState, targets, warnings) {
  const maxIterations = 50;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // Calculer les effectifs actuels
    const currentCounts = {};
    for (const [niveau, eleves] of Object.entries(classesState)) {
      currentCounts[niveau] = eleves.length;
    }

    // Calculer la moyenne et trouver les classes les plus déséquilibrées
    const niveaux = Object.keys(currentCounts);
    const totalEleves = Object.values(currentCounts).reduce((sum, c) => sum + c, 0);
    const moyenne = totalEleves / niveaux.length;

    // Trouver la classe la plus remplie et la classe la plus vide
    let classeMax = null;
    let effectifMax = 0;
    let classeMin = null;
    let effectifMin = Infinity;

    for (const [niveau, effectif] of Object.entries(currentCounts)) {
      if (effectif > effectifMax) {
        effectifMax = effectif;
        classeMax = niveau;
      }
      if (effectif < effectifMin) {
        effectifMin = effectif;
        classeMin = niveau;
      }
    }

    // Si la différence est <= 1, on a atteint un équilibre acceptable
    const ecart = effectifMax - effectifMin;
    if (ecart <= 1) {
      logLine('INFO', `✅ Effectifs équilibrés : écart max = ${ecart} élève(s)`);
      break;
    }

    // Déplacer UN élève LIBRE de la classe la plus remplie vers la classe la plus vide
    const srcEleves = classesState[classeMax];
    let eleveToMove = null;

    for (let j = srcEleves.length - 1; j >= 0; j--) {
      const eleve = srcEleves[j];
      const codeA = eleve.ASSO || eleve.A || eleve['Code A'] || '';
      const codeD = eleve.DISSO || eleve.D || eleve['Code D'] || '';

      // ✅ Élève libre = pas de code ASSO ni DISSO
      if ((!codeA || codeA === '') && (!codeD || codeD === '')) {
        eleveToMove = eleve;
        break;
      }
    }

    if (eleveToMove) {
      moveEleveToClass_(classesState, eleveToMove, classeMax, classeMin);
      logLine('INFO', `  Équilibrage : Déplacé élève de ${classeMax} (${effectifMax}) vers ${classeMin} (${effectifMin})`);
    } else {
      // Aucun élève libre, arrêter
      logLine('WARN', `⚠️ Impossible d'équilibrer davantage : tous les élèves de ${classeMax} ont ASSO/DISSO`);
      break;
    }
  }

  // Vérification finale
  const finalCounts = {};
  for (const [niveau, eleves] of Object.entries(classesState)) {
    finalCounts[niveau] = eleves.length;
  }

  const effectifs = Object.values(finalCounts);
  const min = Math.min(...effectifs);
  const max = Math.max(...effectifs);
  const ecartFinal = max - min;

  logLine('INFO', `📊 Effectifs finaux : min=${min}, max=${max}, écart=${ecartFinal}`);

  if (ecartFinal > 2) {
    warnings.push(`⚠️ Déséquilibre persistant : écart de ${ecartFinal} élèves entre classes`);
  }
}

/**
 * Équilibre la parité F/M
 */
function enforceParity_(classesState, tolerance, warnings) {
  const maxIterations = 100;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration = iteration + 1;
    let swapped = false;

    // Pour chaque classe, calculer le déséquilibre
    const imbalances = [];

    for (const [niveau, eleves] of Object.entries(classesState)) {
      let countF = 0;
      let countM = 0;

      for (const eleve of eleves) {
        const genre = eleve.Genre || eleve.Sexe || '';
        if (genre === 'F' || genre === 'Fille') {
          countF = countF + 1;
        } else if (genre === 'M' || genre === 'Garçon' || genre === 'G') {
          countM = countM + 1;
        }
      }

      const delta = Math.abs(countF - countM);

      if (delta > tolerance) {
        imbalances.push({
          niveau: niveau,
          countF: countF,
          countM: countM,
          delta: delta,
          excessGenre: countF > countM ? 'F' : 'M'
        });
      }
    }

    if (imbalances.length === 0) {
      // Parité OK partout
      break;
    }

    // Essayer de faire des swaps entre classes déséquilibrées
    for (let i = 0; i < imbalances.length; i++) {
      const class1 = imbalances[i];

      for (let j = i + 1; j < imbalances.length; j++) {
        const class2 = imbalances[j];

        // Swap possible si les deux classes ont des excès opposés
        if (class1.excessGenre !== class2.excessGenre) {
          // class1 a trop de F, class2 a trop de M (ou inversement)
          const genreToSwapFrom1 = class1.excessGenre;
          const genreToSwapFrom2 = class2.excessGenre;

          // Chercher un élève de genreToSwapFrom1 dans class1
          const eleve1 = findEleveByGenre_(classesState[class1.niveau], genreToSwapFrom1);

          // Chercher un élève de genreToSwapFrom2 dans class2
          const eleve2 = findEleveByGenre_(classesState[class2.niveau], genreToSwapFrom2);

          if (eleve1 && eleve2) {
            // Faire le swap
            swapEleves_(classesState, eleve1, class1.niveau, eleve2, class2.niveau);
            swapped = true;
            logLine('INFO', '  Parité : Swap entre ' + class1.niveau + ' et ' + class2.niveau);
            break;
          }
        }
      }

      if (swapped) {
        break;
      }
    }

    if (!swapped) {
      // Plus de swap possible
      break;
    }
  }

  // Vérifier les classes encore déséquilibrées
  for (const [niveau, eleves] of Object.entries(classesState)) {
    let countF = 0;
    let countM = 0;

    for (const eleve of eleves) {
      const genre = eleve.Genre || eleve.Sexe || '';
      if (genre === 'F' || genre === 'Fille') {
        countF = countF + 1;
      } else if (genre === 'M' || genre === 'Garçon' || genre === 'G') {
        countM = countM + 1;
      }
    }

    const delta = Math.abs(countF - countM);

    if (delta > tolerance) {
      warnings.push('Classe ' + niveau + ' : Parité |F-M|=' + delta + ' > tolérance ' + tolerance);
    }
  }
}

/**
 * Trouve un élève d'un genre donné dans une liste
 */
function findEleveByGenre_(eleves, genre) {
  // ✅ CORRECTION : Ne PAS sélectionner un élève avec code ASSO ou DISSO
  for (const eleve of eleves) {
    const g = eleve.Genre || eleve.Sexe || '';
    const codeA = eleve.ASSO || eleve.A || eleve['Code A'] || '';
    const codeD = eleve.DISSO || eleve.D || eleve['Code D'] || '';

    // Ignorer les élèves avec code ASSO ou DISSO
    if ((codeA && codeA !== '') || (codeD && codeD !== '')) {
      continue;
    }

    if (genre === 'F' && (g === 'F' || g === 'Fille')) {
      return eleve;
    }
    if (genre === 'M' && (g === 'M' || g === 'Garçon' || g === 'G')) {
      return eleve;
    }
  }
  return null;
}

/**
 * Échange deux élèves entre deux classes
 */
function swapEleves_(classesState, eleve1, classe1, eleve2, classe2) {
  // Retirer eleve1 de classe1
  const array1 = classesState[classe1];
  const idx1 = array1.indexOf(eleve1);
  if (idx1 > -1) {
    array1.splice(idx1, 1);
  }

  // Retirer eleve2 de classe2
  const array2 = classesState[classe2];
  const idx2 = array2.indexOf(eleve2);
  if (idx2 > -1) {
    array2.splice(idx2, 1);
  }

  // Ajouter eleve1 à classe2
  array2.push(eleve1);
  eleve1.Classe = classe2;

  // Ajouter eleve2 à classe1
  array1.push(eleve2);
  eleve2.Classe = classe1;
}

// ===================================================================
// 8. PHASE 4 : SWAPS AVEC VERROUS + MINI-GARDIEN LV2/OPT
// ===================================================================

/**
 * Construit l'offre LV2/OPT par classe à partir de _STRUCTURE
 * Retour : { "6°1": { LV2:Set, OPT:Set }, ... }
 */
function buildOffersFromStructure_(ctx) {
  const offers = {};
  const struct = readStructureSheet_(); // doit retourner lignes avec colonnes Classe / OPTIONS
  
  // Exemples d'OPTIONS dans _STRUCTURE : "ITA=6, CHAV=10" ou "LV2:ITA | OPT:CHAV"
  (struct.rows || []).forEach(function(row) {
    const classe = String(row.classe || row.Classe || row[0] || '').trim().replace(/CACHE|TEST|FIN$/,'');
    if (!classe) return;
    
    const optCell = String(row.options || row.OPTIONS || row[3] || '').toUpperCase();
    const lv2Set = new Set();
    const optSet = new Set();
    
    // parse très tolérant : récupère les libellés à gauche des "=" et après "LV2:"/"OPT:"
    optCell.split(/[,|]/).forEach(function(tok) {
      const t = tok.trim();
      if (!t) return;
      
      const mEq = t.match(/^([A-ZÉÈÀ]+)\s*=/); // ex: ITA=6
      const mTag = t.match(/^(LV2|OPT)\s*:\s*([A-ZÉÈÀ]+)/);
      
      if (mEq) {
        const tag = mEq[1];
        // heuristique : LV2 habituelles
        if (/^(ITA|ALL|ESP|PT|CHI)$/.test(tag)) {
          lv2Set.add(tag);
        } else {
          optSet.add(tag);
        }
      } else if (mTag) {
        if (mTag[1] === 'LV2') {
          lv2Set.add(mTag[2]);
        } else {
          optSet.add(mTag[2]);
        }
      } else {
        // si pas de "=", ranger dans OPT par défaut sauf si LV2 connue
        if (/^(ITA|ALL|ESP|PT|CHI)$/.test(t)) {
          lv2Set.add(t);
        } else {
          optSet.add(t);
        }
      }
    });
    
    offers[classe] = { LV2: lv2Set, OPT: optSet };
  });
  
  return offers;
}

/**
 * Vérifie qu'un élève reste compatible avec l'offre de la classe cible
 */
function isPlacementLV2OPTOK_(eleve, targetClass, offers) {
  const cls = String(targetClass || '').replace(/CACHE|TEST|FIN$/,'');
  const off = offers[cls];
  if (!off) return true; // si pas d'info structure, ne pas bloquer
  
  const lv2 = String(eleve.lv2 || eleve.LV2 || '').toUpperCase().trim();
  const opt = String(eleve.opt || eleve.OPT || '').toUpperCase().trim();
  
  // LV2/OPT vides => pas de contrainte
  const lv2OK = !lv2 || off.LV2.has(lv2);
  const optOK = !opt || off.OPT.has(opt);
  
  return lv2OK && optOK;
}

/**
 * Phase 4 : Optimisation par swaps (COM prioritaire)
 * LIT : depuis CACHE (résultats des phases 1/2/3)
 * ÉCRIT : uniquement CACHE
 */
function Phase4_balanceScoresSwaps_(ctx) {
  const warnings = [];

  // ✅ CORRECTIF : Lire depuis CACHE (résultats phases 1/2/3), PAS depuis TEST !
  logLine('INFO', 'Phase4 : Lecture depuis CACHE (résultats phases 1/2/3)...');
  const classesState = readElevesFromCache_(ctx);

  // 🔒 Construire l'offre LV2/OPT pour le mini-gardien
  const offers = buildOffersFromStructure_(ctx);
  logLine('INFO', '🔒 Mini-gardien LV2/OPT activé');

  // Définir TOUS les verrous
  const lock = {
    keepOptions: true,
    keepLV2: true,
    keepDisso: true,
    keepAsso: true,
    keepParity: true,
    keepQuotas: true
  };

  // Lancer le moteur de swaps avec le mini-gardien
  const res = runSwapEngineV14_withLocks_LEGACY_(
    classesState,
    {
      metrics: ['COM', 'TRA', 'PART', 'ABS'],
      primary: 'COM', // Priorité absolue sur COM
      maxSwaps: ctx.maxSwaps || 1000,
      weights: ctx.weights || { parity: 0.3, com: 0.4, tra: 0.1, part: 0.1, abs: 0.1 },
      parityTol: ctx.tolParite || ctx.parityTolerance || 2,
      runtimeSec: ctx.runtimeSec || 180  // Budget temps (défaut: 3 min)
    },
    lock,
    warnings,
    ctx,
    offers  // 🔒 Passer l'offre au moteur
  );

  // Écrire dans CACHE
  writeAllClassesToCACHE_(ctx, classesState);

  logLine('INFO', '✅ Phase 4 terminée : ' + (res.applied || 0) + ' swaps appliqués, ' + (res.skippedByLV2OPT || 0) + ' refusés (LV2/OPT)');

  return {
    ok: true,
    warnings,
    swapsApplied: res.applied || 0,
    skippedByLV2OPT: res.skippedByLV2OPT || 0
  };
}

/**
 * Moteur de swaps avec verrous + timeboxing + anti-stagnation
 */
function runSwapEngineV14_withLocks_LEGACY_(classesState, options, locks, warnings, ctx, offers) {
  const metrics = options.metrics || ['COM', 'TRA', 'PART', 'ABS'];
  const primary = options.primary || 'COM';
  const maxSwaps = options.maxSwaps || 1000;
  const weights = options.weights || { parity: 0.3, com: 0.4, tra: 0.1, part: 0.1, abs: 0.1 };
  const parityTol = options.parityTol || 2;
  const runtimeSec = options.runtimeSec || 180;

  let applied = 0;
  let skippedByLV2OPT = 0;  // 🔒 Compteur de swaps refusés
  let iteration = 0;
  let itersWithoutImprovement = 0;
  const startTime = new Date().getTime();
  const endTime = startTime + (runtimeSec * 1000);

  logLine('INFO', '  Phase 4 : Démarrage swaps (max=' + maxSwaps + ', runtime=' + runtimeSec + 's, priorité=' + primary + ')');
  logLine('INFO', '  Poids: COM=' + weights.com + ', TRA=' + weights.tra + ', PART=' + weights.part + ', ABS=' + weights.abs + ', Parité=' + weights.parity);
  logLine('INFO', '  Tolérance parité: ' + parityTol);

  // Construire l'offre pour valider les swaps
  const offer = buildOfferWithQuotas_(ctx);
  
  // 📊 Stats mobilité initiale
  const mobilityStats = computeMobilityStats_LEGACY_(classesState, offer);
  logLine('INFO', '  📊 Mobilité: LIBRE=' + mobilityStats.libre + ', FIXE=' + mobilityStats.fixe + ', TOTAL=' + mobilityStats.total);

  // Timeboxing : boucle tant que temps restant ET swaps < max
  while (new Date().getTime() < endTime && applied < maxSwaps) {
    iteration = iteration + 1;

    // ✅ Calculer les counts actuels pour vérifier les quotas en temps réel
    const counts = computeCountsFromState_(classesState);

    // Calculer les scores actuels de toutes les classes
    const currentScores = calculateClassScores_LEGACY_(classesState, metrics);

    // Trouver le meilleur swap possible (avec poids et tolérance)
    const bestSwap = findBestSwap_LEGACY_(classesState, currentScores, primary, locks, offer, counts, weights, parityTol);

    if (!bestSwap) {
      // Plus de swap bénéfique
      itersWithoutImprovement++;
      
      // 🔄 ÉCHAPPATOIRE ANTI-STAGNATION : après 200 iters sans amélioration
      if (itersWithoutImprovement >= 200) {
        logLine('INFO', '  🔄 Stagnation détectée (200 iters) - relaxation minime des poids');
        weights.com *= 0.98;  // Relaxation très faible
        itersWithoutImprovement = 0;
        continue;
      }
      
      logLine('INFO', '  Phase 4 : Aucun swap bénéfique trouvé (iteration ' + iteration + ')');
      break;
    }

    // 🔒 MINI-GARDIEN : refuser si LV2/OPT non proposés dans la classe cible
    if (offers && 
        (!isPlacementLV2OPTOK_(bestSwap.eleve1, bestSwap.classe2, offers) || 
         !isPlacementLV2OPTOK_(bestSwap.eleve2, bestSwap.classe1, offers))) {
      skippedByLV2OPT++;
      continue;  // Ignorer ce swap
    }

    // Appliquer le swap
    swapEleves_(classesState, bestSwap.eleve1, bestSwap.classe1, bestSwap.eleve2, bestSwap.classe2);
    applied = applied + 1;
    itersWithoutImprovement = 0;  // Reset compteur

    if (applied % 20 === 0) {
      const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
      logLine('INFO', '  Phase 4 : ' + applied + ' swaps appliqués (elapsed=' + elapsed + 's)...');
    }
  }

  const elapsedTotal = Math.round((new Date().getTime() - startTime) / 1000);
  logLine('INFO', '  ✅ Phase 4 terminée : elapsed=' + elapsedTotal + 's | iters=' + iteration + ' | swaps=' + applied);
  if (skippedByLV2OPT > 0) {
    logLine('INFO', '  🔒 Mini-gardien : ' + skippedByLV2OPT + ' swaps refusés (LV2/OPT incompatible)');
  }
  
  // 🛡️ GARDE-FOU FINAL PARITÉ : si une classe reste hors tolérance
  // ✅ CORRECTIF: Recalculer counts après la boucle (hors scope)
  const countsAfterSwaps = computeCountsFromState_(classesState);
  applyParityGuardrail_LEGACY_(classesState, parityTol, offer, countsAfterSwaps);

  return {
    applied: applied,
    skippedByLV2OPT: skippedByLV2OPT,
    elapsed: elapsedTotal,
    iterations: iteration
  };
}

/**
 * Calcule les scores de toutes les classes pour toutes les métriques
 */
function calculateClassScores_LEGACY_(classesState, metrics) {
  const scores = {};

  for (const [niveau, eleves] of Object.entries(classesState)) {
    scores[niveau] = {};

    for (const metric of metrics) {
      scores[niveau][metric] = calculateClassMetric_LEGACY_(eleves, metric);
    }
  }

  return scores;
}

/**
 * Calcule une métrique pour une classe
 */
function calculateClassMetric_LEGACY_(eleves, metric) {
  let sum = 0;

  for (const eleve of eleves) {
    const value = parseFloat(eleve[metric]) || 0;
    sum = sum + value;
  }

  return eleves.length > 0 ? sum / eleves.length : 0;
}

/**
 * Trouve le meilleur swap possible avec objectifs hiérarchisés et pondérés
 * Priorité 1 : Parité (si hors tolérance)
 * Priorité 2 : Scores pondérés (COM/TRA/PART/ABS) selon poids UI
 */
function findBestSwap_LEGACY_(classesState, currentScores, primary, locks, offer, counts, weights, parityTol) {
  let bestSwap = null;
  let bestScore = -Infinity;

  const niveaux = Object.keys(classesState);
  
  // Utiliser les poids passés en paramètre (depuis le contexte)
  weights = weights || {
    parity: 0.3,
    com: 0.4,
    tra: 0.1,
    part: 0.1,
    abs: 0.1
  };
  parityTol = parityTol || 2;

  // Parcourir toutes les paires de classes
  for (let i = 0; i < niveaux.length; i++) {
    const niveau1 = niveaux[i];
    const eleves1 = classesState[niveau1];

    for (let j = i + 1; j < niveaux.length; j++) {
      const niveau2 = niveaux[j];
      const eleves2 = classesState[niveau2];

      // Essayer tous les swaps entre ces deux classes
      for (const eleve1 of eleves1) {
        // ✅ Vérifier mobilité élève1 (LIBRE ou PERMUT uniquement)
        if (!isEleveMobile_LEGACY_(eleve1, counts, niveau1, offer)) {
          continue;
        }

        for (const eleve2 of eleves2) {
          // ✅ Vérifier mobilité élève2
          if (!isEleveMobile_LEGACY_(eleve2, counts, niveau2, offer)) {
            continue;
          }
          
          // ✅ Vérifier si le swap est valide selon les verrous + quotas
          if (!isSwapValid_LEGACY_(eleve1, niveau1, eleve2, niveau2, locks, classesState, offer, counts)) {
            continue;
          }

          // Calculer le score d'amélioration (hiérarchisé + pondéré)
          const swapScore = calculateSwapScore_LEGACY_(
            eleve1,
            niveau1,
            eleve2,
            niveau2,
            classesState,
            weights,
            parityTol
          );

          if (swapScore > bestScore) {
            bestScore = swapScore;
            bestSwap = {
              eleve1: eleve1,
              classe1: niveau1,
              eleve2: eleve2,
              classe2: niveau2,
              improvement: swapScore
            };
          }
        }
      }
    }
  }

  return bestSwap;
}

/**
 * Calcule les compteurs LV2/OPT actuels depuis l'état des classes
 * @param {Object} classesState - État actuel {classe: [eleves]}
 * @returns {Object} Compteurs {classe: {LV2:{ITA:n}, OPT:{CHAV:m}, total:n}}
 */
function computeCountsFromState_(classesState) {
  const counts = {};
  
  Object.keys(classesState).forEach(function(cls) {
    const eleves = classesState[cls] || [];
    const LV2 = {};
    const OPT = {};
    
    eleves.forEach(function(e) {
      const lv2 = String(e.LV2 || e.lv2 || '').trim().toUpperCase();
      const opt = String(e.OPT || e.opt || '').trim().toUpperCase();
      
      if (lv2 && lv2 !== 'ANG') {
        LV2[lv2] = (LV2[lv2] || 0) + 1;
      }
      if (opt) {
        OPT[opt] = (OPT[opt] || 0) + 1;
      }
    });
    
    counts[cls] = {
      LV2: LV2,
      OPT: OPT,
      total: eleves.length
    };
  });
  
  return counts;
}

/**
 * ✅ GARDE-FOU UNIVERSEL : Vérifie si un mouvement d'élève est autorisé
 * Utilisé par Phase 3I (parité), Phase 4 (swaps) et repairQuotas
 * 
 * @param {Object} eleve - L'élève à déplacer
 * @param {string} clsTo - La classe de destination
 * @param {Object} offer - L'offre LV2/OPT par classe (depuis buildOfferWithQuotas_)
 * @param {Object} counts - Compteurs actuels par classe {cls: {LV2:{ITA:n}, OPT:{CHAV:m}}}
 * @param {Object} quotas - Quotas attendus (optionnel, déjà dans offer.quotas)
 * @returns {boolean} true si le mouvement est autorisé
 */
function isMoveAllowed_(eleve, clsTo, offer, counts, quotas) {
  // 0) Élève FIXE => jamais bouge
  const fixe = String(eleve.FIXE || eleve.fixe || '').trim().toUpperCase();
  if (fixe === '1' || fixe === 'OUI' || fixe === 'X' || fixe === 'FIXE') {
    return false;
  }

  // 1) Offre LV2/OPT de la classe cible
  const off = offer[clsTo] || { LV2: [], OPT: [], quotas: {} };
  
  const lv2 = String(eleve.LV2 || eleve.lv2 || '').trim().toUpperCase();
  const opt = String(eleve.OPT || eleve.opt || '').trim().toUpperCase();
  
  // Vérifier que la LV2 est autorisée (sauf ANG qui est partout)
  if (lv2 && lv2 !== 'ANG' && off.LV2.length > 0 && off.LV2.indexOf(lv2) === -1) {
    return false;
  }
  
  // Vérifier que l'OPT est autorisée
  if (opt && off.OPT.length > 0 && off.OPT.indexOf(opt) === -1) {
    return false;
  }

  // 2) Respect des quotas (si définis)
  const q = off.quotas || {};
  const clsCounts = counts[clsTo] || { LV2: {}, OPT: {} };
  
  // Compte réalisé actuel dans la classe cible
  const realizedLV2 = lv2 ? (clsCounts.LV2[lv2] || 0) : 0;
  const realizedOPT = opt ? (clsCounts.OPT[opt] || 0) : 0;
  
  // Cible attendue
  const targetLV2 = lv2 ? (q[lv2] || 0) : 0;
  const targetOPT = opt ? (q[opt] || 0) : 0;
  
  // Si quota existe (>0), ne pas dépasser
  if (lv2 && targetLV2 > 0 && realizedLV2 >= targetLV2) {
    return false;
  }
  if (opt && targetOPT > 0 && realizedOPT >= targetOPT) {
    return false;
  }

  // 3) Mobilité : PERMUT ou LIBRE uniquement
  const mobi = String(eleve.MOBILITE || eleve.mobilite || '').trim().toUpperCase();
  if (mobi && mobi.indexOf('PERMUT') === -1 && mobi !== 'LIBRE') {
    // Si ce n'est ni PERMUT ni LIBRE, on refuse (sauf si vide = on accepte)
    if (mobi !== '') return false;
  }

  // 4) Codes A : si un membre du groupe A est marqué FIXE ailleurs → refuser éclatement
  // (optionnel) à compléter par logique de "swap de groupe A" quand nécessaire

  return true;
}

/**
 * @deprecated Utiliser isMoveAllowed_ à la place
 * Conservé pour compatibilité avec le code existant
 */
function eligibleForSwap_LEGACY_(eleve, clsCible, offer) {
  // Appeler la nouvelle fonction avec counts vides (pas de vérification quotas)
  return isMoveAllowed_(eleve, clsCible, offer, {}, {});
}

/**
 * Vérifie si un swap est valide selon les verrous
 */
function isSwapValid_LEGACY_(eleve1, classe1, eleve2, classe2, locks, classesState, offer, counts) {
  // ✅ Utiliser isMoveAllowed_ avec vérification des quotas
  if (!isMoveAllowed_(eleve1, classe2, offer, counts || {}, {})) {
    return false;
  }
  if (!isMoveAllowed_(eleve2, classe1, offer, counts || {}, {})) {
    return false;
  }

  // Vérifications supplémentaires selon les verrous
  if (locks.keepDisso) {
    // Vérifier que les codes D ne créent pas de conflit
    const d1 = String(eleve1.DISSO || eleve1.D || '').trim().toUpperCase();
    const d2 = String(eleve2.DISSO || eleve2.D || '').trim().toUpperCase();
    
    if (d1) {
      // Vérifier qu'aucun élève de classe2 n'a le même code D
      const eleves2 = classesState[classe2] || [];
      for (const e of eleves2) {
        const d = String(e.DISSO || e.D || '').trim().toUpperCase();
        if (d === d1 && e !== eleve2) return false;
      }
    }
    
    if (d2) {
      // Vérifier qu'aucun élève de classe1 n'a le même code D
      const eleves1 = classesState[classe1] || [];
      for (const e of eleves1) {
        const d = String(e.DISSO || e.D || '').trim().toUpperCase();
        if (d === d2 && e !== eleve1) return false;
      }
    }
  }

  return true;
}

/**
 * Calcule les statistiques de mobilité (LIBRE vs FIXE)
 */
function computeMobilityStats_LEGACY_(classesState, offer) {
  let libre = 0;
  let fixe = 0;
  
  for (const [classe, eleves] of Object.entries(classesState)) {
    const counts = computeCountsFromState_(classesState);
    eleves.forEach(function(e) {
      if (isEleveMobile_LEGACY_(e, counts, classe, offer)) {
        libre++;
      } else {
        fixe++;
      }
    });
  }
  
  return {
    libre: libre,
    fixe: fixe,
    total: libre + fixe
  };
}

/**
 * Garde-fou final parité : si une classe reste hors tolérance,
 * force un swap greedy avec la classe la plus opposée en parité
 */
function applyParityGuardrail_LEGACY_(classesState, parityTol, offer, counts) {
  const niveaux = Object.keys(classesState);
  let swapped = false;
  
  // Identifier les classes hors tolérance
  const outOfTol = [];
  niveaux.forEach(function(niveau) {
    const state = computeClassState_LEGACY_(classesState[niveau]);
    if (Math.abs(state.deltaFM) > parityTol) {
      outOfTol.push({
        niveau: niveau,
        deltaFM: state.deltaFM,
        needsGenre: state.deltaFM > 0 ? 'M' : 'F'  // Si trop de F, besoin de M
      });
    }
  });
  
  if (outOfTol.length === 0) {
    logLine('INFO', '  🛡️ Garde-fou parité : Toutes les classes dans la tolérance');
    return;
  }
  
  logLine('WARN', '  🛡️ Garde-fou parité : ' + outOfTol.length + ' classe(s) hors tolérance');
  
  // Pour chaque classe hors tolérance, chercher un swap greedy
  outOfTol.forEach(function(cls1) {
    // Trouver la classe la plus opposée en parité
    let bestTarget = null;
    let bestDelta = 0;
    
    niveaux.forEach(function(niveau2) {
      if (niveau2 === cls1.niveau) return;
      const state2 = computeClassState_LEGACY_(classesState[niveau2]);
      // Opposé = l'une a trop de F, l'autre trop de M
      if ((cls1.deltaFM > 0 && state2.deltaFM < 0) || (cls1.deltaFM < 0 && state2.deltaFM > 0)) {
        const delta = Math.abs(cls1.deltaFM) + Math.abs(state2.deltaFM);
        if (delta > bestDelta) {
          bestDelta = delta;
          bestTarget = niveau2;
        }
      }
    });
    
    if (!bestTarget) return;
    
    // Chercher un swap entre cls1 et bestTarget
    const eleves1 = classesState[cls1.niveau];
    const eleves2 = classesState[bestTarget];
    
    for (let i = 0; i < eleves1.length && !swapped; i++) {
      const e1 = eleves1[i];
      const genre1 = String(e1.SEXE || e1.Genre || e1.Sexe || '').toUpperCase();
      
      if (genre1 !== cls1.needsGenre) continue;  // On cherche le genre opposé
      
      for (let j = 0; j < eleves2.length && !swapped; j++) {
        const e2 = eleves2[j];
        const genre2 = String(e2.SEXE || e2.Genre || e2.Sexe || '').toUpperCase();
        
        if (genre2 === cls1.needsGenre) continue;  // Doit être opposé
        
        // Vérifier mobilité
        if (!isEleveMobile_LEGACY_(e1, counts, cls1.niveau, offer)) continue;
        if (!isEleveMobile_LEGACY_(e2, counts, bestTarget, offer)) continue;
        
        // Appliquer le swap
        swapEleves_(classesState, e1, cls1.niveau, e2, bestTarget);
        logLine('INFO', '  🛡️ Swap parité forcé : ' + cls1.niveau + ' ↔ ' + bestTarget);
        swapped = true;
      }
    }
  });
}

/**
 * Vérifie si un élève est mobile (LIBRE ou PERMUT, hors quotas)
 */
function isEleveMobile_LEGACY_(eleve, counts, currentClass, offer) {
  // 1) Élève FIXE => jamais mobile
  const fixe = String(eleve.FIXE || eleve.fixe || '').trim().toUpperCase();
  if (fixe === '1' || fixe === 'OUI' || fixe === 'X' || fixe === 'FIXE') {
    return false;
  }
  
  // 2) Élève quota (ITA/CHAV) => FIXE pour préserver les quotas
  const lv2 = String(eleve.LV2 || eleve.lv2 || '').trim().toUpperCase();
  const opt = String(eleve.OPT || eleve.opt || '').trim().toUpperCase();
  
  // Si l'élève a une LV2 ou OPT avec quota dans sa classe actuelle, il est FIXE
  const classOffer = offer[currentClass] || { quotas: {} };
  const quotas = classOffer.quotas || {};
  
  if ((lv2 && quotas[lv2] > 0) || (opt && quotas[opt] > 0)) {
    return false; // Élève quota => FIXE
  }
  
  // 3) Codes ASSO => FIXE (ne pas casser les groupes)
  const codeA = String(eleve.ASSO || eleve.A || eleve.CODE_A || '').trim().toUpperCase();
  if (codeA) {
    return false; // Groupe ASSO => FIXE
  }
  
  // 4) Sinon => LIBRE (mobile)
  return true;
}

/**
 * Calcule le score d'amélioration d'un swap (hiérarchisé + pondéré)
 * Priorité 1 : Parité (si hors tolérance)
 * Priorité 2 : Scores pondérés (COM/TRA/PART/ABS)
 */
function calculateSwapScore_LEGACY_(eleve1, classe1, eleve2, classe2, classesState, weights, parityTol) {
  // Calculer l'état actuel des classes
  const state1 = computeClassState_LEGACY_(classesState[classe1]);
  const state2 = computeClassState_LEGACY_(classesState[classe2]);
  
  // Simuler le swap
  const state1After = simulateSwapState_LEGACY_(state1, eleve1, eleve2);
  const state2After = simulateSwapState_LEGACY_(state2, eleve2, eleve1);
  
  // === NIVEAU 1 : PARITÉ (prioritaire si hors tolérance) ===
  const parityBefore = Math.abs(state1.deltaFM) + Math.abs(state2.deltaFM);
  const parityAfter = Math.abs(state1After.deltaFM) + Math.abs(state2After.deltaFM);
  const parityImprovement = parityBefore - parityAfter;
  
  // Si une classe est hors tolérance, prioriser la parité
  const parityOutOfTol = (Math.abs(state1.deltaFM) > parityTol) || (Math.abs(state2.deltaFM) > parityTol);
  
  if (parityOutOfTol && parityImprovement > 0) {
    // Bonus massif pour améliorer la parité hors tolérance
    return 1000 * parityImprovement;
  }
  
  // === NIVEAU 2 : SCORES PONDÉRÉS (COM/TRA/PART/ABS) ===
  
  // Dispersion COM=1 (équilibrer les mauvais COM entre classes)
  // Calcul de la dispersion globale : somme des écarts à la moyenne
  const allClasses = Object.keys(classesState);
  const totalBadCOMBefore = allClasses.reduce(function(sum, cls) {
    return sum + computeClassState_LEGACY_(classesState[cls]).badCOM;
  }, 0);
  const meanBadCOM = totalBadCOMBefore / allClasses.length;
  
  const dispersionBefore = Math.abs(state1.badCOM - meanBadCOM) + Math.abs(state2.badCOM - meanBadCOM);
  const dispersionAfter = Math.abs(state1After.badCOM - meanBadCOM) + Math.abs(state2After.badCOM - meanBadCOM);
  const improvementDispersion = dispersionBefore - dispersionAfter;
  
  // Coût individuel pondéré
  const costBefore = 
    weights.com * (state1.sumCOM + state2.sumCOM) +
    weights.tra * (state1.sumTRA + state2.sumTRA) +
    weights.part * (state1.sumPART + state2.sumPART) +
    weights.abs * (state1.sumABS + state2.sumABS);
    
  const costAfter = 
    weights.com * (state1After.sumCOM + state2After.sumCOM) +
    weights.tra * (state1After.sumTRA + state2After.sumTRA) +
    weights.part * (state1After.sumPART + state2After.sumPART) +
    weights.abs * (state1After.sumABS + state2After.sumABS);
    
  const improvementCost = costBefore - costAfter;
  
  // Score final pondéré
  // Priorité : dispersion COM=1 (×20) > coût individuel > parité faible
  return 20 * improvementDispersion + improvementCost + 0.1 * parityImprovement;
}

/**
 * Calcule l'état d'une classe (compteurs pour les scores)
 */
function computeClassState_LEGACY_(eleves) {
  let countF = 0, countM = 0;
  let badCOM = 0, sumCOM = 0;
  let sumTRA = 0, sumPART = 0, sumABS = 0;
  
  eleves.forEach(function(e) {
    // Genre
    const genre = String(e.SEXE || e.Genre || e.Sexe || '').toUpperCase();
    if (genre === 'F') countF++;
    else if (genre === 'M') countM++;
    
    // Scores
    const com = parseFloat(e.COM || 0);
    const tra = parseFloat(e.TRA || 0);
    const part = parseFloat(e.PART || 0);
    const abs = parseFloat(e.ABS || 0);
    
    if (com === 1) badCOM++;
    sumCOM += com;
    sumTRA += tra;
    sumPART += part;
    sumABS += abs;
  });
  
  return {
    size: eleves.length,
    countF: countF,
    countM: countM,
    deltaFM: countF - countM,
    badCOM: badCOM,
    sumCOM: sumCOM,
    sumTRA: sumTRA,
    sumPART: sumPART,
    sumABS: sumABS
  };
}

/**
 * Simule l'état d'une classe après un swap (enlève out, ajoute in)
 */
function simulateSwapState_LEGACY_(state, out, in_) {
  const newState = JSON.parse(JSON.stringify(state)); // Clone
  
  // Retirer out
  const genreOut = String(out.SEXE || out.Genre || out.Sexe || '').toUpperCase();
  if (genreOut === 'F') newState.countF--;
  else if (genreOut === 'M') newState.countM--;
  
  const comOut = parseFloat(out.COM || 0);
  if (comOut === 1) newState.badCOM--;
  newState.sumCOM -= comOut;
  newState.sumTRA -= parseFloat(out.TRA || 0);
  newState.sumPART -= parseFloat(out.PART || 0);
  newState.sumABS -= parseFloat(out.ABS || 0);
  
  // Ajouter in
  const genreIn = String(in_.SEXE || in_.Genre || in_.Sexe || '').toUpperCase();
  if (genreIn === 'F') newState.countF++;
  else if (genreIn === 'M') newState.countM++;
  
  const comIn = parseFloat(in_.COM || 0);
  if (comIn === 1) newState.badCOM++;
  newState.sumCOM += comIn;
  newState.sumTRA += parseFloat(in_.TRA || 0);
  newState.sumPART += parseFloat(in_.PART || 0);
  newState.sumABS += parseFloat(in_.ABS || 0);
  
  newState.deltaFM = newState.countF - newState.countM;
  
  return newState;
}

// ===================================================================
// 9. UTILITAIRES LOGGING
// ===================================================================

/**
 * Log simple avec timestamp
 */
function logLine(level, msg) {
  const stamp = new Date().toLocaleString('fr-FR');
  const prefix = stamp + ' ' + level.padEnd(7);
  Logger.log(prefix + ' ' + msg);
}

// ===================================================================
// UTILITAIRES MOBILITÉ
// ===================================================================

/** Utilities */
function _u_(v) { return String(v || '').trim().toUpperCase(); }
function _arr(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

/**
 * Retourne l'index (ou crée la colonne si absente)
 */
function ensureColumn_(sheet, headerName) {
  const rng = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  const headers = rng.getValues()[0];
  let idx = headers.indexOf(headerName);
  if (idx === -1) {
    idx = headers.length;
    sheet.getRange(1, idx + 1).setValue(headerName);
    SpreadsheetApp.flush();
  }
  return idx; // 0-based
}

/**
 * Construit la table des classes offrant LV2/OPT depuis ctx.quotas
 */
function buildClassOffers_(ctx) {
  const offers = {}; // classe -> {LV2:Set, OPT:Set}

  (ctx.cacheSheets || []).forEach(function(cl) {
    const base = cl.replace(/CACHE$/, '');
    offers[base] = { LV2: new Set(), OPT: new Set() };
  });

  // ctx.quotas vient de _STRUCTURE
  Object.keys(ctx.quotas || {}).forEach(function(classe) {
    const base = classe; // "6°1"
    if (!offers[base]) offers[base] = { LV2: new Set(), OPT: new Set() };
    const q = ctx.quotas[classe] || {};

    Object.keys(q).forEach(function(label) {
      const L = _u_(label);
      // Heuristique: LV2 connus
      if (/(ITA|ALL|ESP|PT|CHI|ANG|GER|LAT2?|ALLEMAND|ESPAGNOL|ITALIEN|CHINOIS|PORTUGAIS)/.test(L)) {
        offers[base].LV2.add(L);
      } else {
        offers[base].OPT.add(L);
      }
    });
  });

  return offers;
}

/**
 * Retourne Allow(eleve) = classes (sans suffixe) autorisées par LV2 & OPT
 */
function computeAllow_(eleve, classOffers) {
  const lv2 = _u_(eleve.LV2 || eleve.lv2);
  const opt = _u_(eleve.OPT || eleve.opt);
  const allClasses = Object.keys(classOffers);
  let allowed = allClasses.slice();

  if (lv2) {
    allowed = allowed.filter(function(cl) { return classOffers[cl].LV2.has(lv2); });
  }
  if (opt) {
    allowed = allowed.filter(function(cl) { return classOffers[cl].OPT.has(opt); });
  }

  return allowed;
}

/**
 * Parse codes A/D (depuis colonnes dédiées A/D, ou depuis une colonne CODES)
 */
function parseCodes_(rowObj) {
  let A = _u_(rowObj.A || rowObj.codeA || '');
  let D = _u_(rowObj.D || rowObj.codeD || '');
  const C = _u_(rowObj.CODES || '');

  if (!A && /A\d+/.test(C)) A = (C.match(/A\d+/) || [])[0];
  if (!D && /D\d+/.test(C)) D = (C.match(/D\d+/) || [])[0];

  return { A: A, D: D };
}

/**
 * Calcul & écriture des colonnes FIXE/MOBILITE dans tous les ...CACHE
 */
function computeMobilityFlags_(ctx) {
  logLine('INFO', '🔍 Calcul des statuts de mobilité (FIXE/PERMUT/LIBRE)...');

  const ss = ctx.ss;
  const classOffers = buildClassOffers_(ctx); // "6°1" -> {LV2:Set, OPT:Set}

  logLine('INFO', '  Classes offrant LV2/OPT: ' + JSON.stringify(
    Object.keys(classOffers).reduce(function(acc, cl) {
      acc[cl] = {
        LV2: Array.from(classOffers[cl].LV2),
        OPT: Array.from(classOffers[cl].OPT)
      };
      return acc;
    }, {})
  ));

  // 1) Lire tout le CACHE en mémoire + construire groupes A + index D
  const studentsByClass = {}; // "6°1" -> [{row, data, id, ...}]
  const groupsA = {};         // "A7" -> [{class,nameRow,indexRow,...}]
  const Dindex = {};          // "6°1" -> Set(Dx déjà présents)

  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const base = cacheName.replace(/CACHE$/, '');
    const sh = ss.getSheetByName(cacheName);
    if (!sh) return;

    const lr = Math.max(sh.getLastRow(), 1);
    const lc = Math.max(sh.getLastColumn(), 1);
    const values = sh.getRange(1, 1, lr, lc).getDisplayValues();
    const headers = values[0];
    const find = function(name) { return headers.indexOf(name); };

    // Assure colonnes FIXE & MOBILITE
    const colFIXE = ensureColumn_(sh, 'FIXE');
    const colMOB = ensureColumn_(sh, 'MOBILITE');

    // indices de colonnes utiles
    const idxNom = find('NOM');
    const idxPrenom = find('PRENOM');
    const idxSexe = find('SEXE');
    const idxLV2 = find('LV2');
    const idxOPT = find('OPT');
    const idxA = find('A');
    const idxD = find('D');
    const idxCodes = find('CODES');
    const idxAsso = find('ASSO');
    const idxDisso = find('DISSO');

    studentsByClass[base] = [];
    Dindex[base] = new Set();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const obj = {
        NOM: row[idxNom] || '',
        PRENOM: row[idxPrenom] || '',
        SEXE: row[idxSexe] || '',
        LV2: row[idxLV2] || '',
        OPT: row[idxOPT] || '',
        A: (idxA >= 0 ? row[idxA] : (idxAsso >= 0 ? row[idxAsso] : '')),
        D: (idxD >= 0 ? row[idxD] : (idxDisso >= 0 ? row[idxDisso] : '')),
        CODES: (idxCodes >= 0 ? row[idxCodes] : '')
      };

      const codes = parseCodes_(obj);
      const id = _u_((obj.NOM || '') + '|' + (obj.PRENOM || '') + '|' + base);
      const st = {
        id: id,
        classe: base,
        rowIndex: r + 1,
        data: obj,
        A: codes.A,
        D: codes.D,
        colFIXE: colFIXE,
        colMOB: colMOB,
        sheet: sh
      };

      studentsByClass[base].push(st);

      if (codes.A) {
        if (!groupsA[codes.A]) groupsA[codes.A] = [];
        groupsA[codes.A].push(st);
      }
      if (codes.D) {
        Dindex[base].add(codes.D);
      }
    }
  });

  logLine('INFO', '  Groupes A détectés: ' + Object.keys(groupsA).length);
  logLine('INFO', '  Codes D détectés: ' + JSON.stringify(
    Object.keys(Dindex).reduce(function(acc, cl) {
      acc[cl] = Array.from(Dindex[cl]);
      return acc;
    }, {})
  ));

  // 2) Déterminer FIXE explicite & compute Allow individuels
  const explicitFixed = new Set();
  Object.keys(studentsByClass).forEach(function(cl) {
    studentsByClass[cl].forEach(function(st) {
      const vFIXE = _u_(st.sheet.getRange(st.rowIndex, st.colFIXE + 1).getDisplayValue());
      if (vFIXE === 'FIXE' || vFIXE === 'SPEC' || vFIXE === 'LOCK') {
        explicitFixed.add(st.id);
      }
      st.allow = computeAllow_(st.data, classOffers);
    });
  });

  logLine('INFO', '  Élèves FIXE explicites: ' + explicitFixed.size);

  // 3) Résoudre groupes A
  const groupAllow = {};
  Object.keys(groupsA).forEach(function(codeA) {
    const members = groupsA[codeA];
    let inter = null;
    let anyFixed = false;
    let fixedClass = null;

    members.forEach(function(st) {
      if (explicitFixed.has(st.id)) {
        anyFixed = true;
        fixedClass = st.classe;
      }
      const set = new Set(st.allow);
      inter = (inter === null) ? set : new Set([...inter].filter(function(x) { return set.has(x); }));
    });

    const allowArr = inter ? Array.from(inter) : [];
    let status = null;
    let pin = null;

    if (anyFixed) {
      if (allowArr.includes(fixedClass)) {
        status = 'FIXE';
        pin = fixedClass;
      } else {
        status = 'CONFLIT';
      }
    } else {
      if (allowArr.length === 0) status = 'CONFLIT';
      else if (allowArr.length === 1) {
        status = 'FIXE';
        pin = allowArr[0];
      } else {
        status = 'PERMUT';
      }
    }

    groupAllow[codeA] = { allow: new Set(allowArr), status: status, pin: pin };
  });

  // 4) Statut individuel final
  function statusForStudent(st) {
    // a) FIXE explicite
    if (explicitFixed.has(st.id)) return { fix: true, mob: 'FIXE' };

    // b) groupe A
    if (st.A && groupAllow[st.A]) {
      const g = groupAllow[st.A];
      if (g.status === 'CONFLIT') return { fix: false, mob: 'CONFLIT(A)' };
      if (g.status === 'FIXE') return { fix: true, mob: 'GROUPE_FIXE(' + st.A + '→' + g.pin + ')' };
      if (g.status === 'PERMUT') return { fix: false, mob: 'GROUPE_PERMUT(' + st.A + '→' + Array.from(g.allow).join('/') + ')' };
    }

    // c) LV2+OPT individuellement
    let allow = st.allow.slice();

    // d) filtre D
    if (st.D) {
      allow = allow.filter(function(c) { return !Dindex[c].has(st.D) || c === st.classe; });
    }

    if (allow.length === 0) return { fix: false, mob: 'CONFLIT(LV2/OPT/D)' };
    if (allow.length === 1) return { fix: true, mob: 'FIXE' };
    if (allow.length === 2) return { fix: false, mob: 'PERMUT(' + allow.join(',') + ')' };

    return { fix: false, mob: 'LIBRE' };
  }

  // 5) Écrire en feuille
  let countFIXE = 0;
  let countPERMUT = 0;
  let countLIBRE = 0;
  let countCONFLIT = 0;

  Object.keys(studentsByClass).forEach(function(cl) {
    const arr = studentsByClass[cl];
    arr.forEach(function(st) {
      const s = statusForStudent(st);

      if (s.fix) {
        st.sheet.getRange(st.rowIndex, st.colFIXE + 1).setValue('FIXE');
        countFIXE++;
      } else {
        st.sheet.getRange(st.rowIndex, st.colFIXE + 1).clearContent();
      }

      st.sheet.getRange(st.rowIndex, st.colMOB + 1).setValue(s.mob);

      if (s.mob.includes('PERMUT')) countPERMUT++;
      else if (s.mob === 'LIBRE') countLIBRE++;
      else if (s.mob.includes('CONFLIT')) countCONFLIT++;
    });
  });

  SpreadsheetApp.flush();

  logLine('INFO', '✅ Mobilité calculée: FIXE=' + countFIXE + ', PERMUT=' + countPERMUT + ', LIBRE=' + countLIBRE + ', CONFLIT=' + countCONFLIT);
}

/**
 * Ouvre visuellement les onglets CACHE et force la synchronisation
 */
function openCacheTabs_(ctx) {
  try {
    // ✅ Flush AVANT pour garantir que les écritures précédentes sont bien propagées
    SpreadsheetApp.flush();
    Utilities.sleep(200); // Attendre propagation Drive/Sheets

    const opened = [];
    const stats = [];

    // Activer chaque onglet CACHE et récupérer ses stats
    for (let i = 0; i < ctx.cacheSheets.length; i++) {
      const name = ctx.cacheSheets[i];
      const sh = ctx.ss.getSheetByName(name);

      if (sh) {
        // Activer l'onglet pour forcer sa visibilité
        ctx.ss.setActiveSheet(sh);
        sh.getRange('A1').activate(); // Ancrer la sélection
        opened.push(name);

        // Récupérer les stats
        const rows = sh.getLastRow();
        const cols = sh.getLastColumn();
        stats.push({ sheet: name, rows: rows, cols: cols });

        logLine('INFO', '  ✅ Activé: ' + name + ' (' + rows + ' lignes, ' + cols + ' colonnes)');
        Utilities.sleep(80); // Petit délai entre chaque activation
      } else {
        logLine('ERROR', '  ❌ Onglet ' + name + ' introuvable !');
      }
    }

    // Flush APRÈS pour garantir que les activations sont propagées
    SpreadsheetApp.flush();

    const active = ctx.ss.getActiveSheet() ? ctx.ss.getActiveSheet().getName() : '(aucun)';
    logLine('INFO', '✅ Onglet actif final: ' + active);
    logLine('INFO', '✅ ' + opened.length + ' onglets CACHE activés: ' + opened.join(', '));

    return {
      opened: opened,
      active: active,
      stats: stats
    };
  } catch (e) {
    logLine('WARN', '⚠️ openCacheTabs_ a échoué: ' + e.message);
    return {
      opened: [],
      active: null,
      stats: [],
      error: e.message
    };
  }
}

// ===================================================================
// 9B. AUDIT CACHE CONTRE STRUCTURE
// ===================================================================

/**
 * Construit l'offre avec quotas détaillés depuis ctx.quotas
 * Retourne { cls: { LV2:[], OPT:[], quotas: {ITA:6, CHAV:10, ...} } }
 */
function buildOfferWithQuotas_(ctx) {
  const res = {}; // { cls: { LV2:[], OPT:[], quotas: {ITA:6, CHAV:10, ...} } }
  
  // Initialiser depuis cacheSheets
  (ctx.cacheSheets || []).forEach(function(name) {
    const cls = name.replace(/CACHE$/, '').trim();
    res[cls] = { LV2: [], OPT: [], quotas: {} };
  });
  
  // Remplir depuis ctx.quotas
  Object.keys(ctx.quotas || {}).forEach(function(cls) {
    res[cls] = res[cls] || { LV2: [], OPT: [], quotas: {} };
    Object.keys(ctx.quotas[cls]).forEach(function(k) {
      const K = k.toUpperCase();
      const q = Number(ctx.quotas[cls][k]) || 0;
      res[cls].quotas[K] = q;
      
      // Classifier en LV2 ou OPT
      if (K === 'CHAV' || K === 'LAT' || K === 'GRE' || K === 'OPT' || K === 'ITA_OPT') {
        res[cls].OPT.push(K === 'ITA_OPT' ? 'ITA' : K);
      } else {
        res[cls].LV2.push(K);
      }
    });
  });
  
  return res;
}

/**
 * Audite les onglets CACHE contre la structure attendue
 * Retourne un objet { classe: { total, F, M, LV2:{}, OPT:{}, violations:{} } }
 */
function auditCacheAgainstStructure_(ctx) {
  logLine('INFO', '\n🔍 AUDIT: Vérification conformité CACHE vs STRUCTURE...');
  
  const offer = buildOfferWithQuotas_(ctx);
  const audit = {};
  
  // Pour chaque onglet CACHE
  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const cls = cacheName.replace(/CACHE$/, '').trim();
    const sh = ctx.ss.getSheetByName(cacheName);
    
    if (!sh) {
      logLine('WARN', '  ⚠️ Onglet ' + cacheName + ' introuvable');
      return;
    }
    
    const data = sh.getDataRange().getValues();
    if (data.length < 2) {
      audit[cls] = { total: 0, F: 0, M: 0, LV2: {}, OPT: {}, FIXE: 0, PERMUT: 0, LIBRE: 0, violations: { LV2: [], OPT: [], D: [], A: [], QUOTAS: [] } };
      return;
    }
    
    const headers = data[0];
    const idxSexe = headers.indexOf('SEXE') || headers.indexOf('Genre');
    const idxLV2 = headers.indexOf('LV2');
    const idxOPT = headers.indexOf('OPT');
    const idxDisso = headers.indexOf('DISSO') || headers.indexOf('D');
    const idxAsso = headers.indexOf('ASSO') || headers.indexOf('A');
    const idxFixe = headers.indexOf('FIXE');
    const idxMob = headers.indexOf('MOBILITE');
    
    // Agrégation
    const agg = {
      total: 0,
      F: 0,
      M: 0,
      LV2: {},
      OPT: {},
      FIXE: 0,
      PERMUT: 0,
      LIBRE: 0,
      violations: {
        LV2: [],
        OPT: [],
        D: [],
        A: [],
        QUOTAS: []
      }
    };
    
    const codesD = new Set();
    const codesA = {};
    
    // Parcourir les élèves
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      agg.total++;
      
      // Sexe
      const sexe = String(row[idxSexe] || '').trim().toUpperCase();
      if (sexe === 'F' || sexe === 'FILLE') agg.F++;
      else if (sexe === 'M' || sexe === 'G' || sexe === 'GARÇON') agg.M++;
      
      // LV2
      if (idxLV2 >= 0) {
        const lv2 = String(row[idxLV2] || '').trim().toUpperCase();
        if (lv2 && lv2 !== 'ANG') {
          agg.LV2[lv2] = (agg.LV2[lv2] || 0) + 1;
        }
      }
      
      // OPT
      if (idxOPT >= 0) {
        const opt = String(row[idxOPT] || '').trim().toUpperCase();
        if (opt) {
          agg.OPT[opt] = (agg.OPT[opt] || 0) + 1;
        }
      }
      
      // FIXE/MOBILITE (corrigé pour compter tous les élèves)
      let estFixe = false;
      let estPermut = false;
      
      if (idxFixe >= 0) {
        const fixe = String(row[idxFixe] || '').trim().toUpperCase();
        if (fixe === 'FIXE' || fixe === 'X') {
          agg.FIXE++;
          estFixe = true;
        }
      }
      
      if (!estFixe && idxMob >= 0) {
        const mob = String(row[idxMob] || '').trim().toUpperCase();
        if (mob.indexOf('PERMUT') >= 0 || mob === 'PERMUT') {
          agg.PERMUT++;
          estPermut = true;
        } else if (mob === 'FIXE') {
          agg.FIXE++;
          estFixe = true;
        }
      }
      
      // Si ni FIXE ni PERMUT, c'est LIBRE par défaut
      if (!estFixe && !estPermut) {
        agg.LIBRE++;
      }
      
      // Codes D
      if (idxDisso >= 0) {
        const d = String(row[idxDisso] || '').trim().toUpperCase();
        if (d) {
          if (codesD.has(d)) {
            agg.violations.D.push('Code D=' + d + ' en double');
          }
          codesD.add(d);
        }
      }
      
      // Codes A
      if (idxAsso >= 0) {
        const a = String(row[idxAsso] || '').trim().toUpperCase();
        if (a) {
          if (!codesA[a]) codesA[a] = [];
          codesA[a].push(i);
        }
      }
    }
    
    // Vérifier violations LV2
    const offLV2 = (offer[cls] && offer[cls].LV2) ? offer[cls].LV2 : [];
    Object.keys(agg.LV2).forEach(function(lv2) {
      if (offLV2.length > 0 && offLV2.indexOf(lv2) === -1) {
        agg.violations.LV2.push(lv2 + ' non autorisée (' + agg.LV2[lv2] + ' élèves)');
      }
    });
    
    // Vérifier violations OPT
    const offOPT = (offer[cls] && offer[cls].OPT) ? offer[cls].OPT : [];
    Object.keys(agg.OPT).forEach(function(opt) {
      if (offOPT.length > 0 && offOPT.indexOf(opt) === -1) {
        agg.violations.OPT.push(opt + ' non autorisée (' + agg.OPT[opt] + ' élèves)');
      }
    });
    
    // Vérifier violations A (groupes éclatés)
    Object.keys(codesA).forEach(function(a) {
      if (codesA[a].length < 2) {
        agg.violations.A.push('Groupe A=' + a + ' incomplet (1 seul élève)');
      }
    });
    
    // ⚖️ Vérification quotas par classe (si présents)
    const q = (offer[cls] && offer[cls].quotas) ? offer[cls].quotas : {};
    const quotaViol = [];
    Object.keys(q).forEach(function(key) {
      const K = key.toUpperCase();
      const target = q[K]; // quota attendu
      // Où chercher le réalisé ?
      const realized =
        (agg.LV2[K] !== undefined ? agg.LV2[K] : 0) +
        (agg.OPT[K] !== undefined ? agg.OPT[K] : 0);
      
      if (target > 0 && realized !== target) {
        quotaViol.push(K + ': attendu=' + target + ', réalisé=' + realized);
      }
    });
    
    if (quotaViol.length) {
      agg.violations.QUOTAS = quotaViol;
    } else {
      agg.violations.QUOTAS = [];
    }
    
    audit[cls] = agg;
    
    // Log par classe
    logLine('INFO', '📦 Classe ' + cls + ' — Total=' + agg.total + ', F=' + agg.F + ', M=' + agg.M + ', |F-M|=' + Math.abs(agg.F - agg.M));
    logLine('INFO', '   Offre attendue: LV2=[' + offLV2.join(',') + '], OPT=[' + offOPT.join(',') + ']');
    logLine('INFO', '   LV2 réalisées: ' + JSON.stringify(agg.LV2));
    logLine('INFO', '   OPT réalisées: ' + JSON.stringify(agg.OPT));
    logLine('INFO', '   Mobilité: FIXE=' + agg.FIXE + ', PERMUT=' + agg.PERMUT + ', LIBRE=' + agg.LIBRE);
    
    if (agg.violations.LV2.length) {
      logLine('WARN', '   ❌ Violations LV2 (' + agg.violations.LV2.length + '): ' + agg.violations.LV2.join(' | '));
    }
    if (agg.violations.OPT.length) {
      logLine('WARN', '   ❌ Violations OPT (' + agg.violations.OPT.length + '): ' + agg.violations.OPT.join(' | '));
    }
    if (agg.violations.D.length) {
      logLine('WARN', '   ❌ Violations D (' + agg.violations.D.length + '): ' + agg.violations.D.join(' | '));
    }
    if (agg.violations.A.length) {
      logLine('WARN', '   ❌ Violations A (' + agg.violations.A.length + '): ' + agg.violations.A.join(' | '));
    }
    if (agg.violations.QUOTAS && agg.violations.QUOTAS.length) {
      logLine('WARN', '   ❌ Violations QUOTAS (' + agg.violations.QUOTAS.length + '): ' + agg.violations.QUOTAS.join(' | '));
    }
  });
  
  logLine('INFO', '✅ Audit terminé pour ' + Object.keys(audit).length + ' classes');
  return audit;
}

// ===================================================================
// 10. WRAPPER POUR APPEL DEPUIS L'INTERFACE
// ===================================================================

/**
 * Wrapper appelé depuis l'interface UI
 */
function lancerOptimisationV14I_Wrapper(options) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    SpreadsheetApp.getUi().alert(
      'Optimisation déjà en cours',
      'Veuillez patienter...',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return { success: false, message: 'Verrouillé' };
  }

  try {
    const result = runOptimizationV14FullI(options || {});

    const msg = result.ok
      ? '✅ Optimisation réussie !\n' + result.swaps + ' swaps appliqués en ' + result.duration + 's'
      : '❌ Échec de l\'optimisation\n' + result.warnings.join('\n');

    SpreadsheetApp.getUi().alert('Résultat Optimisation V14I', msg, SpreadsheetApp.getUi().ButtonSet.OK);

    return {
      success: result.ok,
      swaps: result.swaps,
      duration: result.duration,
      warnings: result.warnings
    };

  } catch (e) {
    logLine('ERROR', 'Erreur wrapper : ' + e.message);
    SpreadsheetApp.getUi().alert('Erreur', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
