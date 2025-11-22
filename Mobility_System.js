/**
 * ============================================================
 *  MOBILITY_SYSTEM - Calcul FIXE/PERMUT/CONDI/LIBRE
 * ============================================================
 * Fonction unifiée utilisée par LEGACY et OPTI
 *
 * Cette fonction calcule automatiquement les colonnes FIXE et MOBILITE
 * pour tous les élèves en fonction de :
 * - Leurs LV2/OPT (quelles classes les acceptent)
 * - Leurs codes A (ASSO) - doivent rester groupés
 * - Leurs codes D (DISSO) - ne peuvent être ensemble
 * - Les quotas définis dans _STRUCTURE
 *
 * LOGIQUE :
 * - FIXE : Une seule classe autorisée (LV2/OPT unique)
 * - PERMUT : Deux classes autorisées (peut permuter entre elles)
 * - LIBRE : Plus de deux classes autorisées
 * - CONFLIT : Aucune classe autorisée (erreur de configuration)
 * - GROUPE_FIXE : Groupe A avec une seule classe commune
 * - GROUPE_PERMUT : Groupe A avec plusieurs classes communes
 *
 * @version 1.0
 * @date 2025-10-21
 * @author Claude Code
 */

/**
 * Utilitaire : Normalisation en majuscules
 */
function _u_(str) {
  return String(str || '').trim().toUpperCase();
}

/**
 * Crée une colonne si elle n'existe pas, retourne son index (0-based)
 * @param {Sheet} sheet - La feuille Google Sheets
 * @param {string} headerName - Nom de l'en-tête de colonne
 * @returns {number} Index de la colonne (0-based)
 */
function ensureColumn_(sheet, headerName) {
  const rng = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  const headers = rng.getValues()[0];
  let idx = headers.indexOf(headerName);
  if (idx === -1) {
    idx = headers.length;
    sheet.getRange(1, idx + 1).setValue(headerName);
    SpreadsheetApp.flush();
  }
  return idx; // 0-based
}

/**
 * Construit la table des classes offrant LV2/OPT depuis ctx.quotas
 * @param {Object} ctx - Contexte d'exécution
 * @returns {Object} { "6°1": { LV2: Set(['ITA']), OPT: Set(['CHAV']) }, ... }
 */
function buildClassOffers_(ctx) {
  const offers = {}; // classe -> {LV2:Set, OPT:Set}

  (ctx.cacheSheets || []).forEach(function(cl) {
    const base = cl.replace(/CACHE$/, '');
    offers[base] = { LV2: new Set(), OPT: new Set() };
  });

  // ctx.quotas vient de _STRUCTURE
  Object.keys(ctx.quotas || {}).forEach(function(classe) {
    const base = classe; // "6°1"
    if (!offers[base]) offers[base] = { LV2: new Set(), OPT: new Set() };
    const q = ctx.quotas[classe] || {};

    Object.keys(q).forEach(function(label) {
      const L = _u_(label);
      // Heuristique: LV2 connus
      if (/(ITA|ALL|ESP|PT|CHI|ANG|GER|LAT2?|ALLEMAND|ESPAGNOL|ITALIEN|CHINOIS|PORTUGAIS)/.test(L)) {
        offers[base].LV2.add(L);
      } else {
        offers[base].OPT.add(L);
      }
    });
  });

  return offers;
}

/**
 * Retourne Allow(eleve) = classes (sans suffixe) autorisées par LV2 & OPT
 * @param {Object} eleve - Objet élève avec propriétés LV2 et OPT
 * @param {Object} classOffers - Table des offres par classe
 * @returns {Array<string>} Liste des classes autorisées
 */
function computeAllow_(eleve, classOffers) {
  const lv2 = _u_(eleve.LV2 || eleve.lv2);
  const opt = _u_(eleve.OPT || eleve.opt);
  const allClasses = Object.keys(classOffers);
  let allowed = allClasses.slice();

  if (lv2 && lv2 !== 'ESP' && lv2 !== 'ANG') {
    allowed = allowed.filter(function(cl) { return classOffers[cl].LV2.has(lv2); });
  }
  if (opt) {
    allowed = allowed.filter(function(cl) { return classOffers[cl].OPT.has(opt); });
  }

  return allowed;
}

/**
 * Parse codes A/D (depuis colonnes dédiées A/D, ou depuis une colonne CODES)
 * @param {Object} rowObj - Objet représentant une ligne d'élève
 * @returns {Object} { A: string, D: string }
 */
function parseCodes_(rowObj) {
  let A = _u_(rowObj.A || rowObj.codeA || '');
  let D = _u_(rowObj.D || rowObj.codeD || '');
  const C = _u_(rowObj.CODES || '');

  if (!A && /A\d+/.test(C)) A = (C.match(/A\d+/) || [])[0];
  if (!D && /D\d+/.test(C)) D = (C.match(/D\d+/) || [])[0];

  return { A: A, D: D };
}

/**
 * ============================================================
 * FONCTION PRINCIPALE - Calcul & écriture FIXE/MOBILITE
 * ============================================================
 * Calcule et écrit les colonnes FIXE/MOBILITE dans tous les onglets CACHE
 *
 * @param {Object} ctx - Contexte avec ctx.ss, ctx.cacheSheets, ctx.quotas
 */
function computeMobilityFlags_(ctx) {
  logLine('INFO', '🔍 Calcul des statuts de mobilité (FIXE/PERMUT/LIBRE)...');

  const ss = ctx.ss;
  const classOffers = buildClassOffers_(ctx); // "6°1" -> {LV2:Set, OPT:Set}

  logLine('INFO', '  Classes offrant LV2/OPT: ' + JSON.stringify(
    Object.keys(classOffers).reduce(function(acc, cl) {
      acc[cl] = {
        LV2: Array.from(classOffers[cl].LV2),
        OPT: Array.from(classOffers[cl].OPT)
      };
      return acc;
    }, {})
  ));

  // 1) Lire tout le CACHE en mémoire + construire groupes A + index D
  const studentsByClass = {}; // "6°1" -> [{row, data, id, ...}]
  const groupsA = {};         // "A7" -> [{class,nameRow,indexRow,...}]
  const Dindex = {};          // "6°1" -> Set(Dx déjà présents)

  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const base = cacheName.replace(/CACHE$/, '');
    const sh = ss.getSheetByName(cacheName);
    if (!sh) return;

    const lr = Math.max(sh.getLastRow(), 1);
    const lc = Math.max(sh.getLastColumn(), 1);
    const values = sh.getRange(1, 1, lr, lc).getDisplayValues();
    const headers = values[0];
    const find = function(name) { return headers.indexOf(name); };

    // Assure colonnes FIXE & MOBILITE
    const colFIXE = ensureColumn_(sh, 'FIXE');
    const colMOB = ensureColumn_(sh, 'MOBILITE');

    // indices de colonnes utiles
    const idxNom = find('NOM');
    const idxPrenom = find('PRENOM');
    const idxSexe = find('SEXE');
    const idxLV2 = find('LV2');
    const idxOPT = find('OPT');
    const idxA = find('A');
    const idxD = find('D');
    const idxCodes = find('CODES');
    const idxAsso = find('ASSO');
    const idxDisso = find('DISSO');

    studentsByClass[base] = [];
    Dindex[base] = new Set();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const obj = {
        NOM: row[idxNom] || '',
        PRENOM: row[idxPrenom] || '',
        SEXE: row[idxSexe] || '',
        LV2: row[idxLV2] || '',
        OPT: row[idxOPT] || '',
        A: (idxA >= 0 ? row[idxA] : (idxAsso >= 0 ? row[idxAsso] : '')),
        D: (idxD >= 0 ? row[idxD] : (idxDisso >= 0 ? row[idxDisso] : '')),
        CODES: (idxCodes >= 0 ? row[idxCodes] : '')
      };

      const codes = parseCodes_(obj);
      const id = _u_((obj.NOM || '') + '|' + (obj.PRENOM || '') + '|' + base);
      const st = {
        id: id,
        classe: base,
        rowIndex: r + 1,
        data: obj,
        A: codes.A,
        D: codes.D,
        colFIXE: colFIXE,
        colMOB: colMOB,
        sheet: sh
      };

      studentsByClass[base].push(st);

      if (codes.A) {
        if (!groupsA[codes.A]) groupsA[codes.A] = [];
        groupsA[codes.A].push(st);
      }
      if (codes.D) {
        Dindex[base].add(codes.D);
      }
    }
  });

  logLine('INFO', '  Groupes A détectés: ' + Object.keys(groupsA).length);
  logLine('INFO', '  Codes D détectés: ' + JSON.stringify(
    Object.keys(Dindex).reduce(function(acc, cl) {
      acc[cl] = Array.from(Dindex[cl]);
      return acc;
    }, {})
  ));

  // 2) Déterminer FIXE explicite & compute Allow individuels
  const explicitFixed = new Set();
  Object.keys(studentsByClass).forEach(function(cl) {
    studentsByClass[cl].forEach(function(st) {
      const vFIXE = _u_(st.sheet.getRange(st.rowIndex, st.colFIXE + 1).getDisplayValue());
      if (vFIXE === 'FIXE' || vFIXE === 'SPEC' || vFIXE === 'LOCK') {
        explicitFixed.add(st.id);
      }
      st.allow = computeAllow_(st.data, classOffers);
    });
  });

  logLine('INFO', '  Élèves FIXE explicites: ' + explicitFixed.size);

  // 3) Résoudre groupes A
  const groupAllow = {};
  Object.keys(groupsA).forEach(function(codeA) {
    const members = groupsA[codeA];
    let inter = null;
    let anyFixed = false;
    let fixedClass = null;

    members.forEach(function(st) {
      if (explicitFixed.has(st.id)) {
        anyFixed = true;
        fixedClass = st.classe;
      }
      const set = new Set(st.allow);
      inter = (inter === null) ? set : new Set([...inter].filter(function(x) { return set.has(x); }));
    });

    const allowArr = inter ? Array.from(inter) : [];
    let status = null;
    let pin = null;

    if (anyFixed) {
      if (allowArr.includes(fixedClass)) {
        status = 'FIXE';
        pin = fixedClass;
      } else {
        status = 'CONFLIT';
      }
    } else {
      if (allowArr.length === 0) status = 'CONFLIT';
      else if (allowArr.length === 1) {
        status = 'FIXE';
        pin = allowArr[0];
      } else {
        status = 'PERMUT';
      }
    }

    groupAllow[codeA] = { allow: new Set(allowArr), status: status, pin: pin };
  });

  // 4) Statut individuel final
  function statusForStudent(st) {
    // a) FIXE explicite
    if (explicitFixed.has(st.id)) return { fix: true, mob: 'FIXE' };

    // b) groupe A
    if (st.A && groupAllow[st.A]) {
      const g = groupAllow[st.A];
      if (g.status === 'CONFLIT') return { fix: false, mob: 'CONFLIT(A)' };
      
      // ✅ CORRECTION CRITIQUE : Distinguer l'ancre des suiveurs
      // Si le groupe est FIXE, vérifier si CET élève est l'ancre (une seule classe autorisée)
      if (g.status === 'FIXE') {
        // Vérifier si cet élève a une contrainte individuelle (LV2/OPT unique)
        const individualAllow = st.allow.slice();
        if (individualAllow.length === 1) {
          // C'est l'ANCRE (ex: élève avec CHAV qui bloque tout le groupe)
          return { fix: true, mob: 'FIXE' };
        } else {
          // ✅ CORRECTION : Vérifier s'il y a vraiment une ancre dans le groupe
          // Si aucun membre n'a individualAllow.length === 1, le groupe n'a pas d'ancre
          // Dans ce cas, ne pas marquer CONDI, laisser passer à la logique individuelle
          const members = groupsA[st.A] || [];
          const hasAnchor = members.some(function(member) {
            return member.allow && member.allow.length === 1;
          });
          
          if (hasAnchor) {
            // Il y a une ancre → C'est un SUIVEUR (conditionné par l'ancre)
            return { fix: false, mob: 'CONDI(' + st.A + '→' + g.pin + ')' };
          }
          // Pas d'ancre → Laisser passer à la logique individuelle (sera LIBRE ou PERMUT)
        }
      }
      
      if (g.status === 'PERMUT') return { fix: false, mob: 'GROUPE_PERMUT(' + st.A + '→' + Array.from(g.allow).join('/') + ')' };
    }

    // c) LV2+OPT individuellement
    let allow = st.allow.slice();

    // d) filtre D
    if (st.D) {
      allow = allow.filter(function(c) { return !Dindex[c].has(st.D) || c === st.classe; });
    }

    if (allow.length === 0) return { fix: false, mob: 'CONFLIT(LV2/OPT/D)' };
    if (allow.length === 1) return { fix: true, mob: 'FIXE' };
    if (allow.length === 2) return { fix: false, mob: 'PERMUT(' + allow.join(',') + ')' };

    return { fix: false, mob: 'LIBRE' };
  }

  // 5) Écrire en feuille
  let countFIXE = 0;
  let countPERMUT = 0;
  let countLIBRE = 0;
  let countCONFLIT = 0;

  Object.keys(studentsByClass).forEach(function(cl) {
    const arr = studentsByClass[cl];
    arr.forEach(function(st) {
      const s = statusForStudent(st);

      if (s.fix) {
        st.sheet.getRange(st.rowIndex, st.colFIXE + 1).setValue('FIXE');
        countFIXE++;
      } else {
        st.sheet.getRange(st.rowIndex, st.colFIXE + 1).clearContent();
      }

      st.sheet.getRange(st.rowIndex, st.colMOB + 1).setValue(s.mob);

      if (s.mob.includes('PERMUT')) countPERMUT++;
      else if (s.mob === 'LIBRE') countLIBRE++;
      else if (s.mob.includes('CONFLIT')) countCONFLIT++;
    });
  });

  SpreadsheetApp.flush();

  logLine('INFO', '✅ Mobilité calculée: FIXE=' + countFIXE + ', PERMUT=' + countPERMUT + ', LIBRE=' + countLIBRE + ', CONFLIT=' + countCONFLIT);
}
