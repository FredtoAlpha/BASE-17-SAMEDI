/**
 * ===================================================================
 * 🚀 BASE-17 ULTIMATE - POINT D'ENTRÉE PRINCIPAL
 * ===================================================================
 * Version : 3.5 (Finale & Nettoyée)
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 PILOTAGE CLASSE')
    .addItem('📊 Ouvrir la Console V3', 'ouvrirConsolePilotageV3')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🛠️ Outils Spécifiques')
        .addItem('➕ Intégrer un Nouvel Élève', 'ouvrirModuleNouvelEleve')
        .addItem('👥 Créer des Groupes', 'ouvrirModuleGroupes'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🔍 Diagnostic ASSO/DISSO')
        .addItem('📋 Analyser les colonnes', 'diagnosticAssoDisso')
        .addItem('🔄 Inverser ASSO ↔ DISSO', 'inverserAssoDisso'))
    .addSeparator()
    .addItem('⚙️ Configuration Avancée', 'ouvrirConfigurationStructure')
    .addItem('🔓 Déverrouiller _STRUCTURE', 'deverrouillerStructure')
    .addToUi();

  Logger.log('✅ Menu V3 Ultimate chargé');
}

// --- ACCÈS WEB (Interface Profs) ---
function doGet(e) {
  return HtmlService.createTemplateFromFile('InterfaceV2')
    .evaluate()
    .setTitle('Interface Répartition - Professeurs')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- LANCEURS MODALES ---
function ouvrirConsolePilotageV3() {
  const html = HtmlService.createHtmlOutputFromFile('ConsolePilotageV3')
    .setWidth(1600).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Console de Pilotage V3 - Expert Edition');
}

function ouvrirConfigurationStructure() {
  const html = HtmlService.createHtmlOutputFromFile('ConfigurationComplete')
    .setWidth(1200).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuration de la Structure');
}

function ouvrirConfigurationComplete() {
  const html = HtmlService.createHtmlOutputFromFile('ConfigurationComplete')
    .setWidth(1200).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuration Complète');
}

function ouvrirModuleGroupes() {
  const html = HtmlService.createHtmlOutputFromFile('GroupsInterfaceV4')
    .setWidth(1400).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Module Groupes');
}

function ouvrirModuleNouvelEleve() {
  const html = HtmlService.createHtmlOutputFromFile('InterfaceV2_NewStudentModule')
    .setWidth(1000).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Intégration Nouvel Élève');
}

// --- UTILITAIRES ADMIN & COMPATIBILITÉ ---
function deverrouillerStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_STRUCTURE');
  if (sheet) {
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
    SpreadsheetApp.getUi().alert('✅ Onglet _STRUCTURE déverrouillé.');
  } else {
    SpreadsheetApp.getUi().alert('⚠️ Onglet _STRUCTURE introuvable.');
  }
}

function legacy_runFullPipeline() {
  if (typeof legacy_runFullPipeline_PRIME === 'function') {
    return legacy_runFullPipeline_PRIME();
  }
  SpreadsheetApp.getUi().alert("❌ Erreur : Moteur LEGACY introuvable.");
}

function legacy_viewSourceClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheets = ss.getSheets().filter(s => /.+°\d+$/.test(s.getName())); // ✅ Pattern universel
  if (sourceSheets.length > 0) {
    ss.setActiveSheet(sourceSheets[0]);
    SpreadsheetApp.getUi().alert('Classes sources trouvées : ' + sourceSheets.map(s => s.getName()).join(', '));
  } else {
    SpreadsheetApp.getUi().alert('Aucune classe source trouvée.');
  }
}

function legacy_openStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_STRUCTURE');
  if (sheet) ss.setActiveSheet(sheet);
}
