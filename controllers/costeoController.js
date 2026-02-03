const XLSX = require('xlsx');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios, ConsolidadoProveedor } = require('../models');
const { calcularCosteo } = require('./calculosService');

// Función auxiliar para leer valor de celda
const getCellValue = (sheet, row, col) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
};

// Función para buscar campo en DATOS_GENERALES
const buscarCampo = (sheet, nombreCampo) => {
    const maxRow = 30; // Buscar en las primeras 30 filas
    for (let row = 0; row < maxRow; row++) {
        const campo = getCellValue(sheet, row, 0);
        if (campo && campo.toString().toLowerCase().includes(nombreCampo.toLowerCase())) {
            return getCellValue(sheet, row, 1);
        }
    }
    return null;
};

// Función para convertir fecha de Excel
const convertirFechaExcel = (valor) => {
    if (!valor) return null;
    
    // Si ya es un Date
    if (valor instanceof Date) {
        return valor;
    }
    
    // Si es string con formato DD/MM/YYYY
    if (typeof valor === 'string' && valor.includes('/')) {
        const partes = valor.split('/');
        if (partes.length === 3) {
            return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
        }
    }
    
    // Si es número de Excel (días desde 1900)
    if (typeof valor === 'number') {
        const date = new Date((valor - 25569) * 86400 * 1000);
        return date;
    }
    
    return null;
};

// Importar Excel
const importarExcel = async (req, res) => {
    try {
        // Verificar que se subió un archivo
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        // Leer el archivo Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });

        // Verificar que existen las 3 hojas requeridas
        const hojasRequeridas = ['DATOS_GENERALES', 'ARTICULOS', 'BASE_ADUANA_GASTOS'];
        const hojasExistentes = workbook.SheetNames;
        
        for (const hoja of hojasRequeridas) {
            if (!hojasExistentes.includes(hoja)) {
                return res.status(400).json({ 
                    error: `Falta la hoja requerida: ${hoja}`,
                    hojasEncontradas: hojasExistentes
                });
            }
        }

        // LEER DATOS_GENERALES
        const sheetDatosGenerales = workbook.Sheets['DATOS_GENERALES'];
        
        const datosGenerales = {
            nombre_costeo: buscarCampo(sheetDatosGenerales, 'Nombre del costeo'),
            proveedor: buscarCampo(sheetDatosGenerales, 'Proveedor de origen'),
            factura_nro: buscarCampo(sheetDatosGenerales, 'Factura nro'),
            fecha_factura: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Factura')),
            fecha_vencimiento_factura: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Vencimiento')),
            fecha_despacho: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Despacho')),
            incoterm: buscarCampo(sheetDatosGenerales, 'Factura incoterm'),
            moneda_principal: buscarCampo(sheetDatosGenerales, 'Moneda principal de factura'),
            monto_factura: parseFloat(buscarCampo(sheetDatosGenerales, 'MONTO')) || 0,
           tc_usd: parseFloat(buscarCampo(sheetDatosGenerales, 'USD')) || 1,
            tc_eur: parseFloat(buscarCampo(sheetDatosGenerales, 'EUR')) || null,
            tc_gbp: parseFloat(buscarCampo(sheetDatosGenerales, 'GBP')) || null,
            tc_ars: parseFloat(buscarCampo(sheetDatosGenerales, 'ARS')) || 1,
            empresa_intermediaria: buscarCampo(sheetDatosGenerales, 'Empresa Intermediaria') || null,
            factura_intermediaria: buscarCampo(sheetDatosGenerales, 'Nro Factura Intermediaria')?.toString() || null,
            fecha_factura_intermediaria: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Factura Intermediaria')),
            fecha_vencimiento_intermediaria: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Vencimiento intermediaria'))
        };

        // Validar campos obligatorios
        if (!datosGenerales.nombre_costeo) {
            return res.status(400).json({ error: 'Falta el nombre del costeo' });
        }
        if (!datosGenerales.proveedor) {
            return res.status(400).json({ error: 'Falta el proveedor' });
        }
        if (!datosGenerales.moneda_principal) {
            return res.status(400).json({ error: 'Falta la moneda principal' });
        }

        // LEER ARTICULOS (DINÁMICO - HASTA 50)
        const sheetArticulos = workbook.Sheets['ARTICULOS'];
        const articulos = [];
        
        // Buscar fila de headers (normalmente fila 3, índice 2)
        let headerRow = 2;
        const codigoHeader = getCellValue(sheetArticulos, headerRow, 0);
        if (!codigoHeader || !codigoHeader.toString().includes('CODIGO')) {
            // Buscar header en las primeras 10 filas
            for (let i = 0; i < 10; i++) {
                const valor = getCellValue(sheetArticulos, i, 0);
                if (valor && valor.toString().includes('CODIGO')) {
                    headerRow = i;
                    break;
                }
            }
        }

        // Leer artículos desde la siguiente fila
        let row = headerRow + 1;
        let contador = 0;
        const MAX_ARTICULOS = 50;

        while (contador < MAX_ARTICULOS) {
            const codigo = getCellValue(sheetArticulos, row, 0);
            
            // Si no hay código, terminamos
            if (!codigo || codigo === '') {
                break;
            }

            const articulo = {
                codigo_goodies: codigo.toString().trim(),
                codigo_proveedor: getCellValue(sheetArticulos, row, 1)?.toString() || '',
                nombre: getCellValue(sheetArticulos, row, 2)?.toString().trim() || '',
                cantidad_cajas: parseFloat(getCellValue(sheetArticulos, row, 3)) || 0,
                unidades_por_caja: parseFloat(getCellValue(sheetArticulos, row, 4)) || 0,
                unidades_totales: parseFloat(getCellValue(sheetArticulos, row, 5)) || 0,
                valor_unitario_origen: parseFloat(getCellValue(sheetArticulos, row, 6)) || 0,
                importe_total_origen: parseFloat(getCellValue(sheetArticulos, row, 7)) || 0,
                derechos_porcentaje: parseFloat(getCellValue(sheetArticulos, row, 8)) || 0,
                impuesto_interno_porcentaje: parseFloat(getCellValue(sheetArticulos, row, 9)) || 0,
                moneda_origen: datosGenerales.moneda_principal
            };

            // Validar que tenga código y nombre
            if (articulo.codigo_goodies && articulo.nombre) {
                articulos.push(articulo);
                contador++;
            }

            row++;
        }

        // Verificar que hay al menos 1 artículo
        if (articulos.length === 0) {
            return res.status(400).json({ error: 'No se encontraron artículos en el archivo' });
        }

        // Verificar límite de artículos
        if (contador >= MAX_ARTICULOS) {
            const siguienteCodigo = getCellValue(sheetArticulos, row, 0);
            if (siguienteCodigo && siguienteCodigo !== '') {
                return res.status(400).json({ 
                    error: 'El archivo tiene más de 50 artículos',
                    detalles: 'El sistema tiene un límite de 50 artículos por costeo',
                    sugerencia: 'Divida los artículos en múltiples costeos'
                });
            }
        }

        // LEER BASE_ADUANA_GASTOS (DINÁMICO - HASTA 50)
        const sheetGastos = workbook.Sheets['BASE_ADUANA_GASTOS'];
        
        // Buscar Flete y Seguro de Aduana
        let fleteAduana = 0;
        let seguroAduana = 0;
        
        for (let row = 0; row < 50; row++) {
            const campo = getCellValue(sheetGastos, row, 0);
            if (campo) {
                if (campo.toString().includes('Flete Aduana')) {
                    fleteAduana = parseFloat(getCellValue(sheetGastos, row, 2)) || 0;
                }
                if (campo.toString().includes('Seguro Aduana')) {
                    seguroAduana = parseFloat(getCellValue(sheetGastos, row, 2)) || 0;
                }
            }
        }
// Leer RECARGOS ADICIONALES
        const recargos = {
            fleteInternacional: 0,
            transporteInternacional: 0,
            maritimaAgencia: 0,
            gastosOrigen: 0
        };
        
        // Buscar sección "RECARGOS ADICIONALES"
        let recargosStartRow = -1;
        for (let row = 0; row < 50; row++) {
            const valor = getCellValue(sheetGastos, row, 0);
            if (valor && valor.toString().toUpperCase().includes('RECARGOS ADICIONALES')) {
                recargosStartRow = row + 2; // Saltar título y "Los siguientes gastos tendrán recargo:"
                break;
            }
        }
        
        // Leer los recargos si encontramos la sección
        if (recargosStartRow > 0) {
            for (let row = recargosStartRow; row < recargosStartRow + 10; row++) {
                const concepto = getCellValue(sheetGastos, row, 0);
                if (!concepto || concepto === '') break;
                
                const conceptoLower = concepto.toString().toLowerCase();
                const valorRecargo = parseFloat(getCellValue(sheetGastos, row, 1)) || 0;
                
                // Convertir porcentaje a decimal (3% -> 0.03)
                const recargoDecimal = valorRecargo > 1 ? valorRecargo / 100 : valorRecargo;
                
                if (conceptoLower.includes('flete internacional')) {
                    recargos.fleteInternacional = recargoDecimal;
                } else if (conceptoLower.includes('transporte internacional')) {
                    recargos.transporteInternacional = recargoDecimal;
                } else if (conceptoLower.includes('marítima') || conceptoLower.includes('maritima') || conceptoLower.includes('agencia')) {
                    recargos.maritimaAgencia = recargoDecimal;
                } else if (conceptoLower.includes('gastos en origen')) {
                    recargos.gastosOrigen = recargoDecimal;
                }
            }
        }
        
        console.log('Recargos leídos:', recargos);
        // Buscar inicio de TABLA 5 (GASTOS)
        let gastosStartRow = -1;
        for (let row = 0; row < 50; row++) {
            const valor = getCellValue(sheetGastos, row, 0);
            if (valor && valor.toString().includes('TABLA 5')) {
                gastosStartRow = row + 2; // Saltar "TABLA 5" y "GASTOS"
                break;
            }
        }

        // Leer gastos varios (DINÁMICO)
        const gastosVarios = [];
        const gastosAduanaData = {
            despachante: 0,
            gestion_senasa: 0,
            gestion_anmat: 0,
            transporte_internacional: 0,
            gastos_origen: 0,
            terminal: 0,
            maritima_agencia: 0,
            bancarios: 0,
            gestor: 0,
            transporte_nacional: 0,
            custodia: 0,
            sim: 0
        };

        if (gastosStartRow > 0) {
            let row = gastosStartRow;
            let contador = 0;
            const MAX_GASTOS = 50;

            while (contador < MAX_GASTOS) {
                const descripcion = getCellValue(sheetGastos, row, 0);
                
                // Si no hay descripción, terminamos
                if (!descripcion || descripcion === '') {
                    break;
                }

                const proveedor = getCellValue(sheetGastos, row, 1)?.toString() || '';
                const moneda = getCellValue(sheetGastos, row, 2)?.toString() || 'USD';
                const monto = parseFloat(getCellValue(sheetGastos, row, 3)) || 0;

                // Solo procesar si tiene monto válido
                if (monto !== 0) {
                    // Convertir a ARS aplicando recargos si corresponde
                    let montoARS = monto;
                    const descLower = descripcion.toString().toLowerCase();
                    
                    // Determinar el tipo de cambio a usar (con o sin recargo)
                    let tcAplicar = datosGenerales.tc_usd;
                    if (moneda.toUpperCase() === 'EUR') {
                        tcAplicar = datosGenerales.tc_eur || datosGenerales.tc_usd;
                    }
                    
                    // Aplicar recargos adicionales según el tipo de gasto
                    if (descLower.includes('flete internacional')) {
                        tcAplicar = tcAplicar * (1 + (recargos.fleteInternacional || 0));
                    } else if (descLower.includes('transporte internacional')) {
                        tcAplicar = tcAplicar * (1 + (recargos.transporteInternacional || 0));
                    } else if (descLower.includes('marítima') || descLower.includes('maritima') || descLower.includes('agencia')) {
                        tcAplicar = tcAplicar * (1 + (recargos.maritimaAgencia || 0));
                    } else if (descLower.includes('gastos en origen')) {
                        tcAplicar = tcAplicar * (1 + (recargos.gastosOrigen || 0));
                    }
                    
                    // Convertir a ARS
                    if (moneda.toUpperCase() !== 'ARS') {
                        montoARS = monto * tcAplicar;
                    }

                    // Mapear a campo específico de gastos_aduana si coincide
                    const desc = descripcion.toString().toLowerCase();
                    if (desc.includes('despachante')) {
                        gastosAduanaData.despachante += montoARS;
                    } else if (desc.includes('senasa')) {
                        gastosAduanaData.gestion_senasa += montoARS;
                    } else if (desc.includes('anmat')) {
                        gastosAduanaData.gestion_anmat += montoARS;
                    } else if (desc.includes('transporte internacional')) {
                        gastosAduanaData.transporte_internacional += montoARS;
                    } else if (desc.includes('gastos en origen')) {
                        gastosAduanaData.gastos_origen += montoARS;
                    } else if (desc.includes('terminal')) {
                        gastosAduanaData.terminal += montoARS;
                    } else if (desc.includes('marítima') || desc.includes('agencia')) {
                        gastosAduanaData.maritima_agencia += montoARS;
                    } else if (desc.includes('bancarios')) {
                        gastosAduanaData.bancarios += montoARS;
                    } else if (desc.includes('gestor')) {
                        gastosAduanaData.gestor += montoARS;
                    } else if (desc.includes('transporte nacional')) {
                        gastosAduanaData.transporte_nacional += montoARS;
                    } else if (desc.includes('custodia')) {
                        gastosAduanaData.custodia += montoARS;
                    } else if (desc.includes('sim')) {
                        gastosAduanaData.sim += montoARS;
                    }

                    // Agregar a gastos varios
                    gastosVarios.push({
                        descripcion: descripcion.toString().trim(),
                        proveedor: proveedor,
                        moneda: moneda,
                        monto: monto,
                        monto_ars: montoARS
                    });

                    contador++;
                }

                row++;
            }

            // Verificar límite de gastos
            if (contador >= MAX_GASTOS) {
                const siguienteGasto = getCellValue(sheetGastos, row, 0);
                if (siguienteGasto && siguienteGasto !== '') {
                    return res.status(400).json({ 
                        error: 'El archivo tiene más de 50 gastos',
                        detalles: 'El sistema tiene un límite de 50 gastos por costeo',
                        sugerencia: 'Consolide gastos similares'
                    });
                }
            }
        }

        // Calcular total de gastos
        gastosAduanaData.total_gastos_ars = Object.values(gastosAduanaData).reduce((sum, val) => sum + val, 0);

        // GUARDAR EN BASE DE DATOS
        // Crear el costeo
        const costeo = await Costeo.create({
            ...datosGenerales,
            usuario_id: req.usuario.id,
            empresa_id: req.usuario.empresa_id || null,
            flete_usd: fleteAduana,
            seguro_usd: seguroAduana,
            estado: 'borrador'
        });

        // Crear artículos
        for (const art of articulos) {
            await ArticuloCosteo.create({
                ...art,
                costeo_id: costeo.id
            });
        }

        // Crear gastos de aduana
        await GastosAduana.create({
            ...gastosAduanaData,
            costeo_id: costeo.id
        });

        // Crear gastos varios
        for (const gasto of gastosVarios) {
            await GastosVarios.create({
                ...gasto,
                costeo_id: costeo.id
            });
        }

	// EJECUTAR CÁLCULOS AUTOMÁTICOS
        const models = { Costeo, ArticuloCosteo, GastosAduana, GastosVarios };
        await calcularCosteo(costeo.id, models);


        // Respuesta exitosa
        res.status(201).json({
            mensaje: 'Costeo importado exitosamente',
            costeo: {
                id: costeo.id,
                nombre: costeo.nombre_costeo,
                proveedor: costeo.proveedor,
                moneda: costeo.moneda_principal
            },
            estadisticas: {
                articulos_importados: articulos.length,
                gastos_importados: gastosVarios.length,
                flete_usd: fleteAduana,
                seguro_usd: seguroAduana
            }
        });

    } catch (error) {
        console.error('Error en importación:', error);
        res.status(500).json({ 
            error: 'Error al importar archivo',
            detalles: error.message 
        });
    }
};

// Obtener detalle de un costeo
const obtenerCosteo = async (req, res) => {
    try {
        const { id } = req.params;
        
        const costeo = await Costeo.findByPk(id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }
        
        const articulos = await ArticuloCosteo.findAll({ where: { costeo_id: id } });
        const gastosAduana = await GastosAduana.findOne({ where: { costeo_id: id } });
        const gastosVarios = await GastosVarios.findAll({ where: { costeo_id: id } });
        
        res.json({
            costeo,
            articulos,
            gastosAduana,
            gastosVarios
        });
    } catch (error) {
        console.error('Error al obtener costeo:', error);
        res.status(500).json({ error: 'Error al obtener costeo', detalles: error.message });
    }
};
// Calcular costeo
const calcular = async (req, res) => {
    try {
        const { id } = req.params;
        
        const CalculosService = require('../services/calculosService');
        const resultado = await CalculosService.calcularCosteo(id);
        
        res.json(resultado);
    } catch (error) {
        console.error('Error al calcular:', error);
        res.status(500).json({
            error: 'Error al calcular costeo',
            detalles: error.message
        });
    }
};
// Exportar costeo a Excel
const exportar = async (req, res) => {
    try {
        const { id } = req.params;
        
        const ExportarService = require('../services/exportarService');
        const resultado = await ExportarService.exportarCosteo(id);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
        res.send(resultado.buffer);
    } catch (error) {
        console.error('Error al exportar:', error);
        res.status(500).json({
            error: 'Error al exportar costeo',
            detalles: error.message
        });
    }
};

// Carga Manual de Costeo
const cargaManual = async (req, res) => {
    try {
        const datos = req.body;
        
        // Validaciones básicas
        if (!datos.nombre_costeo) {
            return res.status(400).json({ error: 'El nombre del costeo es obligatorio' });
        }
        if (!datos.proveedor) {
            return res.status(400).json({ error: 'El proveedor es obligatorio' });
        }
        if (!datos.articulos || datos.articulos.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un artículo' });
        } 

        // Crear el costeo
        const costeo = await Costeo.create({
            nombre_costeo: datos.nombre_costeo,
            proveedor: datos.proveedor,
            empresa_intermediaria: datos.empresa_intermediaria || null,
            factura_intermediaria: datos.factura_intermediaria || null,
            fecha_factura_intermediaria: datos.fecha_factura_intermediaria || null,
            factura_nro: datos.factura_nro || null,
            moneda_principal: datos.moneda_principal || 'USD',
            monto_factura: datos.monto_factura || 0,
            fecha_factura: datos.fecha_factura || null,
            fecha_vencimiento_factura: datos.fecha_vencimiento_factura || null,
            fecha_despacho: datos.fecha_despacho || null,
            nro_despacho: datos.nro_despacho || null,
            tc_usd: datos.tc_usd || null,
            tc_eur: datos.tc_eur || null,
            tc_gbp: datos.tc_gbp || null,
            fob_moneda: datos.fob_moneda || 'USD',
            fob_monto: datos.fob_monto || 0,
            flete_moneda: datos.flete_moneda || 'USD',
            flete_monto: datos.flete_monto || 0,
            seguro_moneda: datos.seguro_moneda || 'USD',
            seguro_monto: datos.seguro_monto || 0,
fob_parte: datos.fob_parte || 0,
            flete_parte: datos.flete_parte || 0,
            seguro_parte: datos.seguro_parte || 0,
            es_consolidado: datos.es_consolidado || false,
            volumen_m3: datos.volumen_m3 || null,
            peso_kg: datos.peso_kg || null,
            usuario_id: req.usuario.id,
            empresa_id: req.usuario.empresa_id || null,
            estado: 'borrador'
        });

        // Crear proveedores consolidado si es consolidado
        if (datos.es_consolidado && datos.proveedores_consolidado && datos.proveedores_consolidado.length > 0) {
            for (const p of datos.proveedores_consolidado) {
                if (p.nombre) {
                    await ConsolidadoProveedor.create({
                        costeo_id: costeo.id,
                        nombre_proveedor: p.nombre,
                        fob_total: parseFloat(p.fob_total) || 0,
                        moneda: p.moneda || 'USD',
                        volumen_m3: parseFloat(p.volumen_m3) || null,
                        peso_kg: parseFloat(p.peso_kg) || null
                    });
                }
            }
        }

        // Crear artículos
        for (const art of datos.articulos) {
            const unidadesTotales = (parseFloat(art.cantidad_cajas) || 0) * (parseFloat(art.unidades_por_caja) || 0);
            const valorUnitario = parseFloat(art.valor_unitario_intermediaria) || parseFloat(art.valor_unitario_origen) || 0;
            const importeTotal = unidadesTotales * valorUnitario;
            
            await ArticuloCosteo.create({
                costeo_id: costeo.id,
                codigo_goodies: art.codigo_goodies || 'S/COD',
                codigo_proveedor: art.codigo_proveedor || '',
                nombre: art.nombre,
                cantidad_cajas: parseFloat(art.cantidad_cajas) || 0,
                unidades_por_caja: parseFloat(art.unidades_por_caja) || 0,
                unidades_totales: unidadesTotales,
                moneda_origen: datos.moneda_principal || 'USD',
                valor_unitario_origen: valorUnitario,
                importe_total_origen: importeTotal,
                valor_proveedor_origen: parseFloat(art.valor_unitario_origen) || 0,
                derechos_porcentaje: parseFloat(art.derechos_porcentaje) || 0,
                impuesto_interno_porcentaje: parseFloat(art.impuesto_interno_porcentaje) || 0,
                aplica_anmat: art.aplica_anmat !== false,
                grupo: art.grupo || ''
            });
        }

       // Crear gastos
        if (datos.gastos && datos.gastos.length > 0) {
            for (const g of datos.gastos) {
                if (g.descripcion) {
                    const monedaGasto = (g.moneda || 'USD').toUpperCase();
                    const montoOriginal = parseFloat(g.monto) || 0;
                    const recargo = parseFloat(g.recargo) || 0;
                    
                    // Determinar TC según moneda
                    let tcGasto = 1;
                    if (monedaGasto === 'USD') {
                        tcGasto = parseFloat(datos.tc_usd) || 1;
                    } else if (monedaGasto === 'EUR') {
                        tcGasto = parseFloat(datos.tc_eur) || parseFloat(datos.tc_usd) || 1;
                    } else if (monedaGasto === 'GBP') {
                        tcGasto = parseFloat(datos.tc_gbp) || parseFloat(datos.tc_usd) || 1;
                    }
                    // Si es ARS, tcGasto queda en 1
                    
                    // Calcular monto en ARS con recargo
                    let montoARS = montoOriginal * tcGasto;
                    if (recargo > 0) {
                        montoARS = montoARS * (1 + recargo / 100);
                    }
                    
                    await GastosVarios.create({
                        costeo_id: costeo.id,
                        descripcion: g.descripcion,
                        proveedor_gasto: g.proveedor_gasto || '',
                        nro_comprobante: g.nro_comprobante || 'ESTIMADO',
                        moneda: monedaGasto,
                        monto: montoOriginal,
                        recargo: recargo,
                        grupo: g.grupo || '',
                        prorratear_consolidado: g.prorratear_consolidado || false,
                        monto_ars: montoARS,
                        observaciones: g.observaciones || ''
                    });
                }
            }
        }

        res.json({
            mensaje: 'Costeo guardado exitosamente',
            costeo: {
                id: costeo.id,
                nombre: costeo.nombre_costeo,
                proveedor: costeo.proveedor
            },
            estadisticas: {
                articulos: datos.articulos.length,
                gastos: datos.gastos ? datos.gastos.filter(g => g.descripcion).length : 0
            }
        });

    } catch (error) {
        console.error('Error en carga manual:', error);
        res.status(500).json({ error: 'Error al guardar costeo', detalles: error.message });
    }
};

// Precargar Excel sin guardar
const precargarExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }
        
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        
        // Verificar hojas
        const hojasRequeridas = ['DATOS_GENERALES', 'ARTICULOS', 'BASE_ADUANA_GASTOS'];
        const hojasExistentes = workbook.SheetNames;
        
        for (const hoja of hojasRequeridas) {
            if (!hojasExistentes.includes(hoja)) {
                return res.status(400).json({ 
                    error: `Falta la hoja requerida: ${hoja}`,
                    hojasEncontradas: hojasExistentes
                });
            }
        }
        
        // Leer DATOS_GENERALES
        const sheetDatosGenerales = workbook.Sheets['DATOS_GENERALES'];
        
        const datosGenerales = {
            nombre_costeo: buscarCampo(sheetDatosGenerales, 'Nombre del costeo'),
            proveedor: buscarCampo(sheetDatosGenerales, 'Proveedor de origen'),
            factura_nro: buscarCampo(sheetDatosGenerales, 'Factura nro'),
            fecha_factura: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Factura')),
            fecha_vencimiento_factura: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Vencimiento')),
            fecha_despacho: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Despacho')),
            moneda_principal: buscarCampo(sheetDatosGenerales, 'Moneda principal de factura'),
            monto_factura: parseFloat(buscarCampo(sheetDatosGenerales, 'MONTO')) || 0,
           tc_usd: parseFloat(buscarCampo(sheetDatosGenerales, 'USD')) || 1,
            tc_eur: parseFloat(buscarCampo(sheetDatosGenerales, 'EUR')) || null,
            tc_gbp: parseFloat(buscarCampo(sheetDatosGenerales, 'GBP')) || null,
            tc_ars: parseFloat(buscarCampo(sheetDatosGenerales, 'ARS')) || 1,
            empresa_intermediaria: buscarCampo(sheetDatosGenerales, 'Empresa Intermediaria') || null,
            factura_intermediaria: buscarCampo(sheetDatosGenerales, 'Nro Factura Intermediaria')?.toString() || null,
            fecha_factura_intermediaria: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Factura Intermediaria')),
            fecha_vencimiento_intermediaria: convertirFechaExcel(buscarCampo(sheetDatosGenerales, 'Fecha Vencimiento intermediaria'))
        };
        
        // Leer ARTICULOS
        const sheetArticulos = workbook.Sheets['ARTICULOS'];
        const articulos = [];
        
        let row = 3;
        const MAX_ARTICULOS = 100;
        
        while (row < MAX_ARTICULOS + 4) {
            const codigo = getCellValue(sheetArticulos, row, 0);
            if (!codigo || codigo === '') break;
            
            const articulo = {
                codigo_goodies: codigo.toString().trim(),
                codigo_proveedor: getCellValue(sheetArticulos, row, 1)?.toString() || '',
                nombre: getCellValue(sheetArticulos, row, 2)?.toString() || '',
                cantidad_cajas: parseFloat(getCellValue(sheetArticulos, row, 3)) || 0,
                unidades_por_caja: parseFloat(getCellValue(sheetArticulos, row, 4)) || 0,
                valor_unitario_origen: parseFloat(getCellValue(sheetArticulos, row, 6)) || 0,
                derechos_porcentaje: parseFloat(getCellValue(sheetArticulos, row, 8)) || 0,
                impuesto_interno_porcentaje: parseFloat(getCellValue(sheetArticulos, row, 9)) || 0
            };
            
            if (articulo.nombre) {
                articulos.push(articulo);
            }
            row++;
        }
        
        // Leer GASTOS
        const sheetGastos = workbook.Sheets['BASE_ADUANA_GASTOS'];
        const gastos = [];
        
        // Buscar Flete y Seguro Aduana
        let flete_monto = 0;
        let seguro_monto = 0;
        let flete_moneda = 'USD';
        let seguro_moneda = 'USD';
        
        for (let r = 0; r < 20; r++) {
            const desc = getCellValue(sheetGastos, r, 0)?.toString()?.toLowerCase() || '';
            if (desc.includes('flete') && desc.includes('aduana')) {
                flete_moneda = getCellValue(sheetGastos, r, 1)?.toString() || 'USD';
                flete_monto = parseFloat(getCellValue(sheetGastos, r, 2)) || 0;
            }
            if (desc.includes('seguro') && desc.includes('aduana')) {
                seguro_moneda = getCellValue(sheetGastos, r, 1)?.toString() || 'USD';
                seguro_monto = parseFloat(getCellValue(sheetGastos, r, 2)) || 0;
            }
        }
        
       // Buscar gastos varios - empiezan en fila 12 (índice 11)
        const gastosStartRow = 11;
        
        // Detectar formato: NUEVO (7 columnas) o VIEJO (4 columnas)
        const colB = getCellValue(sheetGastos, gastosStartRow, 1)?.toString()?.toLowerCase() || '';
        const esFormatoNuevo = colB.includes('proveedor') || getCellValue(sheetGastos, 11, 4) !== null;
        
        for (let r = gastosStartRow; r < gastosStartRow + 50; r++) {
            const descripcion = getCellValue(sheetGastos, r, 0)?.toString() || '';
            if (!descripcion || descripcion === '' || descripcion.toLowerCase().includes('total')) break;
            
            let gasto;
            
            // Detectar si esta fila tiene datos en columna E (formato nuevo) o columna D (formato viejo)
            const valorColE = getCellValue(sheetGastos, r, 4);
            const valorColD = getCellValue(sheetGastos, r, 3);
            
            if (valorColE !== null && valorColE !== '' && !isNaN(parseFloat(valorColE))) {
                // Formato NUEVO: A=Desc, B=Prov, C=Comprob, D=Moneda, E=Monto, F=Recargo, G=Obs
                gasto = {
                    descripcion: descripcion,
                    proveedor_gasto: getCellValue(sheetGastos, r, 1)?.toString() || '',
                    nro_comprobante: getCellValue(sheetGastos, r, 2)?.toString() || '',
                    moneda: getCellValue(sheetGastos, r, 3)?.toString() || 'USD',
                    monto: parseFloat(getCellValue(sheetGastos, r, 4)) || 0,
                    recargo: parseFloat(getCellValue(sheetGastos, r, 5)) || 0,
                    observaciones: getCellValue(sheetGastos, r, 6)?.toString() || ''
                };
            } else {
                // Formato VIEJO: A=Prov/Gasto, B=Fact/Tipo, C=Moneda, D=Importe
                gasto = {
                    descripcion: descripcion,
                    proveedor_gasto: '',
                    nro_comprobante: getCellValue(sheetGastos, r, 1)?.toString() || '',
                    moneda: getCellValue(sheetGastos, r, 2)?.toString() || 'USD',
                    monto: parseFloat(getCellValue(sheetGastos, r, 3)) || 0,
                    recargo: 0,
                    observaciones: ''
                };
            }
            
            if (gasto.monto > 0 || gasto.monto < 0) {
                gastos.push(gasto);
            }
        }
        
        res.json({
            ...datosGenerales,
            fob_moneda: datosGenerales.moneda_principal || 'USD',
            fob_monto: datosGenerales.monto_factura || 0,
            flete_moneda,
            flete_monto,
            seguro_moneda,
            seguro_monto,
            articulos,
            gastos
        });
        
    } catch (error) {
        console.error('Error al precargar Excel:', error);
        res.status(500).json({ error: 'Error al leer archivo Excel', detalles: error.message });
    }
};
module.exports = {
    importarExcel,
    obtenerCosteo,
    calcular,
    exportar,
    cargaManual,
    precargarExcel
};