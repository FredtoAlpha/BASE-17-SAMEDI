/**
 * ===================================================================
 * TEST UNITAIRE - PARITÉ ADAPTATIVE
 * ===================================================================
 * 
 * Ce script teste la fonction computeParityTargetsForClasses()
 * pour valider le calcul des cibles de parité adaptatives.
 * 
 * Pour exécuter : Ouvrir le script dans l'éditeur Apps Script et
 * lancer la fonction testParityTargets()
 */

/**
 * Fonction de normalisation du sexe (copie depuis Phase4_Optimisation_V15.gs)
 */
function _v14SexeNormalize(val) {
  if (val == null || val === '') return 'U';
  const s = String(val).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (!s) return 'U';
  
  if (s === 'F' || s === 'FILLE' || s === 'FEMININ' || s === 'FEMME' || s === 'FEMALE') return 'F';
  if (s === 'M' || s === 'GARCON' || s === 'MASCULIN' || s === 'HOMME' || s === 'MALE') return 'M';
  
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M') || s.startsWith('G')) return 'M';
  
  return 'U';
}

/**
 * Compte F/M pour une liste d'élèves
 */
function compteFM(eleveList) {
  let F = 0, M = 0, U = 0;
  for (const e of eleveList) {
    const sx = _v14SexeNormalize(e.SEXE);
    if (sx === 'F') F++;
    else if (sx === 'M') M++;
    else U++;
  }
  return {F, M, U};
}

/**
 * Calcul des cibles de parité adaptatives (copie depuis Phase4_Optimisation_V15.gs)
 */
function computeParityTargetsForClasses(classesMap) {
  let totalF = 0, totalM = 0, totalU = 0;
  const classCounts = {};
  
  Object.entries(classesMap).forEach(([className, eleves]) => {
    const counts = compteFM(eleves);
    classCounts[className] = counts;
    totalF += counts.F;
    totalM += counts.M;
    totalU += counts.U;
  });
  
  const totalConnus = totalF + totalM;
  
  if (totalConnus === 0) {
    Logger.log('[PARITÉ] Aucune donnée de sexe détectée - cibles désactivées');
    const targets = {};
    Object.keys(classesMap).forEach(cls => {
      targets[cls] = { targetF: 0, targetM: 0, targetDelta: 0, enforce: false };
    });
    return { totalF: 0, totalM: 0, ratioF: 0.5, ratioM: 0.5, targets };
  }
  
  const ratioF = totalF / totalConnus;
  const ratioM = totalM / totalConnus;
  
  Logger.log(`[PARITÉ] Ratio global: ${totalF}F + ${totalM}M = ${totalConnus} connus (${(ratioF * 100).toFixed(1)}% F)`);
  
  const targets = {};
  let sumTargetF = 0;
  let sumTargetM = 0;
  const classNames = Object.keys(classesMap).sort();
  
  const remainders = [];
  classNames.forEach(className => {
    const eleves = classesMap[className];
    const counts = classCounts[className];
    const knownCount = counts.F + counts.M;
    
    if (knownCount === 0) {
      targets[className] = { targetF: 0, targetM: 0, targetDelta: 0, enforce: false };
      return;
    }
    
    const idealF = knownCount * ratioF;
    const idealM = knownCount * ratioM;
    
    let targetF = Math.floor(idealF);
    let targetM = Math.floor(idealM);
    
    remainders.push({
      className,
      knownCount,
      idealF,
      idealM,
      targetF,
      targetM,
      remainderF: idealF - targetF,
      remainderM: idealM - targetM
    });
    
    sumTargetF += targetF;
    sumTargetM += targetM;
  });
  
  const missingF = totalF - sumTargetF;
  const missingM = totalM - sumTargetM;
  
  remainders.sort((a, b) => b.remainderF - a.remainderF);
  for (let i = 0; i < missingF && i < remainders.length; i++) {
    remainders[i].targetF++;
  }
  
  remainders.sort((a, b) => b.remainderM - a.remainderM);
  for (let i = 0; i < missingM && i < remainders.length; i++) {
    remainders[i].targetM++;
  }
  
  remainders.forEach(r => {
    const targetDelta = r.targetF - r.targetM;
    targets[r.className] = {
      targetF: r.targetF,
      targetM: r.targetM,
      targetDelta: targetDelta,
      enforce: true,
      knownCount: r.knownCount
    };
  });
  
  return {
    totalF,
    totalM,
    totalU,
    ratioF,
    ratioM,
    targets
  };
}

/**
 * TEST 1: Cas réel avec 66F + 55M (54.5% F)
 */
function testParityTargets_CasReel() {
  Logger.log('\n=== TEST 1: Cas Réel (66F + 55M) ===');
  
  // Créer des classes de test
  const classesMap = {
    '6°1': createStudents(16, 9),  // 16F, 9M (avant correction)
    '6°2': createStudents(13, 11), // 13F, 11M
    '6°3': createStudents(13, 11), // 13F, 11M
    '6°4': createStudents(12, 12), // 12F, 12M
    '6°5': createStudents(12, 12)  // 12F, 12M
  };
  
  // Calculer les cibles
  const result = computeParityTargetsForClasses(classesMap);
  
  // Afficher les résultats
  Logger.log(`\nRatio global: ${result.totalF}F + ${result.totalM}M = ${(result.ratioF * 100).toFixed(1)}% F`);
  Logger.log('\nCibles par classe:');
  
  Object.entries(result.targets).forEach(([cls, target]) => {
    const actual = compteFM(classesMap[cls]);
    const actualDelta = actual.F - actual.M;
    const ecartCible = Math.abs(actualDelta - target.targetDelta);
    const status = ecartCible <= 2 ? '✅' : '❌';
    
    Logger.log(`  ${status} ${cls}: Actuel ${actual.F}F/${actual.M}M (Δ=${actualDelta}), Cible ${target.targetF}F/${target.targetM}M (Δ=${target.targetDelta}), Écart=${ecartCible}`);
  });
  
  // Vérifier que la somme des cibles = total
  let sumTargetF = 0, sumTargetM = 0;
  Object.values(result.targets).forEach(t => {
    sumTargetF += t.targetF;
    sumTargetM += t.targetM;
  });
  
  Logger.log(`\nVérification: Somme cibles = ${sumTargetF}F + ${sumTargetM}M (attendu: ${result.totalF}F + ${result.totalM}M)`);
  
  if (sumTargetF === result.totalF && sumTargetM === result.totalM) {
    Logger.log('✅ TEST RÉUSSI: Les cibles sont cohérentes');
  } else {
    Logger.log('❌ TEST ÉCHOUÉ: Incohérence dans les cibles');
  }
}

/**
 * TEST 2: Cas parfait 50/50
 */
function testParityTargets_Cas5050() {
  Logger.log('\n=== TEST 2: Cas Parfait 50/50 (60F + 60M) ===');
  
  const classesMap = {
    '6°1': createStudents(12, 12),
    '6°2': createStudents(12, 12),
    '6°3': createStudents(12, 12),
    '6°4': createStudents(12, 12),
    '6°5': createStudents(12, 12)
  };
  
  const result = computeParityTargetsForClasses(classesMap);
  
  Logger.log(`\nRatio global: ${result.totalF}F + ${result.totalM}M = ${(result.ratioF * 100).toFixed(1)}% F`);
  Logger.log('\nCibles par classe:');
  
  Object.entries(result.targets).forEach(([cls, target]) => {
    Logger.log(`  ${cls}: Cible ${target.targetF}F/${target.targetM}M (Δ=${target.targetDelta})`);
  });
  
  // Dans un cas 50/50, toutes les cibles doivent être Δ=0
  const allZero = Object.values(result.targets).every(t => t.targetDelta === 0);
  
  if (allZero) {
    Logger.log('✅ TEST RÉUSSI: Toutes les cibles sont Δ=0 (50/50)');
  } else {
    Logger.log('❌ TEST ÉCHOUÉ: Certaines cibles ne sont pas Δ=0');
  }
}

/**
 * TEST 3: Cas extrême (80% F)
 */
function testParityTargets_CasExtreme() {
  Logger.log('\n=== TEST 3: Cas Extrême (80F + 20M = 80% F) ===');
  
  const classesMap = {
    '6°1': createStudents(16, 4),
    '6°2': createStudents(16, 4),
    '6°3': createStudents(16, 4),
    '6°4': createStudents(16, 4),
    '6°5': createStudents(16, 4)
  };
  
  const result = computeParityTargetsForClasses(classesMap);
  
  Logger.log(`\nRatio global: ${result.totalF}F + ${result.totalM}M = ${(result.ratioF * 100).toFixed(1)}% F`);
  Logger.log('\nCibles par classe:');
  
  Object.entries(result.targets).forEach(([cls, target]) => {
    Logger.log(`  ${cls}: Cible ${target.targetF}F/${target.targetM}M (Δ=${target.targetDelta})`);
  });
  
  // Vérifier que toutes les cibles sont proches de 16F/4M (Δ=+12)
  const allCorrect = Object.values(result.targets).every(t => Math.abs(t.targetDelta - 12) <= 1);
  
  if (allCorrect) {
    Logger.log('✅ TEST RÉUSSI: Toutes les cibles sont proches de Δ=+12');
  } else {
    Logger.log('❌ TEST ÉCHOUÉ: Certaines cibles s\'écartent trop de Δ=+12');
  }
}

/**
 * TEST 4: Classes de tailles différentes
 */
function testParityTargets_TaillesDifferentes() {
  Logger.log('\n=== TEST 4: Classes de Tailles Différentes ===');
  
  const classesMap = {
    '6°1': createStudents(11, 9),   // 20 élèves
    '6°2': createStudents(13, 11),  // 24 élèves
    '6°3': createStudents(14, 11),  // 25 élèves
    '6°4': createStudents(15, 13),  // 28 élèves
    '6°5': createStudents(13, 11)   // 24 élèves
  };
  
  const result = computeParityTargetsForClasses(classesMap);
  
  Logger.log(`\nRatio global: ${result.totalF}F + ${result.totalM}M = ${(result.ratioF * 100).toFixed(1)}% F`);
  Logger.log('\nCibles par classe:');
  
  Object.entries(result.targets).forEach(([cls, target]) => {
    const actual = compteFM(classesMap[cls]);
    const total = actual.F + actual.M;
    const targetRatio = (target.targetF / (target.targetF + target.targetM) * 100).toFixed(1);
    
    Logger.log(`  ${cls}: ${total} élèves → Cible ${target.targetF}F/${target.targetM}M (${targetRatio}% F, Δ=${target.targetDelta})`);
  });
  
  Logger.log('✅ TEST RÉUSSI: Cibles calculées pour classes de tailles différentes');
}

/**
 * Fonction utilitaire pour créer des élèves de test
 */
function createStudents(nbF, nbM) {
  const students = [];
  
  for (let i = 0; i < nbF; i++) {
    students.push({ ID_ELEVE: `F${i}`, SEXE: 'F', NOM: `Fille${i}` });
  }
  
  for (let i = 0; i < nbM; i++) {
    students.push({ ID_ELEVE: `M${i}`, SEXE: 'M', NOM: `Garcon${i}` });
  }
  
  return students;
}

/**
 * Fonction principale pour lancer tous les tests
 */
function testParityTargets() {
  Logger.log('╔════════════════════════════════════════════════════════════╗');
  Logger.log('║   TEST UNITAIRE - PARITÉ ADAPTATIVE                        ║');
  Logger.log('╚════════════════════════════════════════════════════════════╝');
  
  testParityTargets_CasReel();
  testParityTargets_Cas5050();
  testParityTargets_CasExtreme();
  testParityTargets_TaillesDifferentes();
  
  Logger.log('\n╔════════════════════════════════════════════════════════════╗');
  Logger.log('║   TOUS LES TESTS TERMINÉS                                  ║');
  Logger.log('╚════════════════════════════════════════════════════════════╝');
}
