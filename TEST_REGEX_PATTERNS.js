// TEST & DOCUMENTATION - LA VRAIE SOLUTION
//
// ❌ ERREUR QUE J'AI COMMISE:
// J'ai pensé que c'était basé sur le dernier CARACTÈRE (chiffre vs lettre).
// Mais c'est FAUX! C'est ADAPTATIF au CONTEXTE (quel niveau on répartit).
//
// ✅ SOLUTION CORRECTE & UNIVERSELLE:
// Les onglets SOURCES ont TOUJOURS le format: QUELQUECHOSE°CHIFFRE
// - Si on répartit le niveau 5e → sources sont 6°1, 6°2, 6°3, etc.
// - Si on répartit CM2 → sources sont BRESSOLS°1, GAMARRA°2, etc.
// - Le pattern IDENTIQUE fonctionne TOUJOURS: /^[A-Za-z0-9_-]+°\d+$/
//
// Les DESTINATIONS et RÉSULTATS ont des suffixes explicites:
// - °A, °B, °C, etc. (destinations)
// - TEST, FIN, DEF, CACHE (résultats)

const sourcePattern = /^[A-Za-z0-9_-]+°\d+$/;     // QUELQUECHOSE°CHIFFRE (source adaptatif)
const destinationPattern = /^[A-Za-z0-9_-]+°[A-Za-z]$/; // QUELQUECHOSE°LETTRE (destination)

// CAS DE TEST
const testCases = [
  // SOURCES: Format QUELQUECHOSE°CHIFFRE (adaptatif)
  { name: '6°1', type: 'SOURCE 5e', shouldAccept: true },
  { name: '6°2', type: 'SOURCE 5e', shouldAccept: true },
  { name: '6°3', type: 'SOURCE 5e', shouldAccept: true },
  { name: 'BRESSOLS°1', type: 'SOURCE CM2', shouldAccept: true },
  { name: 'GAMARRA°7', type: 'SOURCE CM2', shouldAccept: true },
  { name: 'COLBERT°4', type: 'SOURCE CM2', shouldAccept: true },

  // DESTINATIONS: Format QUELQUECHOSE°LETTRE (suffixes explicites)
  { name: '5°A', type: 'DESTINATION', shouldAccept: false },
  { name: '5°B', type: 'DESTINATION', shouldAccept: false },
  { name: '5°C', type: 'DESTINATION', shouldAccept: false },
  { name: 'CM2A', type: 'DESTINATION', shouldAccept: false },
  { name: '6°Z', type: 'DESTINATION', shouldAccept: false },

  // RÉSULTATS: Suffixes explicites TEST/FIN/DEF/CACHE
  { name: '6°1TEST', type: 'RÉSULTAT TEST', shouldAccept: false },
  { name: '6°1FIN', type: 'RÉSULTAT FIN', shouldAccept: false },
  { name: '6°1DEF', type: 'RÉSULTAT DEF', shouldAccept: false },
  { name: '6°1CACHE', type: 'RÉSULTAT CACHE', shouldAccept: false },

  // SYSTÈME: Préfixe _
  { name: '_CONFIG', type: 'SYSTÈME', shouldAccept: false },
  { name: '_STRUCTURE', type: 'SYSTÈME', shouldAccept: false },

  // INTERFACES
  { name: 'ACCUEIL', type: 'INTERFACE', shouldAccept: false },
  { name: 'CONSOLIDATION', type: 'INTERFACE', shouldAccept: false },
];

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║ PATTERN UNIVERSEL & ADAPTATIF - Sources vs Destinations       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('PATTERN SOURCE: /^[A-Za-z0-9_-]+°\\d+$/');
console.log('Format: QUELQUECHOSE°CHIFFRE');
console.log('Accepte: 6°1, 6°2 (niveau 5e) OU BRESSOLS°1, GAMARRA°2 (niveau CM2)');
console.log('Fonctionne TOUJOURS peu importe le contexte/niveau!\n');

console.log('─────────────────────────────┬──────────────┬────────────────────');
console.log('NOM ONGLET                   │ TYPE         │ RÉSULTAT');
console.log('─────────────────────────────┼──────────────┼────────────────────');

let correct = 0;
let total = 0;

testCases.forEach(test => {
  const matches = sourcePattern.test(test.name);
  const result = matches ? 'ACCEPTÉ ✅' : 'REJETÉ ❌';
  const expected = test.shouldAccept ? 'ACCEPTÉ ✅' : 'REJETÉ ❌';
  const status = matches === test.shouldAccept ? '✅ OK' : '❌ ERREUR';

  const pad = 28 - test.name.length;
  const padding = ' '.repeat(Math.max(0, pad));
  const typePad = 12 - test.type.length;
  const typePadding = ' '.repeat(Math.max(0, typePad));

  console.log(`${test.name}${padding}│ ${test.type}${typePadding} │ ${result} ${status}`);

  total++;
  if (matches === test.shouldAccept) correct++;
});

console.log('─────────────────────────────┴──────────────┴────────────────────\n');

console.log(`RÉSULTATS: ${correct}/${total} cas corrects\n`);

console.log('BÉNÉFICES DU PATTERN:');
console.log('✅ Accepte: 6°1, 6°2, 6°3 (niveau 5e) - adaptatif!');
console.log('✅ Accepte: BRESSOLS°1, GAMARRA°7 (niveau CM2) - adaptatif!');
console.log('❌ Rejette: 5°A, 5°B, 5°C (destinations avec °LETTRE)');
console.log('❌ Rejette: 6°1TEST, 6°1FIN, etc. (résultats)');
console.log('❌ Rejette: _CONFIG, _STRUCTURE (système)');
console.log('\n🎯 UN SEUL PATTERN fonctionne pour TOUS les niveaux!');
console.log('🎯 C\'est RÉELLEMENT ADAPTATIF et UNIVERSEL!');
