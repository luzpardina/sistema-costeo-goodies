// services/backupService.js
// Backup completo de la base de datos en formato JSON.
// Exporta todas las tablas relevantes del modelo, devuelve un objeto serializable
// con metadatos (timestamp, totales por tabla) más los registros.
//
// Por qué JSON y no pg_dump:
// - No depende de tener el binario pg_dump instalado en el container
// - El JSON es directamente inspeccionable y portable
// - Para restaurar, basta con un script que lea el JSON e inserte vía Sequelize
// - Útil para auditoría: cualquiera puede abrir el archivo y verificar qué hay
//
// Tradeoff: el JSON es más grande que un dump SQL comprimido. Para ~100 costeos
// y ~500 artículos en catálogo, está alrededor de 2-5 MB. Aceptable.

const {
    Costeo, ArticuloCosteo, GastosAduana, GastosVarios,
    ConsolidadoProveedor, CatalogoArticulo, ArticuloMaestro,
    Revaluacion, RevaluacionArticulo,
    ListaPrecio, AcuerdoComercial, PrecioPVP, PrecioActual,
    ValuacionInventario, ValuacionDetalle,
    Usuario, AuditoriaLog, ConfigSistema, CatalogoLog
} = require('../models');

// Lista de modelos a backupear. Orden importa para una eventual restauración:
// primero los que no dependen de nadie, después los que tienen FK.
const MODELOS = [
    { nombre: 'usuarios', model: Usuario, sensible: true },
    { nombre: 'config_sistema', model: ConfigSistema },
    { nombre: 'articulo_maestro', model: ArticuloMaestro },
    { nombre: 'catalogo_articulo', model: CatalogoArticulo },
    { nombre: 'catalogo_log', model: CatalogoLog },
    { nombre: 'costeos', model: Costeo },
    { nombre: 'articulos_costeo', model: ArticuloCosteo },
    { nombre: 'gastos_aduana', model: GastosAduana },
    { nombre: 'gastos_varios', model: GastosVarios },
    { nombre: 'consolidado_proveedor', model: ConsolidadoProveedor },
    { nombre: 'revaluaciones', model: Revaluacion },
    { nombre: 'revaluacion_articulos', model: RevaluacionArticulo },
    { nombre: 'lista_precios', model: ListaPrecio },
    { nombre: 'acuerdos_comerciales', model: AcuerdoComercial },
    { nombre: 'precios_pvp', model: PrecioPVP },
    { nombre: 'precios_actuales', model: PrecioActual },
    { nombre: 'valuaciones_inventario', model: ValuacionInventario },
    { nombre: 'valuacion_detalles', model: ValuacionDetalle },
    { nombre: 'auditoria_log', model: AuditoriaLog }
];

/**
 * Genera un backup completo de la base de datos.
 * @param {object} opciones
 * @param {boolean} opciones.excluirSensibles - Si true, no incluye tabla usuarios (passwords hasheadas).
 *   Default false. Útil para backups que se mandan por mail o se comparten.
 * @returns {Promise<{buffer: Buffer, filename: string, resumen: object}>}
 */
async function generarBackup(opciones = {}) {
    const excluirSensibles = !!opciones.excluirSensibles;
    const inicio = Date.now();
    const ahora = new Date();
    const fechaStr = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaStr = ahora.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    const data = {
        meta: {
            generado_en: ahora.toISOString(),
            version_sistema: '2.6.2',
            excluye_sensibles: excluirSensibles,
            tablas_incluidas: []
        },
        tablas: {}
    };

    const resumen = {};

    for (const { nombre, model, sensible } of MODELOS) {
        if (sensible && excluirSensibles) {
            data.meta.tablas_incluidas.push({ nombre, registros: 0, omitida: true });
            continue;
        }
        try {
            const registros = await model.findAll({ raw: true });
            // Convertir Date a ISO string para que el JSON sea estable
            const registrosLimpios = registros.map(r => {
                const limpio = {};
                for (const [k, v] of Object.entries(r)) {
                    if (v instanceof Date) limpio[k] = v.toISOString();
                    else limpio[k] = v;
                }
                return limpio;
            });
            data.tablas[nombre] = registrosLimpios;
            data.meta.tablas_incluidas.push({ nombre, registros: registrosLimpios.length });
            resumen[nombre] = registrosLimpios.length;
        } catch (e) {
            // No fallar todo el backup si una tabla individual da error
            data.tablas[nombre] = { error: e.message };
            resumen[nombre] = 'ERROR: ' + e.message;
        }
    }

    data.meta.duracion_ms = Date.now() - inicio;
    data.meta.tamano_bytes = null; // se completa después de stringify

    const json = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(json, 'utf-8');
    const sufijo = excluirSensibles ? '_sin-usuarios' : '';
    const filename = `backup_goodies_${fechaStr}_${horaStr}${sufijo}.json`;

    return {
        buffer,
        filename,
        resumen: {
            ...resumen,
            _meta: {
                duracion_ms: data.meta.duracion_ms,
                tamano_kb: Math.round(buffer.length / 1024),
                excluye_sensibles: excluirSensibles
            }
        }
    };
}

module.exports = { generarBackup };
