const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const { CatalogoArticulo } = require('../models');
const { Op } = require('sequelize');

const upload = multer({ storage: multer.memoryStorage() });

function parsearExcelCatalogo(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    const parsePct = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = parseFloat(v);
        if (isNaN(n)) return null;
        return n > 1 ? n / 100 : n;
    };
    return data.map(row => {
        const codigo = String(row['ClaveArticulo'] || row['codigo'] || row['codigo_goodies'] || row['Cod. Goodies'] || '').trim();
        const nombre = String(row['NombreArticulo'] || row['nombre'] || row['Nombre Artículo (Centum)'] || row['Nombre'] || '').trim();
        if (!codigo || !nombre) return null;
        return {
            codigo_goodies: codigo, nombre,
            proveedor: String(row['RazonSocialProveedor'] || row['proveedor'] || row['Proveedor'] || '').trim() || null,
            marca: String(row['NombreMarcaArticulo'] || row['marca'] || row['Marca'] || '').trim() || null,
            rubro: String(row['NombreArticuloCategoria'] || row['categoria'] || row['Rubro'] || '').trim() || null,
            subrubro: String(row['SubRubro'] || row['subrubro'] || '').trim() || null,
            codigo_elaborador: String(row['Cod. Elaborador'] || row['codigo_elaborador'] || '').trim() || null,
            pos_arancelaria: String(row['Pos. Arancelaria'] || row['pos_arancelaria'] || '').trim() || null,
            pais_origen: String(row['País Origen'] || row['pais_origen'] || row['Pais Origen'] || '').trim() || null,
            moneda: String(row['Moneda'] || row['moneda'] || '').trim() || null,
            derechos_porcentaje: parsePct(row['% Derechos'] || row['derechos_porcentaje']),
            imp_interno_porcentaje: parsePct(row['% Imp. Internos'] || row['imp_interno_porcentaje']),
            iva_porcentaje: parsePct(row['% IVA'] || row['iva_porcentaje']),
            estadistica_porcentaje: parsePct(row['% Estadística'] || row['estadistica_porcentaje'])
        };
    }).filter(r => r !== null);
}

// Previsualizar cambios antes de importar
router.post('/previsualizar', auth, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });
        const registros = parsearExcelCatalogo(req.file.buffer);
        if (registros.length === 0) return res.status(400).json({ error: 'No se encontraron artículos válidos' });

        const nuevos = [];
        const cambios = [];
        let sinCambios = 0;
        let completados = 0;

        for (const reg of registros) {
            const existente = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: reg.codigo_goodies } } });
            if (!existente) {
                nuevos.push({ codigo: reg.codigo_goodies, nombre: reg.nombre });
                continue;
            }
            const camposModificados = [];
            const textos = [
                { label: 'Nombre', nuevo: reg.nombre, actual: existente.nombre },
                { label: 'Proveedor', nuevo: reg.proveedor, actual: existente.proveedor },
                { label: 'Marca', nuevo: reg.marca, actual: existente.marca },
                { label: 'Rubro', nuevo: reg.rubro, actual: existente.rubro },
                { label: 'Cod. Elaborador', nuevo: reg.codigo_elaborador, actual: existente.codigo_elaborador },
                { label: 'Pos. Arancelaria', nuevo: reg.pos_arancelaria, actual: existente.pos_arancelaria },
                { label: 'País Origen', nuevo: reg.pais_origen, actual: existente.pais_origen },
                { label: 'Moneda', nuevo: reg.moneda, actual: existente.moneda }
            ];
            for (const c of textos) {
                if (c.nuevo && c.nuevo !== '') {
                    if (!c.actual || c.actual === '') {
                        camposModificados.push({ campo: c.label, antes: '(vacío)', despues: c.nuevo, tipo: 'completar' });
                    } else if (c.actual.toUpperCase().trim() !== c.nuevo.toUpperCase().trim()) {
                        camposModificados.push({ campo: c.label, antes: c.actual, despues: c.nuevo, tipo: 'cambio' });
                    }
                }
            }
            const nums = [
                { label: '% Derechos', nuevo: reg.derechos_porcentaje, actual: existente.derechos_porcentaje ? parseFloat(existente.derechos_porcentaje) : null },
                { label: '% Imp. Internos', nuevo: reg.imp_interno_porcentaje, actual: existente.imp_interno_porcentaje ? parseFloat(existente.imp_interno_porcentaje) : null },
                { label: '% IVA', nuevo: reg.iva_porcentaje, actual: existente.iva_porcentaje ? parseFloat(existente.iva_porcentaje) : null },
                { label: '% Estadística', nuevo: reg.estadistica_porcentaje, actual: existente.estadistica_porcentaje ? parseFloat(existente.estadistica_porcentaje) : null }
            ];
            for (const c of nums) {
                if (c.nuevo !== null) {
                    if (c.actual === null || c.actual === 0) {
                        camposModificados.push({ campo: c.label, antes: '(vacío)', despues: (c.nuevo * 100).toFixed(2) + '%', tipo: 'completar' });
                    } else if (Math.abs(c.actual - c.nuevo) > 0.0001) {
                        camposModificados.push({ campo: c.label, antes: (c.actual * 100).toFixed(2) + '%', despues: (c.nuevo * 100).toFixed(2) + '%', tipo: 'cambio' });
                    }
                }
            }
            if (camposModificados.length > 0) {
                const tieneReemplazo = camposModificados.some(c => c.tipo === 'cambio');
                if (tieneReemplazo) {
                    cambios.push({ codigo: reg.codigo_goodies, nombre: existente.nombre, campos: camposModificados });
                } else {
                    completados++;
                }
            } else {
                sinCambios++;
            }
        }

        res.json({ total_excel: registros.length, nuevos, cambios, completados, sin_cambios: sinCambios });
    } catch (error) {
        res.status(500).json({ error: 'Error al analizar archivo', detalles: error.message });
    }
});

// Importar/Actualizar catálogo confirmado
router.post('/importar', auth, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });
        const registros = parsearExcelCatalogo(req.file.buffer);
        let importados = 0, actualizados = 0, errores = 0;

        for (const reg of registros) {
            try {
                const existente = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: reg.codigo_goodies } } });
                if (existente) {
                    const updates = {};
                    if (reg.nombre) updates.nombre = reg.nombre;
                    if (reg.proveedor) updates.proveedor = reg.proveedor;
                    if (reg.marca) updates.marca = reg.marca;
                    if (reg.rubro) updates.rubro = reg.rubro;
                    if (reg.subrubro) updates.subrubro = reg.subrubro;
                    if (reg.codigo_elaborador) updates.codigo_elaborador = reg.codigo_elaborador;
                    if (reg.pos_arancelaria) updates.pos_arancelaria = reg.pos_arancelaria;
                    if (reg.pais_origen) updates.pais_origen = reg.pais_origen;
                    if (reg.moneda) updates.moneda = reg.moneda;
                    if (reg.derechos_porcentaje !== null) updates.derechos_porcentaje = reg.derechos_porcentaje;
                    if (reg.imp_interno_porcentaje !== null) updates.imp_interno_porcentaje = reg.imp_interno_porcentaje;
                    if (reg.iva_porcentaje !== null) updates.iva_porcentaje = reg.iva_porcentaje;
                    if (reg.estadistica_porcentaje !== null) updates.estadistica_porcentaje = reg.estadistica_porcentaje;
                    if (Object.keys(updates).length > 0) { await existente.update(updates); actualizados++; }
                } else {
                    await CatalogoArticulo.create({ ...reg, habilitado: true });
                    importados++;
                }
            } catch (e) { errores++; }
        }
        res.json({ mensaje: 'Importación completada', importados, actualizados, errores, total: importados + actualizados });
    } catch (error) {
        res.status(500).json({ error: 'Error al importar', detalles: error.message });
    }
});

// Descargar catálogo completo
router.get('/descargar', auth, async (req, res) => {
    try {
        const articulos = await CatalogoArticulo.findAll({ where: { habilitado: true }, order: [['codigo_goodies', 'ASC']] });
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
            '% Estadística': a.estadistica_porcentaje ? (parseFloat(a.estadistica_porcentaje) * 100).toFixed(2) : '',
            'Moneda': a.moneda || '',
            'País Origen': a.pais_origen || '',
            'Und/Caja': a.unidades_por_caja || '',
            'Último Valor Origen': a.ultimo_valor_origen || '',
            'Último Valor Fábrica': a.ultimo_valor_fabrica || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 20 }, { wch: 55 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Unificado');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=CATALOGO_GOODIES.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Error al descargar' });
    }
});

// Buscar artículos
router.get('/buscar', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);
        const articulos = await CatalogoArticulo.findAll({
            where: { habilitado: true, [Op.or]: [{ codigo_goodies: { [Op.iLike]: `%${q}%` } }, { nombre: { [Op.iLike]: `%${q}%` } }] },
            order: [['codigo_goodies', 'ASC']], limit: 20
        });
        res.json(articulos.map(a => ({
            id: a.id, codigo: a.codigo_goodies, nombre: a.nombre, proveedor: a.proveedor, marca: a.marca, categoria: a.rubro,
            derechos_porcentaje: a.derechos_porcentaje, imp_interno_porcentaje: a.imp_interno_porcentaje,
            unidades_por_caja: a.unidades_por_caja, ultimo_valor_origen: a.ultimo_valor_origen, ultimo_valor_fabrica: a.ultimo_valor_fabrica, moneda: a.moneda
        })));
    } catch (error) { res.status(500).json({ error: 'Error al buscar' }); }
});

// Proveedores
router.get('/por-proveedor', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        if (!proveedor) return res.json([]);
        const articulos = await CatalogoArticulo.findAll({ where: { habilitado: true, proveedor: { [Op.iLike]: `%${proveedor}%` } }, order: [['codigo_goodies', 'ASC']] });
        res.json(articulos.map(a => ({ id: a.id, codigo: a.codigo_goodies, nombre: a.nombre, proveedor: a.proveedor, marca: a.marca, categoria: a.rubro })));
    } catch (error) { res.status(500).json({ error: 'Error al buscar' }); }
});

router.get('/proveedores', auth, async (req, res) => {
    try {
        const proveedores = await CatalogoArticulo.findAll({
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('proveedor')), 'proveedor']],
            where: { habilitado: true, proveedor: { [Op.and]: [{ [Op.ne]: '' }, { [Op.ne]: null }] } },
            order: [['proveedor', 'ASC']], raw: true
        });
        res.json(proveedores.map(p => p.proveedor).filter(p => p));
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

router.get('/marcas', auth, async (req, res) => {
    try {
        const { proveedor } = req.query;
        const where = { habilitado: true, marca: { [Op.and]: [{ [Op.ne]: '' }, { [Op.ne]: null }] } };
        if (proveedor) where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        const marcas = await CatalogoArticulo.findAll({
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('marca')), 'marca']],
            where, order: [['marca', 'ASC']], raw: true
        });
        res.json(marcas.map(m => m.marca).filter(m => m));
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

router.get('/por-marca', auth, async (req, res) => {
    try {
        const { marca, proveedor } = req.query;
        if (!marca) return res.json([]);
        const where = { habilitado: true, marca: { [Op.iLike]: `%${marca}%` } };
        if (proveedor) where.proveedor = { [Op.iLike]: `%${proveedor}%` };
        const articulos = await CatalogoArticulo.findAll({ where, order: [['codigo_goodies', 'ASC']] });
        res.json(articulos.map(a => ({ id: a.id, codigo: a.codigo_goodies, nombre: a.nombre, proveedor: a.proveedor, marca: a.marca, categoria: a.rubro })));
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

router.post('/validar', auth, async (req, res) => {
    try {
        const { articulos } = req.body;
        if (!articulos || !articulos.length) return res.json({ alertas: [] });
        const alertas = [];
        for (const art of articulos) {
            if (!art.codigo_goodies || ['MUESTRAS','MUESTRA','POS','PENDIENTE'].includes(art.codigo_goodies.toUpperCase())) continue;
            const cat = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: art.codigo_goodies } } });
            if (!cat) {
                alertas.push({ codigo: art.codigo_goodies, tipo: 'NO_EXISTE', mensaje: `${art.codigo_goodies} no existe en catálogo` });
            } else if (cat.nombre.toUpperCase().trim() !== (art.nombre || '').toUpperCase().trim()) {
                alertas.push({ codigo: art.codigo_goodies, tipo: 'NOMBRE_DIFERENTE', mensaje: `${art.codigo_goodies}: "${art.nombre}" ≠ "${cat.nombre}"`, nombre_maestro: cat.nombre });
            }
        }
        res.json({ alertas });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

router.get('/stats', auth, async (req, res) => {
    try {
        const total = await CatalogoArticulo.count({ where: { habilitado: true } });
        res.json({ total });
    } catch (error) { res.json({ total: 0 }); }
});

module.exports = router;
