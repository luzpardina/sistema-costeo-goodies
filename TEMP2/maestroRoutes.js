const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const { CatalogoArticulo } = require('../models');
const { Op } = require('sequelize');

const upload = multer({ storage: multer.memoryStorage() });

// Importar/Actualizar catálogo desde Excel
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
            const codigo = String(row['ClaveArticulo'] || row['codigo'] || row['codigo_goodies'] || row['Cod. Goodies'] || '').trim();
            const nombre = String(row['NombreArticulo'] || row['nombre'] || row['Nombre Artículo (Centum)'] || '').trim();
            
            if (!codigo || !nombre) {
                errores++;
                continue;
            }

            const proveedor = String(row['RazonSocialProveedor'] || row['proveedor'] || row['Proveedor'] || '').trim();
            const marca = String(row['NombreMarcaArticulo'] || row['marca'] || row['Marca'] || '').trim();
            const categoria = String(row['NombreArticuloCategoria'] || row['categoria'] || row['Rubro'] || '').trim();

            const existente = await CatalogoArticulo.findOne({
                where: { codigo_goodies: { [Op.iLike]: codigo } }
            });

            if (existente) {
                // Actualizar nombre, proveedor, marca si vienen
                const updates = {};
                if (nombre) updates.nombre = nombre;
                if (proveedor && !existente.proveedor) updates.proveedor = proveedor;
                if (marca && !existente.marca) updates.marca = marca;
                if (categoria && !existente.rubro) updates.rubro = categoria;
                await existente.update(updates);
                actualizados++;
            } else {
                await CatalogoArticulo.create({
                    codigo_goodies: codigo,
                    nombre: nombre,
                    proveedor: proveedor,
                    marca: marca,
                    rubro: categoria,
                    habilitado: true
                });
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
        console.error('Error al importar catálogo:', error);
        res.status(500).json({ error: 'Error al importar', detalles: error.message });
    }
});

// Descargar catálogo completo como Excel
router.get('/descargar', auth, async (req, res) => {
    try {
        const articulos = await CatalogoArticulo.findAll({
            where: { habilitado: true },
            order: [['codigo_goodies', 'ASC']]
        });

        const data = articulos.map(a => ({
            'Cod. Goodies': a.codigo_goodies,
            'Nombre': a.nombre,
            'Proveedor': a.proveedor || '',
            'Marca': a.marca || '',
            'Rubro': a.rubro || '',
            'SubRubro': a.subrubro || '',
            'Cod. Elaborador': a.codigo_elaborador || '',
            'Pos. Arancelaria': a.pos_arancelaria || '',
            '% Derechos': a.derechos_porcentaje ? (parseFloat(a.derechos_porcentaje) * 100).toFixed(2) : '',
            '% Imp. Internos': a.imp_interno_porcentaje ? (parseFloat(a.imp_interno_porcentaje) * 100).toFixed(2) : '',
            '% IVA': a.iva_porcentaje ? (parseFloat(a.iva_porcentaje) * 100).toFixed(2) : '',
            'Moneda': a.moneda || '',
            'País Origen': a.pais_origen || '',
            'Und/Caja': a.unidades_por_caja || '',
            'Último Valor Origen': a.ultimo_valor_origen || '',
            'Último Valor Fábrica': a.ultimo_valor_fabrica || '',
            'Fecha Último Precio': a.fecha_ultimo_precio ? new Date(a.fecha_ultimo_precio).toLocaleDateString('es-AR') : ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 20 }, { wch: 55 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
            { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
            { wch: 15 }, { wch: 18 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Unificado');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=CATALOGO_GOODIES.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error al descargar catálogo:', error);
        res.status(500).json({ error: 'Error al descargar' });
    }
});

// Buscar artículos por código o nombre (para autocomplete)
router.get('/buscar', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const articulos = await CatalogoArticulo.findAll({
            where: {
                habilitado: true,
                [Op.or]: [
                    { codigo_goodies: { [Op.iLike]: `%${q}%` } },
                    { nombre: { [Op.iLike]: `%${q}%` } }
                ]
            },
            order: [['codigo_goodies', 'ASC']],
            limit: 20
        });

        // Mapear para compatibilidad con frontend (usa "codigo" y "nombre")
        res.json(articulos.map(a => ({
            id: a.id,
            codigo: a.codigo_goodies,
            nombre: a.nombre,
            proveedor: a.proveedor,
            marca: a.marca,
            categoria: a.rubro,
            derechos_porcentaje: a.derechos_porcentaje,
            imp_interno_porcentaje: a.imp_interno_porcentaje,
            unidades_por_caja: a.unidades_por_caja,
            ultimo_valor_origen: a.ultimo_valor_origen,
            ultimo_valor_fabrica: a.ultimo_valor_fabrica,
            moneda: a.moneda
        })));
    } catch (error) {
        console.error('Error al buscar artículos:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// Obtener artículos por proveedor
router.get('/por-proveedor', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        if (!proveedor) return res.json([]);

        const articulos = await CatalogoArticulo.findAll({
            where: {
                habilitado: true,
                proveedor: { [Op.iLike]: `%${proveedor}%` }
            },
            order: [['codigo_goodies', 'ASC']]
        });

        res.json(articulos.map(a => ({
            id: a.id,
            codigo: a.codigo_goodies,
            nombre: a.nombre,
            proveedor: a.proveedor,
            marca: a.marca,
            categoria: a.rubro
        })));
    } catch (error) {
        console.error('Error al buscar por proveedor:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// Obtener lista de proveedores únicos
router.get('/proveedores', auth, async (req, res) => {
    try {
        const proveedores = await CatalogoArticulo.findAll({
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('proveedor')), 'proveedor']],
            where: { habilitado: true, proveedor: { [Op.and]: [{ [Op.ne]: '' }, { [Op.ne]: null }] } },
            order: [['proveedor', 'ASC']],
            raw: true
        });

        res.json(proveedores.map(p => p.proveedor).filter(p => p));
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// Obtener marcas por proveedor
router.get('/marcas', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        const where = { habilitado: true, marca: { [Op.and]: [{ [Op.ne]: '' }, { [Op.ne]: null }] } };
        if (proveedor) {
            where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        }

        const marcas = await CatalogoArticulo.findAll({
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
        if (!marca) return res.json([]);

        const where = { habilitado: true, marca: { [Op.iLike]: `%${marca}%` } };
        if (proveedor) {
            where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        }

        const articulos = await CatalogoArticulo.findAll({
            where,
            order: [['codigo_goodies', 'ASC']]
        });

        res.json(articulos.map(a => ({
            id: a.id,
            codigo: a.codigo_goodies,
            nombre: a.nombre,
            proveedor: a.proveedor,
            marca: a.marca,
            categoria: a.rubro
        })));
    } catch (error) {
        console.error('Error al buscar por marca:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// Validar artículos contra catálogo
router.post('/validar', auth, async (req, res) => {
    try {
        const { articulos } = req.body;
        if (!articulos || !articulos.length) return res.json({ alertas: [] });

        const alertas = [];
        for (const art of articulos) {
            if (!art.codigo_goodies || ['MUESTRAS','MUESTRA','POS','PENDIENTE'].includes(art.codigo_goodies.toUpperCase())) continue;

            const catalogo = await CatalogoArticulo.findOne({
                where: { codigo_goodies: { [Op.iLike]: art.codigo_goodies } }
            });

            if (!catalogo) {
                alertas.push({
                    codigo: art.codigo_goodies,
                    tipo: 'NO_EXISTE',
                    mensaje: `Código ${art.codigo_goodies} no existe en el catálogo`
                });
            } else if (catalogo.nombre.toUpperCase().trim() !== (art.nombre || '').toUpperCase().trim()) {
                alertas.push({
                    codigo: art.codigo_goodies,
                    tipo: 'NOMBRE_DIFERENTE',
                    mensaje: `${art.codigo_goodies}: "${art.nombre}" ≠ catálogo "${catalogo.nombre}"`,
                    nombre_maestro: catalogo.nombre
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
        const total = await CatalogoArticulo.count({ where: { habilitado: true } });
        const con_derechos = await CatalogoArticulo.count({ where: { habilitado: true, derechos_porcentaje: { [Op.not]: null } } });
        const con_precios = await CatalogoArticulo.count({ where: { habilitado: true, ultimo_valor_origen: { [Op.not]: null } } });
        res.json({ total, con_derechos, con_precios });
    } catch (error) {
        res.json({ total: 0 });
    }
});

module.exports = router;
