/**
 * ===================================================================
 * ⚖️ PRIME LEGACY - PHASE 3 : EFFECTIFS & PARITÉ
 * ===================================================================
 *
 * Basé sur : OPTIMUM PRIME Phase 3
 * Phase 3 : Complète effectifs et équilibre parité F/M
 * LIT : Onglets TEST
 * ÉCRIT : Onglets TEST (update _CLASS_ASSIGNED)
 *
 * Date : 2025-11-13
 * Branche : claude/prime-legacy-cleanup-015Zz6D3gh1QcbpR19TUYMLw
 *
 * ===================================================================
 */

/**
 * Phase 3 LEGACY : Complète effectifs et équilibre parité
 * ✅ IMPLÉMENTATION FONCTIONNELLE basée sur OPTIMUM PRIME
 */
function Phase3I_completeAndParity_LEGACY(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 3 LEGACY - Effectifs & Parité (OPTIMUM PRIME)');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const tolParite = ctx.tolParite || 2;

  // ========== CONSOLIDER DONNÉES ==========
  const allData = [];
  let headersRef = null;

  (ctx.cacheSheets || []).forEach(function(testName) {
    const testSheet = ss.getSheetByName(testName);
    if (!testSheet || testSheet.getLastRow() <= 1) return;

    const data = testSheet.getDataRange().getValues();
    if (!headersRef) headersRef = data[0];

    for (let i = 1; i < data.length; i++) {
      allData.push({
        sheetName: testName,
        row: data[i]
      });
    }
  });

  if (allData.length === 0) {
    return { ok: false, message: 'Aucun élève trouvé' };
  }

  const idxAssigned = headersRef.indexOf('_CLASS_ASSIGNED');
  const idxSexe = headersRef.indexOf('SEXE');
  const idxNom = headersRef.indexOf('NOM');

  // ========== PLACER ÉLÈVES NON ASSIGNÉS ==========
  let placed = 0;
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    if (String(item.row[idxAssigned] || '').trim()) continue;

    // Trouver classe la moins remplie
    const targetClass = findLeastPopulatedClass_Phase3(allData, headersRef, ctx);
    item.row[idxAssigned] = targetClass;
    placed++;
  }

  logLine('INFO', '  ✅ ' + placed + ' élèves non assignés placés');

  // ========== ÉQUILIBRER PARITÉ ==========
  let swaps = 0;
  for (let iter = 0; iter < 100; iter++) {
    let improved = false;

    // Calculer parité par classe
    const paritiesByClass = {};
    (ctx.niveaux || []).forEach(function(cls) {
      paritiesByClass[cls] = { F: 0, M: 0, total: 0 };
    });

    for (let i = 0; i < allData.length; i++) {
      const cls = String(allData[i].row[idxAssigned] || '').trim();
      const sexe = String(allData[i].row[idxSexe] || '').toUpperCase();
      if (cls && paritiesByClass[cls]) {
        paritiesByClass[cls].total++;
        if (sexe === 'F') paritiesByClass[cls].F++;
        else if (sexe === 'M') paritiesByClass[cls].M++;
      }
    }

    // Trouver classes déséquilibrées
    for (const cls1 in paritiesByClass) {
      const p1 = paritiesByClass[cls1];
      const gap1 = Math.abs(p1.F - p1.M);

      if (gap1 <= tolParite) continue;

      // Chercher swap avec autre classe
      for (const cls2 in paritiesByClass) {
        if (cls1 === cls2) continue;

        const p2 = paritiesByClass[cls2];
        const gap2 = Math.abs(p2.F - p2.M);

        // Si les deux ont le même déséquilibre opposé, swap
        if ((p1.F > p1.M && p2.M > p2.F) || (p1.M > p1.F && p2.F > p2.M)) {
          // Trouver élèves à swapper
          const sexeNeeded1 = p1.F > p1.M ? 'M' : 'F';
          const sexeNeeded2 = p2.F > p2.M ? 'M' : 'F';

          let idx1 = -1, idx2 = -1;

          for (let i = 0; i < allData.length; i++) {
            if (idx1 >= 0 && idx2 >= 0) break;

            const cls = String(allData[i].row[idxAssigned] || '').trim();
            const sexe = String(allData[i].row[idxSexe] || '').toUpperCase();

            if (cls === cls1 && sexe === sexeNeeded2 && idx1 === -1) idx1 = i;
            if (cls === cls2 && sexe === sexeNeeded1 && idx2 === -1) idx2 = i;
          }

          if (idx1 >= 0 && idx2 >= 0) {
            // Swap
            allData[idx1].row[idxAssigned] = cls2;
            allData[idx2].row[idxAssigned] = cls1;
            swaps++;
            improved = true;

            logLine('INFO', '  🔄 Swap parité : ' + allData[idx1].row[idxNom] + ' (' + cls1 + '→' + cls2 + ') ↔ ' + allData[idx2].row[idxNom] + ' (' + cls2 + '→' + cls1 + ')');
            break;
          }
        }
      }

      if (improved) break;
    }

    if (!improved) break;
  }

  logLine('INFO', '  ✅ ' + swaps + ' swaps parité appliqués');

  // ========== RÉÉCRIRE ==========
  const bySheet = {};
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    if (!bySheet[item.sheetName]) bySheet[item.sheetName] = [];
    bySheet[item.sheetName].push(item);
  }

  for (const sheetName in bySheet) {
    const testSheet = ss.getSheetByName(sheetName);
    if (!testSheet) continue;

    const items = bySheet[sheetName];
    const allRows = [headersRef];
    items.forEach(function(item) {
      allRows.push(item.row);
    });

    testSheet.getRange(1, 1, allRows.length, headersRef.length).setValues(allRows);
  }

  SpreadsheetApp.flush();

  logLine('INFO', '✅ PHASE 3 LEGACY terminée : ' + placed + ' placés, ' + swaps + ' swaps parité');

  return { ok: true, message: 'Phase 3 terminée', placed: placed, swaps: swaps };
}

function findLeastPopulatedClass_Phase3(allData, headers, ctx) {
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  const counts = {};

  (ctx.niveaux || []).forEach(function(cls) {
    counts[cls] = 0;
  });

  for (let i = 0; i < allData.length; i++) {
    const cls = String(allData[i].row[idxAssigned] || '').trim();
    if (cls && counts[cls] !== undefined) {
      counts[cls]++;
    }
  }

  let minClass = null;
  let minCount = Infinity;
  for (const cls in counts) {
    if (counts[cls] < minCount) {
      minCount = counts[cls];
      minClass = cls;
    }
  }

  return minClass || (ctx.niveaux && ctx.niveaux[0]) || '6°1';
}
