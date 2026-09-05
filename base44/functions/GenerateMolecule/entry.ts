import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Conversión de subíndices Unicode a números normales (H₂O → H2O)
const SUBSCRIPTS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

function normalizeInput(input) {
  let s = input.trim();
  for (const [sub, num] of Object.entries(SUBSCRIPTS)) {
    s = s.split(sub).join(num);
  }
  return s;
}

// Conjunto de metales para clasificar el tipo de enlace
const METALS = new Set([
  'Li', 'Na', 'K', 'Rb', 'Cs', 'Fr', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra',
  'Al', 'Ga', 'In', 'Sn', 'Tl', 'Pb', 'Bi', 'Fe', 'Cu', 'Zn', 'Ag', 'Au',
  'Hg', 'Ni', 'Co', 'Cr', 'Mn', 'Cd', 'Ti', 'V', 'Zr', 'Mo', 'W', 'Pt',
]);

function classifyBondType(atoms) {
  let hasMetal = false;
  let hasNonmetal = false;
  for (const a of atoms) {
    if (METALS.has(a.element)) hasMetal = true;
    else hasNonmetal = true;
  }
  return hasMetal && hasNonmetal ? 'ionic' : 'covalent';
}

// Parsea un SDF (formato V2000) y extrae átomos con posiciones 3D y enlaces
function parseSDF(sdf) {
  const lines = sdf.split('\n');
  if (lines.length < 4) return null;

  // Línea de conteos (índice 3): átomos en columnas 0-3, enlaces en 3-6
  const countsLine = lines[3];
  const atomCount = parseInt(countsLine.substring(0, 3), 10);
  const bondCount = parseInt(countsLine.substring(3, 6), 10);
  if (isNaN(atomCount) || atomCount === 0 || atomCount > 200) return null;

  const atoms = [];
  const bonds = [];

  // Bloque de átomos empieza en línea 5 (índice 4)
  for (let i = 0; i < atomCount; i++) {
    const line = lines[4 + i] || '';
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    const z = parseFloat(line.substring(20, 30));
    const element = line.substring(31, 34).trim();
    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && element) {
      atoms.push({ element, position: [x, y, z] });
    }
  }

  // Bloque de enlaces justo después de los átomos
  for (let i = 0; i < bondCount; i++) {
    const line = lines[4 + atomCount + i] || '';
    const from = parseInt(line.substring(0, 3), 10);
    const to = parseInt(line.substring(3, 6), 10);
    if (!isNaN(from) && !isNaN(to) && from >= 1 && to >= 1) {
      bonds.push({ from: from - 1, to: to - 1 }); // convertir a base 0
    }
  }

  if (atoms.length === 0) return null;
  return { atoms, bonds };
}

async function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Recupera CIDs de PubChem manejando respuestas asíncronas con ListKey
// (PubChem devuelve "Waiting" + ListKey cuando la búsqueda por fórmula
// genera muchos resultados; hay que sondear el endpoint de listkey).
async function fetchCids(url, pubchemBase) {
  let currentUrl = url;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetchWithTimeout(currentUrl, 15000);
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.IdentifierList?.CID?.length) return data.IdentifierList.CID;
      if (data?.Waiting?.ListKey) {
        currentUrl = `${pubchemBase}/compound/listkey/${data.Waiting.ListKey}/cids/JSON`;
        await sleep(1000);
        continue;
      }
      return [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Detecta si un nombre es un IUPAC sistemático largo (con descriptores estereo,
// muchos paréntesis/comas) que conviene reemplazar por un sinónimo común.
function looksSystematic(name) {
  if (!name) return false;
  if (/\([0-9]/.test(name)) return true;                    // ej. (2R,3R...
  if (/[,\(\)]/.test(name) && name.length > 35) return true;
  return false;
}

// Elige un nombre común y legible de la lista de sinónimos de PubChem,
// descartando identificadores técnicos (CAS, InChI, SMILES, acrónimos, IUPAC largos).
function pickCommonName(synonyms) {
  if (!Array.isArray(synonyms) || synonyms.length === 0) return null;
  const candidates = synonyms
    .map((s) => (s || '').trim())
    .filter((s) => s.length >= 3 && s.length <= 35)
    .filter((s) => !/^\d/.test(s))               // no empieza con dígito (CAS, etc.)
    .filter((s) => !/[;:\\/=]/.test(s))          // no InChI/SMILES
    .filter((s) => (s.match(/[(),]/g) || []).length <= 2) // pocos paréntesis/comas
    .filter((s) => !/^[A-Z0-9\-]+$/.test(s))      // descarta acrónimos/códigos todo-mayúsculas
    .filter((s) => /[a-z]/.test(s));              // debe tener letras minúsculas (nombre real)
  if (candidates.length === 0) return null;
  // Elegir el más corto (más probablemente un nombre común)
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

export default async function(req) {
  try {
    const body = await req.json();
    const rawInput = (body?.formula || '').trim();
    if (!rawInput) return Response.json({ error: 'Fórmula requerida' }, { status: 400 });
    if (rawInput.length > 60) return Response.json({ error: 'Entrada demasiado larga' }, { status: 400 });

    const query = normalizeInput(rawInput);
    const queryEncoded = encodeURIComponent(query);
    const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

    // 1) Buscar CIDs por fórmula; si no hay, intentar búsqueda por nombre
    let cids = await fetchCids(`${PUBCHEM}/compound/formula/${queryEncoded}/cids/JSON`, PUBCHEM);
    if (cids.length === 0) {
      cids = await fetchCids(`${PUBCHEM}/compound/name/${queryEncoded}/cids/JSON`, PUBCHEM);
    }

    if (cids.length === 0) {
      return Response.json({
        error: `No se encontró "${query}" en PubChem. Verifica la fórmula o nombre del compuesto.`
      }, { status: 404 });
    }

    // 2) Probar los primeros CIDs hasta encontrar uno con estructura 3D
    let sdfText = null;
    let usedCid = null;
    for (const cid of cids.slice(0, 5)) {
      try {
        const sdfRes = await fetchWithTimeout(
          `${PUBCHEM}/compound/cid/${cid}/SDF?record_type=3d`
        );
        if (sdfRes.ok) {
          const text = await sdfRes.text();
          if (text && text.includes('V2000')) {
            sdfText = text;
            usedCid = cid;
            break;
          }
        }
      } catch (e) { /* probar siguiente CID */ }
    }

    if (!sdfText) {
      return Response.json({
        error: `PubChem tiene "${query}" pero sin estructura 3D disponible. Los compuestos iónicos (ej. NaCl) forman redes cristalinas, no moléculas discretas con coordenadas 3D.`
      }, { status: 404 });
    }

    // 3) Parsear el SDF a átomos + enlaces
    const parsed = parseSDF(sdfText);
    if (!parsed || parsed.atoms.length === 0) {
      return Response.json({ error: 'Error al procesar la estructura 3D de PubChem.' }, { status: 500 });
    }

    // 4) Obtener propiedades (nombre y fórmula molecular canónica)
    let name = query;
    let molecularFormula = query;
    if (usedCid) {
      try {
        const propRes = await fetchWithTimeout(
          `${PUBCHEM}/compound/cid/${usedCid}/property/Title,MolecularFormula/JSON`
        );
        if (propRes.ok) {
          const propData = await propRes.json();
          const props = propData?.PropertyTable?.Properties?.[0];
          if (props) {
            name = props.Title || name;
            molecularFormula = props.MolecularFormula || molecularFormula;
          }
        }
      } catch (e) { /* usar valores por defecto */ }

      // Solo reemplazar el nombre si es un IUPAC sistemático largo
      if (looksSystematic(name)) {
        try {
          const synRes = await fetchWithTimeout(
            `${PUBCHEM}/compound/cid/${usedCid}/synonyms/JSON`
          );
          if (synRes.ok) {
            const synData = await synRes.json();
            const synonyms = synData?.InformationList?.Information?.[0]?.Synonym || [];
            const common = pickCommonName(synonyms);
            if (common) name = common;
          }
        } catch (e) { /* mantener el nombre anterior */ }
      }
    }

    // 5) Clasificar tipo de enlace
    const type = classifyBondType(parsed.atoms);

    // 6) Obtener descripción textual del compuesto (qué es)
    let description = '';
    if (usedCid) {
      try {
        const descRes = await fetchWithTimeout(
          `${PUBCHEM}/compound/cid/${usedCid}/description/JSON`
        );
        if (descRes.ok) {
          const descData = await descRes.json();
          const infos = descData?.InformationList?.Information || [];
          for (const info of infos) {
            if (info.Description && info.Description.length > 10) {
              description = info.Description;
              break;
            }
          }
        }
      } catch (e) { /* usar resumen por defecto */ }
    }
    if (!description) {
      description = `${name} es un compuesto químico con fórmula molecular ${molecularFormula}.`;
    }

    // 7) Traducir la descripción al español con el LLM
    try {
      const base44 = createClientFromRequest(req);
      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Traduce al español el siguiente texto descriptivo de un compuesto químico. Devuelve ÚNICAMENTE la traducción, sin explicaciones ni comillas:\n\n${description}`,
      });
      if (llmRes && typeof llmRes === 'string' && llmRes.trim().length > 10) {
        description = llmRes.trim();
      }
    } catch (e) { /* mantener descripción original */ }

    return Response.json({
      molecule: {
        name,
        formula: molecularFormula,
        type,
        description,
        atoms: parsed.atoms,
        bonds: parsed.bonds,
        source: 'PubChem',
        cid: usedCid,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}