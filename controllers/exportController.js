// exportController.js - Controlador para exportar a Excel
const XLSX = require('xlsx');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = require('../models');

// Función para exportar costeo a Excel
const exportarCosteo = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener el costeo con todos sus datos
        const costeo = await Costeo.findByPk(id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }
        
        const articulos = await ArticuloCosteo.findAll({ where: { costeo_id: id } });
        const gastosAduana = await GastosAduana.findOne({ where: { costeo_id: id } });
        const gastosVarios = await GastosVarios.findAll({ where: { costeo_id: id } });
        
        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        
        // ========== HOJA 1: RESUMEN ==========
        const resumenData = [
            ['RESUMEN DEL COSTEO'],
            [''],
            ['Nombre:', costeo.nombre_costeo],
            ['Proveedor:', costeo.proveedor],
            ['Factura Nro:', costeo.factura_nro],
            ['Moneda:', costeo.moneda_principal],
            ['Tipo de Cambio USD:', parseFloat(costeo.tc_usd) || 0],
            [''],
            ['TOTALES'],
            ['FOB Total USD:', parseFloat(costeo.fob_total_usd) || 0],
            ['Flete USD:', parseFloat(costeo.flete_usd) || 0],
            ['Seguro USD:', parseFloat(costeo.seguro_usd) || 0],
            ['CIF Total USD:', parseFloat(costeo.cif_total_usd) || 0],
            ['CIF Total ARS:', parseFloat(costeo.cif_total_ars) || 0],
            [''],
            ['Derechos Total ARS:', parseFloat(costeo.derechos_total_ars) || 0],
            ['Estadística ARS:', parseFloat(costeo.estadistica_ars) || 0],
            ['IVA ARS:', parseFloat(costeo.iva_ars) || 0],
            ['Imp. Interno ARS:', parseFloat(costeo.impuesto_interno_ars) || 0],
            ['Total Tributos ARS:', parseFloat(costeo.total_tributos_ars) || 0],
            [''],
            ['Total Gastos ARS:', parseFloat(costeo.total_gastos_ars) || 0],
            [''],
            ['COSTO TOTAL ARS:', parseFloat(costeo.costo_total_ars) || 0],
            ['Unidades Totales:', parseInt(costeo.unidades_totales) || 0],
            ['Costo Unitario Promedio ARS:', parseFloat(costeo.costo_unitario_promedio_ars) || 0]
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        
        // ========== HOJA 2: ARTICULOS ==========
        const articulosHeaders = [
            'Código Goodies',
            'Código Proveedor', 
            'Nombre',
            'Unidades',
            'FOB Unit. USD',
            'FOB Total USD',
            'CIF Unit. USD',
            'CIF Total USD',
            'CIF Unit. ARS',
            'CIF Total ARS',
            'Derechos %',
            'Derechos ARS',
            'Estadística ARS',
            'IVA ARS',
            'Imp. Interno %',
            'Imp. Interno ARS',
            'Gastos ARS',
            'Costo Unit. ARS',
            'Costo Total ARS'
        ];
        
        const articulosData = [articulosHeaders];
        
        for (const art of articulos) {
            articulosData.push([
                art.codigo_goodies || '',
                art.codigo_proveedor || '',
                art.nombre || '',
                parseInt(art.unidades_totales) || 0,
                parseFloat(art.fob_unitario_usd) || 0,
                parseFloat(art.fob_total_usd) || 0,
                parseFloat(art.cif_unitario_usd) || 0,
                parseFloat(art.cif_total_usd) || 0,
                parseFloat(art.cif_unitario_ars) || 0,
                parseFloat(art.cif_total_ars) || 0,
                parseFloat(art.derechos_porcentaje) || 0,
                parseFloat(art.derechos_total_ars) || 0,
                parseFloat(art.estadistica_total_ars) || 0,
                parseFloat(art.iva_total_ars) || 0,
                parseFloat(art.impuesto_interno_porcentaje) || 0,
                parseFloat(art.impuesto_interno_total_ars) || 0,
                parseFloat(art.gastos_total_ars) || 0,
                parseFloat(art.costo_unitario_ars) || 0,
                parseFloat(art.costo_total_ars) || 0
            ]);
        }
        
        const wsArticulos = XLSX.utils.aoa_to_sheet(articulosData);
        XLSX.utils.book_append_sheet(wb, wsArticulos, 'Articulos');
        
        // ========== HOJA 3: GASTOS ==========
        const gastosData = [['GASTOS DE IMPORTACIÓN'], ['']];
        
        if (gastosAduana) {
            gastosData.push(['Gastos de Aduana:']);
            gastosData.push(['Despachante:', parseFloat(gastosAduana.despachante) || 0]);
            gastosData.push(['Gestión SENASA:', parseFloat(gastosAduana.gestion_senasa) || 0]);
            gastosData.push(['Gestión ANMAT:', parseFloat(gastosAduana.gestion_anmat) || 0]);
            gastosData.push(['Terminal:', parseFloat(gastosAduana.terminal) || 0]);
            gastosData.push(['Flete Nacional:', parseFloat(gastosAduana.transporte_nacional) || 0]);
            gastosData.push(['Total Gastos Aduana:', parseFloat(gastosAduana.total_gastos_ars) || 0]);
            gastosData.push(['']);
        }
        
        if (gastosVarios.length > 0) {
            gastosData.push(['Gastos Varios:']);
            gastosData.push(['Descripción', 'Moneda', 'Monto', 'Monto ARS']);
            for (const gasto of gastosVarios) {
                gastosData.push([
                    gasto.descripcion || '',
                    gasto.moneda || '',
                    parseFloat(gasto.monto) || 0,
                    parseFloat(gasto.monto_ars) || 0
                ]);
            }
        }
        
        const wsGastos = XLSX.utils.aoa_to_sheet(gastosData);
        XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos');
        
        // Generar el archivo
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Nombre del archivo
        const nombreArchivo = `Costeo_${costeo.nombre_costeo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        
        // Enviar el archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.send(buffer);
        
    } catch (error) {
        console.error('Error al exportar:', error);
        res.status(500).json({ error: 'Error al exportar', detalles: error.message });
    }
};

// Función para listar todos los costeos
const listarCosteos = async (req, res) => {
    try {
        const costeos = await Costeo.findAll({
            where: { usuario_id: req.usuario.id },
            order: [['created_at', 'DESC']],
            attributes: ['id', 'nombre_costeo', 'proveedor', 'moneda_principal', 'costo_total_ars', 'estado', 'created_at']
        });
        
        res.json({ costeos });
    } catch (error) {
        console.error('Error al listar costeos:', error);
        res.status(500).json({ error: 'Error al listar costeos', detalles: error.message });
    }
};

module.exports = {
    exportarCosteo,
    listarCosteos
};