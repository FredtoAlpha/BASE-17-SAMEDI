/**
 * ===================================================================
 * 🚀 PIPELINE OPTI INDÉPENDANT - GOOGLE APPS SCRIPT BACKEND
 * ===================================================================
 *
 * Backend Apps Script qui gère le pipeline OPTI depuis InterfaceV2.
 * Utilise le moteur Phase4_Ultimate avec Asymmetric Weighting.
 *
 * ARCHITECTURE :
 * - Input: InterfaceV2.html (côté client)
 * - Processing: Phase4_Ultimate.gs (moteur optimisation)
 * - Output: Onglets TEST et FIN
 *
 * ISOLATION COMPLÈTE :
 * - OPTI : Lit depuis _OPTI_CONFIG / _BASEOPTI
 * - LEGACY : Lit depuis sources (°1, °2, etc.)
 * - ZÉRO INTERFÉRENCE : Onglets et contextes différents
 *
 * Date: 19/11/2025
 * Moteur: Phase4_Ultimate.gs (Asymmetric Weighting)
 * ===================================================================
 */

// ===================================================================
// CONFIGURATION
// ===================================================================

const OPTI_PIPELINE_CONFIG = {
  maxRuntime: 300,        // 5 minutes max
  enableAsyncMode: false, // Pas de mode async pour v1
  flushInterval: 100,     // Flush tous les 100 swaps
  logLevel: 'INFO'        // DEBUG, INFO, WARN, ERROR
};

// ===================================================================
// 🚀 POINT D'ENTRÉE PRINCIPAL - APPELÉ DEPUIS INTERFACEV2
// ===================================================================

/**
 * Lance le pipeline OPTI complet avec moteur ULTIMATE
 *
 * APPELÉ PAR: InterfaceV2_CoreScript.html
 *   google.script.run.runOptimizationOPTI(options)
 *
 * @param {Object} options - Options depuis l'UI
 *   - structure: {classname: {size, ITA, LATIN, ...}}
 *   - weights: {distrib, parity, profiles, friends}
 *   - maxSwaps: nombre max d'échanges
 * @returns {Object} Résultat complet
 */
function runOptimizationOPTI(options) {
  const startTime = new Date();
  logLine('INFO', '═'.repeat(80));
  logLine('INFO', '🚀 LANCEMENT PIPELINE OPTI INDÉPENDANT');
  logLine('INFO', '📦 Moteur: OPTIMUM PRIME ULTIMATE (Asymmetric Weighting)');
  logLine('INFO', '═'.repeat(80));

  try {
    // 1. VERROU POUR ÉVITER CONCURRENCE
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      logLine('WARN', '🔒 Pipeline verrouillé (optimisation en cours)');
      return {
        success: false,
        locked: true,
        error: 'Une optimisation est déjà en cours'
      };
    }

    // 2. CONSTRUIRE CONTEXTE
    const ctx = buildOptimizationContext_OPTI(options);
    logLine('INFO', `📋 Contexte OPTI créé: ${ctx.allStudents.length} élèves`);

    // 3. PRÉPARER LES DONNÉES (Init phase)
    const initResult = initPhase_OPTI(ctx);
    if (!initResult.ok) {
      return { success: false, error: 'Erreur phase init', initResult };
    }
    logLine('INFO', `✅ INIT: ${initResult.count} élèves chargés`);

    // 4. LANCER LE MOTEUR ULTIMATE
    logLine('INFO', '\n⚡ PHASE 4: Lancement moteur ULTIMATE...');
    const p4Result = Phase4_Ultimate_Run(ctx);

    if (!p4Result.ok) {
      logLine('ERROR', `❌ Moteur ULTIMATE échoué: ${p4Result.message}`);
      return { success: false, error: p4Result.message, p4Result };
    }
    logLine('SUCCESS', `✅ ULTIMATE: ${p4Result.swapsApplied} optimisations appliquées`);

    // 5. FINALISER (Créer onglets FIN)
    logLine('INFO', '\n💾 FINALISATION: Création onglets FIN...');
    const finalResult = finalizePhase_OPTI(ctx, options);

    if (!finalResult.ok) {
      logLine('WARN', `⚠️ Finalisation partielle: ${finalResult.message}`);
    } else {
      logLine('SUCCESS', `✅ FIN: ${finalResult.sheetsCreated} onglets créés`);
    }

    // 6. RÉSULTAT FINAL
    const runtime = (new Date() - startTime) / 1000;
    logLine('SUCCESS', `\n✅ PIPELINE OPTI TERMINÉ (${runtime.toFixed(1)}s)`);
    logLine('INFO', '═'.repeat(80));

    return {
      success: true,
      phase4: p4Result,
      finalize: finalResult,
      runtime: runtime,
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    logLine('ERROR', `❌ Erreur pipeline OPTI: ${e.toString()}`);
    return {
      success: false,
      error: e.toString(),
      stack: e.stack
    };
  }
}

// ===================================================================
// PHASE INIT - PRÉPARER LES DONNÉES
// ===================================================================

/**
 * Initialise le contexte et charge les élèves
 */
function buildOptimizationContext_OPTI(options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ctx = {
    ss: ss,
    options: options || {},
    allStudents: [],
    byClass: {},
    headers: null,
    timestamp: new Date().getTime(),

    // Configuration du moteur
    maxSwaps: options?.maxSwaps || 2000,
    weights: options?.weights || {
      distrib: 5.0,
      parity: 4.0,
      profiles: 10.0,
      friends: 1000.0
    }
  };

  return ctx;
}

/**
 * Phase d'initialisation
 */
function initPhase_OPTI(ctx) {
  try {
    // Charger les élèves depuis les onglets source
    const students = loadAllStudentsData(ctx);

    return {
      ok: true,
      count: students.length
    };
  } catch (e) {
    logLine('ERROR', `Erreur init: ${e.toString()}`);
    return { ok: false, error: e.toString() };
  }
}

/**
 * Phase de finalisation
 */
function finalizePhase_OPTI(ctx, options) {
  try {
    // Créer les onglets FIN avec formatage
    const finResult = finalizeClasses({}, 'finalize');

    return {
      ok: finResult.ok !== false,
      sheetsCreated: finResult.results?.created?.length || 0,
      message: finResult.error || 'OK'
    };
  } catch (e) {
    logLine('ERROR', `Erreur finalisation: ${e.toString()}`);
    return {
      ok: false,
      error: e.toString(),
      sheetsCreated: 0
    };
  }
}

// ===================================================================
// UTILITAIRES & LOGGING
// ===================================================================

// logLine() defined in Phase4_Ultimate.gs (single global definition)

/**
 * Lance le pipeline (wrapper pour menu)
 */
function legacy_runFullPipeline_OPTI() {
  const result = runOptimizationOPTI({});
  SpreadsheetApp.getUi().alert(
    result.success
      ? `✅ Optimisation terminée (${result.runtime?.toFixed(1)}s)`
      : `❌ Erreur: ${result.error}`
  );
  return result;
}

// ===================================================================
// TEST FUNCTIONS
// ===================================================================

/**
 * Test du pipeline (sans UI)
 */
function testOPTI_Pipeline() {
  logLine('INFO', '🧪 TEST PIPELINE OPTI...');
  const result = runOptimizationOPTI({
    maxSwaps: 500,
    weights: {
      distrib: 5.0,
      parity: 4.0,
      profiles: 10.0,
      friends: 1000.0
    }
  });
  Logger.log('RÉSULTAT:');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
