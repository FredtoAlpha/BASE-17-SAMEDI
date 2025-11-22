/**
 * ===================================================================
 * 🚀 PRIME LEGACY - PIPELINE PRINCIPAL (GOOGLE APPS SCRIPT)
 * ===================================================================
 *
 * Backend Apps Script pour le pipeline LEGACY classique.
 * Utilise Phase4_Ultimate avec Asymmetric Weighting.
 *
 * ARCHITECTURE :
 * - LECTURE : Onglets sources (6°1, 5°2, etc.)
 * - TRAITEMENT : Phase4_Ultimate (moteur intelligent)
 * - ÉCRITURE : Onglets TEST et FIN
 *
 * ISOLATION COMPLÈTE :
 * - LEGACY : Sources → TEST → FIN
 * - OPTI : _BASEOPTI → _CACHE → FIN
 * - ZÉRO INTERFÉRENCE : Onglets différents, sécurisé
 *
 * Date: 19/11/2025
 * Moteur: Phase4_Ultimate.gs (Asymmetric Weighting)
 * ===================================================================
 */

// ===================================================================
// CONFIGURATION PIPELINE LEGACY
// ===================================================================

const LEGACY_PIPELINE_CONFIG = {
  maxRuntime: 600,        // 10 minutes max
  enableLogging: true,
  testSheetSuffix: 'TEST',
  finSheetSuffix: 'FIN',
  logLevel: 'INFO'
};

// ===================================================================
// 🚀 POINT D'ENTRÉE PRINCIPAL - APPEL DEPUIS MENU
// ===================================================================

/**
 * Lance le pipeline LEGACY complet
 *
 * APPELÉ PAR: Code.gs → Menu "🚀 PILOTAGE CLASSE"
 *
 * WORKFLOW:
 * 1. Détecter sources (6°1, 5°2, 4°3, etc.)
 * 2. Charger élèves avec profils (Têtes/Niv1)
 * 3. Lancer Phase 4 ULTIMATE
 * 4. Créer onglets TEST
 * 5. Créer onglets FIN (formatés)
 * 6. Afficher résumé
 *
 * @returns {Object} Résultat du pipeline
 */
function legacy_runFullPipeline_PRIME() {
  const ui = SpreadsheetApp.getUi();
  const startTime = new Date();

  logLine('INFO', '═'.repeat(80));
  logLine('INFO', '🚀 LANCEMENT PIPELINE LEGACY PRIME');
  logLine('INFO', '📦 Moteur: OPTIMUM PRIME ULTIMATE (Asymmetric Weighting)');
  logLine('INFO', '═'.repeat(80));

  try {
    // 1. VÉRIFICATION LOCK
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      logLine('WARN', '🔒 Pipeline verrouillé');
      ui.alert('⚠️ Une optimisation est déjà en cours. Veuillez patienter.');
      return { success: false, locked: true };
    }

    // 2. DÉTECTER CLASSES SOURCES
    const sourceSheets = detectSourceSheets();
    if (sourceSheets.length === 0) {
      logLine('ERROR', '❌ Aucun onglet source détecté (Format attendu: 6°1, 5°2...)');
      ui.alert('⚠️ Aucune classe source trouvée.\nFormat attendu: 6°1, 5°2, 4°3, etc.');
      return { success: false, error: 'No source sheets' };
    }
    logLine('INFO', `📋 Classes sources détectées: ${sourceSheets.join(', ')}`);

    // 3. CONSTRUIRE CONTEXTE
    const ctx = buildLegacyContext(sourceSheets);
    logLine('INFO', `✅ Contexte créé: ${ctx.allStudents.length} élèves`);

    // 4. CRÉER ONGLETS TEST
    createTestSheets(ctx);
    logLine('INFO', `✅ Onglets TEST créés: ${sourceSheets.length}`);

    // 5. LANCER PHASE 4 ULTIMATE
    logLine('INFO', '\n⚡ PHASE 4: Lancement moteur ULTIMATE...');
    const p4Result = Phase4_Ultimate_Run(ctx);

    if (!p4Result.ok) {
      logLine('ERROR', `❌ Erreur moteur: ${p4Result.message}`);
      ui.alert(`❌ Erreur optimisation: ${p4Result.message}`);
      return { success: false, error: p4Result.message };
    }
    logLine('SUCCESS', `✅ Swaps appliqués: ${p4Result.swapsApplied}`);

    // 6. CRÉER ONGLETS FIN
    logLine('INFO', '\n💾 Finalisation...');
    const finResult = finalizeAllSheets(ctx);
    logLine('SUCCESS', `✅ Onglets FIN créés: ${finResult.count}`);

    // 7. RÉSUMÉ
    const runtime = (new Date() - startTime) / 1000;
    logLine('SUCCESS', `\n✅ PIPELINE LEGACY TERMINÉ (${runtime.toFixed(1)}s)`);
    logLine('INFO', '═'.repeat(80));

    /*
    ui.alert(
      `✅ RÉPARTITION TERMINÉE\n\n` +
      `• Élèves: ${ctx.allStudents.length}\n` +
      `• Classes: ${sourceSheets.length}\n` +
      `• Optimisations: ${p4Result.swapsApplied}\n` +
      `• Durée: ${runtime.toFixed(1)}s\n\n` +
      `Onglets FIN prêts à utiliser !`
    );
    */

    return {
      success: true,
      students: ctx.allStudents.length,
      classes: sourceSheets.length,
      swaps: p4Result.swapsApplied,
      runtime: runtime,
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    logLine('ERROR', `❌ Erreur pipeline: ${e.toString()}`);
    ui.alert(`❌ Erreur: ${e.toString()}`);
    return { success: false, error: e.toString() };
  }
}

// ===================================================================
// UTILITAIRES LEGACY
// ===================================================================

/**
 * Détecte les onglets sources (format: 6°1, 5°2, ECOLE°1, etc.)
 */
function detectSourceSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(s => s.getName())
    .filter(name => /.+°\d+$/.test(name)) // ✅ Règle stricte °Chiffre
    .sort();
}

/**
 * Crée le contexte LEGACY
 */
function buildLegacyContext(sourceSheets) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ctx = {
    ss: ss,
    allStudents: [],
    byClass: {},
    cacheSheets: sourceSheets,
    timestamp: new Date().getTime()
  };

  // Charger les élèves
  const students = loadAllStudentsData(ctx);
  ctx.allStudents = students;

  // Grouper par classe source
  sourceSheets.forEach(className => {
    ctx.byClass[className] = [];
  });

  return ctx;
}

/**
 * Crée les onglets TEST (vides initialement)
 */
function createTestSheets(ctx) {
  const ss = ctx.ss;

  ctx.cacheSheets.forEach(sourceSheet => {
    const testName = sourceSheet + 'TEST';
    let testSheet = ss.getSheetByName(testName);

    if (!testSheet) {
      testSheet = ss.insertSheet(testName);
      logLine('INFO', `  ✅ Onglet créé: ${testName}`);
    } else {
      testSheet.clearContents();
      logLine('INFO', `  ♻️ Onglet réutilisé: ${testName}`);
    }
  });

  SpreadsheetApp.flush();
}

/**
 * Crée les onglets FIN définitifs avec formatage
 */
function finalizeAllSheets(ctx) {
  const results = finalizeClasses({}, 'finalize');

  return {
    ok: results.ok,
    count: results.results?.created?.length || 0,
    created: results.results?.created || []
  };
}

// logLine() defined in Phase4_Ultimate.gs (single global definition)

// ===================================================================
// ENTRÉES ALTERNATIVES (Menu + Console)
// ===================================================================

/**
 * Entrée depuis Console V3 (Phase 4 button)
 */
function ouvrirPipeline_FromConsole_V3(options) {
  logLine('INFO', '📋 Appel depuis Console V3');
  return legacy_runFullPipeline_PRIME();
}

// legacy_viewSourceClasses() moved to Code.gs (single entry point)

// ===================================================================
// TEST FUNCTION
// ===================================================================

/**
 * Test du pipeline (debug)
 */
function testLEGACY_Pipeline() {
  logLine('INFO', '🧪 TEST PIPELINE LEGACY...');
  const result = legacy_runFullPipeline_PRIME();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
