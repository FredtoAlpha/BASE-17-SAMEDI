/**
 * TESTS UNITAIRES POUR LE MODULE GROUPES
 *
 * Ce fichier contient des cas de test pour valider le comportement
 * des fonctions isStudentLike() et normalizeClassStudents().
 *
 * Usage: Exécuter ces tests avant tout déploiement majeur
 */

// ========== DONNÉES DE TEST ==========

const TEST_CASES = {
  // Cas valides
  validStudent: {
    id: 'DUPONT_Jean_001',
    nom: 'DUPONT',
    prenom: 'Jean',
    sexe: 'M',
    lv2: 'ESP',
    scoreF: 3.5,
    scoreM: 2.8,
    scores: {
      F: 3.5,
      M: 2.8,
      COM: 3,
      TRA: 2,
      PART: 4,
      ABS: 0
    }
  },

  validStudentMinimal: {
    id: 'MARTIN_Marie_002'
    // Seulement l'ID, le reste devrait être rempli par défaut
  },

  validClassDataWithEleves: {
    '6°1FIN': {
      eleves: [
        {
          id: 'DUPONT_Jean_001',
          nom: 'DUPONT',
          prenom: 'Jean',
          sexe: 'M',
          scoreF: 3.5,
          scoreM: 2.8
        },
        {
          id: 'MARTIN_Marie_002',
          nom: 'MARTIN',
          prenom: 'Marie',
          sexe: 'F',
          scoreF: 4.0,
          scoreM: 3.5
        }
      ]
    }
  },

  validClassDataDirectArray: {
    '6°2FIN': [
      {
        id: 'BERNARD_Paul_003',
        nom: 'BERNARD',
        prenom: 'Paul',
        sexe: 'M',
        scoreF: 2.5,
        scoreM: 3.0
      }
    ]
  },

  // Cas invalides
  invalidStudentNoId: {
    nom: 'DUPONT',
    prenom: 'Jean'
    // Manque l'ID
  },

  invalidStudentEmptyId: {
    id: '',
    nom: 'DUPONT',
    prenom: 'Jean'
  },

  invalidStudentNull: null,

  invalidStudentString: 'not an object',

  invalidClassDataNotArray: {
    '6°3FIN': {
      eleves: 'invalid'  // Devrait être un tableau
    }
  },

  invalidClassDataNull: {
    '6°4FIN': null
  },

  // Cas d'avertissements
  studentWithoutScores: {
    id: 'DURAND_Luc_004',
    nom: 'DURAND',
    prenom: 'Luc',
    sexe: 'M'
    // scoreF et scoreM absents (devrait avertir)
  },

  mixedValidityClass: {
    '6°5FIN': {
      eleves: [
        { id: 'VALID_001', nom: 'Valid', prenom: 'Student', scoreF: 3, scoreM: 3 },
        { nom: 'Invalid', prenom: 'NoID' },  // Invalide : pas d'ID
        { id: '', nom: 'Invalid', prenom: 'EmptyID' },  // Invalide : ID vide
        { id: 'VALID_002', nom: 'Another', prenom: 'Valid' }  // Valide
      ]
    }
  }
};

// ========== FONCTIONS DE TEST ==========

/**
 * Teste la fonction isStudentLike
 */
function testIsStudentLike() {
  console.log('====== TEST: isStudentLike ======');

  const tests = [
    { name: 'Valid student', input: TEST_CASES.validStudent, expected: true },
    { name: 'Valid minimal student', input: TEST_CASES.validStudentMinimal, expected: true },
    { name: 'Invalid: no ID', input: TEST_CASES.invalidStudentNoId, expected: false },
    { name: 'Invalid: empty ID', input: TEST_CASES.invalidStudentEmptyId, expected: false },
    { name: 'Invalid: null', input: TEST_CASES.invalidStudentNull, expected: false },
    { name: 'Invalid: string', input: TEST_CASES.invalidStudentString, expected: false },
    { name: 'Student without scores', input: TEST_CASES.studentWithoutScores, expected: true }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    // Note: Remplacer par votre fonction isStudentLike réelle
    const result = isStudentLike(test.input);
    const status = result === test.expected ? '✅ PASS' : '❌ FAIL';

    console.log(`${status}: ${test.name}`);

    if (result === test.expected) {
      passed++;
    } else {
      failed++;
      console.log(`  Expected: ${test.expected}, Got: ${result}`);
    }
  });

  console.log(`\nRésultat: ${passed} réussis, ${failed} échoués\n`);
  return failed === 0;
}

/**
 * Teste la fonction normalizeClassStudents
 */
function testNormalizeClassStudents() {
  console.log('====== TEST: normalizeClassStudents ======');

  const tests = [
    {
      name: 'Valid class with eleves property',
      className: '6°1FIN',
      input: TEST_CASES.validClassDataWithEleves['6°1FIN'],
      expectedCount: 2,
      shouldSucceed: true
    },
    {
      name: 'Valid class as direct array',
      className: '6°2FIN',
      input: TEST_CASES.validClassDataDirectArray['6°2FIN'],
      expectedCount: 1,
      shouldSucceed: true
    },
    {
      name: 'Invalid: not an array',
      className: '6°3FIN',
      input: TEST_CASES.invalidClassDataNotArray['6°3FIN'],
      expectedCount: 0,
      shouldSucceed: false
    },
    {
      name: 'Invalid: null data',
      className: '6°4FIN',
      input: TEST_CASES.invalidClassDataNull['6°4FIN'],
      expectedCount: 0,
      shouldSucceed: false
    },
    {
      name: 'Mixed validity: should filter invalid students',
      className: '6°5FIN',
      input: TEST_CASES.mixedValidityClass['6°5FIN'],
      expectedCount: 2,  // Seulement les 2 élèves valides
      shouldSucceed: true
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    // Note: Remplacer par votre fonction normalizeClassStudents réelle
    const result = normalizeClassStudents(test.className, test.input);

    const isSuccess = result !== null;
    const count = result ? result.length : 0;

    const successMatch = isSuccess === test.shouldSucceed;
    const countMatch = count === test.expectedCount;
    const testPassed = successMatch && countMatch;

    const status = testPassed ? '✅ PASS' : '❌ FAIL';

    console.log(`${status}: ${test.name}`);

    if (testPassed) {
      passed++;
    } else {
      failed++;
      if (!successMatch) {
        console.log(`  Expected success: ${test.shouldSucceed}, Got: ${isSuccess}`);
      }
      if (!countMatch) {
        console.log(`  Expected count: ${test.expectedCount}, Got: ${count}`);
      }
    }
  });

  console.log(`\nRésultat: ${passed} réussis, ${failed} échoués\n`);
  return failed === 0;
}

/**
 * Teste l'intégration complète
 */
function testIntegration() {
  console.log('====== TEST: Integration complète ======');

  // Simuler le chargement de données FIN
  const mockFinData = {
    ...TEST_CASES.validClassDataWithEleves,
    ...TEST_CASES.validClassDataDirectArray,
    ...TEST_CASES.mixedValidityClass
  };

  console.log('Mock FIN data:', mockFinData);

  // Traiter chaque classe
  const results = {};
  Object.keys(mockFinData).forEach(className => {
    const classData = mockFinData[className];
    const normalized = normalizeClassStudents(className, classData);

    if (normalized) {
      results[className] = normalized;
    }
  });

  console.log('\nRésultats de normalisation:');
  console.log(`- Nombre de classes traitées: ${Object.keys(results).length}`);
  Object.entries(results).forEach(([className, students]) => {
    console.log(`- ${className}: ${students.length} élève(s)`);
  });

  // Vérifier que les scores sont présents
  let studentsWithScores = 0;
  let studentsWithoutScores = 0;

  Object.values(results).forEach(students => {
    students.forEach(student => {
      if (student.scoreF > 0 || student.scoreM > 0) {
        studentsWithScores++;
      } else {
        studentsWithoutScores++;
      }
    });
  });

  console.log(`\nScores académiques:`);
  console.log(`- Élèves avec scores: ${studentsWithScores}`);
  console.log(`- Élèves sans scores: ${studentsWithoutScores}`);

  return true;
}

/**
 * Exécuter tous les tests
 */
function runAllTests() {
  console.log('========================================');
  console.log('   SUITE DE TESTS MODULE GROUPES V4');
  console.log('========================================\n');

  const results = {
    isStudentLike: testIsStudentLike(),
    collectStudentsRecursive: testCollectStudentsRecursive(),
    prepareStudentForAlgorithm: testPrepareStudentForAlgorithm(),
    normalizeClassStudents: testNormalizeClassStudents(),
    integration: testIntegration()
  };

  console.log('\n========================================');
  console.log('   RÉSUMÉ FINAL');
  console.log('========================================');

  Object.entries(results).forEach(([testName, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${testName}`);
  });

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
  } else {
    console.log('\n⚠️ CERTAINS TESTS ONT ÉCHOUÉ');
  }

  return allPassed;
}

/**
 * Teste la fonction collectStudentsRecursive
 */
function testCollectStudentsRecursive() {
  console.log('====== TEST: collectStudentsRecursive ======');

  const tests = [
    {
      name: 'Direct array of students',
      input: [
        { id: 'A', nom: 'Test' },
        { id: 'B', nom: 'Test2' }
      ],
      expectedIds: ['A', 'B']
    },
    {
      name: 'Nested in eleves property',
      input: {
        eleves: [
          { id: 'C', nom: 'Test3' },
          { id: 'D', nom: 'Test4' }
        ]
      },
      expectedIds: ['C', 'D']
    },
    {
      name: 'Deep nesting',
      input: {
        data: {
          classes: {
            eleves: [
              { id: 'E', nom: 'Test5' }
            ]
          }
        }
      },
      expectedIds: ['E']
    },
    {
      name: 'Mixed with non-students',
      input: {
        metadata: { timestamp: 123456 },
        eleves: [
          { id: 'F', nom: 'Test6' },
          { invalid: true },  // Pas un élève
          { id: 'G', nom: 'Test7' }
        ]
      },
      expectedIds: ['F', 'G']
    },
    {
      name: 'Deduplication',
      input: [
        { id: 'H', nom: 'Test8' },
        { id: 'H', nom: 'Duplicate' },  // Même ID
        { id: 'I', nom: 'Test9' }
      ],
      expectedIds: ['H', 'I']  // H une seule fois
    },
    {
      name: 'Empty structure',
      input: {},
      expectedIds: []
    },
    {
      name: 'Null input',
      input: null,
      expectedIds: []
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = collectStudentsRecursive(test.input);
    const resultIds = result.map(s => s.id).sort();
    const expectedIds = test.expectedIds.sort();

    const match = JSON.stringify(resultIds) === JSON.stringify(expectedIds);
    const status = match ? '✅ PASS' : '❌ FAIL';

    console.log(`${status}: ${test.name}`);

    if (match) {
      passed++;
    } else {
      failed++;
      console.log(`  Expected IDs: ${JSON.stringify(expectedIds)}`);
      console.log(`  Got IDs: ${JSON.stringify(resultIds)}`);
    }
  });

  console.log(`\nRésultat: ${passed} réussis, ${failed} échoués\n`);
  return failed === 0;
}

/**
 * Teste la fonction prepareStudentForAlgorithm
 */
function testPrepareStudentForAlgorithm() {
  console.log('====== TEST: prepareStudentForAlgorithm ======');

  const tests = [
    {
      name: 'Valid student with all fields',
      input: {
        id: 'TEST_001',
        nom: 'DUPONT',
        prenom: 'Jean',
        sexe: 'M',
        scoreF: 3.5,
        scoreM: 2.8,
        com: 3,
        tra: 2,
        lv2: 'ESPAGNOL'
      },
      expected: {
        id: 'TEST_001',
        sexe: 'M',
        scoreF: 3.5,
        scoreM: 2.8,
        lv2: 'ESP'
      }
    },
    {
      name: 'Sexe normalization (FILLE → F)',
      input: {
        id: 'TEST_002',
        sexe: 'FILLE'
      },
      expected: {
        sexe: 'F',
        gender: 'F'
      }
    },
    {
      name: 'Score clamping (> 4)',
      input: {
        id: 'TEST_003',
        scoreF: 5.5,  // Devrait être clampé à 4
        scoreM: -1    // Devrait être clampé à 0
      },
      expected: {
        scoreF: 4,
        scoreM: 0
      }
    },
    {
      name: 'LV2 normalization',
      input: {
        id: 'TEST_004',
        lv2: 'ALLEMAND'
      },
      expected: {
        lv2: 'ALL'
      }
    },
    {
      name: 'Options as string',
      input: {
        id: 'TEST_005',
        options: 'LATIN,GREC'
      },
      expected: {
        options: ['LATIN', 'GREC']
      }
    },
    {
      name: 'Missing scores (fallback 0)',
      input: {
        id: 'TEST_006'
        // Pas de scores
      },
      expected: {
        scoreF: 0,
        scoreM: 0,
        com: 0,
        tra: 0
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = prepareStudentForAlgorithm(test.input, '6°TEST');

    // Vérifier chaque champ attendu
    let allMatch = true;
    Object.keys(test.expected).forEach(key => {
      const resultValue = result[key];
      const expectedValue = test.expected[key];

      if (JSON.stringify(resultValue) !== JSON.stringify(expectedValue)) {
        allMatch = false;
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`  Field '${key}': Expected ${JSON.stringify(expectedValue)}, Got ${JSON.stringify(resultValue)}`);
      }
    });

    if (allMatch) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      failed++;
    }
  });

  console.log(`\nRésultat: ${passed} réussis, ${failed} échoués\n`);
  return failed === 0;
}

// ========== EXPORTER POUR UTILISATION ==========

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEST_CASES,
    testIsStudentLike,
    testNormalizeClassStudents,
    testCollectStudentsRecursive,
    testPrepareStudentForAlgorithm,
    testIntegration,
    runAllTests
  };
}
