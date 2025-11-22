/**
 * ===================================================================
 * 📋 PRIME LEGACY - INITIALISATION DES ONGLETS TEST
 * ===================================================================
 *
 * Gestion des onglets TEST pour le pipeline LEGACY :
 * - Création des onglets TEST (vidage doux)
 * - Copie des en-têtes depuis les onglets sources
 * - Formatage des onglets TEST
 *
 * ISOLATION COMPLÈTE :
 * - OPTI : _BASEOPTI → _CACHE
 * - LEGACY : Sources (°1, °2) → TEST
 *
 * Date : 2025-11-13
 * Branche : claude/PRIME-LEGACY-01SJDcJv7zHGGBXWhHpzfnxr
 *
 * ===================================================================
 */

// ===================================================================
// INITIALISATION DES ONGLETS TEST
// ===================================================================

/**
 * Initialise les onglets TEST (vide uniquement les lignes de données, garde les en-têtes)
 * ⚠️ SÉCURITÉ : Ne vide PAS tout, seulement les lignes élèves (>= ligne 2)
 *
 * @param {Object} ctx - Contexte LEGACY
 * @returns {Object} { opened: ["5°1TEST", ...], active: "5°1TEST" }
 */
function initEmptyTestTabs_LEGACY(ctx) {
  logLine('INFO', '📋 Initialisation onglets TEST (vidage doux)...');

  const opened = [];

  (ctx.cacheSheets || []).forEach(function(name) {
    let sh = ctx.ss.getSheetByName(name);

    if (!sh) {
      // ✅ Créer l'onglet TEST s'il n'existe pas
      sh = ctx.ss.insertSheet(name);
      logLine('INFO', '  ✨ ' + name + ' créé');
    }

    // ✅ VIDAGE DOUX : Garde les en-têtes (ligne 1), vide seulement les données
    if (sh.getLastRow() > 1) {
      const numRows = sh.getLastRow() - 1; // Nombre de lignes de données
      const numCols = Math.max(1, sh.getLastColumn());
      sh.getRange(2, 1, numRows, numCols).clearContent();
      logLine('INFO', '  🧹 ' + name + ' : ' + numRows + ' lignes vidées (en-tête conservé)');
    } else {
      // Pas d'en-têtes → créer
      writeTestHeaders_LEGACY(ctx, sh, name);
      logLine('INFO', '  ✨ ' + name + ' : en-têtes créés');
    }

    // S'assurer que les en-têtes existent
    if (sh.getLastRow() === 0) {
      writeTestHeaders_LEGACY(ctx, sh, name);
    }

    opened.push(name);
  });

  SpreadsheetApp.flush();

  const active = opened[0] || null;
  logLine('INFO', '✅ Onglets TEST initialisés : ' + opened.join(', '));

  return { opened: opened, active: active };
}

/**
 * Écrit les en-têtes dans un onglet TEST
 * Copie les en-têtes depuis l'onglet source correspondant
 *
 * @param {Object} ctx - Contexte LEGACY
 * @param {Sheet} targetSheet - Onglet TEST cible
 * @param {string} testName - Nom de l'onglet TEST (ex: "5°1TEST")
 */
function writeTestHeaders_LEGACY(ctx, targetSheet, testName) {
  // ✅ Trouver l'onglet source correspondant
  let srcName = null;

  // En mode LEGACY, testName est comme "6°1TEST"
  // On doit trouver l'onglet source correspondant (ex: "PREVERT°1" ou "ECOLE1")
  const destName = testName.replace(ctx.writeTarget, ''); // "6°1"

  // ✅ Utiliser le mapping inverse pour accès direct
  if (ctx.destToSourceMapping) {
    srcName = ctx.destToSourceMapping[destName];
  } else if (ctx.sourceToDestMapping) {
    // Fallback ancien code (si destToSourceMapping n'existe pas)
    for (const source in ctx.sourceToDestMapping) {
      if (ctx.sourceToDestMapping[source] === destName) {
        srcName = source;
        break;
      }
    }
  }

  // Fallback : si pas de mapping, utiliser destName directement
  if (!srcName) {
    srcName = destName;
  }

  const srcSheet = ctx.ss.getSheetByName(srcName);

  if (srcSheet && srcSheet.getLastRow() > 0) {
    // ✅ Copier les en-têtes depuis l'onglet source
    const headers = srcSheet.getRange(1, 1, 1, srcSheet.getLastColumn()).getValues()[0];
    targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // ✅ Formater l'en-tête
    targetSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#C6E0B4'); // Vert clair

    logLine('INFO', '    📋 En-têtes copiés de ' + srcName + ' vers ' + testName);

    // ✅ Ajouter la colonne _CLASS_ASSIGNED si elle n'existe pas
    ensureClassAssignedColumn_LEGACY(targetSheet, headers);

  } else {
    logLine('WARN', '⚠️ Impossible de trouver l\'onglet source pour ' + testName + ' (cherché: ' + srcName + ')');

    // ✅ Créer des en-têtes par défaut
    createDefaultHeaders_LEGACY(targetSheet);
  }
}

/**
 * S'assure que la colonne _CLASS_ASSIGNED existe dans l'onglet TEST
 *
 * @param {Sheet} sheet - Onglet TEST
 * @param {Array} headers - En-têtes actuels
 */
function ensureClassAssignedColumn_LEGACY(sheet, headers) {
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');

  if (idxAssigned === -1) {
    // ✅ Ajouter la colonne _CLASS_ASSIGNED à la fin
    const newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue('_CLASS_ASSIGNED');
    sheet.getRange(1, newCol)
      .setFontWeight('bold')
      .setBackground('#FFD966'); // Jaune

    logLine('INFO', '    ✅ Colonne _CLASS_ASSIGNED ajoutée (colonne ' + newCol + ')');
  }
}

/**
 * Crée des en-têtes par défaut si aucun onglet source n'est trouvé
 *
 * @param {Sheet} sheet - Onglet TEST
 */
function createDefaultHeaders_LEGACY(sheet) {
  // ✅ En-têtes par défaut pour un onglet TEST
  const defaultHeaders = [
    'ID_ELEVE',
    'NOM',
    'PRENOM',
    'SEXE',
    'LV2',
    'OPT',
    'COM',
    'TRA',
    'PART',
    'ABS',
    'ASSO',
    'DISSO',
    '_CLASS_ASSIGNED',
    'MOBILITE',
    'FIXE'
  ];

  sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);

  // ✅ Formater l'en-tête
  sheet.getRange(1, 1, 1, defaultHeaders.length)
    .setFontWeight('bold')
    .setBackground('#C6E0B4'); // Vert clair

  // ✅ Mettre _CLASS_ASSIGNED en jaune
  const idxAssigned = defaultHeaders.indexOf('_CLASS_ASSIGNED');
  if (idxAssigned >= 0) {
    sheet.getRange(1, idxAssigned + 1)
      .setBackground('#FFD966'); // Jaune
  }

  logLine('INFO', '    ✨ En-têtes par défaut créés');
}

// ===================================================================
// FORMATAGE DES ONGLETS TEST
// ===================================================================

/**
 * Formate les onglets TEST pour améliorer la lisibilité
 *
 * @param {Object} ctx - Contexte LEGACY
 */
function formatTestSheets_LEGACY(ctx) {
  logLine('INFO', '🎨 Formatage des onglets TEST...');

  (ctx.cacheSheets || []).forEach(function(name) {
    const sh = ctx.ss.getSheetByName(name);
    if (!sh) return;

    try {
      // ✅ Figer la première ligne (en-têtes)
      sh.setFrozenRows(1);

      // ✅ Ajuster la largeur des colonnes
      adjustColumnWidths_LEGACY(sh);

      // ✅ Formater les colonnes spéciales
      formatSpecialColumns_LEGACY(sh);

      logLine('INFO', '  ✅ ' + name + ' formaté');

    } catch (e) {
      logLine('WARN', '⚠️ Erreur formatage ' + name + ' : ' + e.message);
    }
  });

  SpreadsheetApp.flush();
  logLine('INFO', '✅ Formatage terminé');
}

/**
 * Ajuste la largeur des colonnes pour améliorer la lisibilité
 *
 * @param {Sheet} sheet - Onglet TEST
 */
function adjustColumnWidths_LEGACY(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return;

  const headers = data[0];

  // ✅ Largeurs personnalisées par colonne
  const widths = {
    'ID_ELEVE': 120,
    'NOM': 150,
    'PRENOM': 150,
    'SEXE': 60,
    'LV2': 80,
    'OPT': 80,
    'COM': 60,
    'TRA': 60,
    'PART': 60,
    'ABS': 60,
    'ASSO': 80,
    'DISSO': 80,
    '_CLASS_ASSIGNED': 120,
    'MOBILITE': 100,
    'FIXE': 80
  };

  headers.forEach(function(header, idx) {
    const headerName = String(header).trim().toUpperCase();
    const width = widths[headerName] || 100; // Défaut 100px
    sheet.setColumnWidth(idx + 1, width);
  });
}

/**
 * Formate les colonnes spéciales (_CLASS_ASSIGNED, LV2, OPT, etc.)
 *
 * @param {Sheet} sheet - Onglet TEST
 */
function formatSpecialColumns_LEGACY(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return;

  const headers = data[0];

  // ✅ Formater la colonne _CLASS_ASSIGNED (jaune)
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  if (idxAssigned >= 0 && sheet.getLastRow() > 1) {
    sheet.getRange(2, idxAssigned + 1, sheet.getLastRow() - 1, 1)
      .setBackground('#FFF2CC'); // Jaune clair
  }

  // ✅ Formater les colonnes LV2 et OPT (bleu clair)
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');

  if (idxLV2 >= 0 && sheet.getLastRow() > 1) {
    sheet.getRange(2, idxLV2 + 1, sheet.getLastRow() - 1, 1)
      .setBackground('#D9EAD3'); // Vert clair
  }

  if (idxOPT >= 0 && sheet.getLastRow() > 1) {
    sheet.getRange(2, idxOPT + 1, sheet.getLastRow() - 1, 1)
      .setBackground('#D9EAD3'); // Vert clair
  }

  // ✅ Formater les colonnes scores (COM, TRA, PART, ABS)
  const scoreColumns = ['COM', 'TRA', 'PART', 'ABS'];
  scoreColumns.forEach(function(scoreName) {
    const idx = headers.indexOf(scoreName);
    if (idx >= 0 && sheet.getLastRow() > 1) {
      sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1)
        .setHorizontalAlignment('center'); // Centrer
    }
  });
}

// ===================================================================
// COPIE DES DONNÉES DEPUIS SOURCES VERS TEST
// ===================================================================

/**
 * Copie les données depuis les onglets sources vers les onglets TEST
 * ✅ Copie uniquement les données brutes (sans formules)
 *
 * @param {Object} ctx - Contexte LEGACY
 */
function copySourceDataToTest_LEGACY(ctx) {
  logLine('INFO', '📋 Copie des données sources vers TEST...');

  // ✅ Parcourir chaque onglet source
  (ctx.srcSheets || []).forEach(function(srcName) {
    const srcSheet = ctx.ss.getSheetByName(srcName);
    if (!srcSheet || srcSheet.getLastRow() <= 1) {
      logLine('WARN', '⚠️ ' + srcName + ' vide ou introuvable, skip');
      return;
    }

    // ✅ Trouver l'onglet TEST correspondant
    const destName = (ctx.sourceToDestMapping && ctx.sourceToDestMapping[srcName])
      ? ctx.sourceToDestMapping[srcName] + ctx.writeTarget
      : srcName + ctx.writeTarget;

    const destSheet = ctx.ss.getSheetByName(destName);
    if (!destSheet) {
      logLine('WARN', '⚠️ ' + destName + ' introuvable, skip');
      return;
    }

    // ✅ Copier les données (ligne 2 à la fin)
    const numRows = srcSheet.getLastRow() - 1; // Exclure l'en-tête
    const numCols = srcSheet.getLastColumn();

    if (numRows > 0) {
      const data = srcSheet.getRange(2, 1, numRows, numCols).getValues();

      // ✅ Écrire dans l'onglet TEST
      destSheet.getRange(2, 1, numRows, numCols).setValues(data);

      logLine('INFO', '  ✅ ' + srcName + ' → ' + destName + ' : ' + numRows + ' élèves copiés');
    }
  });

  SpreadsheetApp.flush();
  logLine('INFO', '✅ Copie terminée');
}

// ===================================================================
// UTILITAIRES
// ===================================================================

/**
 * Nettoie les colonnes LV2/OPT dans les onglets TEST
 * ✅ Évite de traîner des LV2/OPT invalides copiées de TEST
 *
 * @param {Object} ctx - Contexte LEGACY
 */
function clearLv2OptColumnsInTest_LEGACY(ctx) {
  logLine('INFO', '🧹 Nettoyage colonnes LV2/OPT dans TEST...');

  (ctx.cacheSheets || []).forEach(function(name) {
    const sh = ctx.ss.getSheetByName(name);
    if (!sh) return;

    const data = sh.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const idxLV2 = headers.indexOf('LV2');
    const idxOPT = headers.indexOf('OPT');

    let cleared = false;

    if (idxLV2 >= 0) {
      sh.getRange(2, idxLV2 + 1, data.length - 1, 1).clearContent();
      cleared = true;
    }

    if (idxOPT >= 0) {
      sh.getRange(2, idxOPT + 1, data.length - 1, 1).clearContent();
      cleared = true;
    }

    if (cleared) {
      logLine('INFO', '  🧹 ' + name + ' : LV2/OPT nettoyées');
    }
  });

  SpreadsheetApp.flush();
  logLine('INFO', '✅ Nettoyage terminé');
}

/**
 * Active visuellement le premier onglet TEST
 *
 * @param {Object} ctx - Contexte LEGACY
 */
function activateFirstTestTab_LEGACY(ctx) {
  if (!ctx.cacheSheets || ctx.cacheSheets.length === 0) return;

  const firstName = ctx.cacheSheets[0];
  const sh = ctx.ss.getSheetByName(firstName);

  if (sh) {
    ctx.ss.setActiveSheet(sh);
    logLine('INFO', '✅ Onglet actif : ' + firstName);
  }
}
