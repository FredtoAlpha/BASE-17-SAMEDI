/**
 * ===================================================================
 * WIZARD BACKEND - Fonctions serveur pour l'interface wizard
 * ===================================================================
 *
 * Ce fichier contient toutes les fonctions Apps Script nécessaires
 * pour gérer le wizard multiphase :
 * - Sauvegarde/restauration de session
 * - Modèles de configuration
 * - Import CSV
 * - Intégration avec les fonctions existantes
 *
 * Date : 2025-11-15
 * ===================================================================
 */

// ===================================================================
// MENU & OUVERTURE
// ===================================================================

/**
 * Ouvre l'interface wizard dans une sidebar
 */
function ouvrirWizardInterface() {
  const html = HtmlService.createHtmlOutputFromFile('WizardInterface')
    .setTitle('Assistant de Configuration')
    .setWidth(1200);

  SpreadsheetApp.getUi().showModalDialog(html, 'BASE-16 RENEW - Configuration Complète');
}

// ===================================================================
// SAUVEGARDE & RESTAURATION DE SESSION
// ===================================================================

/**
 * Sauvegarde l'état actuel du wizard
 * @param {Object} state - État du wizard à sauvegarder
 */
function sauvegarderEtatWizard(state) {
  try {
    const userProps = PropertiesService.getUserProperties();
    const timestamp = new Date().getTime();

    // Sauvegarder l'état avec timestamp
    const stateWithTimestamp = {
      ...state,
      timestamp: timestamp,
      savedAt: new Date().toISOString()
    };

    userProps.setProperty('WIZARD_STATE', JSON.stringify(stateWithTimestamp));

    Logger.log(`✅ État wizard sauvegardé (phase ${state.phase})`);
    return { success: true, message: 'Session sauvegardée' };

  } catch (e) {
    Logger.log(`❌ Erreur sauvegarde wizard: ${e}`);
    throw new Error(`Impossible de sauvegarder la session: ${e.message}`);
  }
}

/**
 * Charge l'état sauvegardé du wizard
 * @returns {Object|null} État sauvegardé ou null si aucun
 */
function chargerEtatWizard() {
  try {
    const userProps = PropertiesService.getUserProperties();
    const savedState = userProps.getProperty('WIZARD_STATE');

    if (!savedState) {
      Logger.log('ℹ️ Aucune session wizard sauvegardée');
      return null;
    }

    const state = JSON.parse(savedState);
    Logger.log(`✅ État wizard chargé (phase ${state.phase}, sauvegardé le ${state.savedAt})`);
    return state;

  } catch (e) {
    Logger.log(`❌ Erreur chargement wizard: ${e}`);
    return null;
  }
}

/**
 * Supprime l'état sauvegardé
 */
function supprimerEtatWizard() {
  try {
    PropertiesService.getUserProperties().deleteProperty('WIZARD_STATE');
    Logger.log('✅ Session wizard supprimée');
    return { success: true };
  } catch (e) {
    Logger.log(`❌ Erreur suppression session: ${e}`);
    throw new Error(`Impossible de supprimer la session: ${e.message}`);
  }
}

// ===================================================================
// MODÈLES DE CONFIGURATION
// ===================================================================

/**
 * Sauvegarde un modèle de configuration
 * @param {string} nom - Nom du modèle
 * @param {Object} config - Configuration à sauvegarder
 */
function sauvegarderModeleConfig(nom, config) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let modelesSheet = ss.getSheetByName('_MODELES_CONFIG');

    // Créer l'onglet s'il n'existe pas
    if (!modelesSheet) {
      modelesSheet = ss.insertSheet('_MODELES_CONFIG');
      modelesSheet.hideSheet();

      // En-têtes
      modelesSheet.getRange(1, 1, 1, 3).setValues([
        ['NOM', 'DATE_CREATION', 'CONFIG_JSON']
      ]).setFontWeight('bold').setBackground('#d5dbdb');
    }

    // Chercher si le modèle existe déjà
    const data = modelesSheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nom) {
        rowIndex = i + 1;
        break;
      }
    }

    const configJSON = JSON.stringify(config);
    const dateCreation = new Date().toISOString();

    if (rowIndex > 0) {
      // Mise à jour
      modelesSheet.getRange(rowIndex, 2, 1, 2).setValues([[dateCreation, configJSON]]);
    } else {
      // Nouveau modèle
      const newRow = modelesSheet.getLastRow() + 1;
      modelesSheet.getRange(newRow, 1, 1, 3).setValues([[nom, dateCreation, configJSON]]);
    }

    Logger.log(`✅ Modèle "${nom}" sauvegardé`);
    return { success: true, message: `Modèle "${nom}" sauvegardé` };

  } catch (e) {
    Logger.log(`❌ Erreur sauvegarde modèle: ${e}`);
    throw new Error(`Impossible de sauvegarder le modèle: ${e.message}`);
  }
}

/**
 * Charge un modèle de configuration
 * @param {string} nom - Nom du modèle à charger
 * @returns {Object} Configuration du modèle
 */
function chargerModeleConfig(nom) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const modelesSheet = ss.getSheetByName('_MODELES_CONFIG');

    if (!modelesSheet) {
      throw new Error('Aucun modèle sauvegardé');
    }

    const data = modelesSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nom) {
        const config = JSON.parse(data[i][2]);
        Logger.log(`✅ Modèle "${nom}" chargé`);
        return config;
      }
    }

    throw new Error(`Modèle "${nom}" introuvable`);

  } catch (e) {
    Logger.log(`❌ Erreur chargement modèle: ${e}`);
    throw new Error(`Impossible de charger le modèle: ${e.message}`);
  }
}

/**
 * Liste tous les modèles disponibles
 * @returns {Array} Liste des modèles
 */
function listerModelesConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const modelesSheet = ss.getSheetByName('_MODELES_CONFIG');

    if (!modelesSheet) {
      return [];
    }

    const data = modelesSheet.getDataRange().getValues();
    const modeles = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        modeles.push({
          nom: data[i][0],
          dateCreation: data[i][1],
          // On ne retourne pas la config complète, juste les infos
        });
      }
    }

    return modeles;

  } catch (e) {
    Logger.log(`❌ Erreur liste modèles: ${e}`);
    return [];
  }
}

/**
 * Supprime un modèle
 * @param {string} nom - Nom du modèle à supprimer
 */
function supprimerModeleConfig(nom) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const modelesSheet = ss.getSheetByName('_MODELES_CONFIG');

    if (!modelesSheet) {
      throw new Error('Aucun modèle trouvé');
    }

    const data = modelesSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nom) {
        modelesSheet.deleteRow(i + 1);
        Logger.log(`✅ Modèle "${nom}" supprimé`);
        return { success: true, message: `Modèle "${nom}" supprimé` };
      }
    }

    throw new Error(`Modèle "${nom}" introuvable`);

  } catch (e) {
    Logger.log(`❌ Erreur suppression modèle: ${e}`);
    throw new Error(`Impossible de supprimer le modèle: ${e.message}`);
  }
}

// ===================================================================
// IMPORT CSV
// ===================================================================

/**
 * Import CSV dans un onglet source
 * @param {string} csvContent - Contenu du fichier CSV
 * @param {string} targetSheet - Nom de l'onglet cible
 * @returns {Object} Résultat de l'import
 */
function importCSVVersOnglet(csvContent, targetSheet) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(targetSheet);

    if (!sheet) {
      throw new Error(`Onglet "${targetSheet}" introuvable`);
    }

    // Parser CSV
    const csvData = Utilities.parseCsv(csvContent);

    if (!csvData || csvData.length === 0) {
      throw new Error('Fichier CSV vide');
    }

    // Détecter les colonnes
    const mapping = detecterColonnesCSV(csvData[0]);

    Logger.log(`Mapping détecté: ${JSON.stringify(mapping)}`);

    // Récupérer les en-têtes de l'onglet cible
    const targetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Transformer les données
    const dataTransformee = transformerDonneesCSV(csvData.slice(1), mapping, targetHeaders);

    // Écrire dans l'onglet (à partir de la ligne 2)
    if (dataTransformee.length > 0) {
      sheet.getRange(2, 1, dataTransformee.length, dataTransformee[0].length)
           .setValues(dataTransformee);
    }

    Logger.log(`✅ Import CSV: ${dataTransformee.length} lignes importées dans ${targetSheet}`);

    return {
      success: true,
      lignesImportees: dataTransformee.length,
      colonnesMappees: mapping
    };

  } catch (e) {
    Logger.log(`❌ Erreur import CSV: ${e}`);
    throw new Error(`Erreur lors de l'import: ${e.message}`);
  }
}

/**
 * Détecte automatiquement les colonnes d'un CSV
 * @param {Array} headers - En-têtes du CSV
 * @returns {Object} Mapping colonne CSV -> colonne système
 */
function detecterColonnesCSV(headers) {
  const mapping = {};
  const config = getConfig();
  const aliases = config.COLUMN_ALIASES || {};

  headers.forEach((header, index) => {
    const headerUpper = String(header).trim().toUpperCase();

    // Chercher dans les alias
    for (const [canonicalName, aliasList] of Object.entries(aliases)) {
      if (aliasList && aliasList.map(a => a.toUpperCase()).includes(headerUpper)) {
        mapping[index] = canonicalName;
        break;
      }
    }

    // Si pas trouvé, essayer une correspondance directe
    if (!mapping[index]) {
      mapping[index] = headerUpper;
    }
  });

  return mapping;
}

/**
 * Transforme les données CSV pour correspondre au format de l'onglet cible
 * @param {Array} csvData - Données du CSV
 * @param {Object} mapping - Mapping des colonnes
 * @param {Array} targetHeaders - En-têtes de l'onglet cible
 * @returns {Array} Données transformées
 */
function transformerDonneesCSV(csvData, mapping, targetHeaders) {
  const transformedData = [];

  csvData.forEach(row => {
    // Créer une ligne vide avec la bonne longueur
    const newRow = new Array(targetHeaders.length).fill('');

    // Remplir les colonnes selon le mapping
    for (const [csvIndex, canonicalName] of Object.entries(mapping)) {
      const targetIndex = targetHeaders.indexOf(canonicalName);

      if (targetIndex >= 0 && row[csvIndex] !== undefined) {
        newRow[targetIndex] = row[csvIndex];
      }
    }

    // N'ajouter que les lignes non vides
    if (newRow.some(cell => cell !== '')) {
      transformedData.push(newRow);
    }
  });

  return transformedData;
}

// ===================================================================
// INTÉGRATION AVEC LES FONCTIONS EXISTANTES
// ===================================================================

/**
 * Wrapper pour initialiserSysteme avec retour structuré
 */
function wizard_initialiserSysteme(niveau, nbSources, nbDest, lv2Options, optOptions) {
  try {
    // Appeler la fonction existante
    initialiserSysteme(niveau, nbSources, nbDest, lv2Options, optOptions);

    return {
      success: true,
      message: 'Système initialisé avec succès',
      data: {
        niveau: niveau,
        nbSources: nbSources,
        nbDestinations: nbDest,
        lv2: lv2Options,
        opt: optOptions
      }
    };

  } catch (e) {
    Logger.log(`❌ Erreur initialisation: ${e}`);
    throw new Error(`Erreur lors de l'initialisation: ${e.message}`);
  }
}

/**
 * Wrapper pour genererNomPrenomEtID
 */
function wizard_genererNomPrenomEtID() {
  try {
    genererNomPrenomEtID();

    return {
      success: true,
      message: 'NOM_PRENOM et ID_ELEVE générés avec succès'
    };

  } catch (e) {
    Logger.log(`❌ Erreur génération: ${e}`);
    throw new Error(`Erreur lors de la génération: ${e.message}`);
  }
}

/**
 * Wrapper pour ajouterListesDeroulantes
 */
function wizard_ajouterListesDeroulantes() {
  try {
    ajouterListesDeroulantes();

    return {
      success: true,
      message: 'Listes déroulantes appliquées avec succès'
    };

  } catch (e) {
    Logger.log(`❌ Erreur listes déroulantes: ${e}`);
    throw new Error(`Erreur lors de l'application des listes: ${e.message}`);
  }
}

/**
 * Wrapper pour verifierDonnees
 */
function wizard_verifierDonnees() {
  try {
    const result = verifierDonnees();

    return {
      success: true,
      message: result,
      hasErrors: result.includes('problème')
    };

  } catch (e) {
    Logger.log(`❌ Erreur vérification: ${e}`);
    throw new Error(`Erreur lors de la vérification: ${e.message}`);
  }
}

/**
 * Wrapper pour consoliderDonnees
 */
function wizard_consoliderDonnees() {
  try {
    const result = consoliderDonnees();

    return {
      success: true,
      message: result
    };

  } catch (e) {
    Logger.log(`❌ Erreur consolidation: ${e}`);
    throw new Error(`Erreur lors de la consolidation: ${e.message}`);
  }
}

/**
 * Récupère les informations de structure actuelle
 */
function wizard_getStructureInfo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheet = ss.getSheetByName('_STRUCTURE');

    if (!structureSheet) {
      return null;
    }

    const data = structureSheet.getDataRange().getValues();
    const sourceSheets = [];
    const testSheets = [];
    const defSheets = [];

    for (let i = 1; i < data.length; i++) {
      const type = data[i][0];
      const nom = data[i][1];

      if (type === 'SOURCE') {
        sourceSheets.push(nom);
      } else if (type === 'TEST') {
        testSheets.push(nom);
      } else if (type === 'DEF') {
        defSheets.push(nom);
      }
    }

    return {
      sources: sourceSheets,
      test: testSheets,
      def: defSheets,
      totalSources: sourceSheets.length,
      totalDestinations: testSheets.length
    };

  } catch (e) {
    Logger.log(`❌ Erreur récupération structure: ${e}`);
    return null;
  }
}

/**
 * Récupère la configuration actuelle depuis _CONFIG
 */
function wizard_getConfig() {
  try {
    return getConfig();
  } catch (e) {
    Logger.log(`❌ Erreur récupération config: ${e}`);
    return CONFIG; // Retourner la config par défaut
  }
}

/**
 * Sauvegarde la configuration initiale (LV2 et Options)
 * @param {Object} data - Données d'initialisation
 */
function wizard_saveInitialConfig(data) {
  try {
    Logger.log('💾 [WIZARD] Sauvegarde configuration initiale');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let configSheet = ss.getSheetByName('_CONFIG');

    if (!configSheet) {
      configSheet = ss.insertSheet('_CONFIG');
      Logger.log('✅ Onglet _CONFIG créé');
    }

    // Structure de base
    const configData = [
      ['PARAMETRE', 'VALEUR'],
      ['NIVEAU', data.niveau || '6°'],
      ['NB_SOURCES', data.nbSourcesClasses || 6],
      ['NB_DESTINATIONS', data.nbDestinations || 5],
      ['LV2', (data.lv2List || []).join(',')],
      ['OPT', (data.optionsList || []).join(',')],
      ['ADMIN_PASSWORD', data.motDePasse || ''],
      ['DATE_INIT', new Date().toISOString()]
    ];

    // Écrire la config
    configSheet.clear();
    configSheet.getRange(1, 1, configData.length, 2).setValues(configData);

    // Formatage
    configSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    configSheet.setColumnWidth(1, 200);
    configSheet.setColumnWidth(2, 300);

    // Créer les onglets sources
    const niveau = data.niveau || '6°';
    const nbSources = data.nbSourcesClasses || 6;

    for (let i = 1; i <= nbSources; i++) {
      const nomOnglet = `${niveau}${i}`;

      if (!ss.getSheetByName(nomOnglet)) {
        const newSheet = ss.insertSheet(nomOnglet);
        const headers = ['ID_ELEVE', 'NOM', 'PRENOM', 'NOM_PRENOM', 'SEXE', 'LV2', 'OPT', 'COM', 'TRA', 'PART', 'ABS'];
        newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0c674');
        newSheet.setFrozenRows(1);
        Logger.log(`✅ Onglet ${nomOnglet} créé`);
      }
    }

    Logger.log('✅ Configuration initiale sauvegardée');
    return { success: true, message: 'Configuration sauvegardée avec succès' };

  } catch (e) {
    Logger.log(`❌ Erreur sauvegarde config: ${e}`);
    throw new Error(`Impossible de sauvegarder: ${e.message}`);
  }
}

/**
 * Génère un onglet STATS avec statistiques globales
 */
function wizard_genererStatistiques() {
  try {
    Logger.log('📊 [WIZARD] Génération onglet STATS');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const consolidationSheet = ss.getSheetByName('CONSOLIDATION');

    if (!consolidationSheet) {
      throw new Error('Onglet CONSOLIDATION introuvable');
    }

    let statsSheet = ss.getSheetByName('STATS');
    if (!statsSheet) {
      statsSheet = ss.insertSheet('STATS');
    } else {
      statsSheet.clear();
    }

    const data = consolidationSheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('Aucune donnée dans CONSOLIDATION');
    }

    const headers = data[0];
    const rows = data.slice(1).filter(row => row[1] && row[2]);

    const sourceIndex = headers.indexOf('SOURCE');
    const sexeIndex = headers.indexOf('SEXE');
    const lv2Index = headers.indexOf('LV2');
    const optIndex = headers.indexOf('OPT');

    const stats = {
      totalEleves: rows.length,
      sources: {},
      sexe: { F: 0, M: 0 },
      lv2: {},
      options: {}
    };

    rows.forEach(row => {
      if (sourceIndex !== -1 && row[sourceIndex]) {
        const src = row[sourceIndex];
        stats.sources[src] = (stats.sources[src] || 0) + 1;
      }

      if (sexeIndex !== -1 && row[sexeIndex]) {
        const sexe = row[sexeIndex];
        if (sexe === 'F' || sexe === 'M') stats.sexe[sexe]++;
      }

      if (lv2Index !== -1 && row[lv2Index]) {
        const lv2 = row[lv2Index];
        stats.lv2[lv2] = (stats.lv2[lv2] || 0) + 1;
      }

      if (optIndex !== -1 && row[optIndex]) {
        const opt = row[optIndex];
        stats.options[opt] = (stats.options[opt] || 0) + 1;
      }
    });

    // Écrire les statistiques
    let currentRow = 1;

    statsSheet.getRange(currentRow, 1, 1, 2).merge().setValue('📊 STATISTIQUES GLOBALES');
    statsSheet.getRange(currentRow, 1).setFontSize(16).setFontWeight('bold').setBackground('#667eea').setFontColor('white');
    currentRow += 2;

    statsSheet.getRange(currentRow, 1).setValue('Total élèves :');
    statsSheet.getRange(currentRow, 2).setValue(stats.totalEleves).setFontWeight('bold');
    currentRow += 2;

    statsSheet.getRange(currentRow, 1, 1, 2).merge().setValue('Répartition par Source');
    statsSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#e3f2fd');
    currentRow++;

    Object.keys(stats.sources).sort().forEach(src => {
      statsSheet.getRange(currentRow, 1).setValue(src);
      statsSheet.getRange(currentRow, 2).setValue(stats.sources[src]);
      currentRow++;
    });
    currentRow++;

    statsSheet.getRange(currentRow, 1, 1, 2).merge().setValue('Parité F/M');
    statsSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#f3e5f5');
    currentRow++;
    statsSheet.getRange(currentRow, 1).setValue('Filles');
    statsSheet.getRange(currentRow, 2).setValue(stats.sexe.F);
    currentRow++;
    statsSheet.getRange(currentRow, 1).setValue('Garçons');
    statsSheet.getRange(currentRow, 2).setValue(stats.sexe.M);
    currentRow += 2;

    if (Object.keys(stats.lv2).length > 0) {
      statsSheet.getRange(currentRow, 1, 1, 2).merge().setValue('Répartition par LV2');
      statsSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#fff3e0');
      currentRow++;

      Object.keys(stats.lv2).sort().forEach(lv2 => {
        statsSheet.getRange(currentRow, 1).setValue(lv2);
        statsSheet.getRange(currentRow, 2).setValue(stats.lv2[lv2]);
        currentRow++;
      });
      currentRow++;
    }

    if (Object.keys(stats.options).length > 0) {
      statsSheet.getRange(currentRow, 1, 1, 2).merge().setValue('Répartition par Options');
      statsSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#e8f5e9');
      currentRow++;

      Object.keys(stats.options).sort().forEach(opt => {
        statsSheet.getRange(currentRow, 1).setValue(opt);
        statsSheet.getRange(currentRow, 2).setValue(stats.options[opt]);
        currentRow++;
      });
    }

    statsSheet.setColumnWidth(1, 250);
    statsSheet.setColumnWidth(2, 100);

    Logger.log('✅ Onglet STATS généré');
    return { success: true, message: 'Statistiques générées dans STATS' };

  } catch (e) {
    Logger.log(`❌ Erreur génération stats: ${e}`);
    throw new Error(`Impossible de générer les statistiques: ${e.message}`);
  }
}

// ===================================================================
// PROGRESSION TEMPS RÉEL (pour Phase 4)
// ===================================================================

/**
 * Stocke la progression du pipeline LEGACY
 */
function emettreProgression(phase, pourcentage, log) {
  try {
    const startTime = PropertiesService.getUserProperties().getProperty('LEGACY_START_TIME');
    const tempsEcoule = startTime ? (new Date().getTime() - parseInt(startTime)) / 1000 : 0;
    const tempsRestant = pourcentage > 0 ? (tempsEcoule / pourcentage) * (100 - pourcentage) : 0;

    const payload = {
      phase: phase,
      pourcentage: pourcentage,
      tempsEcoule: tempsEcoule,
      tempsRestant: tempsRestant,
      timestamp: new Date().getTime(),
      log: log || null
    };

    PropertiesService.getUserProperties()
      .setProperty('LEGACY_PROGRESS', JSON.stringify(payload));

  } catch (e) {
    Logger.log(`⚠️ Erreur émission progression: ${e}`);
  }
}

/**
 * Récupère la progression actuelle
 */
function getLegacyProgress() {
  try {
    const progress = PropertiesService.getUserProperties()
      .getProperty('LEGACY_PROGRESS');

    return progress ? JSON.parse(progress) : null;
  } catch (e) {
    Logger.log(`⚠️ Erreur lecture progression: ${e}`);
    return null;
  }
}

/**
 * Initialise le tracking de temps pour le pipeline
 */
function initLegacyProgress() {
  PropertiesService.getUserProperties()
    .setProperty('LEGACY_START_TIME', new Date().getTime().toString());
}

/**
 * Nettoie le tracking de progression
 */
function cleanLegacyProgress() {
  const userProps = PropertiesService.getUserProperties();
  userProps.deleteProperty('LEGACY_PROGRESS');
  userProps.deleteProperty('LEGACY_START_TIME');
}

// ===================================================================
// WRAPPERS POUR LES NOUVELLES PHASES (3, 4, 5, 6)
// ===================================================================

/**
 * Wrapper pour lancer le pipeline LEGACY complet (Phase 4)
 * Avec émission de progression pour feedback temps réel
 */
function wizard_runFullPipeline() {
  try {
    Logger.log('🚀 [WIZARD] Lancement pipeline LEGACY complet');

    // Initialiser le tracking de progression
    initLegacyProgress();

    emettreProgression(0, 0, 'Initialisation du pipeline...', 'INFO');

    // Vérifier que la fonction existe
    if (typeof legacy_runFullPipeline_PRIME !== 'function') {
      throw new Error('Fonction legacy_runFullPipeline_PRIME() non trouvée');
    }

    // Lancer le pipeline
    emettreProgression(1, 20, 'Lancement des 4 phases...', 'INFO');
    const result = legacy_runFullPipeline_PRIME();

    emettreProgression(4, 100, 'Pipeline terminé !', 'SUCCESS');

    // Nettoyer la progression après 5 secondes
    Utilities.sleep(5000);
    cleanLegacyProgress();

    Logger.log('✅ [WIZARD] Pipeline terminé avec succès');

    return {
      ok: true,
      message: result.message || 'Pipeline exécuté avec succès',
      testSheets: result.testSheets || 0,
      duration: result.duration || 0
    };

  } catch (e) {
    Logger.log(`❌ [WIZARD] Erreur pipeline: ${e}`);
    emettreProgression(0, 0, `Erreur: ${e.message}`, 'ERROR');

    return {
      ok: false,
      message: e.message || 'Erreur lors de l\'exécution du pipeline'
    };
  }
}

/**
 * Génère un rapport détaillé de la répartition (Phase 5)
 */
function wizard_genererRapport() {
  try {
    Logger.log('📊 [WIZARD] Génération du rapport');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const testSheets = ss.getSheets().filter(s => s.getName().endsWith('TEST'));

    if (testSheets.length === 0) {
      throw new Error('Aucun onglet TEST trouvé. Exécutez d\'abord le pipeline.');
    }

    // Statistiques globales
    let totalEleves = 0;
    let totalFilles = 0;
    let totalGarcons = 0;
    const classesStats = [];
    const lv2Stats = {};
    const optionsStats = {};

    testSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      // Trouver les colonnes
      const colSexe = headers.indexOf('SEXE');
      const colLV2 = headers.indexOf('LV2');
      const colOPT = headers.indexOf('OPT');

      const rows = data.slice(1).filter(row => row[0]); // Ignorer lignes vides

      const filles = rows.filter(row => row[colSexe] === 'F').length;
      const garcons = rows.filter(row => row[colSexe] === 'M').length;

      totalEleves += rows.length;
      totalFilles += filles;
      totalGarcons += garcons;

      classesStats.push({
        nom: sheet.getName(),
        effectif: rows.length,
        filles: filles,
        garcons: garcons,
        scoreMoyen: null // TODO: calculer si besoin
      });

      // Stats LV2
      rows.forEach(row => {
        const lv2 = row[colLV2];
        if (lv2) {
          lv2Stats[lv2] = (lv2Stats[lv2] || 0) + 1;
        }

        const opt = row[colOPT];
        if (opt) {
          optionsStats[opt] = (optionsStats[opt] || 0) + 1;
        }
      });
    });

    const effectifMoyen = Math.round(totalEleves / testSheets.length);
    const paritePourcentage = totalEleves > 0
      ? Math.round((totalFilles / totalEleves) * 100)
      : 50;
    const parite = `${paritePourcentage}/${100 - paritePourcentage}`;

    // Générer des alertes si déséquilibres
    const alertes = [];

    // Alerte parité
    if (Math.abs(paritePourcentage - 50) > 10) {
      alertes.push({
        type: 'warning',
        message: `Déséquilibre de parité détecté : ${parite} (F/M). Écart > 10%.`
      });
    }

    // Alerte effectifs
    classesStats.forEach(c => {
      const ecart = Math.abs(c.effectif - effectifMoyen);
      if (ecart > 3) {
        alertes.push({
          type: 'warning',
          message: `Classe ${c.nom} : effectif ${c.effectif} (écart de ${ecart} par rapport à la moyenne ${effectifMoyen})`
        });
      }
    });

    Logger.log('✅ [WIZARD] Rapport généré');

    return {
      totalEleves: totalEleves,
      nbClasses: testSheets.length,
      effectifMoyen: effectifMoyen,
      parite: parite,
      classes: classesStats,
      lv2: lv2Stats,
      options: optionsStats,
      alertes: alertes
    };

  } catch (e) {
    Logger.log(`❌ [WIZARD] Erreur génération rapport: ${e}`);
    throw new Error(`Impossible de générer le rapport: ${e.message}`);
  }
}

/**
 * Finalise la répartition : copie TEST → DEF (Phase 6)
 */
function wizard_finaliserTestVersDef() {
  try {
    Logger.log('🏁 [WIZARD] Finalisation TEST → DEF');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const testSheets = ss.getSheets().filter(s => s.getName().endsWith('TEST'));

    if (testSheets.length === 0) {
      throw new Error('Aucun onglet TEST à finaliser');
    }

    let nbCopies = 0;

    testSheets.forEach(testSheet => {
      const nomTest = testSheet.getName();
      const nomDef = nomTest.replace('TEST', 'DEF');

      // Supprimer l'onglet DEF s'il existe
      const defExistant = ss.getSheetByName(nomDef);
      if (defExistant) {
        ss.deleteSheet(defExistant);
      }

      // Copier TEST → DEF
      const newDef = testSheet.copyTo(ss);
      newDef.setName(nomDef);

      // Déplacer DEF après TEST
      const position = testSheet.getIndex() + 1;
      ss.moveActiveSheet(position);

      nbCopies++;
    });

    // Enregistrer dans l'historique
    ajouterHistorique('Finalisation TEST → DEF', `${nbCopies} classe(s) finalisée(s)`);

    Logger.log(`✅ [WIZARD] ${nbCopies} classe(s) finalisée(s)`);

    return {
      ok: true,
      message: `${nbCopies} classe(s) finalisée(s) avec succès`,
      nbCopies: nbCopies
    };

  } catch (e) {
    Logger.log(`❌ [WIZARD] Erreur finalisation: ${e}`);
    throw new Error(`Impossible de finaliser: ${e.message}`);
  }
}

/**
 * Récupère l'historique des actions
 */
function wizard_getHistorique() {
  try {
    const userProps = PropertiesService.getUserProperties();
    const historique = userProps.getProperty('WIZARD_HISTORIQUE');

    if (!historique) {
      return [];
    }

    return JSON.parse(historique);

  } catch (e) {
    Logger.log(`❌ [WIZARD] Erreur chargement historique: ${e}`);
    return [];
  }
}

/**
 * Ajoute une entrée à l'historique
 */
function ajouterHistorique(action, resultat) {
  try {
    const userProps = PropertiesService.getUserProperties();
    let historique = [];

    const saved = userProps.getProperty('WIZARD_HISTORIQUE');
    if (saved) {
      historique = JSON.parse(saved);
    }

    historique.push({
      date: new Date().toISOString(),
      action: action,
      resultat: resultat
    });

    // Garder seulement les 20 dernières entrées
    if (historique.length > 20) {
      historique = historique.slice(-20);
    }

    userProps.setProperty('WIZARD_HISTORIQUE', JSON.stringify(historique));

  } catch (e) {
    Logger.log(`⚠️ Erreur ajout historique: ${e}`);
  }
}
