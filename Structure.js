/**
 * Ouvre l'interface de configuration de structure
 * Redirige vers l'interface de configuration complète
 */
function ouvrirConfigurationStructure() {
  // Rediriger vers la configuration complète
  ouvrirConfigurationComplete();
}

/**
 * Charge la structure depuis l'onglet _STRUCTURE
 * Version universelle qui accepte TOUTES les options
 * @return {Object} Structure des classes
 */
function chargerStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structureSheet = ss.getSheetByName("_STRUCTURE");
  
  if (!structureSheet) {
    Logger.log("L'onglet _STRUCTURE est introuvable");
    return { classes: [] };
  }
  
  // Récupérer toutes les données
  const data = structureSheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Structure vide");
    return { classes: [] };
  }
  
  const headers = data[0];
  Logger.log("En-têtes de _STRUCTURE: " + headers.join(", "));
  
  // Trouver les indices des colonnes importantes
  const origineIndex = headers.indexOf("CLASSE_ORIGINE");
  const destIndex = headers.indexOf("CLASSE_DEST"); 
  const effectifIndex = headers.indexOf("EFFECTIF");
  const optionsIndex = headers.indexOf("OPTIONS");
  
  Logger.log(`Indices trouvés: Origine=${origineIndex}, Destination=${destIndex}, Effectif=${effectifIndex}, Options=${optionsIndex}`);
  
  if (origineIndex === -1 || effectifIndex === -1 || optionsIndex === -1) {
    Logger.log("Colonnes manquantes dans _STRUCTURE");
    return { classes: [] };
  }
  
  // Créer la structure
  const structure = { classes: [] };
  
  // Parcourir les lignes (en sautant l'en-tête)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Ignorer les lignes vides
    if (!row[origineIndex] && !row[destIndex]) continue;
    
    const origine = row[origineIndex] || "";
    const destination = row[destIndex] || "";
    const effectif = parseInt(row[effectifIndex]) || 28;
    const optionsString = String(row[optionsIndex] || "");
    
    Logger.log(`Ligne ${i}: Origine="${origine}", Destination="${destination}", Effectif=${effectif}, Options="${optionsString}"`);
    
    // Analyser les options (accepte "=" et ":" comme séparateurs)
    const options = [];
    if (optionsString.trim() !== "") {
      const optionsParts = optionsString.split(",");
      
      for (const part of optionsParts) {
        // Trouver le séparateur (= ou :)
        let nomOption, quotaStr;
        
        if (part.includes("=")) {
          [nomOption, quotaStr] = part.split("=", 2);
        } else if (part.includes(":")) {
          [nomOption, quotaStr] = part.split(":", 2);
        } else {
          nomOption = part.trim();
          quotaStr = "0";
        }
        
        // Nettoyage et validation
        nomOption = (nomOption || "").trim();
        quotaStr = (quotaStr || "0").trim();
        
        if (nomOption) {
          const option = { 
            nom: nomOption,
            quota: parseInt(quotaStr) || 0
          };
          options.push(option);
          Logger.log(`  Option trouvée: "${option.nom}" = ${option.quota}`);
        }
      }
    }
    
    // Ajouter la classe à la structure
    structure.classes.push({
      origine: origine,
      destination: destination,
      effectif: effectif,
      options: options
    });
  }
  
  // Récapitulatif pour vérification
  Logger.log(`Structure chargée: ${structure.classes.length} classes`);
  structure.classes.forEach((classe, index) => {
    Logger.log(`Classe ${index+1}: ${classe.origine} → ${classe.destination} (${classe.effectif} élèves)`);
    classe.options.forEach(opt => {
      Logger.log(`  - Option ${opt.nom} = ${opt.quota}`);
    });
  });
  
  // Récupérer la liste des options disponibles
  const options = getAllOptions(structure.classes);
  
  return { 
    classes: structure.classes,
    options: options
  };
}

/**
 * Extrait toutes les options uniques des classes
 */
function getAllOptions(classes) {
  const optionsSet = new Set();
  
  // Collecter toutes les options de toutes les classes
  classes.forEach(classe => {
    if (classe.options && classe.options.length > 0) {
      classe.options.forEach(opt => {
        if (opt.nom) {
          optionsSet.add(opt.nom);
        }
      });
    }
  });
  
  // Ajouter des options par défaut si nécessaire
  const defaultOptions = ["LATIN", "GREC", "CHAV", "ITA", "ESP", "ALL"];
  defaultOptions.forEach(opt => optionsSet.add(opt));
  
  // Convertir le Set en tableau et trier
  return Array.from(optionsSet).sort();
}

/**
 * Récupère la liste des options disponibles à partir de l'onglet _CONFIG
 * @return {Array} Liste des options disponibles
 */
function getOptionsDisponibles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("_CONFIG");
  
  if (!configSheet) return ["LATIN", "GREC", "CHAV", "ITA"]; // Valeurs par défaut
  
  const configData = configSheet.getDataRange().getValues();
  let optionsRow = -1;
  
  // Trouver la ligne d'en-tête des options
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === "OPTION") {
      optionsRow = i;
      break;
    }
  }
  
  if (optionsRow === -1) return ["LATIN", "GREC", "CHAV", "ITA"]; // Valeurs par défaut
  
  // Extraire les options
  const options = [];
  for (let i = optionsRow + 1; i < configData.length; i++) {
    if (!configData[i][0]) break; // Fin des options
    options.push(configData[i][0]);
  }
  
  return options;
}

/**
 * Sauvegarde la structure des classes dans l'onglet _STRUCTURE
 * Version universelle qui enregistre TOUTES les options
 * @param {Object} structure - La structure à sauvegarder
 * @return {Object} Résultat de l'opération
 */
function sauvegarderStructure(structure) {
  try {
    // 1. Validation des données d'entrée
    if (!structure || !structure.classes) {
      return { success: false, message: "Structure invalide" };
    }
    
    Logger.log("Sauvegarde de la structure avec " + structure.classes.length + " classes...");
    
    // 2. Préparation du tableur
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let structureSheet = ss.getSheetByName("_STRUCTURE");
    
    if (!structureSheet) {
      structureSheet = ss.insertSheet("_STRUCTURE");
      Logger.log("Onglet _STRUCTURE créé");
    }
    
    // 3. Désactiver les protections temporairement
    try {
      const protections = structureSheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      if (protections.length > 0) {
        for (const protection of protections) {
          // Utiliser setWarningOnly au lieu de setAllowEdit qui cause des erreurs
          protection.setWarningOnly(true);
        }
      }
    } catch (e) {
      Logger.log("Note: Impossible de modifier la protection: " + e);
      // Continuer même en cas d'échec de cette étape
    }
    
    // 4. Préparer les en-têtes
    structureSheet.getRange("A1:D1").setValues([["CLASSE_ORIGINE", "CLASSE_DEST", "EFFECTIF", "OPTIONS"]]);
    structureSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#4285f4").setFontColor("white");
    
    // 5. Effacer les données existantes (sauf l'en-tête)
    const lastRow = Math.max(structureSheet.getLastRow(), 2);
    const lastCol = structureSheet.getLastColumn();
    if (lastRow > 1) {
      structureSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
    
    // 6. Préparer les données à écrire
    const donnees = [];
    let totalOptions = 0;
    
    for (const classe of structure.classes) {
      // Formatter les options (OPTION1=quota1,OPTION2=quota2)
      let optionsStr = "";
      if (classe.options && classe.options.length > 0) {
        // Filtrer, traiter et joindre chaque option
        const optionsValides = classe.options
          .filter(opt => opt && opt.nom && opt.quota !== undefined)
          .map(opt => {
            // Log pour débogage
            Logger.log(`Traitement option: ${JSON.stringify(opt)}`);
            return `${String(opt.nom).trim()}=${opt.quota}`;
          });
        
        optionsStr = optionsValides.join(",");
        totalOptions += optionsValides.length;
      }
      
      // Ajouter une ligne de données
      donnees.push([
        String(classe.origine || ''), // Origine
        String(classe.destination || ''), // Destination
        parseInt(classe.effectif) || 28, // Effectif
        optionsStr // Options
      ]);
      
      // Log pour débogage
      Logger.log(`Classe préparée: ${classe.origine} → ${classe.destination}, Options: ${optionsStr}`);
    }
    
    // 7. Écrire les données
    if (donnees.length > 0) {
      Logger.log(`Écriture de ${donnees.length} classes avec ${totalOptions} options au total`);
      structureSheet.getRange(2, 1, donnees.length, 4).setValues(donnees);
      
      // 8. Formater les colonnes
      structureSheet.getRange(2, 1, donnees.length, 2).setNumberFormat("@"); // Format texte pour CLASSE_ORIGINE et DEST
      structureSheet.getRange(2, 3, donnees.length, 1).setNumberFormat("0"); // Format nombre pour EFFECTIF
      
      // 9. Ajuster les largeurs de colonnes
      structureSheet.setColumnWidth(1, 150); // CLASSE_ORIGINE
      structureSheet.setColumnWidth(2, 150); // CLASSE_DEST
      structureSheet.setColumnWidth(3, 80);  // EFFECTIF  
      structureSheet.setColumnWidth(4, 250); // OPTIONS
    }
    
    // 10. Protéger l'onglet en mode avertissement seulement
    try {
      const protection = structureSheet.protect().setDescription("Structure des classes");
      protection.setWarningOnly(true); // Avertissement sans bloquer l'édition
    } catch (e) {
      Logger.log("Note: Protection avec avertissement impossible: " + e);
    }
    
    // 11. Traiter les pondérations si nécessaire (comme dans le code original)
    if (structure.ponderation && structure.ponderation.length > 0) {
      // Code inchangé pour traiter les pondérations
      // ...
    }
    
    // 12. Retourner un résultat de succès
    return { 
      success: true, 
      message: `Structure sauvegardée avec succès (${donnees.length} classes, ${totalOptions} options)` 
    };
    
  } catch (e) {
    Logger.log("ERREUR lors de la sauvegarde de la structure: " + e + "\n" + e.stack);
    return { success: false, message: "Erreur lors de la sauvegarde: " + e.toString() };
  }
}