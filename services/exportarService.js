// services/exportarService.js
const ExcelJS = require('exceljs');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = require('../models');

const COLORS = {
    headerBg: 'FF1A237E', headerFont: 'FFFFFFFF',
    greenBg: 'FF4CAF50', totalBg: 'FFE3F2FD', borderColor: 'FFD0D0D0',
};
const thinBorder = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
};
function styleHeader(row, bg) {
    row.font = { bold: true, color: { argb: COLORS.headerFont }, size: 11, name: 'Calibri' };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg || COLORS.headerBg } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.height = 32;
    row.eachCell(c => { c.border = thinBorder; });
}
function styleDataRow(row, alt) {
    row.font = { size: 10, name: 'Calibri' };
    if (alt) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
    row.eachCell(c => { c.border = thinBorder; });
}
function styleTotalRow(row) {
    row.font = { bold: true, size: 11, name: 'Calibri' };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
    row.eachCell(c => { c.border = thinBorder; });
}
const fmtFecha = (f) => {
    if (!f) return '';
    const d = new Date(f);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

class ExportarService {
    static async exportarCosteo(costeoId) {
        const costeo = await Costeo.findByPk(costeoId, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' }
            ]
        });
        if (!costeo) throw new Error('Costeo no encontrado');

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema de Costeo GOODIES';
        wb.created = new Date();

        const fechaDesp = fmtFecha(costeo.fecha_despacho);
        const esDef = !!fechaDesp;
        const moneda = costeo.moneda_principal || 'USD';
        let tcP = parseFloat(costeo.tc_usd) || 1;
        if (moneda.toUpperCase() === 'EUR') tcP = parseFloat(costeo.tc_eur) || tcP;
        if (moneda.toUpperCase() === 'GBP') tcP = parseFloat(costeo.tc_gbp) || tcP;

        // =================== RESUMEN ===================
        const ws1 = wb.addWorksheet('RESUMEN');
        ws1.columns = [{ width: 4 }, { width: 24 }, { width: 28 }, { width: 5 }, { width: 22 }, { width: 22 }];

        ws1.mergeCells('B1:C1');
        ws1.getCell('B1').value = 'GOODIES S.A.';
        ws1.getCell('B1').font = { bold: true, size: 16, color: { argb: COLORS.headerBg } };
        ws1.mergeCells('B2:C2');
        ws1.getCell('B2').value = costeo.nombre_costeo;
        ws1.getCell('B2').font = { bold: true, size: 13 };
        ws1.mergeCells('E1:F1');
        ws1.getCell('E1').value = esDef ? 'DEFINITIVO' : 'PRESUPUESTADO';
        ws1.getCell('E1').font = { bold: true, size: 14, color: { argb: esDef ? 'FF4CAF50' : 'FFFF9800' } };
        ws1.getCell('E1').alignment = { horizontal: 'right' };

        const info = [
            ['Proveedor', costeo.proveedor, 'TC USD', parseFloat(costeo.tc_usd) || 0],
            ['Factura', costeo.factura_nro, 'TC EUR', parseFloat(costeo.tc_eur) || 0],
            ['Fecha Factura', fmtFecha(costeo.fecha_factura), 'TC GBP', parseFloat(costeo.tc_gbp) || 0],
            ['Fecha Despacho', fechaDesp || 'Sin despacho', '', ''],
            ['Nro Despacho', costeo.nro_despacho || '-', 'FOB Total (' + moneda + ')', parseFloat(costeo.fob_total_usd) || 0],
            ['Moneda', moneda, 'Total Gastos ARS', parseFloat(costeo.total_gastos_ars) || 0],
        ];
        info.forEach((d, i) => {
            const r = 4 + i;
            ws1.getCell(`B${r}`).value = d[0];
            ws1.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: 'FF666666' } };
            ws1.getCell(`C${r}`).value = d[1] || '-';
            if (d[2]) {
                ws1.getCell(`E${r}`).value = d[2];
                ws1.getCell(`E${r}`).font = { bold: true, size: 10, color: { argb: 'FF666666' } };
                const c = ws1.getCell(`F${r}`);
                c.value = d[3];
                if (typeof d[3] === 'number' && d[3] > 0) c.numFmt = '#,##0.00';
            }
        });

        // Grand total
        const tr = 4 + info.length + 1;
        ws1.mergeCells(`B${tr}:C${tr}`);
        ws1.getCell(`B${tr}`).value = 'INVERSIÓN TOTAL ARS';
        ws1.getCell(`B${tr}`).font = { bold: true, size: 14, color: { argb: COLORS.headerBg } };
        ws1.mergeCells(`E${tr}:F${tr}`);
        ws1.getCell(`E${tr}`).value = parseFloat(costeo.costo_total_ars) || 0;
        ws1.getCell(`E${tr}`).numFmt = '$ #,##0.00';
        ws1.getCell(`E${tr}`).font = { bold: true, size: 18, color: { argb: '224CAF50' } };
        ws1.getCell(`E${tr}`).alignment = { horizontal: 'right' };

        ws1.getCell(`B${tr+1}`).value = 'Unidades Totales';
        ws1.getCell(`B${tr+1}`).font = { bold: true, size: 10, color: { argb: 'FF666666' } };
        ws1.getCell(`C${tr+1}`).value = parseInt(costeo.unidades_totales) || 0;
        ws1.getCell(`C${tr+1}`).font = { bold: true, size: 14 };

        // =================== ARTÍCULOS ===================
        const ws2 = wb.addWorksheet('ARTÍCULOS');
        const aH = ['Código', 'Nombre', 'Und.', moneda + ' Unit.', moneda + ' Total',
            'ARS Unit.', 'ARS Total', 'ANMAT', 'Base Aduana',
            'Der. %', 'Derechos', 'Estad.', 'Gastos Prorr.',
            'COSTO NETO UNIT.', 'IVA Unit.', 'Imp.Int %', 'Imp.Int.',
            'COSTO FINAL UNIT.', 'Factor Imp.'];
        const aW = [16, 42, 7, 12, 14, 12, 14, 10, 14, 8, 12, 10, 14, 16, 12, 8, 12, 16, 10];
        aH.forEach((_, i) => { ws2.getColumn(i + 1).width = aW[i]; });
        
        const hr = ws2.addRow(aH);
        styleHeader(hr);
        [14, 18, 19].forEach(c => { hr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenBg } }; });

        let tFobDiv = 0, tFobARS = 0, tCN = 0, tCF = 0, tUnd = 0;
        costeo.articulos.forEach((a, idx) => {
            const fuDiv = parseFloat(a.fob_unitario_usd) || 0;
            const ftDiv = parseFloat(a.fob_total_usd) || 0;
            const fuARS = parseFloat(a.fob_unitario_ars) || (fuDiv * tcP);
            const ftARS = parseFloat(a.fob_total_ars) || (ftDiv * tcP);
            const cn = parseFloat(a.costo_unitario_neto_ars) || 0;
            const cf = parseFloat(a.costo_unitario_ars) || 0;
            const und = parseInt(a.unidades_totales) || 0;
            const dp = parseFloat(a.derechos_porcentaje) || 0;
            const ip = parseFloat(a.impuesto_interno_porcentaje) || 0;
            tFobDiv += ftDiv; tFobARS += ftARS; tCN += cn * und; tCF += cf * und; tUnd += und;

            const row = ws2.addRow([
                a.codigo_goodies, a.nombre, und, fuDiv, ftDiv, fuARS, ftARS,
                parseFloat(a.anmat_ars) || 0, parseFloat(a.base_aduana_ars) || 0,
                (dp <= 1 ? dp * 100 : dp), parseFloat(a.derechos_total_ars) || 0,
                parseFloat(a.estadistica_total_ars) || 0, parseFloat(a.gastos_varios_ars) || 0,
                cn, parseFloat(a.iva_unitario_ars) || 0,
                (ip <= 1 ? ip * 100 : ip), parseFloat(a.impuesto_interno_unitario_ars) || 0,
                cf, parseFloat(a.factor_importacion) || 0
            ]);
            styleDataRow(row, idx % 2 === 1);
            for (let c = 4; c <= 19; c++) {
                row.getCell(c).numFmt = (c === 10 || c === 16) ? '0.00' : '#,##0.00';
            }
            row.getCell(14).font = { bold: true, size: 10, color: { argb: '1A237E' } };
            row.getCell(18).font = { bold: true, size: 10, color: { argb: '4CAF50' } };
            row.getCell(19).font = { bold: true, size: 10 };
        });

        const totR = ws2.addRow(['', 'TOTALES', tUnd, '', tFobDiv, '', tFobARS, '', '', '', '', '', '', tCN, '', '', '', tCF, '']);
        styleTotalRow(totR);
        [5, 7, 14, 18].forEach(c => { totR.getCell(c).numFmt = '#,##0.00'; });

        ws2.autoFilter = { from: 'A1', to: `S${costeo.articulos.length + 1}` };
        ws2.views = [{ state: 'frozen', ySplit: 1 }];

        // =================== GASTOS ===================
        const ws3 = wb.addWorksheet('GASTOS');
        const gH = ['Descripción', 'Proveedor', 'Nro Comprobante', 'Moneda', 'Monto', '% Recargo', 'Grupo', 'Monto ARS', 'No Contable', 'Observaciones'];
        const gW = [40, 25, 16, 8, 14, 10, 10, 16, 10, 30];
        gH.forEach((_, i) => { ws3.getColumn(i + 1).width = gW[i]; });
        styleHeader(ws3.addRow(gH));

        let tGARS = 0;
        costeo.gastos_varios.forEach((g, idx) => {
            const mars = parseFloat(g.monto_ars) || 0;
            tGARS += mars;
            const row = ws3.addRow([
                g.descripcion, g.proveedor_gasto || '', g.nro_comprobante || '',
                g.moneda, parseFloat(g.monto) || 0, parseFloat(g.recargo) || 0,
                g.grupo || '', mars, g.no_contable ? 'SI' : '', g.observaciones || ''
            ]);
            styleDataRow(row, idx % 2 === 1);
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(6).numFmt = '0.00';
            row.getCell(8).numFmt = '#,##0.00';
            if (g.no_contable) row.getCell(9).font = { color: { argb: 'FFFF9800' }, bold: true, size: 10 };
        });

        const gTot = ws3.addRow(['', '', '', '', '', '', 'TOTAL', tGARS, '', '']);
        styleTotalRow(gTot);
        gTot.getCell(8).numFmt = '#,##0.00';
        ws3.autoFilter = { from: 'A1', to: `J${costeo.gastos_varios.length + 1}` };
        ws3.views = [{ state: 'frozen', ySplit: 1 }];

        // Generate
        const buffer = await wb.xlsx.writeBuffer();
        const fd = fechaDesp ? fechaDesp.replace(/\//g, '-') : 'PRESUPUESTO';
        const nm = (costeo.nombre_costeo || 'Costeo').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '').trim().replace(/\s+/g, '_');
        return { buffer, filename: `${nm}_${fd}_${esDef ? 'DEFINITIVO' : 'PRESUPUESTO'}.xlsx` };
    }
}

module.exports = ExportarService;
