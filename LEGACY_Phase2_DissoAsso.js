/**
 * ===================================================================
 * 🔗 PRIME LEGACY - PHASE 2 : ASSO/DISSO
 * ===================================================================
 *
 * Basé sur : OPTIMUM PRIME (Phase2I_applyDissoAsso_BASEOPTI_V3)
 * Source : Phases_BASEOPTI_V3_COMPLETE.gs (lignes 134-295)
 *
 * Phase 2 : Applique codes A (regrouper) et D (séparer)
 * LIT : Onglets TEST (tous les élèves)
 * ÉCRIT : Onglets TEST (update _CLASS_ASSIGNED)
 *
 * Date : 2025-11-13
 * Branche : claude/prime-legacy-cleanup-015Zz6D3gh1QcbpR19TUYMLw
 *
 * ===================================================================
 */

/**
 * Phase 2 LEGACY : Applique codes ASSO/DISSO
 * ✅ IMPLÉMENTATION COMPLÈTE basée sur OPTIMUM PRIME V3
 *
 * @param {Object} ctx - Contexte LEGACY
 * @returns {Object} { ok: true, asso: X, disso: Y }
 */
function Phase2I_applyDissoAsso_LEGACY(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 2 LEGACY - ASSO/DISSO (OPTIMUM PRIME)');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();

  // ========== ÉTAPE 1 : CONSOLIDER DONNÉES DE TOUS LES ONGLETS TEST ==========
  logLine('INFO', '📋 Consolidation des onglets TEST : ' + (ctx.cacheSheets || []).join(', '));

  const allData = [];
  let headersRef = null;

  (ctx.cacheSheets || []).forEach(function(testName) {
    const testSheet = ss.getSheetByName(testName);
    if (!testSheet || testSheet.getLastRow() <= 1) {
      logLine('WARN', '⚠️ ' + testName + ' vide ou introuvable, skip');
      return;
    }

    const data = testSheet.getDataRange().getValues();
    const headers = data[0];

    if (!headersRef) {
      headersRef = headers;
    }

    // Ajouter les élèves avec métadonnées
    for (let i = 1; i < data.length; i++) {
      allData.push({
        sheetName: testName,
        rowIndex: i,
        row: data[i],
        headers: headers
      });
    }
  });

  if (allData.length === 0) {
    logLine('WARN', '⚠️ Aucun élève trouvé dans les onglets TEST');
    return { ok: false, asso: 0, disso: 0 };
  }

  logLine('INFO', '  ✅ ' + allData.length + ' élèves consolidés');

  // ========== ÉTAPE 2 : TROUVER INDEX DES COLONNES ==========
  const idxA = headersRef.indexOf('ASSO');
  const idxD = headersRef.indexOf('DISSO');
  const idxAssigned = headersRef.indexOf('_CLASS_ASSIGNED');
  const idxNom = headersRef.indexOf('NOM');
  const idxPrenom = headersRef.indexOf('PRENOM');

  if (idxAssigned === -1) {
    throw new Error('Colonne _CLASS_ASSIGNED manquante');
  }

  let assoMoved = 0;
  let dissoMoved = 0;

  // ========== ÉTAPE 3 : CODES ASSO (A) ==========
  const groupsA = {};
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    const codeA = String(item.row[idxA] || '').trim().toUpperCase();
    if (codeA) {
      if (!groupsA[codeA]) groupsA[codeA] = [];
      groupsA[codeA].push(i);
    }
  }

  logLine('INFO', '🔗 Groupes ASSO : ' + Object.keys(groupsA).length);

  for (const code in groupsA) {
    const indices = groupsA[code];
    if (indices.length <= 1) {
      logLine('INFO', '  ⏭️ A=' + code + ' : 1 seul élève');
      continue;
    }

    logLine('INFO', '  🔗 A=' + code + ' : ' + indices.length + ' élèves');

    // Trouver classe majoritaire
    const classCounts = {};
    indices.forEach(function(i) {
      const cls = String(allData[i].row[idxAssigned] || '').trim();
      if (cls) {
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      }
    });

    let targetClass = null;
    let maxCount = 0;
    for (const cls in classCounts) {
      if (classCounts[cls] > maxCount) {
        maxCount = classCounts[cls];
        targetClass = cls;
      }
    }

    // Si aucun placé, choisir classe la moins remplie
    if (!targetClass) {
      targetClass = findLeastPopulatedClass_LEGACY(allData, headersRef, ctx);
    }

    logLine('INFO', '    🎯 Cible : ' + targetClass);

    // Déplacer tous vers la cible
    indices.forEach(function(i) {
      const item = allData[i];
      const currentClass = String(item.row[idxAssigned] || '').trim();
      if (currentClass !== targetClass) {
        item.row[idxAssigned] = targetClass;
        assoMoved++;

        const nom = String(item.row[idxNom] || '');
        const prenom = String(item.row[idxPrenom] || '');
        logLine('INFO', '      ✅ ' + nom + ' ' + prenom + ' : ' + currentClass + ' → ' + targetClass);
      }
    });
  }

  // ========== ÉTAPE 4 : CODES DISSO (D) ==========
  const groupsD = {};
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    const codeD = String(item.row[idxD] || '').trim().toUpperCase();
    if (codeD) {
      if (!groupsD[codeD]) groupsD[codeD] = [];
      groupsD[codeD].push(i);
      dissoMoved++;
    }
  }

  logLine('INFO', '🚫 Groupes DISSO : ' + Object.keys(groupsD).length + ' (' + dissoMoved + ' élèves)');

  for (const code in groupsD) {
    const indices = groupsD[code];

    logLine('INFO', '  🚫 D=' + code + ' : ' + indices.length + ' élève(s) à vérifier');

    // Vérifier si plusieurs sont dans la même classe
    const byClass = {};
    indices.forEach(function(i) {
      const cls = String(allData[i].row[idxAssigned] || '').trim();
      if (cls) {
        if (!byClass[cls]) byClass[cls] = [];
        byClass[cls].push(i);
      }
    });

    // Pour chaque classe avec >1 élève D, déplacer
    for (const cls in byClass) {
      if (byClass[cls].length > 1) {
        logLine('INFO', '    ⚠️ ' + cls + ' contient ' + byClass[cls].length + ' D=' + code);

        // Garder le premier, déplacer les autres
        for (let j = 1; j < byClass[cls].length; j++) {
          const i = byClass[cls][j];
          const item = allData[i];

          // 🔒 Trouver classe sans ce code D
          const targetClass = findClassWithoutCodeD_LEGACY(allData, headersRef, code, groupsD[code], i, ctx);

          if (targetClass) {
            item.row[idxAssigned] = targetClass;

            const nom = String(item.row[idxNom] || '');
            const prenom = String(item.row[idxPrenom] || '');
            logLine('INFO', '      ✅ ' + nom + ' ' + prenom + ' : ' + cls + ' → ' + targetClass + ' (séparation D=' + code + ')');
          } else {
            const nom = String(item.row[idxNom] || '');
            logLine('WARN', '      ⚠️ ' + nom + ' reste en ' + cls + ' (contrainte LV2/OPT absolue)');
          }
        }
      }
    }
  }

  // ========== ÉTAPE 5 : RÉÉCRIRE DANS LES ONGLETS TEST ==========
  logLine('INFO', '📋 Réécriture dans les onglets TEST...');

  // Grouper par onglet
  const bySheet = {};
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    if (!bySheet[item.sheetName]) {
      bySheet[item.sheetName] = [];
    }
    bySheet[item.sheetName].push(item);
  }

  // Écrire chaque onglet
  for (const sheetName in bySheet) {
    const testSheet = ss.getSheetByName(sheetName);
    if (!testSheet) continue;

    const items = bySheet[sheetName];

    // Reconstruire le tableau complet (headers + rows)
    const allRows = [headersRef];
    items.forEach(function(item) {
      allRows.push(item.row);
    });

    // Écrire
    testSheet.getRange(1, 1, allRows.length, headersRef.length).setValues(allRows);
    logLine('INFO', '  ✅ ' + sheetName + ' : ' + items.length + ' élèves réécrits');
  }

  SpreadsheetApp.flush();

  logLine('INFO', '✅ PHASE 2 LEGACY terminée : ' + assoMoved + ' ASSO, ' + dissoMoved + ' DISSO');

  return { ok: true, asso: assoMoved, disso: dissoMoved };
}

// ===================================================================
// HELPERS LEGACY
// ===================================================================

function findLeastPopulatedClass_LEGACY(allData, headers, ctx) {
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

function findClassWithoutCodeD_LEGACY(allData, headers, codeD, indicesWithD, eleveIdx, ctx) {
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');

  const eleveLV2 = eleveIdx >= 0 ? String(allData[eleveIdx].row[idxLV2] || '').trim().toUpperCase() : '';
  const eleveOPT = eleveIdx >= 0 ? String(allData[eleveIdx].row[idxOPT] || '').trim().toUpperCase() : '';

  const classesWithD = new Set();
  indicesWithD.forEach(function(i) {
    const cls = String(allData[i].row[idxAssigned] || '').trim();
    if (cls) classesWithD.add(cls);
  });

  const allClasses = new Set();
  for (let i = 0; i < allData.length; i++) {
    const cls = String(allData[i].row[idxAssigned] || '').trim();
    if (cls) allClasses.add(cls);
  }

  if (eleveLV2 || eleveOPT) {
    for (const cls of Array.from(allClasses)) {
      if (classesWithD.has(cls)) continue;

      const quotas = (ctx && ctx.quotas && ctx.quotas[cls]) || {};

      let canPlace = false;
      if (eleveLV2 && ['ITA', 'ESP', 'ALL', 'PT'].indexOf(eleveLV2) >= 0) {
        canPlace = (quotas[eleveLV2] !== undefined && quotas[eleveLV2] > 0);
      } else if (eleveOPT) {
        canPlace = (quotas[eleveOPT] !== undefined && quotas[eleveOPT] > 0);
      }

      if (canPlace) {
        logLine('INFO', '        ✅ Classe ' + cls + ' compatible (propose ' + (eleveLV2 || eleveOPT) + ')');
        return cls;
      }
    }

    logLine('WARN', '        ⚠️ Aucune classe sans D=' + codeD + ' ne propose ' + (eleveLV2 || eleveOPT));
    return null;
  }

  for (const cls of Array.from(allClasses)) {
    if (!classesWithD.has(cls)) {
      return cls;
    }
  }

  return null;
}
