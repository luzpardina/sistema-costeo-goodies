// =============================================
// MÓDULO CONTABLE - Valuaciones
// =============================================


    // =============================================
    // MÓDULO CONTABLE - VALUACIONES
    // =============================================
    async function cargarRevaluacionesDisponibles() {
        try {
            const resp = await fetch(API_URL + '/api/contable/revaluaciones-disponibles', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!resp.ok) {
                console.error('Error cargando revaluaciones:', resp.status, resp.statusText);
                return;
            }
            const revs = await resp.json();
            const sel = document.getElementById('valRevaluacion');
            if (!sel) return;
            const arr = Array.isArray(revs) ? revs : [];
            sel.innerHTML = '<option value="">Último costo original</option>' +
                arr.map(r => '<option value="' + r.id + '">' + (r.motivo || 'Sin motivo') + ' (' + new Date(r.fecha_revaluacion).toLocaleDateString('es-AR') + ') - TC USD: ' + r.tc_usd_nuevo + '</option>').join('');
        } catch(e) { console.error('Error cargando revaluaciones:', e); }
    }

    var articulosCentumCargados = [];

    async function parsearExcelCentum() {
        const fileInput = document.getElementById('valExcelFile');
        const file = fileInput.files[0];
        if (!file) { alert('Seleccioná un archivo Excel'); return; }

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const resp = await fetch(API_URL + '/api/contable/parsear-excel', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });
            const data = await resp.json();
            if (data.error) { alert('Error: ' + data.error); return; }

            articulosCentumCargados = data.articulos;
            const preview = document.getElementById('valExcelPreview');
            preview.innerHTML = '<div style="background:#1a3a1a;border:1px solid #4CAF50;padding:10px;border-radius:5px;">' +
                '<span style="color:#4CAF50;font-weight:bold;">✅ ' + data.total_articulos + ' artículos cargados desde "' + data.hoja + '"</span>' +
                '<div style="max-height:200px;overflow-y:auto;margin-top:10px;"><table><thead><tr><th>Código</th><th>Nombre</th><th>Cantidad</th><th>Costo Unit</th><th>Costo Total</th></tr></thead><tbody>' +
                data.articulos.slice(0, 20).map(a => '<tr><td>' + a.codigo_goodies + '</td><td>' + a.descripcion + '</td><td>' + a.cantidad + '</td><td>$' + a.costo_unit_contable.toFixed(2) + '</td><td>$' + a.costo_total_contable.toFixed(2) + '</td></tr>').join('') +
                (data.articulos.length > 20 ? '<tr><td colspan="5" style="color:#888;">... y ' + (data.articulos.length - 20) + ' más</td></tr>' : '') +
                '</tbody></table></div></div>';
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function crearValuacion() {
        const nombre = document.getElementById('valNombre').value;
        if (!nombre) { alert('Ingresá un nombre para la valuación'); return; }

        const revaluacion_id = document.getElementById('valRevaluacion').value || null;
        var articulos_centum = [];

        if (articulosCentumCargados.length > 0) {
            articulos_centum = articulosCentumCargados;
        } else {
            alert('Subí un archivo Excel de Centum primero'); return;
        }

        if (articulos_centum.length === 0) { alert('No se encontraron artículos válidos.'); return; }

        try {
            const resp = await fetch(API_URL + '/api/contable/valuaciones', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, revaluacion_id, articulos_centum })
            });
            const data = await resp.json();
            if (data.error) { alert('Error: ' + data.error); return; }
            renderResultadoValuacion(data);
            cargarHistorialValuaciones();
            articulosCentumCargados = [];
        } catch(e) { alert('Error: ' + e.message); }
    }

    var ultimaValuacionData = null;

    function renderResultadoValuacion(data) {
        ultimaValuacionData = data;
        document.getElementById('resultadoValuacionCard').style.display = 'block';

        const res = data.resumen || data.valuacion;
        const resDiv = document.getElementById('resumenValuacion');
        const totalContable = parseFloat(res.total_contable) || 0;
        const totalRevaluado = parseFloat(res.total_revaluado) || 0;
        const diferencia = parseFloat(res.diferencia) || 0;
        const det = data.detalle || [];
        const artNoEncontrado = res.art_no_encontrado || det.filter(d => d.estado === 'NO ENCONTRADO').length;
        const artSinCostoSist = res.art_sin_costo_sistema || det.filter(d => d.estado === 'SIN COSTO SISTEMA').length;
        const artSinCostoCont = res.art_sin_costo_contable || det.filter(d => d.estado === 'SIN COSTO CONTABLE').length;
        const colorDif = diferencia >= 0 ? '#4CAF50' : '#f44336';

        resDiv.innerHTML = 
            '<div style="padding:15px;background:#2a2a3e;border-radius:8px;"><div style="color:#888;font-size:12px;">Total Contable</div><div style="color:#fff;font-size:20px;font-weight:bold;">$' + totalContable.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</div></div>' +
            '<div style="padding:15px;background:#2a2a3e;border-radius:8px;"><div style="color:#888;font-size:12px;">Total Sistema</div><div style="color:#2196F3;font-size:20px;font-weight:bold;">$' + totalRevaluado.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</div></div>' +
            '<div style="padding:15px;background:#2a2a3e;border-radius:8px;"><div style="color:#888;font-size:12px;">Diferencia</div><div style="color:' + colorDif + ';font-size:20px;font-weight:bold;">$' + diferencia.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</div></div>' +
            '<div style="padding:15px;background:#2a2a3e;border-radius:8px;"><div style="color:#888;font-size:12px;">Comparados OK</div><div style="color:#fff;font-size:14px;">+ ' + (res.art_dif_positiva || 0) + ' / - ' + (res.art_dif_negativa || 0) + '</div></div>' +
            '<div style="padding:15px;background:' + (artNoEncontrado > 0 ? '#3a1a1a;border:1px solid #f44336' : '#2a2a3e') + ';border-radius:8px;"><div style="color:#888;font-size:12px;">NO ENCONTRADO en Sist.</div><div style="color:' + (artNoEncontrado > 0 ? '#f44336' : '#4CAF50') + ';font-size:20px;font-weight:bold;">' + artNoEncontrado + '</div></div>' +
            '<div style="padding:15px;background:' + (artSinCostoSist > 0 ? '#3a2a1a;border:1px solid #ff9800' : '#2a2a3e') + ';border-radius:8px;"><div style="color:#888;font-size:12px;">Sin Costo Sistema</div><div style="color:' + (artSinCostoSist > 0 ? '#ff9800' : '#4CAF50') + ';font-size:20px;font-weight:bold;">' + artSinCostoSist + '</div></div>' +
            '<div style="padding:15px;background:' + (artSinCostoCont > 0 ? '#1a2a3a;border:1px solid #2196F3' : '#2a2a3e') + ';border-radius:8px;"><div style="color:#888;font-size:12px;">Sin Costo Contable</div><div style="color:' + (artSinCostoCont > 0 ? '#2196F3' : '#4CAF50') + ';font-size:20px;font-weight:bold;">' + artSinCostoCont + '</div></div>';

        const body = document.getElementById('valuacionDetalleBody');
        body.innerHTML = det.map(function(d) {
            var colorPct = d.diferencia_pct > 0 ? '#4CAF50' : d.diferencia_pct < 0 ? '#f44336' : '#888';
            var est = d.estado || 'OK';
            var estadoBadge = '<span style="color:#4CAF50;font-size:11px;">OK</span>';
            var rowStyle = '';
            if (est === 'NO ENCONTRADO') {
                estadoBadge = '<span style="background:#f44336;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;">NO ENCONTRADO</span>';
                rowStyle = 'background:rgba(244,67,54,0.1);';
            } else if (est === 'SIN COSTO SISTEMA') {
                estadoBadge = '<span style="background:#ff9800;color:#000;padding:2px 6px;border-radius:3px;font-size:10px;">SIN COSTO SIST.</span>';
                rowStyle = 'background:rgba(255,152,0,0.1);';
            } else if (est === 'SIN COSTO CONTABLE') {
                estadoBadge = '<span style="background:#2196F3;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;">SIN COSTO CONT.</span>';
                rowStyle = 'background:rgba(33,150,243,0.1);';
            } else if (est.indexOf('MATCH NOMBRE') >= 0) {
                estadoBadge = '<span style="background:#9C27B0;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;">MATCH NOMBRE</span>';
            }
            var sinDatos = est === 'NO ENCONTRADO';
            var fechaDesp = d.fecha_despacho_origen ? new Date(d.fecha_despacho_origen).toLocaleDateString('es-AR') : '-';
            var legajo = d.nombre_costeo_origen || '-';
            return '<tr style="' + rowStyle + '">' +
                '<td>' + estadoBadge + '</td>' +
                '<td>' + d.codigo_goodies + '</td><td>' + (d.descripcion || '') + '</td><td>' + d.cantidad + '</td>' +
                '<td>$' + parseFloat(d.costo_unit_contable).toFixed(2) + '</td><td>$' + parseFloat(d.costo_total_contable).toFixed(2) + '</td>' +
                '<td>' + (sinDatos ? '-' : '$' + parseFloat(d.costo_unit_revaluado).toFixed(2)) + '</td>' +
                '<td>' + (sinDatos ? '-' : '$' + parseFloat(d.costo_total_revaluado).toFixed(2)) + '</td>' +
                '<td style="color:' + colorPct + '">' + (sinDatos ? '-' : '$' + parseFloat(d.diferencia_unit).toFixed(2)) + '</td>' +
                '<td style="color:' + colorPct + '">' + (sinDatos ? '-' : '$' + parseFloat(d.diferencia_total).toFixed(2)) + '</td>' +
                '<td style="color:' + colorPct + ';font-weight:bold;">' + (sinDatos ? '-' : parseFloat(d.diferencia_pct).toFixed(1) + '%') + '</td>' +
                '<td style="font-size:11px;color:#aaa;">' + legajo + '</td>' +
                '<td style="font-size:11px;color:#aaa;">' + fechaDesp + '</td>' +
                '</tr>';
        }).join('');
    }


    async function cargarHistorialValuaciones() {
        try {
            const resp = await fetch(API_URL + '/api/contable/valuaciones', { headers: { 'Authorization': 'Bearer ' + token } });
            const valuaciones = await resp.json();
            const body = document.getElementById('historialValuacionesBody');
            if (!body) return;
            body.innerHTML = valuaciones.map(v => `<tr>
                <td>${new Date(v.created_at).toLocaleDateString()}</td>
                <td>${v.nombre}</td>
                <td>$${parseFloat(v.total_contable).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                <td>$${parseFloat(v.total_revaluado).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                <td style="color:${parseFloat(v.diferencia) >= 0 ? '#4CAF50' : '#f44336'}">$${parseFloat(v.diferencia).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                <td>${v.cantidad_articulos}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-secondary" onclick="verValuacion('${v.id}')">👁️</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarValuacion('${v.id}')">🗑️</button>
                </td>
            </tr>`).join('');
        } catch(e) { console.error('Error:', e); }
    }

    async function verValuacion(id) {
        try {
            const resp = await fetch(API_URL + '/api/contable/valuaciones/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            renderResultadoValuacion({ valuacion: data.valuacion, detalle: data.detalle, resumen: data.valuacion });
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function eliminarValuacion(id) {
        if (!confirm('¿Eliminar esta valuación?')) return;
        await fetch(API_URL + '/api/contable/valuaciones/' + id, {
            method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
        });
        cargarHistorialValuaciones();
    }

    function exportarValuacion() {
        if (!ultimaValuacionData) { alert('No hay valuacion para exportar.'); return; }
        var data = ultimaValuacionData;
        var res = data.resumen || data.valuacion;
        var detalle = data.detalle || [];
        var artNoEnc = detalle.filter(function(d){return d.estado==='NO ENCONTRADO';}).length;
        var artSinSist = detalle.filter(function(d){return d.estado==='SIN COSTO SISTEMA';}).length;
        var artSinCont = detalle.filter(function(d){return d.estado==='SIN COSTO CONTABLE';}).length;

        var resumenData = [
            ['VALUACION DE INVENTARIO - GOODIES S.A.'],
            ['Nombre:', res.nombre || ''],
            ['Fecha:', new Date().toLocaleDateString('es-AR')],
            [],
            ['Total Contable', 'Total Sistema', 'Diferencia', 'Articulos', 'Dif Positiva', 'Dif Negativa', 'No Encontrado', 'Sin Costo Sistema', 'Sin Costo Contable'],
            [parseFloat(res.total_contable)||0, parseFloat(res.total_revaluado)||0, parseFloat(res.diferencia)||0,
             res.cantidad_articulos||detalle.length, res.art_dif_positiva||0, res.art_dif_negativa||0,
             artNoEnc, artSinSist, artSinCont]
        ];

        var detalleData = [
            ['Estado', 'Codigo Inventario', 'Descripcion Inventario', 'Cantidad',
             'Costo Unit Contable', 'Costo Total Contable', 'Costo Unit Sistema', 'Costo Total Sistema',
             'Dif Unitaria', 'Dif Total', 'Dif %',
             'Legajo Origen', 'Fecha Despacho', 'Nro Despacho', 'Proveedor']
        ];
        detalle.forEach(function(d) {
            var fechaDesp = d.fecha_despacho_origen ? new Date(d.fecha_despacho_origen).toLocaleDateString('es-AR') : '';
            detalleData.push([
                d.estado || 'OK', d.codigo_goodies, d.descripcion, parseFloat(d.cantidad)||0,
                parseFloat(d.costo_unit_contable)||0, parseFloat(d.costo_total_contable)||0,
                parseFloat(d.costo_unit_revaluado)||0, parseFloat(d.costo_total_revaluado)||0,
                parseFloat(d.diferencia_unit)||0, parseFloat(d.diferencia_total)||0, parseFloat(d.diferencia_pct)||0,
                d.nombre_costeo_origen||'', fechaDesp, d.nro_despacho_origen||'', d.proveedor_origen||''
            ]);
        });
        detalleData.push([]);
        detalleData.push(['TOTALES','','','', '', parseFloat(res.total_contable)||0, '', parseFloat(res.total_revaluado)||0, '', parseFloat(res.diferencia)||0]);

        var noEncData = [['ARTICULOS EN INVENTARIO NO ENCONTRADOS EN SISTEMA DE COSTOS'],[],
            ['Codigo','Descripcion','Cantidad','Costo Unit Contable','Costo Total Contable']];
        detalle.filter(function(d){return d.estado==='NO ENCONTRADO';}).forEach(function(d){
            noEncData.push([d.codigo_goodies, d.descripcion, parseFloat(d.cantidad)||0, parseFloat(d.costo_unit_contable)||0, parseFloat(d.costo_total_contable)||0]);
        });

        var sinSistData = [['ARTICULOS CON COSTO $0 EN SISTEMA'],[],
            ['Codigo','Descripcion','Cantidad','Costo Unit Contable','Costo Total Contable','Legajo','Fecha Despacho']];
        detalle.filter(function(d){return d.estado==='SIN COSTO SISTEMA';}).forEach(function(d){
            var fd = d.fecha_despacho_origen ? new Date(d.fecha_despacho_origen).toLocaleDateString('es-AR') : '';
            sinSistData.push([d.codigo_goodies, d.descripcion, parseFloat(d.cantidad)||0, parseFloat(d.costo_unit_contable)||0, parseFloat(d.costo_total_contable)||0, d.nombre_costeo_origen||'', fd]);
        });

        var sinContData = [['ARTICULOS CON COSTO $0 EN CONTABILIDAD (CENTUM)'],[],
            ['Codigo','Descripcion','Cantidad','Costo Unit Sistema','Costo Total Sistema','Legajo','Fecha Despacho']];
        detalle.filter(function(d){return d.estado==='SIN COSTO CONTABLE';}).forEach(function(d){
            var fd = d.fecha_despacho_origen ? new Date(d.fecha_despacho_origen).toLocaleDateString('es-AR') : '';
            sinContData.push([d.codigo_goodies, d.descripcion, parseFloat(d.cantidad)||0, parseFloat(d.costo_unit_revaluado)||0, parseFloat(d.costo_total_revaluado)||0, d.nombre_costeo_origen||'', fd]);
        });

        var wb = XLSX.utils.book_new();
        var wsRes = XLSX.utils.aoa_to_sheet(resumenData);
        var wsDet = XLSX.utils.aoa_to_sheet(detalleData);
        wsDet['!cols'] = [{wch:16},{wch:18},{wch:40},{wch:10},{wch:16},{wch:18},{wch:16},{wch:18},{wch:12},{wch:14},{wch:8},{wch:25},{wch:14},{wch:18},{wch:20}];
        XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
        XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle');
        if (noEncData.length > 3) { var ws1 = XLSX.utils.aoa_to_sheet(noEncData); ws1['!cols']=[{wch:18},{wch:45},{wch:10},{wch:16},{wch:18}]; XLSX.utils.book_append_sheet(wb, ws1, 'No Encontrados'); }
        if (sinSistData.length > 3) { var ws2 = XLSX.utils.aoa_to_sheet(sinSistData); ws2['!cols']=[{wch:18},{wch:45},{wch:10},{wch:16},{wch:18},{wch:25},{wch:14}]; XLSX.utils.book_append_sheet(wb, ws2, 'Sin Costo Sistema'); }
        if (sinContData.length > 3) { var ws3 = XLSX.utils.aoa_to_sheet(sinContData); ws3['!cols']=[{wch:18},{wch:45},{wch:10},{wch:16},{wch:18},{wch:25},{wch:14}]; XLSX.utils.book_append_sheet(wb, ws3, 'Sin Costo Contable'); }
        var okData = [['ARTICULOS CON COSTO CONTABLE Y COSTO EN SISTEMA (OK)'],[],
            ['Codigo','Descripcion','Cantidad','Costo Unit Contable','Costo Total Contable','Costo Unit Sistema','Costo Total Sistema','Dif Unitaria','Dif Total','Dif %','Legajo','Fecha Despacho']];
        detalle.filter(function(d){var e=d.estado||'';return e==='OK'||e.indexOf('MATCH NOMBRE')>=0;}).forEach(function(d){
            var fd = d.fecha_despacho_origen ? new Date(d.fecha_despacho_origen).toLocaleDateString('es-AR') : '';
            okData.push([d.codigo_goodies, d.descripcion, parseFloat(d.cantidad)||0, parseFloat(d.costo_unit_contable)||0, parseFloat(d.costo_total_contable)||0, parseFloat(d.costo_unit_revaluado)||0, parseFloat(d.costo_total_revaluado)||0, parseFloat(d.diferencia_unit)||0, parseFloat(d.diferencia_total)||0, parseFloat(d.diferencia_pct)||0, d.nombre_costeo_origen||'', fd]);
        });
        if (okData.length > 3) { var ws4 = XLSX.utils.aoa_to_sheet(okData); ws4['!cols']=[{wch:18},{wch:45},{wch:10},{wch:16},{wch:18},{wch:16},{wch:18},{wch:12},{wch:14},{wch:8},{wch:25},{wch:14}]; XLSX.utils.book_append_sheet(wb, ws4, 'OK Comparados'); }

        var nombreArchivo = 'Valuacion_' + (res.nombre || 'inventario').replace(/[^a-zA-Z0-9]/g, '_') + '.xlsx';
        XLSX.writeFile(wb, nombreArchivo);
    }

    // Cargar artículos en el select del simulador
