// services/exportarService.js
const ExcelJS = require('exceljs');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = require('../models');

class ExportarService {

    static async exportarCosteo(costeoId) {
        // 1. Obtener datos
        const costeo = await Costeo.findByPk(costeoId, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' }
            ]
        });

        if (!costeo) {
            throw new Error('Costeo no encontrado');
        }

        // 2. Crear workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Costeo';
        workbook.created = new Date();

        // Formato de fecha DD/MM/AA
        const formatoFecha = (fecha) => {
            if (!fecha) return '';
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return '';
            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const anio = String(d.getFullYear()).slice(-2);
            return `${dia}/${mes}/${anio}`;
        };

        // Verificar si tiene fecha de despacho válida
        const fechaDespacho = formatoFecha(costeo.fecha_despacho);
        const estadoDespacho = fechaDespacho ? fechaDespacho : 'PRESUPUESTADO';

        // 3. Hoja RESUMEN
        const hojaCosteo = workbook.addWorksheet('RESUMEN');
        
        hojaCosteo.columns = [
            { header: 'Campo', key: 'campo', width: 30 },
            { header: 'Valor', key: 'valor', width: 25 }
        ];

        const filasResumen = [
            { campo: 'COSTEO', valor: costeo.nombre_costeo },
            { campo: 'Proveedor', valor: costeo.proveedor },
            { campo: 'Factura', valor: costeo.factura_nro },
            { campo: 'Fecha Factura', valor: formatoFecha(costeo.fecha_factura) },
           { campo: 'Fecha Despacho', valor: estadoDespacho },
            { campo: 'Nro Despacho', valor: costeo.nro_despacho || '' },
            { campo: 'Moneda Principal', valor: costeo.moneda_principal },
            { campo: '', valor: '' },
            { campo: 'Tipo de Cambio USD', valor: parseFloat(costeo.tc_usd) || 0 },
            { campo: 'Tipo de Cambio EUR', valor: parseFloat(costeo.tc_eur) || 0 },
            { campo: 'Tipo de Cambio GBP', valor: parseFloat(costeo.tc_gbp) || 0 },
            { campo: '', valor: '' },
            { campo: 'FOB Total Divisa', valor: parseFloat(costeo.fob_total_usd) || 0 },
            { campo: 'Total Gastos ARS', valor: parseFloat(costeo.total_gastos_ars) || 0 },
            { campo: '', valor: '' },
            { campo: 'Importe Total Inversión ARS', valor: parseFloat(costeo.costo_total_ars) || 0 },
            { campo: 'Unidades Totales', valor: parseInt(costeo.unidades_totales) || 0 }
        ];

        for (const fila of filasResumen) {
            hojaCosteo.addRow(fila);
        }

        // Aplicar formato numerico a columna B (2 decimales)
        for (let i = 2; i <= hojaCosteo.rowCount; i++) {
            const celda = hojaCosteo.getCell(`B${i}`);
            if (typeof celda.value === 'number') {
                celda.numFmt = '#,##0.00';
            }
        }

        // Estilo encabezado
        hojaCosteo.getRow(1).font = { bold: true };
        hojaCosteo.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        hojaCosteo.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // 4. Hoja ARTICULOS
        const hojaArticulos = workbook.addWorksheet('ARTICULOS');
        
       hojaArticulos.columns = [
            { header: 'Codigo Articulo Goodies', key: 'codigo', width: 22 },
            { header: 'Nombre de Articulo', key: 'nombre', width: 40 },
            { header: 'Unidades Compradas', key: 'unidades', width: 18 },
            { header: 'Divisa del Proveedor', key: 'divisa', width: 18 },
            { header: 'FOB Unitario en Divisa', key: 'fob_unit_divisa', width: 20 },
            { header: 'FOB Total en Divisa', key: 'fob_total_divisa', width: 18 },
            { header: 'FOB Unit ARS', key: 'fob_unit_ars', width: 14 },
            { header: 'FOB Total ARS', key: 'fob_total_ars', width: 16 },
            { header: 'ANMAT ARS', key: 'anmat', width: 14 },
            { header: 'Base Aduana ARS', key: 'base_aduana', width: 16 },
            { header: 'Derechos %', key: 'derechos_pct', width: 12 },
            { header: 'Derechos ARS', key: 'derechos', width: 14 },
            { header: 'Estadist ARS', key: 'estadistica', width: 14 },
            { header: 'Gastos Prorrat ARS', key: 'gastos_prorrat', width: 18 },
            { header: 'Costo Neto Unit', key: 'costo_neto', width: 16 },
            { header: 'IVA Unit ARS', key: 'iva', width: 14 },
            { header: 'Imp Int %', key: 'imp_int_pct', width: 12 },
            { header: 'Imp Int Unit ARS', key: 'imp_int', width: 16 },
            { header: 'Costo Final Unit', key: 'costo_final', width: 16 },
            { header: 'Factor Importacion', key: 'factor', width: 18 }
        ];
        // Determinar TC según moneda principal
        const monedaPrincipal = costeo.moneda_principal || 'USD';
        let tcPrincipal = parseFloat(costeo.tc_usd) || 1;
        if (monedaPrincipal.toUpperCase() === 'EUR') {
            tcPrincipal = parseFloat(costeo.tc_eur) || parseFloat(costeo.tc_usd) || 1;
        } else if (monedaPrincipal.toUpperCase() === 'GBP') {
            tcPrincipal = parseFloat(costeo.tc_gbp) || parseFloat(costeo.tc_usd) || 1;
        }
   
        for (const art of costeo.articulos) {
            const fobUnitDivisa = parseFloat(art.fob_unitario_usd) || 0;
            const fobTotalDivisa = parseFloat(art.fob_total_usd) || 0;
            const fobUnitARS = parseFloat(art.fob_unitario_ars) || (fobUnitDivisa * tcPrincipal);
            const fobTotalARS = parseFloat(art.fob_total_ars) || (fobTotalDivisa * tcPrincipal);
            const costoNetoUnit = parseFloat(art.costo_unitario_neto_ars) || 0;
            const factorImportacion = parseFloat(art.factor_importacion) || 0;

           hojaArticulos.addRow({
                codigo: art.codigo_goodies,
                nombre: art.nombre,
                unidades: parseInt(art.unidades_totales) || 0,
                divisa: monedaPrincipal,
                fob_unit_divisa: fobUnitDivisa,
                fob_total_divisa: fobTotalDivisa,
                fob_unit_ars: fobUnitARS,
                fob_total_ars: fobTotalARS,
                anmat: parseFloat(art.anmat_ars) || 0,
                base_aduana: parseFloat(art.base_aduana_ars) || 0,
                derechos_pct: parseFloat(art.derechos_porcentaje) || 0,
                derechos: parseFloat(art.derechos_total_ars) || 0,
                estadistica: parseFloat(art.estadistica_total_ars) || 0,
                gastos_prorrat: parseFloat(art.gastos_varios_ars) || 0,
                costo_neto: costoNetoUnit,
                iva: parseFloat(art.iva_unitario_ars) || 0,
                imp_int_pct: parseFloat(art.impuesto_interno_porcentaje) || 0,
                imp_int: parseFloat(art.impuesto_interno_unitario_ars) || 0,
                costo_final: parseFloat(art.costo_unitario_ars) || 0,
                factor: factorImportacion
            });
        }

        // Aplicar formato numerico a todas las columnas numericas (2 decimales)
        for (let i = 2; i <= hojaArticulos.rowCount; i++) {
            for (let col = 3; col <= 20; col++) {
                const celda = hojaArticulos.getRow(i).getCell(col);
                if (typeof celda.value === 'number') {
                    celda.numFmt = '#,##0.00';
                }
            }
            // Negrita para Costo Neto Unit (columna 12)
            // Negrita para Costo Neto Unit (columna 15)
            hojaArticulos.getRow(i).getCell(15).font = { bold: true };
            // Negrita para Factor Importacion (columna 20)
            hojaArticulos.getRow(i).getCell(20).font = { bold: true };
        }

        // Estilo encabezado
        hojaArticulos.getRow(1).font = { bold: true };
        hojaArticulos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        hojaArticulos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Negrita especial para titulos Costo Neto Unit y Factor Importacion
        hojaArticulos.getRow(1).getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
        hojaArticulos.getRow(1).getCell(20).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };

        // 5. Hoja GASTOS
        const hojaGastos = workbook.addWorksheet('GASTOS');
        
       hojaGastos.columns = [
            { header: 'Descripcion', key: 'descripcion', width: 40 },
            { header: 'Proveedor', key: 'proveedor', width: 25 },
            { header: 'Nro Comprobante', key: 'nro_comprobante', width: 18 },
            { header: 'Moneda', key: 'moneda', width: 10 },
            { header: 'Monto Original', key: 'monto', width: 15 },
            { header: '% Recargo', key: 'recargo', width: 12 },
            { header: 'Grupo', key: 'grupo', width: 12 },
            { header: 'Monto ARS', key: 'monto_ars', width: 18 },
            { header: 'Observaciones', key: 'observaciones', width: 30 }
        ];

        // Lista de gastos con recargo
        const gastosConRecargo = ['flete internacional', 'transporte internacional', 'marítima', 'maritima', 'agencia', 'gastos en origen'];

        for (const gasto of costeo.gastos_varios) {
            const descLower = (gasto.descripcion || '').toLowerCase();
            let recargoPct = 0;
            
            // Determinar si tiene recargo
            for (const g of gastosConRecargo) {
                if (descLower.includes(g)) {
                    // Calcular recargo aproximado comparando monto original vs ARS
                    const montoOrig = parseFloat(gasto.monto) || 0;
                    const montoARS = parseFloat(gasto.monto_ars) || 0;
                    const monedaGasto = (gasto.moneda || 'USD').toUpperCase();
                    
                    let tcEsperado = parseFloat(costeo.tc_usd) || 1;
                    if (monedaGasto === 'EUR') {
                        tcEsperado = parseFloat(costeo.tc_eur) || parseFloat(costeo.tc_usd) || 1;
                    } else if (monedaGasto === 'GBP') {
                        tcEsperado = parseFloat(costeo.tc_gbp) || parseFloat(costeo.tc_usd) || 1;
                    } else if (monedaGasto === 'ARS') {
                        tcEsperado = 1;
                    }
                    
                    if (montoOrig !== 0 && tcEsperado !== 0) {
                        const montoSinRecargo = montoOrig * tcEsperado;
                        if (montoSinRecargo !== 0) {
                            recargoPct = ((montoARS / montoSinRecargo) - 1) * 100;
                            if (recargoPct < 0.5) recargoPct = 0; // Ignorar diferencias mínimas
                        }
                    }
                    break;
                }
            }

           hojaGastos.addRow({
                descripcion: gasto.descripcion,
                proveedor: gasto.proveedor_gasto || '',
                nro_comprobante: gasto.nro_comprobante || '',
                moneda: gasto.moneda,
                monto: parseFloat(gasto.monto) || 0,
                recargo: recargoPct > 0 ? recargoPct : 0,
                grupo: gasto.grupo || '',
                monto_ars: parseFloat(gasto.monto_ars) || 0,
                observaciones: gasto.observaciones || ''
            });
        }

       // Aplicar formato numerico (2 decimales)
        for (let i = 2; i <= hojaGastos.rowCount; i++) {
            hojaGastos.getRow(i).getCell(5).numFmt = '#,##0.00';
            hojaGastos.getRow(i).getCell(6).numFmt = '#,##0.00';
            hojaGastos.getRow(i).getCell(8).numFmt = '#,##0.00';
        }

        // Estilo encabezado
        hojaGastos.getRow(1).font = { bold: true };
        hojaGastos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        hojaGastos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // 6. Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        return {
            buffer: buffer,
            filename: `Costeo_${costeo.nombre_costeo.replace(/[^a-zA-Z0-9]/g, '_')}_${estadoDespacho === 'PRESUPUESTADO' ? 'PRESUPUESTO' : 'DEFINITIVO'}.xlsx`
        };
    }
}

module.exports = ExportarService;