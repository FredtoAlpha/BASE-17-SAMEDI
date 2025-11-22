// ... (début du fichier ConsolePilotage_Server.gs) ...

/**
 * Fournit le contexte de pont à l'InterfaceV2 et le supprime ensuite.
 * C'est la fonction appelée par l'InterfaceV2 à son initialisation.
 * @returns {Object} Un objet contenant {success: Boolean, context: Object|null}.
 */
/**
 * Copie les onglets ...TEST vers ...DEF.
 * C'est l'action finale et irréversible de la console.
 */
function finalizeProcess() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const testSheets = ss.getSheets().filter(s => s.getName().endsWith('TEST'));

    if (testSheets.length === 0) {
      throw new Error("Aucun onglet ...TEST à finaliser.");
    }

    let finalizedCount = 0;
    testSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const finalName = sheetName.replace(/TEST$/, 'DEF');

      // Supprimer l'ancien onglet DEF s'il existe
      const oldDefSheet = ss.getSheetByName(finalName);
      if (oldDefSheet) {
        ss.deleteSheet(oldDefSheet);
      }

      // Copier l'onglet TEST vers le nouvel onglet DEF
      const newDefSheet = sheet.copyTo(ss);
      newDefSheet.setName(finalName);

      // Rendre la feuille visible et la protéger (facultatif)
      newDefSheet.showSheet();

      finalizedCount++;
    });

    return { success: true, message: `${finalizedCount} classe(s) ont été finalisées avec succès.` };
  } catch (e) {
    console.error(`Erreur dans finalizeProcess: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Stores the necessary context for InterfaceV2 to initialize.
 * @param {string} mode - The mode to load (e.g., 'TEST').
 */
function setBridgeContext(mode, sourceSheetName) {
  try {
    const context = {
      mode: mode,
      sourceSheetName: sourceSheetName,
      timestamp: new Date().toISOString()
    };
    PropertiesService.getUserProperties().setProperty('JULES_CONTEXT', JSON.stringify(context));
    return { success: true };
  } catch (e) {
    console.error(`Erreur dans setBridgeContext: ${e.message}`);
    return { success: false, error: e.message };
  }
}
