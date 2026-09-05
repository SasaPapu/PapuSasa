import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 118 elementos químicos: [símbolo, nombre, número atómico, masa]
const ELEMENTS = [
  ['H','Hidrógeno',1,1],['He','Helio',2,4],['Li','Litio',3,7],['Be','Berilio',4,9],['B','Boro',5,11],
  ['C','Carbono',6,12],['N','Nitrógeno',7,14],['O','Oxígeno',8,16],['F','Flúor',9,19],['Ne','Neón',10,20],
  ['Na','Sodio',11,23],['Mg','Magnesio',12,24],['Al','Aluminio',13,27],['Si','Silicio',14,28],['P','Fósforo',15,31],
  ['S','Azufre',16,32],['Cl','Cloro',17,35],['Ar','Argón',18,40],['K','Potasio',19,39],['Ca','Calcio',20,40],
  ['Sc','Escandio',21,45],['Ti','Titanio',22,48],['V','Vanadio',23,51],['Cr','Cromo',24,52],['Mn','Manganeso',25,55],
  ['Fe','Hierro',26,56],['Co','Cobalto',27,59],['Ni','Níquel',28,59],['Cu','Cobre',29,64],['Zn','Cinc',30,65],
  ['Ga','Galio',31,70],['Ge','Germanio',32,73],['As','Arsénico',33,75],['Se','Selenio',34,79],['Br','Bromo',35,80],
  ['Kr','Kriptón',36,84],['Rb','Rubidio',37,85],['Sr','Estroncio',38,88],['Y','Itrio',39,89],['Zr','Circonio',40,91],
  ['Nb','Niobio',41,93],['Mo','Molibdeno',42,96],['Tc','Tecnecio',43,98],['Ru','Rutenio',44,101],['Rh','Rodio',45,103],
  ['Pd','Paladio',46,106],['Ag','Plata',47,108],['Cd','Cadmio',48,112],['In','Indio',49,115],['Sn','Estaño',50,119],
  ['Sb','Antimonio',51,122],['Te','Telurio',52,128],['I','Yodo',53,127],['Xe','Xenón',54,131],['Cs','Cesio',55,133],
  ['Ba','Bario',56,137],['La','Lantano',57,139],['Ce','Cerio',58,140],['Pr','Praseodimio',59,141],['Nd','Neodimio',60,144],
  ['Pm','Prometio',61,145],['Sm','Samario',62,150],['Eu','Europio',63,152],['Gd','Gadolinio',64,157],['Tb','Terbio',65,159],
  ['Dy','Disprosio',66,163],['Ho','Holmio',67,165],['Er','Erbio',68,167],['Tm','Tulio',69,169],['Yb','Iterbio',70,173],
  ['Lu','Lutecio',71,175],['Hf','Hafnio',72,178],['Ta','Tántalo',73,181],['W','Wolframio',74,184],['Re','Renio',75,186],
  ['Os','Osmio',76,190],['Ir','Iridio',77,192],['Pt','Platino',78,195],['Au','Oro',79,197],['Hg','Mercurio',80,201],
  ['Tl','Talio',81,204],['Pb','Plomo',82,207],['Bi','Bismuto',83,209],['Po','Polonio',84,209],['At','Ástato',85,210],
  ['Rn','Radón',86,222],['Fr','Francio',87,223],['Ra','Radio',88,226],['Ac','Actinio',89,227],['Th','Torio',90,232],
  ['Pa','Protactinio',91,231],['U','Uranio',92,238],['Np','Neptunio',93,237],['Pu','Plutonio',94,244],['Am','Americio',95,243],
  ['Cm','Curio',96,247],['Bk','Berkelio',97,247],['Cf','Californio',98,251],['Es','Einsteinio',99,252],['Fm','Fermio',100,257],
  ['Md','Mendelevio',101,258],['No','Nobelio',102,259],['Lr','Laurencio',103,262],['Rf','Rutherfordio',104,267],['Db','Dubnio',105,268],
  ['Sg','Seaborgio',106,271],['Bh','Bohrio',107,272],['Hs','Hassio',108,270],['Mt','Meitnerio',109,276],['Ds','Darmstadtio',110,281],
  ['Rg','Roentgenio',111,282],['Cn','Copernicio',112,285],['Nh','Nihonio',113,286],['Fl','Flerovio',114,289],['Mc','Moscovio',115,290],
  ['Lv','Livermorio',116,293],['Ts','Teneso',117,294],['Og','Oganesón',118,294]
];

const METALLOIDS = new Set([5, 14, 32, 33, 51, 52]);
const NONMETAL_Z = new Set([1, 6, 7, 8, 15, 16]);

function derivePeriodGroup(z) {
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

function categoryOf(z) {
  const { group, lanthanide, actinide } = derivePeriodGroup(z);
  return deriveCategory(z, group, lanthanide, actinide);
}

// Función de mantenimiento (solo admin): genera resúmenes de 3 líneas con IA
// para los 118 elementos y los siembra en la entidad Element (idempotente).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo el administrador puede sembrar los elementos' }, { status: 403 });
    }

    const BATCH = 40;
    const summaryMap = {};
    for (let i = 0; i < ELEMENTS.length; i += BATCH) {
      const batch = ELEMENTS.slice(i, i + BATCH);
      const list = batch.map(([s, n]) => `${s} (${n})`).join(', ');
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          'Eres un asistente educativo de química en español. Para cada uno de los siguientes elementos químicos, ' +
          'escribe un resumen de exactamente 3 líneas (cada línea una frase corta separada por salto de línea): ' +
          'línea 1 = qué es y su categoría/tipo; línea 2 = propiedades clave (estado, reactividad); ' +
          'línea 3 = usos o importancia. Elementos: ' + list + '. ' +
          'Devuelve un JSON con la forma { "elements": [ { "symbol": "H", "summary": "..." }, ... ] }.',
        response_json_schema: {
          type: 'object',
          properties: {
            elements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                  summary: { type: 'string' }
                },
                required: ['symbol', 'summary']
              }
            }
          },
          required: ['elements']
        }
      });
      const arr = (res && res.elements) || [];
      for (const e of arr) {
        if (e && e.symbol && e.summary) summaryMap[e.symbol] = e.summary.trim();
      }
    }

    const records = ELEMENTS.map(([s, n, z, m]) => ({
      symbol: s,
      name: n,
      z,
      mass: m,
      type: categoryOf(z),
      summary: summaryMap[s] || `${n}. Elemento con número atómico ${z}, clasificado como ${categoryOf(z)}.`
    }));

    // Re-siembra idempotente: borra los registros previos y crea los nuevos.
    await base44.asServiceRole.entities.Element.deleteMany({});
    const created = await base44.asServiceRole.entities.Element.bulkCreate(records);
    const count = Array.isArray(created) ? created.length : 0;
    return Response.json({ ok: true, count, total: records.length, missing: records.filter((r) => !summaryMap[r.symbol]).map((r) => r.symbol) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}