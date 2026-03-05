/**
 * Importador de datos logísticos desde planillas de depósito
 * Matchea por: codigo_proveedor, nombre fuzzy, código de barras
 */

const { CatalogoArticulo } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

/**
 * Parsear Excel de datos logísticos (formato variable por proveedor)
 * Detecta columnas automáticamente buscando headers conocidos
 */
function parsearExcelLogistico(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Pick the sheet with the most data
    let bestSheet = null;
    let bestRows = 0;
    for (const name of workbook.SheetNames) {
        const ws = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const nonEmpty = data.filter(r => r.some(c => c !== '')).length;
        if (nonEmpty > bestRows) {
            bestRows = nonEmpty;
            bestSheet = name;
        }
    }
    
    if (!bestSheet || bestRows < 3) throw new Error('No se encontró una hoja con datos suficientes');
    
    const sheet = workbook.Sheets[bestSheet];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (data.length < 3) throw new Error('El archivo tiene menos de 3 filas');
    
    // Buscar fila de headers — check rows 0-5 for known header words
    let headerRow = -1;
    let colMap = {};
    
    // First check if there's a two-row header (row 0 = groups, row 1 = columns)
    for (let r = 0; r < Math.min(5, data.length); r++) {
        const row = data[r].map(c => String(c || '').toLowerCase().replace(/\n/g, ' ').trim());
        // Check if this row has CODE or DESCRIPTION
        const hasCode = row.some(c => c === 'code' || c === 'código' || c === 'codigo' || c === 'sku');
        const hasDesc = row.some(c => c.includes('description') || c.includes('descripcion') || c.includes('nombre'));
        
        if (hasCode || hasDesc) {
            headerRow = r;
            // Detect groups from previous row if exists
            const groupRow = r > 0 ? data[r-1].map(c => String(c || '').toLowerCase().trim()) : [];
            colMap = detectColumnsWithGroups(row, groupRow);
            break;
        }
    }
    
    if (headerRow < 0) throw new Error('No se detectaron columnas de CODE/DESCRIPTION en el Excel');
    
    // Parsear filas de datos
    const articulos = [];
    for (let r = headerRow + 1; r < data.length; r++) {
        const row = data[r];
        const code = String(row[colMap.code] || '').trim();
        const desc = String(row[colMap.description] || '').trim();
        if (!code && !desc) continue;
        
        articulos.push({
            codigo_proveedor: code.replace(/\.0$/, ''), // Quitar .0 de números
            descripcion: desc,
            tipo_empaque: colMap.packaging >= 0 ? String(row[colMap.packaging] || '').trim() : '',
            // Pieza
            pieza_largo_cm: parseNum(row[colMap.pieza_largo]),
            pieza_ancho_cm: parseNum(row[colMap.pieza_ancho]),
            pieza_alto_cm: parseNum(row[colMap.pieza_alto]),
            pieza_peso_kg: parseNum(row[colMap.pieza_peso]),
            // Caja
            caja_largo_cm: parseNum(row[colMap.caja_largo]),
            caja_ancho_cm: parseNum(row[colMap.caja_ancho]),
            caja_alto_cm: parseNum(row[colMap.caja_alto]),
            caja_peso_kg: parseNum(row[colMap.caja_peso]),
            und_por_caja: parseNum(row[colMap.und_caja]),
            // EAN
            ean: colMap.ean >= 0 ? String(row[colMap.ean] || '').trim().replace(/\.0$/, '') : ''
        });
    }
    
    return articulos;
}

/**
 * Detect columns using both header row and group row
 * Group row tells us which "Largo" is for pieza vs caja
 */
function detectColumnsWithGroups(row, groupRow) {
    const map = {
        code: -1, description: -1, packaging: -1,
        pieza_largo: -1, pieza_ancho: -1, pieza_alto: -1, pieza_peso: -1,
        caja_largo: -1, caja_ancho: -1, caja_alto: -1, caja_peso: -1,
        und_caja: -1, ean: -1
    };
    
    // Build a zone map from group row: which columns belong to pieza vs caja
    const zones = {}; // col index -> 'pieza' | 'caja' | ''
    let currentZone = '';
    for (let i = 0; i < Math.max(row.length, groupRow.length); i++) {
        const g = (groupRow[i] || '').toLowerCase();
        if (g.includes('pieza') || g.includes('unit') || g.includes('producto')) currentZone = 'pieza';
        else if (g.includes('caja') || g.includes('box') || g.includes('case')) currentZone = 'caja';
        else if (g.includes('pallet') || g.includes('std') || g.includes('barr') || g.includes('ean')) currentZone = 'other';
        zones[i] = currentZone;
    }
    
    for (let i = 0; i < row.length; i++) {
        const v = row[i];
        const zone = zones[i] || '';
        
        if (v === 'code' || v === 'código' || v === 'codigo' || v === 'sku') {
            if (v.includes('ean') || v.includes('barra')) map.ean = i;
            else if (map.code < 0) map.code = i;
        }
        else if (v.includes('description') || v.includes('descripcion') || v.includes('nombre')) {
            if (map.description < 0) map.description = i;
        }
        else if (v.includes('packaging') || v.includes('empaque') || v.includes('presentac') || v.includes('unit packaging')) map.packaging = i;
        else if (v.includes('ean') || v.includes('barra') || v.includes('gtin')) map.ean = i;
        else if ((v.includes('unidades') || v.includes('und') || v.includes('units')) && zone === 'caja') map.und_caja = i;
        else if (v.includes('largo') || v.includes('length') || v.includes('long')) {
            if (zone === 'pieza') map.pieza_largo = i;
            else if (zone === 'caja') map.caja_largo = i;
        }
        else if (v.includes('ancho') || v.includes('width')) {
            if (zone === 'pieza') map.pieza_ancho = i;
            else if (zone === 'caja') map.caja_ancho = i;
        }
        else if (v.includes('alto') || v.includes('altura') || v.includes('height')) {
            if (zone === 'pieza') map.pieza_alto = i;
            else if (zone === 'caja') map.caja_alto = i;
        }
        else if (v.includes('peso') || v.includes('weight') || v.includes('neto')) {
            if (zone === 'pieza') map.pieza_peso = i;
            else if (zone === 'caja') map.caja_peso = i;
        }
    }
    
    return map;
}

function parseNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

/**
 * Intentar matchear artículos del Excel con el catálogo
 */
async function matchearConCatalogo(articulosLogisticos) {
    // Cargar todo el catálogo
    const catalogo = await CatalogoArticulo.findAll({
        where: { habilitado: true },
        attributes: ['id', 'codigo_goodies', 'nombre', 'codigo_elaborador', 'proveedor', 'empresa_fabrica', 'marca']
    });
    
    const resultados = [];
    
    for (const art of articulosLogisticos) {
        let match = null;
        let metodo = null;
        let confianza = 0;
        
        // 1. Match por código proveedor (codigo_elaborador)
        if (art.codigo_proveedor) {
            const codProv = art.codigo_proveedor.toUpperCase().trim();
            match = catalogo.find(c => {
                const codElab = (c.codigo_elaborador || '').toUpperCase().trim();
                return codElab === codProv || codElab.includes(codProv) || codProv.includes(codElab);
            });
            if (match) { metodo = 'codigo_proveedor'; confianza = 95; }
        }
        
        // 2. Match por nombre fuzzy
        if (!match && art.descripcion) {
            const descNorm = normalizarNombre(art.descripcion);
            let bestScore = 0;
            let bestMatch = null;
            
            for (const c of catalogo) {
                const catNorm = normalizarNombre(c.nombre);
                const score = similaridad(descNorm, catNorm);
                if (score > bestScore && score > 0.5) {
                    bestScore = score;
                    bestMatch = c;
                }
            }
            
            if (bestMatch) {
                match = bestMatch;
                metodo = 'nombre_fuzzy';
                confianza = Math.round(bestScore * 100);
            }
        }
        
        resultados.push({
            ...art,
            match: match ? {
                id: match.id,
                codigo_goodies: match.codigo_goodies,
                nombre_catalogo: match.nombre,
                proveedor: match.proveedor,
                marca: match.marca
            } : null,
            metodo_match: metodo,
            confianza: confianza
        });
    }
    
    return resultados;
}

/**
 * Normalizar nombre para comparación fuzzy
 */
function normalizarNombre(str) {
    return (str || '').toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\bX\b/g, '')
        .replace(/\b\d+\s*(GR|G|ML|KG|LT|L|CC)\b/g, '') // Quitar unidades
        .replace(/\bST\b\.?\s*/g, 'ST ')
        .trim();
}

/**
 * Similaridad entre dos strings (Jaccard de palabras)
 */
function similaridad(a, b) {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    
    let intersection = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
    }
    
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
}

/**
 * Aplicar datos logísticos al catálogo (después de confirmar matches)
 */
async function aplicarDatosLogisticos(matches) {
    let actualizados = 0;
    let errores = 0;
    
    for (const m of matches) {
        if (!m.codigo_goodies || !m.confirmar) continue;
        
        try {
            const art = await CatalogoArticulo.findOne({ where: { codigo_goodies: m.codigo_goodies } });
            if (!art) { errores++; continue; }
            
            const updates = {};
            if (m.pieza_peso_kg > 0) updates.peso_unitario_kg = m.pieza_peso_kg;
            if (m.pieza_alto_cm > 0) updates.alto_cm = m.pieza_alto_cm;
            if (m.pieza_largo_cm > 0) updates.largo_cm = m.pieza_largo_cm;
            if (m.pieza_ancho_cm > 0) updates.ancho_cm = m.pieza_ancho_cm;
            
            if (Object.keys(updates).length > 0) {
                await art.update(updates);
                actualizados++;
            }
        } catch (e) {
            errores++;
        }
    }
    
    return { actualizados, errores };
}

module.exports = { parsearExcelLogistico, matchearConCatalogo, aplicarDatosLogisticos };
