/**
 * TEST MANUEL : Vérifier que la consolidation fonctionne
 * À lancer manuellement pour diagnostiquer
 */
function TEST_ConsolidationManuelle() {
  Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Logger.log("🧪 TEST CONSOLIDATION");
  Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    // 1. Générer les IDs
    Logger.log("\n📝 Étape 1 : Génération des IDs...");
    genererNomPrenomEtID();
    
    // 2. Consolider
    Logger.log("\n📊 Étape 2 : Consolidation...");
    const resultat = consoliderDonnees();
    Logger.log(`\n✅ RÉSULTAT: ${resultat}`);
    
    // 3. Vérifier CONSOLIDATION
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const conso = ss.getSheetByName("CONSOLIDATION");
    if (conso) {
      const nbLignes = conso.getLastRow() - 1; // -1 pour l'en-tête
      Logger.log(`\n📈 CONSOLIDATION contient ${nbLignes} élèves`);
    } else {
      Logger.log("\n❌ CONSOLIDATION n'existe pas !");
    }
    
    Logger.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Logger.log("🎉 TEST TERMINÉ");
    
  } catch (e) {
    Logger.log(`\n❌ ERREUR: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * TEST : Vérifier uniquement la détection des sources
 */
function TEST_DetectionSources() {
  Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Logger.log("🔍 TEST DÉTECTION SOURCES");
  Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();
  const sourceSheets = allSheets.filter(s => /.+°\d+$/.test(s.getName()));
  
  Logger.log(`\n✅ ${sourceSheets.length} sources détectées:`);
  sourceSheets.forEach(s => {
    const nbLignes = s.getLastRow() - 1;
    Logger.log(`   - ${s.getName()} : ${nbLignes} élèves`);
  });
  
  Logger.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
