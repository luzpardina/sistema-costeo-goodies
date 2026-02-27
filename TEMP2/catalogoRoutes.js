const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { CatalogoArticulo } = require('../models');

// Buscar artículo por código Goodies (exacto)
router.get('/buscar/:codigo', auth, async (req, res) => {
    try {
        const articulo = await CatalogoArticulo.findOne({
            where: { codigo_goodies: { [Op.iLike]: req.params.codigo } }
        });
        if (!articulo) {
            return res.status(404).json({ error: 'Artículo no encontrado en catálogo' });
        }
        res.json(articulo);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar artículo' });
    }
});

// Buscar artículos por texto (código, nombre o marca) - para autocomplete
router.get('/buscar', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);
        const articulos = await CatalogoArticulo.findAll({
            where: {
                [Op.or]: [
                    { codigo_goodies: { [Op.iLike]: `%${q}%` } },
                    { nombre: { [Op.iLike]: `%${q}%` } },
                    { marca: { [Op.iLike]: `%${q}%` } },
                    { codigo_elaborador: { [Op.iLike]: `%${q}%` } }
                ]
            },
            order: [['codigo_goodies', 'ASC']],
            limit: 20
        });
        res.json(articulos);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar artículos' });
    }
});

// Aplicar actualizaciones confirmadas al catálogo
router.post('/actualizar-confirmado', auth, async (req, res) => {
    try {
        const { actualizaciones } = req.body;
        if (!actualizaciones || actualizaciones.length === 0) {
            return res.json({ mensaje: 'Sin actualizaciones', actualizados: 0 });
        }
        let actualizados = 0;
        for (const upd of actualizaciones) {
            const articulo = await CatalogoArticulo.findOne({
                where: { codigo_goodies: { [Op.iLike]: upd.codigo } }
            });
            if (articulo && upd.campo && upd.valor !== undefined) {
                await articulo.update({ [upd.campo]: upd.valor });
                actualizados++;
            }
        }
        res.json({ mensaje: `${actualizados} campo(s) actualizados en catálogo`, actualizados });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar catálogo' });
    }
});

// Listar todos los artículos del catálogo (con paginación)
router.get('/listar', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50, marca, proveedor, rubro } = req.query;
        const where = {};
        if (marca) where.marca = { [Op.iLike]: `%${marca}%` };
        if (proveedor) where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        if (rubro) where.rubro = { [Op.iLike]: `%${rubro}%` };
        const { count, rows } = await CatalogoArticulo.findAndCountAll({
            where, order: [['codigo_goodies', 'ASC']],
            limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
        });
        res.json({ total: count, pagina: parseInt(page), articulos: rows });
    } catch (error) {
        res.status(500).json({ error: 'Error al listar catálogo' });
    }
});

// Estadísticas del catálogo
router.get('/stats', auth, async (req, res) => {
    try {
        const total = await CatalogoArticulo.count();
        const con_derechos = await CatalogoArticulo.count({ where: { derechos_porcentaje: { [Op.not]: null } } });
        const con_posicion = await CatalogoArticulo.count({ where: { pos_arancelaria: { [Op.not]: null, [Op.ne]: '' } } });
        const con_moneda = await CatalogoArticulo.count({ where: { moneda: { [Op.not]: null, [Op.ne]: '' } } });
        res.json({ total, con_derechos, con_posicion, con_moneda });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
