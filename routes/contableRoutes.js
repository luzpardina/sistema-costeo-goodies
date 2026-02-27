const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const ValuacionInventario = require('../models/ValuacionInventario');
const ValuacionDetalle = require('../models/ValuacionDetalle');
const { ArticuloCosteo, Costeo, Revaluacion, RevaluacionArticulo } = require('../models');

// =============================================
// VALUACIONES DE INVENTARIO
// =============================================

// Listar valuaciones
router.get('/valuaciones', auth, async (req, res) => {
    try {
        const valuaciones = await ValuacionInventario.findAll({
            order: [['created_at', 'DESC']]
        });
        res.json(valuaciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener detalle de una valuación
router.get('/valuaciones/:id', auth, async (req, res) => {
    try {
        const valuacion = await ValuacionInventario.findByPk(req.params.id);
        if (!valuacion) return res.status(404).json({ error: 'Valuación no encontrada' });

        const detalle = await ValuacionDetalle.findAll({
            where: { valuacion_id: req.params.id },
            order: [['codigo_goodies', 'ASC']]
        });

        res.json({ valuacion, detalle });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear nueva valuación
// Recibe: nombre, revaluacion_id (opcional, null = último costo original), articulos_centum (del Excel)
router.post('/valuaciones', auth, async (req, res) => {
    try {
        const { nombre, revaluacion_id, articulos_centum } = req.body;
        // articulos_centum = [{ codigo_goodies, descripcion, cantidad, costo_unit_contable, costo_total_contable }]

        let totalContable = 0;
        let totalRevaluado = 0;
        let artDifPositiva = 0;
        let artDifNegativa = 0;
        const detalles = [];

        for (const artCentum of articulos_centum) {
            const codigo = artCentum.codigo_goodies;
            const cantidad = parseFloat(artCentum.cantidad) || 0;
            const costoUnitContable = parseFloat(artCentum.costo_unit_contable) || 0;
            const costoTotalContable = parseFloat(artCentum.costo_total_contable) || (costoUnitContable * cantidad);

            let costoUnitRevaluado = 0;

            if (revaluacion_id) {
                // Buscar en la revaluación seleccionada
                const artRev = await RevaluacionArticulo.findOne({
                    where: { revaluacion_id, codigo_goodies: codigo }
                });
                if (artRev) {
                    costoUnitRevaluado = parseFloat(artRev.costo_neto_revaluado) || 0;
                }
            } else {
                // Usar último costo original (del último costeo definitivo)
                const ultimoArt = await ArticuloCosteo.findOne({
                    where: { codigo_goodies: codigo },
                    include: [{
                        model: Costeo,
                        as: 'costeo',
                        where: { estado: { [Op.ne]: 'borrador' } }
                    }],
                    order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
                });
                if (ultimoArt) {
                    costoUnitRevaluado = parseFloat(ultimoArt.costo_unitario_neto_ars) || 0;
                }
            }

            const costoTotalRevaluado = costoUnitRevaluado * cantidad;
            const difUnit = costoUnitRevaluado - costoUnitContable;
            const difTotal = costoTotalRevaluado - costoTotalContable;
            const difPct = costoUnitContable > 0 ? ((costoUnitRevaluado - costoUnitContable) / costoUnitContable) * 100 : 0;

            totalContable += costoTotalContable;
            totalRevaluado += costoTotalRevaluado;
            if (difTotal > 0) artDifPositiva++;
            if (difTotal < 0) artDifNegativa++;

            detalles.push({
                codigo_goodies: codigo,
                descripcion: artCentum.descripcion || '',
                cantidad,
                costo_unit_contable: Math.round(costoUnitContable * 100) / 100,
                costo_total_contable: Math.round(costoTotalContable * 100) / 100,
                costo_unit_revaluado: Math.round(costoUnitRevaluado * 100) / 100,
                costo_total_revaluado: Math.round(costoTotalRevaluado * 100) / 100,
                diferencia_unit: Math.round(difUnit * 100) / 100,
                diferencia_total: Math.round(difTotal * 100) / 100,
                diferencia_pct: Math.round(difPct * 100) / 100
            });
        }

        // Crear valuación
        const valuacion = await ValuacionInventario.create({
            nombre,
            fecha_carga: new Date(),
            revaluacion_id: revaluacion_id || null,
            total_contable: Math.round(totalContable * 100) / 100,
            total_revaluado: Math.round(totalRevaluado * 100) / 100,
            diferencia: Math.round((totalRevaluado - totalContable) * 100) / 100,
            cantidad_articulos: detalles.length,
            art_dif_positiva: artDifPositiva,
            art_dif_negativa: artDifNegativa,
            usuario_id: req.user?.id || null
        });

        // Crear detalles
        for (const det of detalles) {
            await ValuacionDetalle.create({
                valuacion_id: valuacion.id,
                ...det
            });
        }

        // Devolver resultado completo
        res.json({
            valuacion,
            detalle: detalles,
            resumen: {
                total_contable: Math.round(totalContable * 100) / 100,
                total_revaluado: Math.round(totalRevaluado * 100) / 100,
                diferencia: Math.round((totalRevaluado - totalContable) * 100) / 100,
                art_dif_positiva: artDifPositiva,
                art_dif_negativa: artDifNegativa
            }
        });
    } catch (error) {
        console.error('Error creando valuación:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar valuación
router.delete('/valuaciones/:id', auth, async (req, res) => {
    try {
        await ValuacionDetalle.destroy({ where: { valuacion_id: req.params.id } });
        await ValuacionInventario.destroy({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar revaluaciones disponibles (para el select del formulario)
router.get('/revaluaciones-disponibles', auth, async (req, res) => {
    try {
        const revs = await Revaluacion.findAll({
            order: [['fecha_revaluacion', 'DESC']],
            attributes: ['id', 'motivo', 'fecha_revaluacion', 'tc_usd_nuevo', 'tc_eur_nuevo', 'tc_gbp_nuevo', 'cantidad_articulos']
        });
        res.json(revs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
