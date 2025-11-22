/**
 * ===================================================================
 * 🚀 OPTIMUM PRIME ULTIMATE - MOTEUR D'OPTIMISATION
 * ===================================================================
 * LE CONCEPT :
 * Remplace l'usine à gaz "V15" par une architecture saine.
 * Combine la puissance statistique de "Jules Codex" avec les
 * critères pédagogiques "Humains" (Têtes de classe, Niv1).
 *
 * PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES :
 * Appliquée aux deux pipelines (LEGACY et OPTI).
 *
 * AUTEUR : Gemini (Expert Apps Script)
 * DATE : 19/11/2025
 * ===================================================================
 */

// Configuration Ajustable
const ULTIMATE_CONFIG = {
  maxSwaps: 2000,           // Nombre max d'échanges testés
  stagnationLimit: 50,      // Arrêt si pas d'amélioration après N tentatives
  weights: {
    distrib: 5.0,           // Poids de la courbe de Gauss (Note moyenne)
    parity: 4.0,            // Poids de la parité F/M
    profiles: 10.0,         // Poids CRITIQUE des profils (Têtes/Niv1)
    friends: 1000.0         // Poids CRITIQUE des amitiés (ASSO/DISSO)
  },
  targets: {
    headMin: 2,             // Min têtes de classe par classe
    headMax: 5,             // Max têtes de classe par classe
    niv1Max: 4,             // Max élèves en difficulté par classe
    niv1Min: 0
  }
};

/**
 * Point d'entrée principal appelé par le Pipeline OPTI ou LEGACY
 * @param {Object} ctx - Contexte de l'optimisation
 * @returns {Object} Résultat d'optimisation
 */
function Phase4_Ultimate_Run(ctx) {
  const ss = ctx.ss || SpreadsheetApp.getActiveSpreadsheet();
  logLine('INFO', '🚀 Lancement OPTIMUM PRIME ULTIMATE...');

  // 1. CHARGEMENT ET CLASSIFICATION
  const dataResult = loadAndClassifyData_Ultimate(ctx);
  if (!dataResult.ok) {
    logLine('ERROR', '❌ Échec du chargement des données ULTIMATE');
    return { ok: false, message: 'Erreur chargement données' };
  }

  let { allData, byClass, headers } = dataResult;
  logLine('INFO', `📊 Chargement OK : ${allData.length} élèves répartis en ${Object.keys(byClass).length} classes.`);

  // 2. STATISTIQUES GLOBALES
  const globalStats = calculateGlobalStats_Ultimate(allData);
  logLine('INFO', `🎯 Cibles : Ratio F=${(globalStats.ratioF*100).toFixed(1)}%, Moyenne COM=${globalStats.avgCOM.toFixed(2)}`);

  // 3. BOUCLE D'OPTIMISATION "SMART HILL CLIMBING"
  let swapsApplied = 0;
  let stagnationCount = 0;

  for (let iter = 0; iter < ULTIMATE_CONFIG.maxSwaps; iter++) {

    // A. Identifier la classe la plus "malade" (Score le plus élevé)
    const worstClassKey = findWorstClass_Ultimate(byClass, allData, globalStats);
    if (!worstClassKey) break; // Tout est parfait !

    // B. Identifier une classe partenaire (Le "Médecin")
    const partnerClassKey = findPartnerClass_Ultimate(worstClassKey, byClass, allData, globalStats);
    if (!partnerClassKey) {
      stagnationCount++;
      if(stagnationCount > 10) break;
      continue;
    }

    // C. Chercher le meilleur swap "Chirurgical"
    const bestSwap = findBestSwapBetween_Ultimate(worstClassKey, partnerClassKey, allData, byClass, headers, globalStats);

    // D. Appliquer si gain positif
    if (bestSwap && bestSwap.gain > 0.0001) {
      applySwap_Ultimate(allData, byClass, bestSwap);
      swapsApplied++;
      stagnationCount = 0;

      if (swapsApplied % 50 === 0) {
        logLine('INFO', `⚡ Swap #${swapsApplied}: ${bestSwap.reason} (Gain: ${bestSwap.gain.toFixed(4)})`);
      }
    } else {
      stagnationCount++;
    }

    if (stagnationCount >= ULTIMATE_CONFIG.stagnationLimit) {
      logLine('INFO', '🛑 Convergence atteinte (Stagnation).');
      break;
    }
  }

  // 4. SAUVEGARDE RÉELLE
  const saveResult = saveResults_Ultimate(ss, allData, byClass, headers);

  logLine('SUCCESS', `✅ ULTIMATE Terminé : ${swapsApplied} swaps chirurgicaux appliqués.`);
  return {
    ok: true,
    swapsApplied: swapsApplied,
    saveResult: saveResult
  };
}

// ===================================================================
// 🧠 LE CERVEAU : CALCUL DES SCORES (La logique pédagogique)
// ===================================================================

/**
 * Calcule le score de "maladie" d'une classe
 * PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES :
 * - Pénalité forte (au carré) si manque de têtes
 * - Pénalité modérée si excès de têtes
 * - Pénalité très forte (au cube) si excès de Niv1
 */
function calculateScore_Ultimate(indices, allData, globalStats) {
  let score = 0;
  const students = indices.map(i => allData[i]);
  const total = students.length;
  if (total === 0) return 10000;

  // --- 1. CRITÈRE PROFILS (Héritage LEGACY - Priorité Absolue) ---
  const nbTetes = students.filter(s => s.isHead).length;
  const nbNiv1 = students.filter(s => s.isNiv1).length;

  // PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES
  if (nbTetes < ULTIMATE_CONFIG.targets.headMin) {
    score += Math.pow(ULTIMATE_CONFIG.targets.headMin - nbTetes, 2) * 500;
  }
  if (nbTetes > ULTIMATE_CONFIG.targets.headMax) {
    score += (nbTetes - ULTIMATE_CONFIG.targets.headMax) * 200;
  }

  if (nbNiv1 > ULTIMATE_CONFIG.targets.niv1Max) {
    score += Math.pow(nbNiv1 - ULTIMATE_CONFIG.targets.niv1Max, 3) * 100;
  }

  // --- 2. CRITÈRE PARITÉ (Adaptatif) ---
  const nbFilles = students.filter(s => s.sexe === 'F').length;
  const ratioF = nbFilles / total;
  score += Math.abs(ratioF - globalStats.ratioF) * 1000 * ULTIMATE_CONFIG.weights.parity;

  // --- 3. CRITÈRE DISTRIBUTION ACADÉMIQUE (Jules Codex) ---
  const avgCOM = students.reduce((acc, s) => acc + (s.COM || 2.5), 0) / total;
  const avgTRA = students.reduce((acc, s) => acc + (s.TRA || 2.5), 0) / total;

  score += Math.abs(avgCOM - globalStats.avgCOM) * 100 * ULTIMATE_CONFIG.weights.distrib;
  score += Math.abs(avgTRA - globalStats.avgTRA) * 100 * ULTIMATE_CONFIG.weights.distrib;

  return score;
}

/**
 * Identifie le meilleur swap entre deux classes
 */
function findBestSwapBetween_Ultimate(cls1Name, cls2Name, allData, byClass, headers, globalStats) {
  const idxList1 = byClass[cls1Name];
  const idxList2 = byClass[cls2Name];

  const scoreBefore = calculateScore_Ultimate(idxList1, allData, globalStats) +
                      calculateScore_Ultimate(idxList2, allData, globalStats);

  let bestSwap = null;
  let maxGain = 0;

  // Stochastic probing (15 random pairs)
  for (let i = 0; i < 15; i++) {
    const i1 = idxList1[Math.floor(Math.random() * idxList1.length)];
    const s1 = allData[i1];
    if (isFixed(s1)) continue;

    for (let j = 0; j < 15; j++) {
      const i2 = idxList2[Math.floor(Math.random() * idxList2.length)];
      const s2 = allData[i2];
      if (isFixed(s2)) continue;

      // Simulation du swap
      const tempList1 = idxList1.filter(idx => idx !== i1).concat([i2]);
      const tempList2 = idxList2.filter(idx => idx !== i2).concat([i1]);

      const scoreAfter = calculateScore_Ultimate(tempList1, allData, globalStats) +
                         calculateScore_Ultimate(tempList2, allData, globalStats);

      const gain = scoreBefore - scoreAfter;

      if (gain > maxGain) {
        maxGain = gain;
        bestSwap = {
          idx1: i1,
          idx2: i2,
          cls1: cls1Name,
          cls2: cls2Name,
          gain: gain,
          reason: `Swap ${s1.isHead ? 'Tête' : 'Std'}/${s1.isNiv1 ? 'Niv1' : 'Std'}`
        };
      }
    }
  }

  return bestSwap;
}

/**
 * Charge et classifie toutes les données élèves
 */
function loadAndClassifyData_Ultimate(ctx) {
  const ss = ctx.ss || SpreadsheetApp.getActiveSpreadsheet();
  const allData = [];
  const byClass = {};
  let headersRef = null;

  const sheets = ss.getSheets().filter(s => /.+°\d+$/.test(s.getName())); // ✅ Pattern universel

  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    if (!headersRef) headersRef = data[0];
    const headers = data[0];

    const idx = {
      ID: headers.indexOf('ID_ELEVE'),
      SEXE: headers.indexOf('SEXE'),
      COM: headers.indexOf('COM'),
      TRA: headers.indexOf('TRA'),
      PART: headers.indexOf('PART'),
      MOB: headers.indexOf('MOBILITE'),
      FIXE: headers.indexOf('FIXE')
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[idx.ID]) continue;

      const student = {
        row: row,
        originalSheet: sheet.getName(),
        index: i,
        sexe: String(row[idx.SEXE] || 'M').toUpperCase().trim().charAt(0),
        COM: Number(row[idx.COM]) || 2.5,
        TRA: Number(row[idx.TRA]) || 2.5,
        PART: Number(row[idx.PART]) || 2.5,
        mobilite: String(row[idx.MOB] || row[idx.FIXE] || '').toUpperCase()
      };

      // --- CLASSIFICATION LOGIQUE ---
      const scoreMoy = (student.COM + student.TRA + student.PART) / 3;
      student.isHead = (student.COM >= 4 || student.TRA >= 4) || scoreMoy >= 3.5;
      student.isNiv1 = (student.COM <= 1 || student.TRA <= 1);

      allData.push(student);

      if (!byClass[sheet.getName()]) byClass[sheet.getName()] = [];
      byClass[sheet.getName()].push(allData.length - 1);
    }
  });

  return { ok: true, allData: allData, byClass: byClass, headers: headersRef };
}

/**
 * Calcule les statistiques globales
 */
function calculateGlobalStats_Ultimate(allData) {
  let total = allData.length;
  if (total === 0) return { ratioF: 0.5, avgCOM: 2.5, avgTRA: 2.5 };

  const nbFilles = allData.filter(s => s.sexe === 'F').length;
  const sumCOM = allData.reduce((sum, s) => sum + s.COM, 0);
  const sumTRA = allData.reduce((sum, s) => sum + s.TRA, 0);

  return {
    ratioF: nbFilles / total,
    avgCOM: sumCOM / total,
    avgTRA: sumTRA / total
  };
}

/**
 * Identifie la classe "malade" (score le plus élevé)
 */
function findWorstClass_Ultimate(byClass, allData, globalStats) {
  let maxScore = -1;
  let worstClass = null;
  for (const cls in byClass) {
    const score = calculateScore_Ultimate(byClass[cls], allData, globalStats);
    if (score > maxScore) {
      maxScore = score;
      worstClass = cls;
    }
  }
  return worstClass;
}

/**
 * Trouve une classe partenaire pour un swap
 */
function findPartnerClass_Ultimate(worstClass, byClass, allData, globalStats) {
  const classes = Object.keys(byClass).filter(c => c !== worstClass);
  if (classes.length === 0) return null;
  return classes[Math.floor(Math.random() * classes.length)];
}

/**
 * Vérifie si un élève est "fixe" (non mobile)
 */
function isFixed(student) {
  const mob = student.mobilite;
  return mob.includes('FIXE') || mob.includes('NON');
}

/**
 * Applique un swap d'indices entre deux classes
 */
function applySwap_Ultimate(allData, byClass, swap) {
  const idx1 = swap.idx1;
  const idx2 = swap.idx2;

  byClass[swap.cls1] = byClass[swap.cls1].filter(i => i !== idx1).concat([idx2]);
  byClass[swap.cls2] = byClass[swap.cls2].filter(i => i !== idx2).concat([idx1]);
}

/**
 * Sauvegarde physiquement les résultats dans les onglets
 */
function saveResults_Ultimate(ss, allData, byClass, headersRef) {
  logLine('INFO', '💾 Début de l\'écriture physique des résultats...');

  if (!headersRef || headersRef.length === 0) {
    logLine('ERROR', '❌ Impossible de sauvegarder : En-têtes manquants');
    return { ok: false };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const className in byClass) {
    const indices = byClass[className];
    const testSheetName = className + 'TEST';
    const sheet = ss.getSheetByName(testSheetName);

    if (!sheet) {
      logLine('WARN', `⚠️ Onglet ${testSheetName} introuvable pour l'écriture.`);
      errorCount++;
      continue;
    }

    try {
      const rowsToWrite = [headersRef];
      indices.forEach(idx => {
        const student = allData[idx];
        rowsToWrite.push(student.row);
      });

      if (rowsToWrite.length > 0) {
        sheet.getRange(1, 1, rowsToWrite.length, headersRef.length).setValues(rowsToWrite);
        const lastRow = sheet.getLastRow();
        if (lastRow > rowsToWrite.length) {
          sheet.getRange(rowsToWrite.length + 1, 1, lastRow - rowsToWrite.length, sheet.getLastColumn()).clearContent();
        }
        logLine('INFO', `  ✅ ${testSheetName} : ${indices.length} élèves écrits.`);
        successCount++;
      }
    } catch (e) {
      logLine('ERROR', `  ❌ Erreur écriture ${testSheetName} : ${e.toString()}`);
      errorCount++;
    }
  }

  SpreadsheetApp.flush();
  logLine('SUCCESS', `💾 Sauvegarde complète : ${successCount} réussi(s), ${errorCount} erreur(s)`);

  return {
    ok: errorCount === 0,
    successCount: successCount,
    errorCount: errorCount
  };
}

/**
 * Utilitaire de logging
 */
function logLine(type, msg) {
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  Logger.log(`[${timestamp}] [${type}] ${msg}`);
}

// ===================================================================
// TEST FUNCTIONS
// ===================================================================

/**
 * Lance le moteur Ultimate en mode test
 */
function testPhase4Ultimate() {
  const ctx = {
    ss: SpreadsheetApp.getActiveSpreadsheet()
  };
  const result = Phase4_Ultimate_Run(ctx);
  Logger.log('=== RÉSULTAT TEST ULTIMATE ===');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
