import { ALL_ELEMENTS } from './allElements';

// Datos de elementos químicos para la visualización 3D

export const ELEMENT_COLORS = {
  H: '#f0f0f0',
  O: '#ff4d4d',
  C: '#2b2b2b',
  N: '#3b5bfd',
  Cl: '#22cc22',
  Na: '#ab5cf2',
  K: '#8f40d4',
  Ca: '#4a4a4a',
  Mg: '#7fff3d',
  Li: '#cc80ff',
  F: '#90e050',
  Br: '#a6401f',
  S: '#ffd900'
};

export const ELEMENT_NAMES = {
  H: 'Hidrógeno',
  O: 'Oxígeno',
  C: 'Carbono',
  N: 'Nitrógeno',
  Cl: 'Cloro',
  Na: 'Sodio',
  K: 'Potasio',
  Ca: 'Calcio',
  Mg: 'Magnesio',
  Li: 'Litio',
  F: 'Flúor',
  Br: 'Bromo',
  S: 'Azufre'
};

// Unidades en milímetros — el slicer interpretará 1 unidad = 1 mm
// Bolas de 1 cm de diámetro (radio 5 mm) para impresión tipo LEGO
export const BALL_RADIUS_MM = 5;
export const TUBE_RADIUS_MM = 1.4;
export const TUBE_LENGTH_MM = 11;
// Ajuste a presión: el orificio es ligeramente más pequeño que el cilindro
// conector para que el encaje sea firme (interferencia de 0.3 mm de diámetro).
export const TOLERANCE_MM = 0.15; // interferencia radial para ajuste a presión
export const SOCKET_RADIUS_MM = TUBE_RADIUS_MM - TOLERANCE_MM; // 1.25 mm (< tubo)
export const SOCKET_DEPTH_MM = BALL_RADIUS_MM * 0.7; // 3.5 mm (ciego, puente pequeño)
// Placa de impresión
export const PEDESTAL_HEIGHT_MM = 2;
export const PEDESTAL_RADIUS_MM = 3.2;
export const PRINT_GAP_MM = 5;
export const TUBE_RAFT_HEIGHT_MM = 1;
// Escala posiciones (Å) a mm para la vista ensamblada
export const POSITION_SCALE = 8;

// Datos atómicos para el modelo de Bohr (z = número atómico, mass = masa atómica)
export const ELEMENT_DATA = {
  H:  { z: 1,  mass: 1,  name: 'Hidrógeno' },
  O:  { z: 8,  mass: 16, name: 'Oxígeno' },
  C:  { z: 6,  mass: 12, name: 'Carbono' },
  N:  { z: 7,  mass: 14, name: 'Nitrógeno' },
  Cl: { z: 17, mass: 35, name: 'Cloro' },
  Na: { z: 11, mass: 23, name: 'Sodio' },
  K:  { z: 19, mass: 39, name: 'Potasio' },
  Ca: { z: 20, mass: 40, name: 'Calcio' },
  Mg: { z: 12, mass: 24, name: 'Magnesio' },
  Li: { z: 3,  mass: 7,  name: 'Litio' },
  F:  { z: 9,  mass: 19, name: 'Flúor' },
  Br: { z: 35, mass: 80, name: 'Bromo' },
  S:  { z: 16, mass: 32, name: 'Azufre' },
};

// Calcula la distribución de electrones por capa (modelo de Bohr)
export function getElectronShells(z) {
  const shellCaps = [2, 8, 18, 32, 32, 18, 8];
  const shells = [];
  let remaining = z;
  for (const cap of shellCaps) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, cap);
    shells.push(count);
    remaining -= count;
  }
  return shells;
}

// Deriva periodo y grupo de la tabla periódica a partir del número atómico
export function derivePeriodGroup(z) {
  if (z === 1) return { period: 1, group: 1 };
  if (z === 2) return { period: 1, group: 18 };
  if (z >= 3 && z <= 10) return { period: 2, group: z <= 4 ? z - 2 : z + 8 };
  if (z >= 11 && z <= 18) return { period: 3, group: z <= 12 ? z - 10 : z };
  if (z >= 19 && z <= 36) return { period: 4, group: z - 18 };
  if (z >= 37 && z <= 54) return { period: 5, group: z - 36 };
  if (z >= 55 && z <= 86) {
    if (z <= 56) return { period: 6, group: z - 54 };
    if (z <= 71) return { period: 6, group: null, lanthanide: true };
    return { period: 6, group: z - 68 };
  }
  if (z >= 87 && z <= 118) {
    if (z <= 88) return { period: 7, group: z - 86 };
    if (z <= 103) return { period: 7, group: null, actinide: true };
    return { period: 7, group: z - 100 };
  }
  return { period: null, group: null };
}

const METALLOIDS = new Set([5, 14, 32, 33, 51, 52]);
const NONMETAL_Z = new Set([1, 6, 7, 8, 15, 16]);

function deriveCategory(z, group, lanthanide, actinide) {
  if (lanthanide) return 'Lantánido';
  if (actinide) return 'Actínido';
  if (z === 2 || group === 18) return 'Gas noble';
  if (group === 17) return 'Halógeno';
  if (group === 1 && z !== 1) return 'Metal alcalino';
  if (group === 2) return 'Alcalinotérreo';
  if (group >= 3 && group <= 12) return 'Metal de transición';
  if (METALLOIDS.has(z)) return 'Metaloide';
  if (NONMETAL_Z.has(z)) return 'No metal';
  return 'Metal del bloque p';
}

export function isMetalCategory(category) {
  return ['Metal alcalino', 'Alcalinotérreo', 'Metal de transición', 'Metal del bloque p', 'Lantánido', 'Actínido'].includes(category);
}

export function getValenceElectrons(group, z) {
  if (z === 2) return 2;
  if (!group) return 2;
  if (group <= 2) return group;
  if (group >= 13) return group - 10;
  return 2;
}

// Metadatos completos de un elemento
export function getElementMeta(z) {
  const { period, group, lanthanide, actinide } = derivePeriodGroup(z);
  const category = deriveCategory(z, group, lanthanide, actinide);
  const valence = getValenceElectrons(group, z);
  const shells = getElectronShells(z);
  return { period, group, category, valence, shells, lanthanide, actinide };
}

// Electronegatividad de Pauling por número atómico (null = sin valor establecido)
const ELECTRONEG = [
  null, // 0 placeholder
  2.20, null, 0.98, 1.57, 2.04, 2.55, 3.04, 3.44, 3.98, null, // 1-10
  0.93, 1.31, 1.61, 1.90, 2.19, 2.58, 3.16, null, 0.82, 1.00, // 11-20
  1.36, 1.54, 1.63, 1.66, 1.55, 1.83, 1.88, 1.91, 1.90, 1.65, // 21-30
  1.81, 2.01, 2.18, 2.55, 2.96, 3.00, 0.82, 0.95, 1.22, 1.33, // 31-40
  1.60, 2.16, 1.90, 2.20, 2.28, 2.20, 1.93, 1.69, 1.78, 1.96, // 41-50
  2.05, 2.10, 2.66, 2.60, 0.79, 0.89, 1.10, 1.12, 1.13, 1.14, // 51-60
  1.13, 1.17, 1.20, 1.10, 1.22, 1.23, 1.24, 1.25, 1.10, 1.27, // 61-70
  1.30, 1.50, 2.36, 1.90, 2.20, 2.20, 2.28, 2.54, 2.00, 1.62, // 71-80
  1.87, 2.02, 2.00, 2.20, null, 0.70, 0.90, 1.10, 1.30, 1.50, // 81-90
  1.38, 1.36, 1.28, 1.13, 1.28, 1.30, 1.30, 1.30, 1.30, 1.30, // 91-100
  1.30, 1.30, 1.30, null, null, null, null, null, null, null, // 101-110
  null, null, null, null, null, null, null, null, null, // 111-118
];

export function electronegativity(z) {
  return ELECTRONEG[z] ?? null;
}

// Carácter metálico cualitativo derivado de la categoría
export function metallicCharacter(category) {
  if (isMetalCategory(category)) return 'Alto';
  if (category === 'Metaloide') return 'Medio';
  return 'Bajo';
}

// Orden de enlace (nº de pares compartidos) para dos elementos covalentes,
// basado en los electrones que a cada uno le faltan para completar octeto.
export function covalentBondOrder(a, b) {
  const neededA = a.z === 1 ? 1 : Math.max(0, 8 - a.valence);
  const neededB = b.z === 1 ? 1 : Math.max(0, 8 - b.valence);
  const order = Math.max(1, Math.min(neededA, neededB, 3));
  return order;
}

export function bondOrderLabel(order) {
  return order === 3 ? 'Triple' : order === 2 ? 'Doble' : 'Simple';
}

// --- Configuración electrónica según el diagrama de Möller (Aufbau) ---
const SUB_CAP = { s: 2, p: 6, d: 10, f: 14 };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
// Orden de llenado de los subniveles (flechas diagonales del diagrama de Möller)
const AUFBAU_ORDER = [
  { n: 1, l: 's' }, { n: 2, l: 's' }, { n: 2, l: 'p' }, { n: 3, l: 's' }, { n: 3, l: 'p' },
  { n: 4, l: 's' }, { n: 3, l: 'd' }, { n: 4, l: 'p' }, { n: 5, l: 's' }, { n: 4, l: 'd' },
  { n: 5, l: 'p' }, { n: 6, l: 's' }, { n: 4, l: 'f' }, { n: 5, l: 'd' }, { n: 6, l: 'p' },
  { n: 7, l: 's' }, { n: 5, l: 'f' }, { n: 6, l: 'd' }, { n: 7, l: 'p' },
];

// Devuelve la configuración electrónica completa: "1s² 2s² 2p⁶ 3s²..."
export function getElectronicConfig(z) {
  let remaining = z;
  const parts = [];
  for (const sub of AUFBAU_ORDER) {
    if (remaining <= 0) break;
    const cap = SUB_CAP[sub.l];
    const filled = Math.min(remaining, cap);
    const sup = String(filled).split('').map((d) => SUP[d] || d).join('');
    parts.push(`${sub.n}${sub.l}${sup}`);
    remaining -= filled;
  }
  return parts.join(' ');
}

const ROMAN = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
function toRoman(num) {
  let r = '';
  for (const [s, v] of ROMAN) { while (num >= v) { r += s; num -= v; } }
  return r;
}

// Notación de grupo: número + romano + A/B (sistema antiguo IUPAC)
export function groupNotation(group, z) {
  if (!group) return z === 1 ? 'Grupo 1 · IA' : '—';
  let romano, ab;
  if (group <= 2) { romano = toRoman(group); ab = 'A'; }
  else if (group <= 12) { romano = toRoman(group); ab = 'B'; }
  else { romano = toRoman(group - 10); ab = 'A'; }
  return `Grupo ${group} · ${romano}${ab}`;
}

// Valencia típica de los elementos (para inferir orden de enlace)
const TYPICAL_VALENCE = {
  H: 1, Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Fr: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Ra: 2,
  B: 3, Al: 3, Ga: 3, In: 3, Tl: 3, C: 4, Si: 4, Ge: 4, Sn: 4, Pb: 4,
  N: 3, P: 3, As: 3, Sb: 3, Bi: 3, O: 2, S: 2, Se: 2, Te: 2, F: 1, Cl: 1, Br: 1, I: 1, At: 1,
};

// Infiere el orden de cada enlace (1=simple, 2=doble, 3=triple) a partir de la
// valencia típica de cada átomo y cuántos enlaces forma.
export function inferBondOrders(atoms, bonds) {
  const order = bonds.map(() => 1);
  const adj = atoms.map(() => []);
  bonds.forEach((b, i) => { adj[b.from].push({ bi: i, other: b.to }); adj[b.to].push({ bi: i, other: b.from }); });
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let a = 0; a < atoms.length; a++) {
      const v = TYPICAL_VALENCE[atoms[a].element] ?? 1;
      let sum = 0; adj[a].forEach((e) => (sum += order[e.bi]));
      let deficit = v - sum;
      if (deficit <= 0) continue;
      for (const e of adj[a]) {
        if (deficit <= 0) break;
        if (order[e.bi] >= 3) continue;
        let ps = 0; adj[e.other].forEach((x) => (ps += order[x.bi]));
        const pdef = (TYPICAL_VALENCE[atoms[e.other].element] ?? 1) - ps;
        if (pdef > 0) { order[e.bi]++; deficit--; changed = true; }
      }
    }
    if (!changed) break;
  }
  return order;
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
export function toSubscript(n) {
  return String(n).split('').map((d) => SUB[d] || d).join('');
}

// Analiza el enlace entre dos elementos (a, b: { symbol, z, ...meta })
export function analyzeBond(a, b) {
  const ma = getElementMeta(a.z);
  const mb = getElementMeta(b.z);
  const enA = electronegativity(a.z);
  const enB = electronegativity(b.z);
  const A = { ...a, ...ma, en: enA, metallic: metallicCharacter(ma.category) };
  const B = { ...b, ...mb, en: enB, metallic: metallicCharacter(mb.category) };
  const deltaEN = enA !== null && enB !== null ? Math.abs(enA - enB) : null;

  if (ma.category === 'Gas noble' || mb.category === 'Gas noble') {
    return { type: 'none', A, B, enA, enB, deltaEN, polarity: 'Sin enlace', reason: 'Los gases nobles ya tienen su capa de valencia completa y rara vez forman enlaces.' };
  }
  const aMetal = isMetalCategory(ma.category);
  const bMetal = isMetalCategory(mb.category);

  if (aMetal && bMetal) {
    return { type: 'metallic', A, B, enA, enB, deltaEN, polarity: 'Metálico', reason: 'Ambos son metales: forman un enlace metálico (mar de electrones compartido), no una molécula discreta.' };
  }

  if (aMetal || bMetal) {
    // Enlace iónico: el metal cede electrones, el no metal los gana
    const metal = aMetal ? A : B;
    const nonmetal = aMetal ? B : A;
    const metalCharge = metal.valence; // positivo
    const nonmetalCharge = nonmetal.z === 1 ? -1 : -(8 - nonmetal.valence);
    const g = gcd(metalCharge, Math.abs(nonmetalCharge));
    const nMetal = Math.abs(nonmetalCharge) / g;
    const nNonmetal = metalCharge / g;
    const formula = `${metal.symbol}${nMetal > 1 ? toSubscript(nMetal) : ''}${nonmetal.symbol}${nNonmetal > 1 ? toSubscript(nNonmetal) : ''}`;
    // Valencia antes/después de la transferencia
    const metalShellsBefore = [...metal.shells];
    const nonmetalShellsBefore = [...nonmetal.shells];
    const metalShellsAfter = [...metal.shells];
    const nonmetalShellsAfter = [...nonmetal.shells];
    if (metalShellsAfter.length > 0) {
      metalShellsAfter[metalShellsAfter.length - 1] -= metalCharge;
      // Si la última capa queda vacía, se elimina
      while (metalShellsAfter.length && metalShellsAfter[metalShellsAfter.length - 1] === 0) {
        metalShellsAfter.pop();
      }
    }
    if (nonmetalShellsAfter.length > 0) {
      nonmetalShellsAfter[nonmetalShellsAfter.length - 1] += metalCharge;
    }
    const nonmetalValenceAfter = nonmetalShellsAfter.length ? nonmetalShellsAfter[nonmetalShellsAfter.length - 1] : 0;
    return {
      type: 'ionic', A, B, metal, nonmetal,
      metalCharge, nonmetalCharge, nMetal, nNonmetal,
      transferCount: metalCharge,
      formula,
      enA, enB, deltaEN, polarity: 'Iónico',
      metalShellsBefore, nonmetalShellsBefore, metalShellsAfter, nonmetalShellsAfter,
      nonmetalValenceAfter,
      reason: `${metal.name} cede ${metalCharge} electrón${metalCharge > 1 ? 'es' : ''} y queda como catión ${metal.symbol}⁺${metalCharge > 1 ? metalCharge : ''}; ${nonmetal.name} los gana y completa su octeto (${nonmetalValenceAfter} e⁻ en su última capa). La fórmula estable es ${formula}.`,
    };
  }

  // Enlace covalente: comparten electrones
  const order = covalentBondOrder(A, B);
  const sharedPairs = order; // nº de pares compartidos
  const homo = A.symbol === B.symbol;
  const formula = homo ? `${A.symbol}${toSubscript(2)}` : `${A.symbol}${B.symbol}`;
  const covalentPolarity = deltaEN !== null
    ? (deltaEN >= 0.4 ? 'Covalente polar' : 'Covalente apolar')
    : 'Desconocido';
  return {
    type: 'covalent', A, B,
    bondOrder: order,
    bondOrderLabel: bondOrderLabel(order),
    sharedPairs,
    homo,
    formula,
    enA, enB, deltaEN,
    polarity: covalentPolarity,
    reason: `${A.name} y ${B.name} son no metales y comparten ${order === 1 ? 'un par' : `${order} pares`} de electrones (enlace ${bondOrderLabel(order).toLowerCase()}) para completar sus capas de valencia (regla del octeto).`,
  };
}

// Mapa símbolo -> número atómico para clasificar compuestos
const _zBySymbol = {};
ALL_ELEMENTS.forEach((e) => { _zBySymbol[e.symbol] = e.z; });

// Clasifica un compuesto en iónico, covalente polar o covalente apolar.
// - Iónico: contiene al menos un metal y un no metal.
// - Covalente: usa la diferencia de electronegatividad (ΔEN) de los enlaces;
//   ΔEN >= 0.4 => polar, si no => apolar.
export function classifyCompound(c) {
  if (!c || !c.atoms || !c.atoms.length) return { key: 'covalent_apolar', label: 'Covalente apolar' };
  const zs = c.atoms.map((a) => _zBySymbol[a.element]).filter((z) => z != null);
  const metas = zs.map(getElementMeta);
  const hasMetal = metas.some((m) => isMetalCategory(m.category));
  const hasNonmetal = metas.some((m) => m && !isMetalCategory(m.category));
  if (hasMetal && hasNonmetal) return { key: 'ionic', label: 'Iónico' };

  const en = (sym) => electronegativity(_zBySymbol[sym]);
  let pairs = [];
  if (c.bonds && c.bonds.length) {
    c.bonds.forEach((b) => {
      const a = c.atoms[b.from];
      const bb = c.atoms[b.to];
      if (a && bb) pairs.push([a.element, bb.element]);
    });
  } else {
    for (let i = 0; i < c.atoms.length; i++) {
      for (let j = i + 1; j < c.atoms.length; j++) {
        pairs.push([c.atoms[i].element, c.atoms[j].element]);
      }
    }
  }
  let maxDelta = 0;
  for (const [a, b] of pairs) {
    const ea = en(a);
    const eb = en(b);
    if (ea != null && eb != null) maxDelta = Math.max(maxDelta, Math.abs(ea - eb));
  }
  return maxDelta >= 0.4
    ? { key: 'covalent_polar', label: 'Covalente polar' }
    : { key: 'covalent_apolar', label: 'Covalente apolar' };
}