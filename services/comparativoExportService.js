// services/comparativoExportService.js
// Genera un Excel con el comparativo entre 2 costeos.
// Secciones incluidas se definen por el payload { secciones: {...} }.
// Replica exactamente el contenido del modal del frontend para que
// Luz pueda mandar por mail un informe con la misma info que ve en pantalla.

const ExcelJS = require('exceljs');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios, ConsolidadoProveedor } = require('../models');

const COLORS = {
    headerBg: 'FF1A237E',
    headerFont: 'FFFFFFFF',
    greenBg: 'FF4CAF50',     // costeo 1 (base)
    orangeBg: 'FFFF9800',    // costeo 2 (comparado)
    blueBg: 'FF2196F3',      // columna diferencia
    altRow: 'FFF9F9F9',
    totalBg: 'FFE3F2FD',
    borderColor: 'FFD0D0D0'
};

const thinBorder = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } }
};

// pctDif: misma fórmula que el frontend — (a - b) / |b|
// Nota: devuelve número puro (ej. 15.23 para +15.23%), no decimal.
function pctDif(a, b) {
    a = parseFloat(a) || 0;
    b = parseFloat(b) || 0;
    if (b === 0) return a === 0 ? 0 : 100;
    return ((a - b) / Math.abs(b)) * 100;
}

// Sanitiza un nombre para usarlo en un filename de Excel.
function sanitizarNombreArchivo(nombre) {
    return (nombre || 'Costeo')
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
}

// Aplica estilo a fila de encabezado de tabla con colores costeo1/costeo2/dif.
// cols es un array con { col, tipo }, tipo = 'base'|'green'|'orange'|'blue'
function styleTableHeader(row, cols) {
    row.font = { bold: true, color: { argb: COLORS.headerFont }, size: 11, name: 'Calibri' };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.height = 28;
    cols.forEach(c => {
        const cell = row.getCell(c.col);
        let bg = COLORS.headerBg;
        if (c.tipo === 'green') bg = COLORS.greenBg;
        else if (c.tipo === 'orange') bg = COLORS.orangeBg;
        else if (c.tipo === 'blue') bg = COLORS.blueBg;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = thinBorder;
    });
}

function styleDataRow(row, alt) {
    row.font = { size: 10, name: 'Calibri' };
    if (alt) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRow } };
    row.eachCell(c => { c.border = thinBorder; });
}

function styleTotalRow(row) {
    row.font = { bold: true, size: 11, name: 'Calibri' };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
    row.eachCell(c => { c.border = thinBorder; });
}

// Aplica color al valor % según magnitud: rojo >2%, verde <-2%, naranja leve, gris si 0.
function colorPctCell(cell, pct) {
    const n = parseFloat(pct) || 0;
    let color = 'FF888888';
    if (n > 2) color = 'FFF44336';
    else if (n < -2) color = 'FF4CAF50';
    else if (n !== 0) color = 'FFFF9800';
    cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: color } };
}

const fmtFecha = (f) => {
    if (!f) return '';
    const d = new Date(f);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

class ComparativoExportService {
    /**
     * Exporta comparativo de 2 costeos a Excel.
     * @param {number[]} ids - [costeo1_id, costeo2_id]. El orden define la base.
     * @param {object} secciones - flags booleanos { tc, baseAduana, gastosVarios, gastosAduana, articulosFOB, articulosCostoNeto }
     * @returns {Promise<{ buffer: Buffer, filename: string }>}
     */
    static async exportarComparativo(ids, secciones) {
        if (!Array.isArray(ids) || ids.length !== 2) {
            throw new Error('Se requieren exactamente 2 ids de costeos');
        }

        // Traigo ambos costeos con todas las asociaciones necesarias
        const costeos = await Promise.all(ids.map(id => Costeo.findByPk(id, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' },
                { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
            ]
        })));

        if (!costeos[0] || !costeos[1]) throw new Error('Uno o ambos costeos no fueron encontrados');

        const c1 = costeos[0];
        const c2 = costeos[1];
        const n1 = c1.nombre_costeo || 'Costeo 1';
        const n2 = c2.nombre_costeo || 'Costeo 2';

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema de Costeo GOODIES';
        wb.created = new Date();

        const ws = wb.addWorksheet('Comparativo');
        ws.columns = [
            { width: 30 },   // A - concepto / artículo
            { width: 10 },   // B - moneda (solo en base aduana)
            { width: 20 },   // C - costeo 1
            { width: 20 },   // D - costeo 2
            { width: 12 }    // E - dif %
        ];

        // =================== ENCABEZADO ===================
        ws.mergeCells('A1:E1');
        ws.getCell('A1').value = 'COMPARATIVO DE COSTEOS';
        ws.getCell('A1').font = { bold: true, size: 16, color: { argb: COLORS.headerBg } };
        ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 30;

        ws.mergeCells('A2:E2');
        ws.getCell('A2').value = `${n1}  vs  ${n2}`;
        ws.getCell('A2').font = { bold: true, size: 12 };
        ws.getCell('A2').alignment = { horizontal: 'center' };

        ws.mergeCells('A3:E3');
        ws.getCell('A3').value = `Generado: ${fmtFecha(new Date())}`;
        ws.getCell('A3').font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        ws.getCell('A3').alignment = { horizontal: 'center' };

        // Tarjetas resumen: costeo 1 y costeo 2 lado a lado
        ws.getCell('A5').value = 'Costeo base (A)';
        ws.getCell('A5').font = { bold: true, size: 10, color: { argb: COLORS.greenBg } };
        ws.getCell('C5').value = 'Costeo comparado (B)';
        ws.getCell('C5').font = { bold: true, size: 10, color: { argb: COLORS.orangeBg } };

        const cardData = [
            ['Nombre',    n1,                                n2],
            ['Tipo',      c1.fecha_despacho ? 'DEFINITIVO' : 'PRESUPUESTO',
                          c2.fecha_despacho ? 'DEFINITIVO' : 'PRESUPUESTO'],
            ['Fecha',     fmtFecha(c1.fecha_despacho || c1.fecha_factura),
                          fmtFecha(c2.fecha_despacho || c2.fecha_factura)],
            ['Artículos', (c1.articulos || []).length,       (c2.articulos || []).length]
        ];
        cardData.forEach((d, i) => {
            const row = ws.getRow(6 + i);
            row.getCell(1).value = d[0];
            row.getCell(1).font = { bold: true, size: 10 };
            row.getCell(3).value = d[1];
            row.getCell(4).value = d[2];
            row.getCell(3).font = { size: 10 };
            row.getCell(4).font = { size: 10 };
        });

        let currentRow = 12;

        // =================== SECCIÓN: TIPOS DE CAMBIO ===================
        if (secciones.tc) {
            currentRow = this._agregarTituloSeccion(ws, currentRow, '💱 TIPOS DE CAMBIO');
            currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Moneda', null, n1, n2, 'Dif %']);
            ['USD', 'EUR', 'GBP'].forEach(mon => {
                const v1 = parseFloat(c1['tc_' + mon.toLowerCase()]) || 0;
                const v2 = parseFloat(c2['tc_' + mon.toLowerCase()]) || 0;
                if (v1 === 0 && v2 === 0) return;
                currentRow = this._agregarFilaComparativa(ws, currentRow, mon, null, v1, v2, '#,##0.00');
            });
            currentRow += 2;
        }

        // =================== SECCIÓN: BASE ADUANA ===================
        if (secciones.baseAduana) {
            currentRow = this._agregarTituloSeccion(ws, currentRow, '📦 BASE ADUANA (FOB + FLETE + SEGURO) EN DIVISA');
            currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Concepto', 'Moneda', n1, n2, 'Dif %']);
            const baseRows = [
                { label: 'Puesta FOB',           monKey: 'moneda_principal', valFn: c => parseFloat(c.es_consolidado ? c.fob_parte    : c.fob_monto)    || 0 },
                { label: 'Flete Internacional',  monKey: 'flete_moneda',      valFn: c => parseFloat(c.es_consolidado ? c.flete_parte  : c.flete_monto)  || 0 },
                { label: 'Seguro',               monKey: 'seguro_moneda',     valFn: c => parseFloat(c.es_consolidado ? c.seguro_parte : c.seguro_monto) || 0 }
            ];
            for (const br of baseRows) {
                const mon = (c1[br.monKey] || 'USD').toUpperCase();
                currentRow = this._agregarFilaComparativa(ws, currentRow, br.label, mon, br.valFn(c1), br.valFn(c2), '#,##0.00');
            }
            currentRow += 2;
        }

        // =================== SECCIÓN: GASTOS VARIOS (sin STABZ) ===================
        if (secciones.gastosVarios) {
            const gastosMap = new Map();
            [c1, c2].forEach((c, idx) => {
                (c.gastos_varios || []).forEach(g => {
                    const desc = (g.descripcion || '').toUpperCase().trim();
                    if (desc.includes('STABZ') || (g.proveedor_gasto || '').toUpperCase().includes('STABZ')) return;
                    const key = desc + '|' + (g.moneda || 'USD').toUpperCase();
                    if (!gastosMap.has(key)) gastosMap.set(key, { desc: g.descripcion, moneda: g.moneda || 'USD', v1: 0, v2: 0 });
                    const entry = gastosMap.get(key);
                    entry[idx === 0 ? 'v1' : 'v2'] += parseFloat(g.monto) || 0;
                });
            });

            if (gastosMap.size > 0) {
                currentRow = this._agregarTituloSeccion(ws, currentRow, '💰 GASTOS VARIOS EN DIVISA (SIN STABZ)');
                currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Concepto', 'Moneda', n1, n2, 'Dif %']);
                let t1 = 0, t2 = 0;
                for (const g of gastosMap.values()) {
                    t1 += g.v1;
                    t2 += g.v2;
                    currentRow = this._agregarFilaComparativa(ws, currentRow, g.desc, g.moneda, g.v1, g.v2, '#,##0.00');
                }
                // Fila total
                const rowTot = ws.getRow(currentRow);
                rowTot.getCell(1).value = 'TOTAL GASTOS';
                rowTot.getCell(3).value = t1;
                rowTot.getCell(4).value = t2;
                rowTot.getCell(3).numFmt = '#,##0.00';
                rowTot.getCell(4).numFmt = '#,##0.00';
                const pctTot = pctDif(t2, t1);
                rowTot.getCell(5).value = pctTot / 100;
                rowTot.getCell(5).numFmt = '+0.00%;-0.00%;0.00%';
                styleTotalRow(rowTot);
                colorPctCell(rowTot.getCell(5), pctTot);
                currentRow += 3;
            }
        }

        // =================== SECCIÓN: GASTOS DE ADUANA (ARS) ===================
        if (secciones.gastosAduana) {
            const gastosAduanaFields = [
                { key: 'despachante',              label: 'Despachante' },
                { key: 'gestion_senasa',           label: 'Gestión SENASA' },
                { key: 'gestion_anmat',            label: 'Gestión ANMAT' },
                { key: 'transporte_internacional', label: 'Transporte Intl.' },
                { key: 'gastos_origen',            label: 'Gastos Origen' },
                { key: 'terminal',                 label: 'Terminal' },
                { key: 'maritima_agencia',         label: 'Marítima/Agencia' },
                { key: 'bancarios',                label: 'Bancarios' },
                { key: 'gestor',                   label: 'Gestor' },
                { key: 'transporte_nacional',      label: 'Transporte Nacional' },
                { key: 'custodia',                 label: 'Custodia' },
                { key: 'sim',                      label: 'SIM' }
            ];
            const ga1 = c1.gastos_aduana || {};
            const ga2 = c2.gastos_aduana || {};
            const tiene = gastosAduanaFields.some(f => (parseFloat(ga1[f.key]) || 0) > 0 || (parseFloat(ga2[f.key]) || 0) > 0);

            if (tiene) {
                currentRow = this._agregarTituloSeccion(ws, currentRow, '🏛️ GASTOS DE ADUANA (ARS)');
                currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Concepto', null, n1, n2, 'Dif %']);
                let t1 = 0, t2 = 0;
                for (const f of gastosAduanaFields) {
                    const v1 = parseFloat(ga1[f.key]) || 0;
                    const v2 = parseFloat(ga2[f.key]) || 0;
                    if (v1 === 0 && v2 === 0) continue;
                    t1 += v1;
                    t2 += v2;
                    currentRow = this._agregarFilaComparativa(ws, currentRow, f.label, null, v1, v2, '"$"#,##0.00');
                }
                const rowTot = ws.getRow(currentRow);
                rowTot.getCell(1).value = 'TOTAL';
                rowTot.getCell(3).value = t1;
                rowTot.getCell(4).value = t2;
                rowTot.getCell(3).numFmt = '"$"#,##0.00';
                rowTot.getCell(4).numFmt = '"$"#,##0.00';
                const pctTot = pctDif(t2, t1);
                rowTot.getCell(5).value = pctTot / 100;
                rowTot.getCell(5).numFmt = '+0.00%;-0.00%;0.00%';
                styleTotalRow(rowTot);
                colorPctCell(rowTot.getCell(5), pctTot);
                currentRow += 3;
            }
        }

        // =================== SECCIÓN: ARTÍCULOS - FOB UNITARIO ===================
        // Uno el set de códigos de ambos costeos (mismo enfoque que el frontend)
        const todosCodigos = new Set();
        [c1, c2].forEach(c => (c.articulos || []).forEach(a => todosCodigos.add(a.codigo_goodies)));

        if (secciones.articulosFOB) {
            currentRow = this._agregarTituloSeccion(ws, currentRow, '📦 ARTÍCULOS — FOB UNITARIO (USD)');
            currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Artículo', 'Descripción', 'FOB ' + n1, 'FOB ' + n2, 'Dif %']);
            let altF = false;
            for (const codigo of todosCodigos) {
                const a1 = (c1.articulos || []).find(a => a.codigo_goodies === codigo);
                const a2 = (c2.articulos || []).find(a => a.codigo_goodies === codigo);
                const nombre = (a1 || a2 || {}).nombre || '';
                const f1 = a1 ? (parseFloat(a1.fob_unitario_usd) || 0) : 0;
                const f2 = a2 ? (parseFloat(a2.fob_unitario_usd) || 0) : 0;
                const row = ws.getRow(currentRow);
                row.getCell(1).value = codigo;
                row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
                row.getCell(2).value = nombre;
                row.getCell(3).value = f1 || null;
                row.getCell(4).value = f2 || null;
                row.getCell(3).numFmt = '#,##0.0000';
                row.getCell(4).numFmt = '#,##0.0000';
                if (f1 > 0 && f2 > 0) {
                    const pct = pctDif(f2, f1);
                    row.getCell(5).value = pct / 100;
                    row.getCell(5).numFmt = '+0.00%;-0.00%;0.00%';
                    colorPctCell(row.getCell(5), pct);
                } else {
                    row.getCell(5).value = '-';
                    row.getCell(5).alignment = { horizontal: 'center' };
                }
                styleDataRow(row, altF);
                altF = !altF;
                currentRow++;
            }
            currentRow += 2;
        }

        // =================== SECCIÓN: ARTÍCULOS - COSTO NETO UNITARIO (ARS) ===================
        if (secciones.articulosCostoNeto) {
            currentRow = this._agregarTituloSeccion(ws, currentRow, '💰 ARTÍCULOS — COSTO NETO UNITARIO (ARS)');
            currentRow = this._agregarEncabezadoTabla(ws, currentRow, ['Artículo', 'Descripción', 'Costo Neto ' + n1, 'Costo Neto ' + n2, 'Dif %']);
            let altC = false;
            for (const codigo of todosCodigos) {
                const a1 = (c1.articulos || []).find(a => a.codigo_goodies === codigo);
                const a2 = (c2.articulos || []).find(a => a.codigo_goodies === codigo);
                const nombre = (a1 || a2 || {}).nombre || '';
                const cn1 = a1 ? (parseFloat(a1.costo_unitario_neto_ars) || 0) : 0;
                const cn2 = a2 ? (parseFloat(a2.costo_unitario_neto_ars) || 0) : 0;
                const row = ws.getRow(currentRow);
                row.getCell(1).value = codigo;
                row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
                row.getCell(2).value = nombre;
                row.getCell(3).value = cn1 || null;
                row.getCell(4).value = cn2 || null;
                row.getCell(3).numFmt = '"$"#,##0.00';
                row.getCell(4).numFmt = '"$"#,##0.00';
                if (cn1 > 0 && cn2 > 0) {
                    const pct = pctDif(cn2, cn1);
                    row.getCell(5).value = pct / 100;
                    row.getCell(5).numFmt = '+0.00%;-0.00%;0.00%';
                    colorPctCell(row.getCell(5), pct);
                } else {
                    row.getCell(5).value = '-';
                    row.getCell(5).alignment = { horizontal: 'center' };
                }
                styleDataRow(row, altC);
                altC = !altC;
                currentRow++;
            }
        }

        // Generate
        const buffer = await wb.xlsx.writeBuffer();
        const n1s = sanitizarNombreArchivo(n1);
        const n2s = sanitizarNombreArchivo(n2);
        const filename = `Comparativo_${n1s}_vs_${n2s}.xlsx`;
        return { buffer, filename };
    }

    // === Helpers privados ===

    static _agregarTituloSeccion(ws, row, titulo) {
        ws.mergeCells(`A${row}:E${row}`);
        const cell = ws.getCell(`A${row}`);
        cell.value = titulo;
        cell.font = { bold: true, size: 12, color: { argb: COLORS.headerFont } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        ws.getRow(row).height = 24;
        return row + 1;
    }

    static _agregarEncabezadoTabla(ws, row, headers) {
        const r = ws.getRow(row);
        r.getCell(1).value = headers[0];
        if (headers[1]) r.getCell(2).value = headers[1];
        r.getCell(3).value = headers[2];
        r.getCell(4).value = headers[3];
        r.getCell(5).value = headers[4];
        styleTableHeader(r, [
            { col: 1, tipo: 'base' },
            { col: 2, tipo: 'base' },
            { col: 3, tipo: 'green' },
            { col: 4, tipo: 'orange' },
            { col: 5, tipo: 'blue' }
        ]);
        return row + 1;
    }

    static _agregarFilaComparativa(ws, row, label, moneda, v1, v2, numFmt) {
        const r = ws.getRow(row);
        r.getCell(1).value = label;
        if (moneda) {
            r.getCell(2).value = moneda;
            r.getCell(2).alignment = { horizontal: 'center' };
        }
        r.getCell(3).value = v1 || null;
        r.getCell(4).value = v2 || null;
        r.getCell(3).numFmt = numFmt;
        r.getCell(4).numFmt = numFmt;
        if (v1 > 0 && v2 > 0) {
            const pct = pctDif(v2, v1);
            r.getCell(5).value = pct / 100;
            r.getCell(5).numFmt = '+0.00%;-0.00%;0.00%';
            colorPctCell(r.getCell(5), pct);
        } else {
            r.getCell(5).value = '-';
            r.getCell(5).alignment = { horizontal: 'center' };
        }
        styleDataRow(r, false);
        return row + 1;
    }
}

module.exports = ComparativoExportService;
