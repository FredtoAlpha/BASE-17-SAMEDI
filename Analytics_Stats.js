/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ANALYTICS_STATS.GS - Analyse complète des données consolidées
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Lit l'onglet CONSOLIDATION et calcule toutes les statistiques nécessaires
 * pour la Phase STATS de la Console V3.
 */

/**
 * Fonction principale : récupère toutes les statistiques depuis CONSOLIDATION
 * @returns {Object} Objet contenant toutes les métriques
 */
function getConsolidationStats() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const consoSheet = ss.getSheetByName('CONSOLIDATION');

    if (!consoSheet) {
      return {
        success: false,
        error: "L'onglet CONSOLIDATION n'existe pas. Veuillez d'abord consolider les données."
      };
    }

    const data = consoSheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: false,
        error: "L'onglet CONSOLIDATION est vide. Veuillez d'abord générer les IDs et consolider."
      };
    }

    const headers = data[0];
    const rows = data.slice(1).filter(row => row[0]); // Filtrer les lignes vides

    // Fonction helper pour trouver une colonne (insensible à la casse et aux espaces)
    const findColumn = (possibleNames) => {
      const normalized = headers.map(h => String(h).trim().toUpperCase());
      for (const name of possibleNames) {
        const idx = normalized.indexOf(name.toUpperCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Indices des colonnes avec recherche flexible
    const idx = {
      SEXE: findColumn(['SEXE', 'SEX']),
      LV2: findColumn(['LV2', 'LANGUE']),
      OPT: findColumn(['OPT', 'OPTION', 'OPTIONS']),
      DISPOSITIF: findColumn(['DISPOSITIF', 'DISPO', 'DISPOSITIFS']),
      ASSO: findColumn(['ASSO', 'CODES_ASSO', 'CODE_ASSO']),
      DISSO: findColumn(['DISSO', 'CODES_DISSO', 'CODE_DISSO'])
    };

    Logger.log(`📋 Colonnes détectées dans CONSOLIDATION: ${headers.join(', ')}`);
    Logger.log(`📍 Indices: SEXE=${idx.SEXE}, LV2=${idx.LV2}, OPT=${idx.OPT}, DISPOSITIF=${idx.DISPOSITIF}, ASSO=${idx.ASSO}, DISSO=${idx.DISSO}`);

    // Calculer toutes les statistiques
    const stats = {
      success: true,
      effectifs: calculerEffectifs(rows),
      parite: calculerParite(rows, idx.SEXE),
      lv2: calculerLV2(rows, idx.LV2, idx.OPT),
      options: calculerOptions(rows, idx.OPT, idx.LV2),
      combos: calculerCombos(rows, idx.LV2, idx.OPT),
      global: calculerComptagesGlobaux(rows, idx.LV2, idx.OPT), // NOUVEAU : Comptage global unifié
      dispositifs: calculerDispositifs(rows, idx.DISPOSITIF),
      asso: calculerCodesAsso(rows, idx.ASSO),
      disso: calculerCodesDisso(rows, idx.DISSO)
    };

    return stats;

  } catch (e) {
    Logger.log(`Erreur getConsolidationStats: ${e.message}`);
    return {
      success: false,
      error: `Erreur technique: ${e.message}`
    };
  }
}

/**
 * Calcule les effectifs totaux
 */
function calculerEffectifs(rows) {
  return {
    total: rows.length
  };
}

/**
 * Calcule la parité F/M
 */
function calculerParite(rows, sexeIdx) {
  const counts = { F: 0, M: 0, inconnu: 0 };

  rows.forEach(row => {
    const sexe = String(row[sexeIdx] || '').trim().toUpperCase();
    if (sexe === 'F') counts.F++;
    else if (sexe === 'M') counts.M++;
    else counts.inconnu++;
  });

  const total = counts.F + counts.M;

  return {
    F: counts.F,
    M: counts.M,
    inconnu: counts.inconnu,
    ratioF: total > 0 ? ((counts.F / total) * 100).toFixed(2) : 0,
    ratioM: total > 0 ? ((counts.M / total) * 100).toFixed(2) : 0
  };
}

/**
 * Calcule les LV2 SEULES (sans option)
 */
function calculerLV2(rows, lv2Idx, optIdx) {
  const lv2Counts = {};

  rows.forEach(row => {
    const lv2 = String(row[lv2Idx] || '').trim().toUpperCase();
    const opt = String(row[optIdx] || '').trim();

    // Ne compter que si LV2 existe ET pas d'option
    if (lv2 && !opt) {
      lv2Counts[lv2] = (lv2Counts[lv2] || 0) + 1;
    }
  });

  return lv2Counts;
}

/**
 * Calcule les OPTIONS SEULES (sans LV2 spécifique, ou avec ESP par défaut)
 */
function calculerOptions(rows, optIdx, lv2Idx) {
  const optCounts = {};

  rows.forEach(row => {
    const opt = String(row[optIdx] || '').trim().toUpperCase();
    const lv2 = String(row[lv2Idx] || '').trim().toUpperCase();

    // Ne compter que si option existe ET pas de LV2 (car si LV2, c'est un combo)
    if (opt && !lv2) {
      optCounts[opt] = (optCounts[opt] || 0) + 1;
    }
  });

  return optCounts;
}

/**
 * Calcule les PROFILS DOUBLES (LV2 spécifique + Option)
 * Ex: ITA+GREC, ALL+LATIN, ESP+LATIN...
 */
function calculerCombos(rows, lv2Idx, optIdx) {
  const combos = {};

  // Helper : split multi-options "LATIN / CHAV" → ["LATIN", "CHAV"]
  const splitOptions = (optString) => {
    return String(optString || '')
      .toUpperCase()
      .split(/[+,;/]|\s+\+\s+/)
      .map(o => o.trim())
      .filter(Boolean);
  };

  rows.forEach(row => {
    const lv2 = String(row[lv2Idx] || '').trim().toUpperCase();
    const options = splitOptions(row[optIdx]);

    // Profil double = tout couple LV2 + Option (chaque option est comptée séparément)
    if (lv2 && options.length) {
      options.forEach(opt => {
        const combo = `${lv2} + ${opt}`;
        combos[combo] = (combos[combo] || 0) + 1;
      });
    }
  });

  return combos;
}

/**
 * Calcule les comptages GLOBAUX pour chaque matière (LV2 ou Option)
 * Permet de savoir combien d'élèves font "ITA" au total (LV2 + Option + Combos)
 */
function calculerComptagesGlobaux(rows, lv2Idx, optIdx) {
  const globalCounts = {};

  rows.forEach(row => {
    const lv2 = String(row[lv2Idx] || '').trim().toUpperCase();
    const opt = String(row[optIdx] || '').trim().toUpperCase();

    // Ajouter LV2
    if (lv2) {
      globalCounts[lv2] = (globalCounts[lv2] || 0) + 1;
    }

    // Ajouter Option (si différente de LV2, pour éviter double compte si erreur saisie)
    if (opt && opt !== lv2) {
      globalCounts[opt] = (globalCounts[opt] || 0) + 1;
    }
  });

  return globalCounts;
}

/**
 * Calcule les dispositifs (PAI, PPRE, ULIS...)
 */
function calculerDispositifs(rows, dispoIdx) {
  if (dispoIdx === -1) return {};

  const dispoCounts = {};

  rows.forEach(row => {
    const dispo = String(row[dispoIdx] || '').trim().toUpperCase();
    if (dispo) {
      dispoCounts[dispo] = (dispoCounts[dispo] || 0) + 1;
    }
  });

  return dispoCounts;
}

/**
 * Calcule les codes ASSO (A1, A2...)
 */
function calculerCodesAsso(rows, assoIdx) {
  if (assoIdx === -1) return { codes: 0, eleves: 0, details: {} };

  const codesSet = new Set();
  const codeDetails = {};
  let elevesTotal = 0;

  rows.forEach(row => {
    const asso = String(row[assoIdx] || '').trim().toUpperCase();
    if (asso) {
      codesSet.add(asso);
      codeDetails[asso] = (codeDetails[asso] || 0) + 1;
      elevesTotal++;
    }
  });

  return {
    codes: codesSet.size,
    eleves: elevesTotal,
    details: codeDetails
  };
}

/**
 * Calcule les codes DISSO (D1, D2...) avec détection de conflits
 */
function calculerCodesDisso(rows, dissoIdx) {
  if (dissoIdx === -1) return { codes: 0, eleves: 0, details: {}, conflicts: [] };

  const codesSet = new Set();
  const codeDetails = {};
  let elevesTotal = 0;

  rows.forEach(row => {
    const disso = String(row[dissoIdx] || '').trim().toUpperCase();
    if (disso) {
      codesSet.add(disso);
      codeDetails[disso] = (codeDetails[disso] || 0) + 1;
      elevesTotal++;
    }
  });

  return {
    codes: codesSet.size,
    eleves: elevesTotal,
    details: codeDetails,
    conflicts: [] // Sera calculé plus tard avec le nb de classes
  };
}

/**
 * Détecte les conflits DISSO par rapport au nombre de classes cibles
 */
function detecterConflitsDisso(statsDisso, nbClassesCibles) {
  const conflicts = [];

  Object.entries(statsDisso.details).forEach(([code, count]) => {
    if (count > nbClassesCibles) {
      conflicts.push({
        code: code,
        count: count,
        nbClasses: nbClassesCibles,
        message: `⚠️ IMPOSSIBLE: ${count} élèves avec code ${code} pour seulement ${nbClassesCibles} classes`
      });
    }
  });

  return conflicts;
}
