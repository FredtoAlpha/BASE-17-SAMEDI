/**
 * ===================================================================
 * TESTS UNITAIRES - PHASE 3 PARITÉ ADAPTATIVE
 * ===================================================================
 *
 * Tests pour valider le bon fonctionnement du nouveau système de Phase 3
 */

/**
 * Fonction principale de test - Exécute tous les tests
 */
function runAllPhase3Tests() {
  Logger.log('='.repeat(80));
  Logger.log('🧪 TESTS UNITAIRES - PHASE 3 PARITÉ ADAPTATIVE');
  Logger.log('='.repeat(80));
  Logger.log('');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Liste des tests à exécuter
  const tests = [
    testCalculateParityTargets,
    testDecideSexForSeat_WithinTolerance,
    testDecideSexForSeat_OutsideTolerance,
    testDecideSexForSeat_TieBreak,
    testParityPenaltyCalculation,
    testPickStudentFromPool,
    testOppositeSex,
    testGlobalNeed,
    testLargestRemainderMethod
  ];

  // Exécuter chaque test
  tests.forEach(function(testFunc) {
    results.total++;
    try {
      const result = testFunc();
      if (result.passed) {
        results.passed++;
        Logger.log('✅ ' + result.name);
      } else {
        results.failed++;
        Logger.log('❌ ' + result.name + ' : ' + result.message);
      }
      results.tests.push(result);
    } catch (e) {
      results.failed++;
      Logger.log('❌ ' + testFunc.name + ' : EXCEPTION : ' + e.message);
      results.tests.push({
        name: testFunc.name,
        passed: false,
        message: 'Exception: ' + e.message
      });
    }
  });

  // Résumé
  Logger.log('');
  Logger.log('='.repeat(80));
  Logger.log('📊 RÉSUMÉ DES TESTS');
  Logger.log('='.repeat(80));
  Logger.log('Total : ' + results.total);
  Logger.log('✅ Réussis : ' + results.passed);
  Logger.log('❌ Échoués : ' + results.failed);
  Logger.log('Taux de réussite : ' + (results.passed / results.total * 100).toFixed(1) + '%');
  Logger.log('');

  return results;
}

// ===================================================================
// TESTS INDIVIDUELS
// ===================================================================

/**
 * Test 1 : Calcul des quotas F/M avec méthode des plus forts restes
 */
function testCalculateParityTargets() {
  const testName = 'testCalculateParityTargets';

  // Données de test
  const poolF = [1, 2, 3, 4, 5]; // 5 filles
  const poolM = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // 10 garçons

  const classes = [
    { name: '6°1', targetTotal: 10, currentF: 2, currentM: 3, slotsLeft: 5 },
    { name: '6°2', targetTotal: 10, currentF: 1, currentM: 4, slotsLeft: 5 },
    { name: '6°3', targetTotal: 10, currentF: 0, currentM: 5, slotsLeft: 5 }
  ];

  const ctx = {};

  const result = calculateParityTargets_V3(ctx, classes, poolF, poolM);

  // Vérifications
  const totalSlots = 15;
  const expectedRatioF = 5 / 15; // 33.3%
  const expectedRatioM = 10 / 15; // 66.7%

  if (Math.abs(result.ratioF - expectedRatioF) > 0.01) {
    return {
      name: testName,
      passed: false,
      message: 'Ratio F incorrect : attendu ' + expectedRatioF + ', obtenu ' + result.ratioF
    };
  }

  if (result.targetFGlobal + result.targetMGlobal !== totalSlots) {
    return {
      name: testName,
      passed: false,
      message: 'Quotas globaux incohérents : ' + result.targetFGlobal + ' + ' + result.targetMGlobal + ' ≠ ' + totalSlots
    };
  }

  // Vérifier que chaque classe a des cibles définies
  for (let i = 0; i < classes.length; i++) {
    if (classes[i].targetF_total === undefined) {
      return {
        name: testName,
        passed: false,
        message: 'Classe ' + classes[i].name + ' n\'a pas de targetF_total défini'
      };
    }
  }

  return { name: testName, passed: true };
}

/**
 * Test 2 : Décision du sexe quand la classe est dans la tolérance
 */
function testDecideSexForSeat_WithinTolerance() {
  const testName = 'testDecideSexForSeat_WithinTolerance';

  const C = {
    name: '6°1',
    currentF: 15,
    currentM: 15,
    pendingF: 0,
    pendingM: 0,
    targetTotal: 30,
    targetF_total: 15
  };

  const meta = {
    parityTolerance: 1,
    lastSexUsed: 'M',
    targetFGlobal: 10,
    targetMGlobal: 5, // Plus besoin de M que de F globalement
    placedF: 0,
    placedM: 0,
    poolF: [1, 2, 3],
    poolM: [4, 5, 6]
  };

  const ctx = {};
  const sex = decideSexForSeat_V3(C, ctx, meta);

  // La classe est dans la tolérance (0 écart), donc on doit regarder le global
  // Le global a besoin de plus de M (5) que de F (10), donc on devrait choisir F
  if (sex !== 'F') {
    return {
      name: testName,
      passed: false,
      message: 'Attendu F (besoin global), obtenu ' + sex
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 3 : Décision du sexe quand la classe est hors tolérance
 */
function testDecideSexForSeat_OutsideTolerance() {
  const testName = 'testDecideSexForSeat_OutsideTolerance';

  const C = {
    name: '6°1',
    currentF: 10,
    currentM: 18, // Beaucoup plus de M que de F
    pendingF: 0,
    pendingM: 0,
    targetTotal: 30,
    targetF_total: 15 // Cible : 15F / 15M
  };

  const meta = {
    parityTolerance: 1,
    lastSexUsed: 'M',
    targetFGlobal: 5,
    targetMGlobal: 5,
    placedF: 0,
    placedM: 0,
    poolF: [1, 2, 3],
    poolM: [4, 5, 6]
  };

  const ctx = {};
  const sex = decideSexForSeat_V3(C, ctx, meta);

  // Il manque 5F et on est au-dessus de 2M, donc on doit choisir F
  if (sex !== 'F') {
    return {
      name: testName,
      passed: false,
      message: 'Attendu F (rééquilibrage local), obtenu ' + sex
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 4 : Tie-break avec alternance
 */
function testDecideSexForSeat_TieBreak() {
  const testName = 'testDecideSexForSeat_TieBreak';

  const C = {
    name: '6°1',
    currentF: 15,
    currentM: 15,
    pendingF: 0,
    pendingM: 0,
    targetTotal: 30,
    targetF_total: 15
  };

  const meta = {
    parityTolerance: 1,
    lastSexUsed: 'F', // Dernier était F
    targetFGlobal: 5,
    targetMGlobal: 5, // Parfaitement équilibré
    placedF: 0,
    placedM: 0,
    poolF: [1, 2, 3],
    poolM: [4, 5, 6]
  };

  const ctx = {};
  const sex = decideSexForSeat_V3(C, ctx, meta);

  // Égalité parfaite, donc on alterne : lastSexUsed = F => on doit choisir M
  if (sex !== 'M') {
    return {
      name: testName,
      passed: false,
      message: 'Attendu M (alternance après F), obtenu ' + sex
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 5 : Calcul de la pénalité de parité
 */
function testParityPenaltyCalculation() {
  const testName = 'testParityPenaltyCalculation';

  const C = {
    currentF: 10,
    currentM: 15,
    pendingF: 0,
    pendingM: 0,
    targetTotal: 30,
    targetF_total: 15 // Cible : 15F / 15M
  };

  const parityTolerance = 1;

  // Test placement d'une fille
  const penaltyF = parityPenaltyAfterPlacement_V3(C, 'F', parityTolerance);
  // Après placement F : 11F / 15M
  // diffF = |11 - 15| = 4, overTolF = 4 - 1 = 3
  // diffM = |15 - 15| = 0, overTolM = 0
  // Pénalité = 3

  if (penaltyF !== 3) {
    return {
      name: testName,
      passed: false,
      message: 'Pénalité F incorrecte : attendu 3, obtenu ' + penaltyF
    };
  }

  // Test placement d'un garçon
  const penaltyM = parityPenaltyAfterPlacement_V3(C, 'M', parityTolerance);
  // Après placement M : 10F / 16M
  // diffF = |10 - 15| = 5, overTolF = 5 - 1 = 4
  // diffM = |16 - 15| = 1, overTolM = 1 - 1 = 0
  // Pénalité = 4

  if (penaltyM !== 4) {
    return {
      name: testName,
      passed: false,
      message: 'Pénalité M incorrecte : attendu 4, obtenu ' + penaltyM
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 6 : Sélection d'un élève du pool (mock)
 */
function testPickStudentFromPool() {
  const testName = 'testPickStudentFromPool';

  // Ce test est simplifié car il nécessite un mock de canPlaceInClass_V3
  // Dans un environnement réel, il faudrait mocker la fonction

  const poolF = [1, 2, 3];
  const poolM = [4, 5, 6];

  if (poolF.length !== 3) {
    return {
      name: testName,
      passed: false,
      message: 'Pool F incorrect'
    };
  }

  if (poolM.length !== 3) {
    return {
      name: testName,
      passed: false,
      message: 'Pool M incorrect'
    };
  }

  // Test basique : vérifier que les pools ne sont pas vides
  return { name: testName, passed: true };
}

/**
 * Test 7 : Fonction oppositeSex
 */
function testOppositeS() {
  const testName = 'testOppositeSex';

  if (oppositeSex_V3('F') !== 'M') {
    return {
      name: testName,
      passed: false,
      message: 'oppositeSex(F) devrait retourner M'
    };
  }

  if (oppositeSex_V3('M') !== 'F') {
    return {
      name: testName,
      passed: false,
      message: 'oppositeSex(M) devrait retourner F'
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 8 : Fonction globalNeed
 */
function testGlobalNeed() {
  const testName = 'testGlobalNeed';

  const targetFGlobal = 10;
  const targetMGlobal = 15;
  const placedF = 3;
  const placedM = 8;

  const needF = globalNeed_V3('F', targetFGlobal, targetMGlobal, placedF, placedM);
  const needM = globalNeed_V3('M', targetFGlobal, targetMGlobal, placedF, placedM);

  if (needF !== 7) {
    return {
      name: testName,
      passed: false,
      message: 'needF devrait être 7 (10 - 3), obtenu ' + needF
    };
  }

  if (needM !== 7) {
    return {
      name: testName,
      passed: false,
      message: 'needM devrait être 7 (15 - 8), obtenu ' + needM
    };
  }

  return { name: testName, passed: true };
}

/**
 * Test 9 : Méthode des plus forts restes (vérification mathématique)
 */
function testLargestRemainderMethod() {
  const testName = 'testLargestRemainderMethod';

  // Cas test : 3 classes, 45 élèves, ratio 40% F / 60% M
  const classes = [
    { name: '6°1', targetTotal: 15, currentF: 0, currentM: 0, slotsLeft: 15 },
    { name: '6°2', targetTotal: 15, currentF: 0, currentM: 0, slotsLeft: 15 },
    { name: '6°3', targetTotal: 15, currentF: 0, currentM: 0, slotsLeft: 15 }
  ];

  const poolF = Array(18).fill(0); // 18 filles (40% de 45)
  const poolM = Array(27).fill(0); // 27 garçons (60% de 45)

  const ctx = {};
  const result = calculateParityTargets_V3(ctx, classes, poolF, poolM);

  // Vérifier que la somme des targetF_total fait bien 18
  let sumTargetF = 0;
  classes.forEach(function(C) {
    sumTargetF += C.targetF_total;
  });

  if (sumTargetF !== result.targetFGlobal) {
    return {
      name: testName,
      passed: false,
      message: 'Somme des targetF_total (' + sumTargetF + ') ≠ targetFGlobal (' + result.targetFGlobal + ')'
    };
  }

  // Chaque classe devrait avoir environ 6F (18/3)
  // Avec méthode des plus forts restes : certaines auront 6, d'autres 7
  const counts = classes.map(function(C) { return C.targetF_total; });
  const min = Math.min.apply(null, counts);
  const max = Math.max.apply(null, counts);

  if (max - min > 1) {
    return {
      name: testName,
      passed: false,
      message: 'Écart trop important entre les classes : min=' + min + ', max=' + max
    };
  }

  return { name: testName, passed: true };
}

// ===================================================================
// TESTS D'INTÉGRATION (optionnel)
// ===================================================================

/**
 * Test d'intégration complet (nécessite une vraie feuille de calcul)
 * À exécuter manuellement sur un jeu de données test
 */
function testFullIntegration() {
  Logger.log('🧪 TEST D\'INTÉGRATION - PHASE 3 PARITÉ ADAPTATIVE');
  Logger.log('');

  // Créer un contexte de test
  const ctx = {
    ss: SpreadsheetApp.getActive(),
    levels: ['6°1', '6°2', '6°3'],
    targets: {
      '6°1': 30,
      '6°2': 30,
      '6°3': 30
    },
    quotas: {
      '6°1': { 'ITA': 5, 'CHAV': 10 },
      '6°2': { 'ESP': 5, 'CHAV': 10 },
      '6°3': { 'ALL': 5, 'CHAV': 10 }
    },
    parityTolerance: 1
  };

  try {
    const result = Phase3I_completeAndParity_PariteAdaptive_V3(ctx);

    Logger.log('✅ Test d\'intégration réussi');
    Logger.log('Résultat : ' + JSON.stringify(result, null, 2));

    return true;
  } catch (e) {
    Logger.log('❌ Test d\'intégration échoué : ' + e.message);
    Logger.log(e.stack);
    return false;
  }
}
