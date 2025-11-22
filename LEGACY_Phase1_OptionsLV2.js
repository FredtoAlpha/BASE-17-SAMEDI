/**
 * ===================================================================
 * 🎯 PRIME LEGACY - PHASE 1 : OPTIONS & LV2
 * ===================================================================
 *
 * Basé sur : OPTIMUM PRIME (Phase1I_dispatchOptionsLV2_BASEOPTI_V3)
 * Source : Phases_BASEOPTI_V3_COMPLETE.gs (JULES-VERNE-NAUTILUS)
 *
 * Phase 1 : Place les élèves avec OPT/LV2 selon quotas
 * LIT : Onglets sources (°1, °2, etc.)
 * ÉCRIT : Onglets TEST
 *
 * ISOLATION COMPLÈTE :
 * - OPTI : _BASEOPTI (vivier unique)
 * - LEGACY : Sources → TEST
 *
 * Date : 2025-11-13
 * Branche : claude/PRIME-LEGACY-01SJDcJv7zHGGBXWhHpzfnxr
 *
 * ===================================================================
 */

/**
 * Phase 1 LEGACY : Place les élèves avec OPT/LV2 selon quotas
 * LIT : Onglets sources (°1, °2, etc.)
 * ÉCRIT : Onglets TEST (colonne _CLASS_ASSIGNED)
 *
 * @param {Object} ctx - Contexte LEGACY
 * @returns {Object} { ok: true, counts: {...} }
 */
function Phase1I_dispatchOptionsLV2_LEGACY(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 1 LEGACY - Options & LV2 (OPTIMUM PRIME)');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const stats = {};

  // ========== ÉTAPE 1 : CONSOLIDER LES DONNÉES SOURCES ==========
  // Lire tous les onglets sources et les consolider en mémoire
  logLine('INFO', '📋 Lecture des onglets sources : ' + (ctx.srcSheets || []).join(', '));

  const allData = [];
  const headers = null;
  let headersRef = null;

  (ctx.srcSheets || []).forEach(function(srcName) {
    const srcSheet = ss.getSheetByName(srcName);
    if (!srcSheet || srcSheet.getLastRow() <= 1) {
      logLine('WARN', '⚠️ ' + srcName + ' vide ou introuvable, skip');
      return;
    }

    const data = srcSheet.getDataRange().getValues();
    const srcHeaders = data[0];

    // ✅ Utiliser les premiers en-têtes comme référence
    if (!headersRef) {
      headersRef = srcHeaders;
    }

    // ✅ Ajouter les élèves (lignes 2+)
    for (let i = 1; i < data.length; i++) {
      allData.push({
        source: srcName,
        row: data[i],
        headers: srcHeaders
      });
    }
  });

  if (allData.length === 0) {
    logLine('WARN', '⚠️ Aucun élève trouvé dans les onglets sources');
    return { ok: false, counts: stats };
  }

  logLine('INFO', '  ✅ ' + allData.length + ' élèves consolidés');

  // ========== ÉTAPE 2 : TROUVER LES INDEX DES COLONNES ==========
  const idxLV2 = headersRef.indexOf('LV2');
  const idxOPT = headersRef.indexOf('OPT');
  const idxAssigned = headersRef.indexOf('_CLASS_ASSIGNED');
  const idxNom = headersRef.indexOf('NOM');
  const idxPrenom = headersRef.indexOf('PRENOM');

  if (idxAssigned === -1) {
    logLine('ERROR', '❌ Colonne _CLASS_ASSIGNED manquante dans les onglets sources');
    throw new Error('Colonne _CLASS_ASSIGNED manquante');
  }

  logLine('INFO', '  📍 Colonnes : LV2=' + idxLV2 + ', OPT=' + idxOPT + ', _CLASS_ASSIGNED=' + idxAssigned);

  // ========== ÉTAPE 3 : RÉPARTITION PAR QUOTAS ==========
  // Parcourir les quotas par classe
  for (const classe in (ctx.quotas || {})) {
    const quotas = ctx.quotas[classe];

    for (const optName in quotas) {
      const quota = quotas[optName];
      if (quota <= 0) continue;

      let placed = 0;

      // Parcourir tous les élèves consolidés
      for (let i = 0; i < allData.length; i++) {
        if (placed >= quota) break;

        const item = allData[i];
        const row = item.row;
        const assigned = String(row[idxAssigned] || '').trim();

        if (assigned) continue; // Déjà placé

        const lv2 = String(row[idxLV2] || '').trim().toUpperCase();
        const opt = String(row[idxOPT] || '').trim().toUpperCase();

        let match = false;
        if (['ITA', 'ESP', 'ALL', 'PT'].indexOf(optName) >= 0) {
          match = (lv2 === optName);
        } else {
          match = (opt === optName);
        }

        if (match) {
          // ✅ PLACER SANS VÉRIFIER DISSO : LV2/OPT = RÈGLE ABSOLUE
          row[idxAssigned] = classe;
          placed++;
          stats[optName] = (stats[optName] || 0) + 1;

          const nom = String(row[idxNom] || '');
          const prenom = String(row[idxPrenom] || '');
          logLine('INFO', '    ✅ ' + nom + ' ' + prenom + ' → ' + classe + ' (' + optName + ')');
        }
      }

      if (placed > 0) {
        logLine('INFO', '  ✅ ' + classe + ' : ' + placed + ' × ' + optName + (placed < quota ? ' (⚠️ quota=' + quota + ')' : ''));
      }
    }
  }

  // ========== ÉTAPE 4 : ÉCRIRE DANS LES ONGLETS TEST ==========
  logLine('INFO', '📋 Écriture dans les onglets TEST...');

  // Grouper les élèves par classe de destination
  const byClass = {};
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    const row = item.row;
    const assigned = String(row[idxAssigned] || '').trim();

    if (assigned) {
      if (!byClass[assigned]) {
        byClass[assigned] = [];
      }
      byClass[assigned].push(row);
    }
  }

  // Écrire dans les onglets TEST correspondants
  for (const classe in byClass) {
    const testName = classe + ctx.writeTarget; // Ex: "5°1TEST"
    const testSheet = ss.getSheetByName(testName);

    if (!testSheet) {
      logLine('WARN', '⚠️ Onglet TEST ' + testName + ' introuvable, skip');
      continue;
    }

    const rows = byClass[classe];

    // Écrire les données (à partir de la ligne 2)
    if (rows.length > 0) {
      testSheet.getRange(2, 1, rows.length, headersRef.length).setValues(rows);
      logLine('INFO', '  ✅ ' + testName + ' : ' + rows.length + ' élèves écrits');
    }
  }

  SpreadsheetApp.flush();

  // ========== ÉTAPE 5 : CALCUL MOBILITÉ ==========
  // ✅ CALCUL MOBILITÉ : Déterminer FIXE/PERMUT/LIBRE après Phase 1
  if (typeof computeMobilityFlags_LEGACY === 'function') {
    computeMobilityFlags_LEGACY(ctx);
  } else {
    logLine('WARN', '⚠️ computeMobilityFlags_LEGACY() non disponible (vérifier que LEGACY_Mobility.gs est chargé)');
  }

  logLine('INFO', '✅ PHASE 1 LEGACY terminée');

  return { ok: true, counts: stats };
}
