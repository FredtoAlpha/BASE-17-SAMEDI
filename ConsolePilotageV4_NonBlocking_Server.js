/**
 * ===================================================================
 * 🚀 Console de Pilotage V4 - Backend NON-BLOQUANT
 * ===================================================================
 *
 * Ce fichier contient les fonctions backend pour la Console V4
 * qui utilise showModelessDialog (NON BLOQUANT) au lieu de
 * showModalDialog (BLOQUANT).
 *
 * ZÉRO POPUP ! TOUT DANS L'INTERFACE !
 *
 * @version 4.0.0
 * @date 2025-11-15
 * ===================================================================
 */

/**
 * ===================================================================
 * OUVERTURE DE L'INTERFACE NON-BLOQUANTE
 * ===================================================================
 */

/**
 * Ouvre la Console de Pilotage V4 en mode NON-BLOQUANT
 * L'utilisateur peut continuer à utiliser Google Sheets
 * pendant que l'interface est ouverte.
 */
function ouvrirConsolePilotageV4_NonBlocking() {
  const html = HtmlService.createHtmlOutputFromFile('ConsolePilotageV4_NonBlocking')
    .setWidth(900)
    .setHeight(800);

  // UTILISE showModelessDialog au lieu de showModalDialog
  // Cela permet de ne PAS bloquer l'accès à Google Sheets !
  SpreadsheetApp.getUi().showModelessDialog(html, '🚀 Console de Pilotage V4 - Non-Bloquante');
}

/**
 * ===================================================================
 * INITIALISATION INTÉGRÉE - ZÉRO POPUP
 * ===================================================================
 */

/**
 * Initialise le système avec les données du formulaire INTÉGRÉ
 * Plus besoin de multiples popups !
 *
 * @param {Object} formData - Les données du formulaire
 * @param {string} formData.adminPassword - Mot de passe admin
 * @param {string} formData.niveau - Niveau scolaire (6°, 5°, 4°, 3°)
 * @param {number} formData.nbSources - Nombre de sources
 * @param {number} formData.nbDestinations - Nombre de destinations
 * @param {string} formData.lv2Options - LV2 (séparées par virgules)
 * @param {string} formData.otherOptions - Options (séparées par virgules)
 * @returns {Object} {success: boolean, message?: string, error?: string}
 */
function v4_runInitialization(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getConfig();

    // 1. Vérifier le mot de passe (cherche d'abord ADMIN_PASSWORD, sinon ADMIN_PASSWORD_DEFAULT)
    const expectedPassword = config.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD_DEFAULT || "admin123";
    if (formData.adminPassword !== expectedPassword) {
      return {
        success: false,
        error: "Mot de passe administrateur incorrect"
      };
    }

    // 2. Valider les données (Validation OUVERTE - accepte n'importe quel niveau)
    if (!formData.niveau || formData.niveau.trim() === "") {
      return {
        success: false,
        error: "Niveau scolaire requis"
      };
    }

    if (formData.nbSources < 1 || formData.nbSources > 20) {
      return {
        success: false,
        error: "Nombre de sources invalide (1-20)"
      };
    }

    if (formData.nbDestinations < 1 || formData.nbDestinations > 15) {
      return {
        success: false,
        error: "Nombre de destinations invalide (1-15)"
      };
    }

    // 3. Nettoyer les LV2 et Options
    const lv2Array = nettoyerListeInput(formData.lv2Options);
    const optionsArray = nettoyerListeInput(formData.otherOptions);

    Logger.log(`V4 Init - Niveau: ${formData.niveau}`);
    Logger.log(`V4 Init - Sources: ${formData.nbSources}`);
    Logger.log(`V4 Init - Destinations: ${formData.nbDestinations}`);
    Logger.log(`V4 Init - LV2: ${lv2Array.join(', ')}`);
    Logger.log(`V4 Init - Options: ${optionsArray.join(', ')}`);

    // 4. Vérifier si déjà initialisé
    const structureSheet = ss.getSheetByName(config.SHEETS.STRUCTURE);
    if (structureSheet) {
      // Demander confirmation n'est plus possible sans popup
      // On log simplement et on continue (réinitialisation)
      Logger.log("ATTENTION: Le système est déjà initialisé. Réinitialisation en cours...");
    }

    // 5. Créer les onglets sources
    const sourceLabel = formData.niveau === "6°" ? "École" : determinerNiveauSource(formData.niveau);
    const ongletsSources = [];
    for (let i = 1; i <= formData.nbSources; i++) {
      const nomSource = formData.niveau === "6°"
        ? `${sourceLabel}${String.fromCharCode(64 + i)}`
        : `${sourceLabel}${i}`;
      ongletsSources.push(nomSource);

      // Créer ou nettoyer l'onglet source
      let sheetSource = ss.getSheetByName(nomSource);
      if (!sheetSource) {
        sheetSource = ss.insertSheet(nomSource);
      } else {
        sheetSource.clear();
      }
    }

    // 6. Créer les onglets destinations
    const ongletsDestinations = [];
    for (let i = 1; i <= formData.nbDestinations; i++) {
      const nomDest = `${formData.niveau}${i}`;
      ongletsDestinations.push(nomDest);

      // Créer les versions TEST et DEF
      [nomDest + "TEST", nomDest + "DEF"].forEach(sheetName => {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
        } else {
          sheet.clear();
        }
      });
    }

    // 7. Créer/Mettre à jour _STRUCTURE
    let structureSheetFinal = ss.getSheetByName(config.SHEETS.STRUCTURE);
    if (!structureSheetFinal) {
      structureSheetFinal = ss.insertSheet(config.SHEETS.STRUCTURE);
    } else {
      structureSheetFinal.clear();
    }

    // Écrire les headers
    structureSheetFinal.getRange(1, 1, 1, 5).setValues([
      ["Niveau", "Sources", "Destinations", "LV2", "Options"]
    ]).setFontWeight("bold");

    // Écrire les données
    structureSheetFinal.getRange(2, 1, 1, 5).setValues([
      [
        formData.niveau,
        ongletsSources.join(","),
        ongletsDestinations.join(","),
        lv2Array.join(","),
        optionsArray.join(",")
      ]
    ]);

    // 8. Créer/Mettre à jour CONSOLIDATION
    let consolidationSheet = ss.getSheetByName("CONSOLIDATION");
    if (!consolidationSheet) {
      consolidationSheet = ss.insertSheet("CONSOLIDATION");
    } else {
      consolidationSheet.clear();
    }

    // Headers CONSOLIDATION
    consolidationSheet.getRange(1, 1, 1, 10).setValues([
      ["NOM", "Prénom", "ID", "Source", "LV2", "Options", "Parité", "Groupe", "Classe", "Code"]
    ]).setFontWeight("bold");

    // 9. Logger l'action
    try {
      logAction(`Initialisation V4 - Niveau: ${formData.niveau}, Sources: ${formData.nbSources}, Destinations: ${formData.nbDestinations}`);
    } catch(e) {
      Logger.log(`Initialisation V4 complète (logAction non disponible)`);
    }

    return {
      success: true,
      message: `Système initialisé avec succès pour ${formData.niveau} (${formData.nbSources} sources → ${formData.nbDestinations} destinations)`
    };

  } catch (e) {
    Logger.log(`Erreur dans v4_runInitialization: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message || "Erreur lors de l'initialisation"
    };
  }
}

/**
 * ===================================================================
 * FONCTIONS UTILITAIRES
 * ===================================================================
 */

/**
 * Détermine le niveau source en fonction du niveau de destination
 * @param {string} niveauDest - Le niveau de destination (5°, 4°, 3°)
 * @return {string} Le niveau source
 */
function determinerNiveauSource(niveauDest) {
  const mapping = {
    "5°": "6°",
    "4°": "5°",
    "3°": "4°"
  };
  return mapping[niveauDest] || "6°";
}

/**
 * ===================================================================
 * CRÉATION DU MENU
 * ===================================================================
 */

/**
 * Crée le menu pour ouvrir la Console V4 Non-Bloquante
 * Cette fonction doit être appelée depuis onOpen() dans Code.gs
 */
function createConsolePilotageV4Menu() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Console V4 (Non-Bloquante)')
    .addItem('📊 Ouvrir la Console V4', 'ouvrirConsolePilotageV4_NonBlocking')
    .addSeparator()
    .addItem('📈 Voir les Métriques', 'showV3Metrics')
    .addToUi();
}
