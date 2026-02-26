const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const { ArticuloMaestro } = require('../models');
const { Op } = require('sequelize');

const upload = multer({ storage: multer.memoryStorage() });

// Importar Excel de artículos maestros
router.post('/importar', auth, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        let importados = 0;
        let actualizados = 0;
        let errores = 0;

        for (const row of data) {
            const codigo = String(row['ClaveArticulo'] || row['codigo'] || '').trim();
            const nombre = String(row['NombreArticulo'] || row['nombre'] || '').trim();
            
            if (!codigo || !nombre) {
                errores++;
                continue;
            }

            const proveedor = String(row['RazonSocialProveedor'] || row['proveedor'] || '').trim();
            const marca = String(row['NombreMarcaArticulo'] || row['marca'] || '').trim();
            const categoria = String(row['NombreArticuloCategoria'] || row['categoria'] || '').trim();
            const tipo = String(row['TIPO DE ARTICULO '] || row['tipo'] || '').trim();
            const sociedad = String(row['NombreArticuloSociedad'] || row['sociedad'] || '').trim();

            const [articulo, created] = await ArticuloMaestro.findOrCreate({
                where: { codigo },
                defaults: { nombre, proveedor, marca, categoria, tipo, sociedad }
            });

            if (!created) {
                await articulo.update({ nombre, proveedor, marca, categoria, tipo, sociedad });
                actualizados++;
            } else {
                importados++;
            }
        }

        res.json({
            mensaje: 'Importación completada',
            importados,
            actualizados,
            errores,
            total: importados + actualizados
        });
    } catch (error) {
        console.error('Error al importar maestro:', error);
        res.status(500).json({ error: 'Error al importar', detalles: error.message });
    }
});

// Buscar artículos por código o nombre
router.get('/buscar', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const articulos = await ArticuloMaestro.findAll({
            where: {
                activo: true,
                [Op.or]: [
                    { codigo: { [Op.iLike]: `%${q}%` } },
                    { nombre: { [Op.iLike]: `%${q}%` } }
                ]
            },
            order: [['codigo', 'ASC']],
            limit: 20
        });

        res.json(articulos);
    } catch (error) {
        console.error('Error al buscar artículos:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// Obtener artículos por proveedor
router.get('/por-proveedor', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        if (!proveedor) {
            return res.json([]);
        }

        const articulos = await ArticuloMaestro.findAll({
            where: {
                activo: true,
                proveedor: { [Op.iLike]: `%${proveedor}%` }
            },
            order: [['codigo', 'ASC']]
        });

        res.json(articulos);
    } catch (error) {
        console.error('Error al buscar por proveedor:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// Obtener lista de proveedores únicos
router.get('/proveedores', auth, async (req, res) => {
    try {
        const proveedores = await ArticuloMaestro.findAll({
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('proveedor')), 'proveedor']],
            where: { activo: true, proveedor: { [Op.ne]: '' } },
            order: [['proveedor', 'ASC']],
            raw: true
        });

        res.json(proveedores.map(p => p.proveedor).filter(p => p));
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// Validar artículos de un costeo contra maestro
router.post('/validar', auth, async (req, res) => {
    try {
        const { articulos } = req.body;
        if (!articulos || !articulos.length) {
            return res.json({ alertas: [] });
        }

        const alertas = [];
        for (const art of articulos) {
            if (!art.codigo_goodies || ['MUESTRAS','MUESTRA','POS','PENDIENTE'].includes(art.codigo_goodies.toUpperCase())) {
                continue;
            }

            const maestro = await ArticuloMaestro.findOne({
                where: { codigo: art.codigo_goodies }
            });

            if (!maestro) {
                alertas.push({
                    codigo: art.codigo_goodies,
                    tipo: 'NO_EXISTE',
                    mensaje: `Código ${art.codigo_goodies} no existe en el catálogo maestro`
                });
            } else if (maestro.nombre.toUpperCase().trim() !== (art.nombre || '').toUpperCase().trim()) {
                alertas.push({
                    codigo: art.codigo_goodies,
                    tipo: 'NOMBRE_DIFERENTE',
                    mensaje: `${art.codigo_goodies}: nombre en costeo "${art.nombre}" ≠ catálogo "${maestro.nombre}"`,
                    nombre_maestro: maestro.nombre
                });
            }
        }

        res.json({ alertas });
    } catch (error) {
        console.error('Error al validar:', error);
        res.status(500).json({ error: 'Error al validar' });
    }
});

// Estadísticas del catálogo
router.get('/stats', auth, async (req, res) => {
    try {
        const total = await ArticuloMaestro.count({ where: { activo: true } });
        res.json({ total });
    } catch (error) {
        res.json({ total: 0 });
    }
});

// Obtener marcas por proveedor
router.get('/marcas', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        const where = { activo: true, marca: { [Op.and]: [{ [Op.ne]: '' }, { [Op.ne]: null }] } };
        if (proveedor) {
            where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        }

        const marcas = await ArticuloMaestro.findAll({
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('marca')), 'marca']],
            where,
            order: [['marca', 'ASC']],
            raw: true
        });

        res.json(marcas.map(m => m.marca).filter(m => m));
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
});

// Obtener artículos por marca
router.get('/por-marca', auth, async (req, res) => {
    try {
        const { marca, proveedor } = req.query;
        if (!marca) {
            return res.json([]);
        }

        const where = { activo: true, marca: { [Op.iLike]: `%${marca}%` } };
        if (proveedor) {
            where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        }

        const articulos = await ArticuloMaestro.findAll({
            where,
            order: [['codigo', 'ASC']]
        });

        res.json(articulos);
    } catch (error) {
        console.error('Error al buscar por marca:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

module.exports = router;
