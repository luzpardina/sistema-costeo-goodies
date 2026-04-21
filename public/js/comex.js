// =============================================
// MÓDULO COMEX - Costeos, Revaluaciones, Catálogo
// =============================================

        async function cargarUltimosCostos() {
            const loading = document.getElementById('articulosLoading');
            loading.classList.add('show');
            try {
                const res = await fetch(API_URL + '/api/costeos/ultimos-costos', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (res.ok && Array.isArray(data)) {
                    todosLosArticulos = data;
                    actualizarDropdownProveedorArticulo();
                    filtrarArticulos();
                }
            } catch (err) { console.error(err); }
            finally { loading.classList.remove('show'); }
        }

        async function actualizarDropdownProveedorArticulo() {
            // Usar catálogo activo para dropdowns de Último Costo también
            try {
                const [resProv, resFab, resMar] = await Promise.all([
                    fetch(window.location.origin + '/api/maestro/proveedores', { headers: { 'Authorization': 'Bearer ' + token } }),
                    fetch(window.location.origin + '/api/maestro/fabricantes', { headers: { 'Authorization': 'Bearer ' + token } }),
                    fetch(window.location.origin + '/api/maestro/marcas', { headers: { 'Authorization': 'Bearer ' + token } })
                ]);
                const provs = resProv.ok ? await resProv.json() : [];
                const fabs = resFab.ok ? await resFab.json() : [];
                const mars = resMar.ok ? await resMar.json() : [];
                const dlProv = document.getElementById('listaProveedoresArticulo');
                if (dlProv) dlProv.innerHTML = [...new Set(provs)].sort().map(p => '<option value="' + p + '">').join('');
                const dlFab = document.getElementById('listaFabricantesArticulo');
                if (dlFab) dlFab.innerHTML = [...new Set(fabs)].sort().map(f => '<option value="' + f + '">').join('');
                const dlMar = document.getElementById('listaMarcasArticulo');
                if (dlMar) dlMar.innerHTML = [...new Set(mars)].sort().map(m => '<option value="' + m + '">').join('');
            } catch(e) { console.error('Error cargando dropdowns artículos:', e); }
        }

        function cascadaFiltrosUltimoCosto() {
            const arts = todosLosArticulos || [];
            if (arts.length === 0) return;
            const prov = document.getElementById('filtroProveedorArticulo').value.trim().toLowerCase();
            const fab = document.getElementById('filtroFabricanteArticulo').value.trim().toLowerCase();
            
            var artsFab = [...arts];
            if (prov) artsFab = artsFab.filter(a => a.proveedor && a.proveedor.toLowerCase().includes(prov));
            document.getElementById('listaFabricantesArticulo').innerHTML = [...new Set(artsFab.map(a => a.empresa_fabrica).filter(f => f))].sort().map(f => '<option value="' + f + '">').join('');
            
            var artsMarca = [...arts];
            if (prov) artsMarca = artsMarca.filter(a => a.proveedor && a.proveedor.toLowerCase().includes(prov));
            if (fab) artsMarca = artsMarca.filter(a => a.empresa_fabrica && a.empresa_fabrica.toLowerCase().includes(fab));
            document.getElementById('listaMarcasArticulo').innerHTML = [...new Set(artsMarca.map(a => a.marca).filter(m => m))].sort().map(m => '<option value="' + m + '">').join('');
        }

        function filtrarArticulos() {
            const busqueda = document.getElementById('buscarArticulo').value.toLowerCase();
            const proveedor = document.getElementById('filtroProveedorArticulo').value;
            const fabricante = document.getElementById('filtroFabricanteArticulo').value;
            const marca = document.getElementById('filtroMarcaArticulo').value;
            
            articulosFiltrados = todosLosArticulos.filter(a => {
                const coincideBusqueda = !busqueda || 
                    (a.codigo_goodies || '').toLowerCase().includes(busqueda) ||
                    (a.nombre || '').toLowerCase().includes(busqueda);
                const coincideProveedor = !proveedor || (a.proveedor && a.proveedor.toLowerCase().includes(proveedor.toLowerCase()));
                const coincideFabricante = !fabricante || (a.empresa_fabrica && a.empresa_fabrica.toLowerCase().includes(fabricante.toLowerCase()));
                const coincideMarca = !marca || (a.marca && a.marca.toLowerCase().includes(marca.toLowerCase()));
                return coincideBusqueda && coincideProveedor && coincideFabricante && coincideMarca;
            });
            
            renderizarArticulosUltimoCosto(articulosFiltrados);
        }

        function renderizarArticulosUltimoCosto(articulos) {
            const tbody = document.getElementById('articulosUltimoCostoBody');
            if (articulos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;">No hay artículos</td></tr>';
                return;
            }
            tbody.innerHTML = articulos.map(art => {
                const tcInfo = [];
                if (art.tc_usd) tcInfo.push('USD: ' + art.tc_usd);
                if (art.tc_eur) tcInfo.push('EUR: ' + art.tc_eur);
                if (art.tc_gbp) tcInfo.push('GBP: ' + art.tc_gbp);
                
                const colorDifCosto = art.diferencia_pct > 0 ? '#f44336' : art.diferencia_pct < 0 ? '#4CAF50' : '#fff';
                
                return '<tr>' +
                    '<td><input type="checkbox" class="art-check" value="' + (art.codigo_goodies || '') + '" onchange="actualizarSeleccion()"></td>' +
                    '<td>' + (art.codigo_goodies || '-') + '</td>' +
                    '<td>' + (art.proveedor || '-') + '</td>' +
                    '<td>' + (art.nombre || '-') + '</td>' +
                    '<td>' + (art.moneda_fob || '-') + '</td>' +
                    '<td>' + (art.valor_fob ? parseFloat(art.valor_fob).toFixed(2) : '-') + '</td>' +
                    '<td>$' + (art.costo_neto ? parseFloat(art.costo_neto).toLocaleString('es-AR', {minimumFractionDigits: 2}) : '-') + '</td>' +
                    '<td>$' + (art.costo_anterior ? parseFloat(art.costo_anterior).toLocaleString('es-AR', {minimumFractionDigits: 2}) : '-') + '</td>' +
                    '<td style="color:' + colorDifCosto + ';font-weight:bold;">' + (art.diferencia_pct !== null ? (art.diferencia_pct > 0 ? '+' : '') + art.diferencia_pct.toFixed(2) + '%' : '-') + '</td>' +
                    '<td>' + formatearFecha(art.fecha_despacho) + '</td>' +
                    '<td>' + (art.nombre_costeo || '-') + '</td>' +
                    '<td><button class="btn btn-secondary btn-sm" onclick="verDetalleArticulo(\'' + art.codigo_goodies + '\')">Ver</button> <button class="btn btn-sm" style="background:#2a2a3e;border:1px solid #4fc3f7;color:#4fc3f7;" onclick="verHistorial(\'' + art.codigo_goodies + '\')" title="Ver historial de costos">📈</button></td>' +
                    '</tr>';
            }).join('');
        }
        
// ========== REVALUACIONES ==========
        var revaluacionActualId = null;
        
        var revCatalogoArts = [];

        function abrirModalRevaluar() {
            // Verificar si hay costeos seleccionados
            const seleccionados = document.querySelectorAll('.costeo-check:checked');
            if (seleccionados.length > 0) {
                document.getElementById('revaluarInfo').textContent = `Se revaluarán los artículos de ${seleccionados.length} costeo(s) seleccionado(s)`;
            } else {
                document.getElementById('revaluarInfo').textContent = 'Se revaluarán todos los artículos (último costo de cada uno)';
            }
            
            // Limpiar campos
            document.getElementById('rev_motivo').value = '';
            document.getElementById('rev_otroMotivo').value = '';
            document.getElementById('rev_soloContable').checked = false;
            document.getElementById('rev_tcUsd').value = '';
            document.getElementById('rev_tcEur').value = '';
            document.getElementById('rev_tcGbp').value = '';
            document.getElementById('rev_filtroProveedor').value = '';
            document.getElementById('rev_filtroFabrica').value = '';
            document.getElementById('rev_filtroMarca').value = '';
            
            // Poblar datalists — usar catálogo local si disponible, si no cargar del API
            var arts = todosLosArticulos || [];
            if (arts.length > 0) {
                revCatalogoArts = arts;
                poblarDatalistsRevaluacion(arts);
            } else {
                fetch(API_URL + '/api/maestro/stats', { headers: { 'Authorization': 'Bearer ' + token } })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.proveedores) document.getElementById('rev_listaProveedores').innerHTML = data.proveedores.map(function(p){return '<option value="'+p+'">';}).join('');
                        if (data.fabricantes) document.getElementById('rev_listaFabricas').innerHTML = data.fabricantes.map(function(f){return '<option value="'+f+'">';}).join('');
                        if (data.marcas) document.getElementById('rev_listaMarcas').innerHTML = data.marcas.map(function(m){return '<option value="'+m+'">';}).join('');
                    })
                    .catch(function() {});
            }
            
            document.getElementById('revaluarModal').style.display = 'flex';
        }

        function poblarDatalistsRevaluacion(arts) {
            var provs = [...new Set(arts.map(function(a){return a.proveedor;}).filter(function(p){return p;}))].sort();
            var fabs = [...new Set(arts.map(function(a){return a.empresa_fabrica;}).filter(function(f){return f;}))].sort();
            var marcas = [...new Set(arts.map(function(a){return a.marca;}).filter(function(m){return m;}))].sort();
            document.getElementById('rev_listaProveedores').innerHTML = provs.map(function(p){return '<option value="'+p+'">';}).join('');
            document.getElementById('rev_listaFabricas').innerHTML = fabs.map(function(f){return '<option value="'+f+'">';}).join('');
            document.getElementById('rev_listaMarcas').innerHTML = marcas.map(function(m){return '<option value="'+m+'">';}).join('');
        }

        function cascadaFiltrosRevaluacion() {
            if (revCatalogoArts.length === 0) return;
            var prov = document.getElementById('rev_filtroProveedor').value.trim();
            var fab = document.getElementById('rev_filtroFabrica').value.trim();
            
            var filtered = revCatalogoArts;
            if (prov) filtered = filtered.filter(function(a) { return a.proveedor === prov; });
            var fabs = [...new Set(filtered.map(function(a){return a.empresa_fabrica;}).filter(function(f){return f;}))].sort();
            document.getElementById('rev_listaFabricas').innerHTML = fabs.map(function(f){return '<option value="'+f+'">';}).join('');
            
            if (fab) filtered = filtered.filter(function(a) { return a.empresa_fabrica === fab; });
            var marcas = [...new Set(filtered.map(function(a){return a.marca;}).filter(function(m){return m;}))].sort();
            document.getElementById('rev_listaMarcas').innerHTML = marcas.map(function(m){return '<option value="'+m+'">';}).join('');
        }
        
        // Rev motivo - detalle siempre visible
        
        async function ejecutarRevaluacion() {
            const motivoSelect = document.getElementById('rev_motivo').value;
            const motivoOtro = document.getElementById('rev_otroMotivo').value;
            const tcUsd = document.getElementById('rev_tcUsd').value;
            const tcEur = document.getElementById('rev_tcEur').value;
            const tcGbp = document.getElementById('rev_tcGbp').value;
            
            if (!motivoSelect) {
                alert('Debe seleccionar un motivo');
                return;
            }
            if (!tcUsd) {
                alert('Debe ingresar el TC USD');
                return;
            }
            
            const motivo = motivoSelect === 'Otro' ? (motivoOtro || 'Otro') : (motivoOtro ? motivoSelect + ' - ' + motivoOtro : motivoSelect);
            
            // Obtener costeos seleccionados
            const seleccionados = document.querySelectorAll('.costeo-check:checked');
            const costeoIds = Array.from(seleccionados).map(cb => cb.dataset.id);
            
            try {
                var filtros = {
                    filtro_proveedor: document.getElementById('rev_filtroProveedor').value.trim() || null,
                    filtro_fabrica: document.getElementById('rev_filtroFabrica').value.trim() || null,
                    filtro_marca: document.getElementById('rev_filtroMarca').value.trim() || null
                };
                console.log('Revaluación filtros enviados:', filtros);
                
                const res = await fetch(API_URL + '/api/revaluaciones/generar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        costeo_ids: costeoIds,
                        tc_usd: tcUsd,
                        tc_eur: tcEur || null,
                        tc_gbp: tcGbp || null,
                        motivo: motivo,
                        solo_contable: document.getElementById('rev_soloContable').checked,
                        filtro_proveedor: filtros.filtro_proveedor,
                        filtro_fabrica: filtros.filtro_fabrica,
                        filtro_marca: filtros.filtro_marca
                    })
                });
                
                const data = await res.json();
                
                if (!res.ok) {
                    alert('Error: ' + data.error);
                    return;
                }
                
                cerrarModal('revaluarModal');
                
                // Guardar ID para exportar
                revaluacionActualId = data.revaluacion_id;
                
                // Mostrar resultado
                document.getElementById('resumenRevaluacion').innerHTML = `
                    <strong>Motivo:</strong> ${data.motivo} | 
                    <strong>TC USD:</strong> ${data.tc_usd_nuevo} | 
                    <strong>TC EUR:</strong> ${data.tc_eur_nuevo || '-'} | 
                    <strong>TC GBP:</strong> ${data.tc_gbp_nuevo || '-'} | 
                    <strong>Artículos:</strong> ${data.cantidad_articulos}
                `;
                
                var html = '';
                for (const art of data.articulos) {
                    const difColor = art.diferencia_pct > 0 ? '#f44336' : (art.diferencia_pct < 0 ? '#4CAF50' : '#fff');
                    html += `<tr>
                        <td>${art.nombre}</td>
                        <td style="font-weight:bold;">$${parseFloat(art.costo_neto_original).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td style="font-weight:bold;">$${parseFloat(art.costo_neto_revaluado).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td style="color:${difColor};">${art.diferencia_pct ? art.diferencia_pct.toFixed(2) + '%' : '-'}</td>
                    </tr>`;
                }
                document.getElementById('resultadoRevaluacionBody').innerHTML = html;
                document.getElementById('resultadoRevaluacionModal').style.display = 'flex';
                
                // Actualizar historial
                cargarHistorialRevaluaciones();
                
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        function exportarRevaluacionActual() {
            if (revaluacionActualId) {
                window.open(API_URL + '/api/revaluaciones/exportar/' + revaluacionActualId + '?token=' + token, '_blank');
            }
        }
        
        async function cargarHistorialRevaluaciones() {
            try {
                const res = await fetch(API_URL + '/api/revaluaciones/historial', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                
                var html = '';
                if (data.length === 0) {
                    html = '<tr><td colspan="7" style="text-align:center;color:#888;">No hay revaluaciones</td></tr>';
                } else {
                    for (const rev of data) {
                        const fecha = new Date(rev.fecha_revaluacion).toLocaleDateString('es-AR');
                        html += `<tr>
                            <td>${fecha}</td>
                            <td>${rev.motivo}</td>
                            <td>${parseFloat(rev.tc_usd_nuevo).toFixed(4)}</td>
                            <td>${rev.tc_eur_nuevo ? parseFloat(rev.tc_eur_nuevo).toFixed(4) : '-'}</td>
                            <td>${rev.tc_gbp_nuevo ? parseFloat(rev.tc_gbp_nuevo).toFixed(4) : '-'}</td>
                            <td>${rev.cantidad_articulos}</td>
                            <td>
                                <button class="btn btn-small btn-info" onclick="verDetalleRevaluacion('${rev.id}')">Ver</button>
                                <button class="btn btn-small btn-success" onclick="exportarRevaluacion('${rev.id}')">Excel</button>
                                <button class="btn btn-small btn-danger" onclick="eliminarRevaluacion('${rev.id}')">X</button>
                            </td>
                        </tr>`;
                    }
                }
                document.getElementById('historialRevaluacionesBody').innerHTML = html;
            } catch (error) {
                console.error('Error al cargar historial:', error);
            }
        }
        
        async function verDetalleRevaluacion(id) {
            try {
                const res = await fetch(API_URL + '/api/revaluaciones/detalle/' + id, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                
                if (!res.ok) {
                    alert('Error: ' + data.error);
                    return;
                }
                
                revaluacionActualId = id;
                
                document.getElementById('resumenRevaluacion').innerHTML = `
                    <strong>Fecha:</strong> ${new Date(data.fecha_revaluacion).toLocaleDateString('es-AR')} | 
                    <strong>Motivo:</strong> ${data.motivo} | 
                    <strong>TC USD:</strong> ${data.tc_usd_nuevo} | 
                    <strong>TC EUR:</strong> ${data.tc_eur_nuevo || '-'} | 
                    <strong>TC GBP:</strong> ${data.tc_gbp_nuevo || '-'}
                `;
                
                var html = '';
                for (const art of data.articulos) {
                    const difColor = art.diferencia_costo_pct > 0 ? '#f44336' : (art.diferencia_costo_pct < 0 ? '#4CAF50' : '#fff');
                    html += `<tr>
                        <td>${art.nombre}</td>
                        <td style="font-weight:bold;">$${parseFloat(art.costo_neto_original).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td style="font-weight:bold;">$${parseFloat(art.costo_neto_revaluado).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td style="color:${difColor};">${art.diferencia_costo_pct ? parseFloat(art.diferencia_costo_pct).toFixed(2) + '%' : '-'}</td>
                    </tr>`;
                }
                document.getElementById('resultadoRevaluacionBody').innerHTML = html;
                document.getElementById('resultadoRevaluacionModal').style.display = 'flex';
                
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        function exportarRevaluacion(id) {
            window.open(API_URL + '/api/revaluaciones/exportar/' + id + '?token=' + token, '_blank');
        }
        
        async function eliminarRevaluacion(id) {
            if (!confirm('¿Eliminar esta revaluación?')) return;
            
            try {
                const res = await fetch(API_URL + '/api/revaluaciones/' + id, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (res.ok) {
                    cargarHistorialRevaluaciones();
                } else {
                    const data = await res.json();
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
async function verDetalleArticulo(codigo) {
            try {
                const res = await fetch(API_URL + '/api/costeos/detalle-articulo/' + encodeURIComponent(codigo), { 
                    headers: { 'Authorization': 'Bearer ' + token } 
                });
                const data = await res.json();
                
                if (!res.ok) {
                    alert('Error: ' + data.error);
                    return;
                }
                
                const ultimo = data.ultimo;
                const anterior = data.anterior;
                
                var html = '<div style="display:flex;gap:20px;flex-wrap:wrap;">';
                
                var varTcUsd = null, varTcEur = null, varTcGbp = null;
                var varFobOrigen = null, varFobInterm = null;
                var varCostoNeto = null, varCostoImp = null;
                var varGastos = null;
                
                if (anterior) {
                    varTcUsd = ultimo.tc_usd && anterior.tc_usd ? (((ultimo.tc_usd - anterior.tc_usd) / anterior.tc_usd) * 100).toFixed(2) : null;
                    varTcEur = ultimo.tc_eur && anterior.tc_eur ? (((ultimo.tc_eur - anterior.tc_eur) / anterior.tc_eur) * 100).toFixed(2) : null;
                    varTcGbp = ultimo.tc_gbp && anterior.tc_gbp ? (((ultimo.tc_gbp - anterior.tc_gbp) / anterior.tc_gbp) * 100).toFixed(2) : null;
                    varFobOrigen = ultimo.fob_origen && anterior.fob_origen ? (((ultimo.fob_origen - anterior.fob_origen) / anterior.fob_origen) * 100).toFixed(2) : null;
                    varFobInterm = ultimo.fob_interm && anterior.fob_interm ? (((ultimo.fob_interm - anterior.fob_interm) / anterior.fob_interm) * 100).toFixed(2) : null;
                    varCostoNeto = ultimo.costo_neto && anterior.costo_neto ? (((ultimo.costo_neto - anterior.costo_neto) / anterior.costo_neto) * 100).toFixed(2) : null;
                    varCostoImp = ultimo.costo_con_impuestos && anterior.costo_con_impuestos ? (((ultimo.costo_con_impuestos - anterior.costo_con_impuestos) / anterior.costo_con_impuestos) * 100).toFixed(2) : null;
                    if (ultimo.total_gastos_ars && anterior.total_gastos_ars && anterior.total_gastos_ars > 0) {
                        varGastos = (((ultimo.total_gastos_ars - anterior.total_gastos_ars) / anterior.total_gastos_ars) * 100).toFixed(2);
                    }
                }
                
                const colorVar = (v) => v > 0 ? '#f44336' : v < 0 ? '#4CAF50' : '#fff';
                const formatVar = (v) => v !== null ? ' <span style="color:' + colorVar(v) + ';">(' + (v > 0 ? '+' : '') + v + '%)</span>' : '';
                const fmtARS = (v) => v ? '$' + parseFloat(v).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
                
                // Columna ÚLTIMO
                html += '<div style="flex:1;min-width:380px;background:#1e1e2f;padding:15px;border-radius:8px;">';
                html += '<h4 style="color:#4CAF50;margin-top:0;">ÚLTIMO COSTEO</h4>';
                html += '<p><strong>Costeo:</strong> ' + (ultimo.nombre_costeo || '-') + '</p>';
                html += '<p><strong>Fecha Despacho:</strong> ' + formatearFecha(ultimo.fecha_despacho) + '</p>';
                html += '<hr style="border-color:#444;">';
                html += '<p><strong>TC USD:</strong> ' + (ultimo.tc_usd || '-') + formatVar(varTcUsd) + '</p>';
                html += '<p><strong>TC EUR:</strong> ' + (ultimo.tc_eur || '-') + formatVar(varTcEur) + '</p>';
                html += '<p><strong>TC GBP:</strong> ' + (ultimo.tc_gbp || '-') + formatVar(varTcGbp) + '</p>';
                html += '<hr style="border-color:#444;">';
                html += '<p><strong>FOB Origen:</strong> ' + (ultimo.fob_origen ? parseFloat(ultimo.fob_origen).toFixed(4) : '-') + ' ' + (ultimo.moneda || '') + formatVar(varFobOrigen) + '</p>';
                if (ultimo.fob_interm && parseFloat(ultimo.fob_interm) > 0) {
                    html += '<p><strong>FOB Fábrica:</strong> ' + parseFloat(ultimo.fob_interm).toFixed(4) + ' ' + (ultimo.moneda || '') + formatVar(varFobInterm) + '</p>';
                }
                html += '<p><strong>Costo Neto:</strong> ' + fmtARS(ultimo.costo_neto) + formatVar(varCostoNeto) + '</p>';
                
                // Gastos resumen (sin desplegable individual)
                html += '<hr style="border-color:#444;">';
                html += '<p><strong>Total Gastos:</strong> ' + fmtARS(ultimo.total_gastos_ars) + formatVar(varGastos) + '</p>';
                html += '</div>';
                
                // Columna ANTERIOR
                html += '<div style="flex:1;min-width:380px;background:#1e1e2f;padding:15px;border-radius:8px;">';
                html += '<h4 style="color:#ff9800;margin-top:0;">COSTEO ANTERIOR</h4>';
                if (anterior) {
                    html += '<p><strong>Costeo:</strong> ' + (anterior.nombre_costeo || '-') + '</p>';
                    html += '<p><strong>Fecha Despacho:</strong> ' + formatearFecha(anterior.fecha_despacho) + '</p>';
                    html += '<hr style="border-color:#444;">';
                    html += '<p><strong>TC USD:</strong> ' + (anterior.tc_usd || '-') + '</p>';
                    html += '<p><strong>TC EUR:</strong> ' + (anterior.tc_eur || '-') + '</p>';
                    html += '<p><strong>TC GBP:</strong> ' + (anterior.tc_gbp || '-') + '</p>';
                    html += '<hr style="border-color:#444;">';
                    html += '<p><strong>FOB Origen:</strong> ' + (anterior.fob_origen ? parseFloat(anterior.fob_origen).toFixed(4) : '-') + ' ' + (anterior.moneda || '') + '</p>';
                    if (anterior.fob_interm && parseFloat(anterior.fob_interm) > 0) {
                        html += '<p><strong>FOB Fábrica:</strong> ' + parseFloat(anterior.fob_interm).toFixed(4) + ' ' + (anterior.moneda || '') + '</p>';
                    }
                    html += '<hr style="border-color:#444;">';
                    html += '<p><strong>Costo Neto:</strong> ' + fmtARS(anterior.costo_neto) + '</p>';
                    
                    // Gastos anterior resumen (sin desplegable individual)
                    html += '<hr style="border-color:#444;">';
                    html += '<p><strong>Total Gastos:</strong> ' + fmtARS(anterior.total_gastos_ars) + '</p>';
                } else {
                    html += '<p style="color:#888;">No hay costeo anterior para comparar</p>';
                }
                html += '</div>';
                
                html += '</div>';

                // Comparativo de gastos línea por línea (en divisa, sin STABZ)
                if (anterior && ultimo.gastos && ultimo.gastos.length > 0) {
                    html += '<div style="margin-top:15px;">';
                    html += '<h4 style="color:#64b5f6;font-size:14px;font-weight:bold;margin-bottom:10px;">📊 Comparativo de gastos</h4>';
                    html += '<div style="background:#1e1e2f;padding:15px;border-radius:8px;">';
                    html += '<table style="width:100%;font-size:13px;border-collapse:collapse;">';
                    html += '<thead><tr style="border-bottom:2px solid #444;"><th style="text-align:left;padding:5px;">Gasto</th><th style="text-align:center;padding:5px;">Mon.</th><th style="text-align:right;padding:5px;">Último</th><th style="text-align:right;padding:5px;">Anterior</th><th style="text-align:right;padding:5px;">Variación</th></tr></thead><tbody>';
                    
                    const normalizarGasto = (desc) => (desc || '').trim().toUpperCase().replace(/\s+/g, ' ');
                    
                    // Agrupar gastos por descripción, guardando moneda y monto en divisa
                    const gastosUMap = {};
                    ultimo.gastos.forEach(g => {
                        const key = normalizarGasto(g.descripcion);
                        if (key.includes('STABZ')) return;
                        const montoDiv = (g.moneda && g.moneda !== 'ARS' && g.monto_orig) ? parseFloat(g.monto_orig) : parseFloat(g.monto_ars) || 0;
                        const mon = (g.moneda && g.moneda !== 'ARS' && g.monto_orig) ? g.moneda : 'ARS';
                        if (!gastosUMap[key]) gastosUMap[key] = { desc: g.descripcion, monto: 0, moneda: mon };
                        gastosUMap[key].monto += montoDiv;
                    });
                    
                    const gastosAMap = {};
                    if (anterior.gastos) {
                        anterior.gastos.forEach(g => {
                            const key = normalizarGasto(g.descripcion);
                            if (key.includes('STABZ')) return;
                            const montoDiv = (g.moneda && g.moneda !== 'ARS' && g.monto_orig) ? parseFloat(g.monto_orig) : parseFloat(g.monto_ars) || 0;
                            const mon = (g.moneda && g.moneda !== 'ARS' && g.monto_orig) ? g.moneda : 'ARS';
                            if (!gastosAMap[key]) gastosAMap[key] = { desc: g.descripcion, monto: 0, moneda: mon };
                            gastosAMap[key].monto += montoDiv;
                        });
                    }
                    
                    const todosKeys = new Set([...Object.keys(gastosUMap), ...Object.keys(gastosAMap)]);
                    const sortedKeys = [...todosKeys].sort();
                    const fmtDiv = (v) => parseFloat(v).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    
                    var totalU = 0, totalA = 0;
                    sortedKeys.forEach(key => {
                        const gU = gastosUMap[key];
                        const gA = gastosAMap[key];
                        const mU = gU ? gU.monto : 0;
                        const mA = gA ? gA.monto : 0;
                        totalU += mU;
                        totalA += mA;
                        const desc = gU ? gU.desc : gA.desc;
                        const moneda = gU ? gU.moneda : (gA ? gA.moneda : 'ARS');
                        var varPct = '';
                        var varColor = '#fff';
                        if (mA !== 0 && mU !== 0) {
                            const pct = ((mU - mA) / Math.abs(mA) * 100).toFixed(2);
                            varColor = pct > 0 ? '#f44336' : pct < 0 ? '#4CAF50' : '#fff';
                            varPct = (pct > 0 ? '+' : '') + pct + '%';
                        } else if (mU !== 0 && mA === 0) {
                            varPct = 'NUEVO'; varColor = '#ff9800';
                        } else if (mU === 0 && mA !== 0) {
                            varPct = 'ELIMINADO'; varColor = '#888';
                        }
                        html += '<tr style="border-bottom:1px solid #333;"><td style="padding:4px 5px;">' + desc + '</td>';
                        html += '<td style="text-align:center;padding:4px 5px;color:#aaa;font-size:11px;">' + moneda + '</td>';
                        html += '<td style="text-align:right;padding:4px 5px;">' + (mU !== 0 ? fmtDiv(mU) : '-') + '</td>';
                        html += '<td style="text-align:right;padding:4px 5px;">' + (mA !== 0 ? fmtDiv(mA) : '-') + '</td>';
                        html += '<td style="text-align:right;padding:4px 5px;color:' + varColor + ';font-weight:bold;">' + varPct + '</td></tr>';
                    });
                    
                    // Fila total
                    var varTotal = '';
                    var varTotalColor = '#fff';
                    if (totalA !== 0 && totalU !== 0) {
                        const pctT = ((totalU - totalA) / Math.abs(totalA) * 100).toFixed(2);
                        varTotalColor = pctT > 0 ? '#f44336' : pctT < 0 ? '#4CAF50' : '#fff';
                        varTotal = (pctT > 0 ? '+' : '') + pctT + '%';
                    }
                    html += '<tr style="border-top:2px solid #666;font-weight:bold;"><td style="padding:5px;">TOTAL <span style="font-weight:normal;font-size:11px;color:#888;">(sin STABZ)</span></td>';
                    html += '<td></td>';
                    html += '<td style="text-align:right;padding:5px;">' + fmtDiv(totalU) + '</td>';
                    html += '<td style="text-align:right;padding:5px;">' + fmtDiv(totalA) + '</td>';
                    html += '<td style="text-align:right;padding:5px;color:' + varTotalColor + ';">' + varTotal + '</td></tr>';
                    
                    html += '</tbody></table></div></div>';
                }
                
                document.getElementById('detalleArticuloBody').innerHTML = html;
                document.getElementById('detalleArticuloTitle').textContent = 'Detalle: ' + codigo + ' - ' + (ultimo.nombre || '');
                document.getElementById('detalleArticuloModal').classList.add('show');
                
            } catch (err) {
                console.error(err);
                alert('Error al cargar detalle del artículo');
            }
        }
function exportarUltimosCostosXLSX() {
            exportarArticulosXLSX(articulosFiltrados, 'Ultimos_Costos');
        }

        function exportarSeleccionadosXLSX() {
            const seleccionados = document.querySelectorAll('.art-check:checked');
            const codigos = [...seleccionados].map(cb => cb.value);
            const arts = articulosFiltrados.filter(a => codigos.includes(a.codigo_goodies));
            if (arts.length === 0) { alert('No hay artículos seleccionados'); return; }
            exportarArticulosXLSX(arts, 'Seleccion_Costos');
        }

        function exportarArticulosXLSX(articulos, prefijo) {
            if (articulos.length === 0) { alert('No hay artículos para exportar'); return; }
            
            const data = articulos.map(art => ({
                'Código': art.codigo_goodies || '',
                'Proveedor': art.proveedor || '',
                'Nombre': art.nombre || '',
                'Moneda FOB': art.moneda_fob || '',
                'FOB Origen': art.valor_fob ? parseFloat(parseFloat(art.valor_fob).toFixed(4)) : '',
                'Costo Neto $': art.costo_neto ? parseFloat(parseFloat(art.costo_neto).toFixed(2)) : '',
                'Costo c/Imp $': art.costo_con_impuestos ? parseFloat(parseFloat(art.costo_con_impuestos).toFixed(2)) : '',
                'Costo Anterior $': art.costo_anterior ? parseFloat(parseFloat(art.costo_anterior).toFixed(2)) : '',
                'Dif %': art.diferencia_pct !== null ? parseFloat(art.diferencia_pct.toFixed(2)) : '',
                'Fecha Despacho': art.fecha_despacho ? art.fecha_despacho.split('T')[0] : '',
                'Costeo': art.nombre_costeo || '',
                'TC USD': art.tc_usd ? parseFloat(art.tc_usd) : '',
                'TC EUR': art.tc_eur ? parseFloat(art.tc_eur) : '',
                'TC GBP': art.tc_gbp ? parseFloat(art.tc_gbp) : ''
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 22 }, { wch: 20 }, { wch: 50 }, { wch: 10 },
                { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 12 },
                { wch: 12 }, { wch: 12 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Últimos Costos');
            XLSX.writeFile(wb, prefijo + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
        }

        function limpiarFiltrosArticulos() {
            document.getElementById('buscarArticulo').value = '';
            document.getElementById('filtroProveedorArticulo').value = '';
            document.getElementById('filtroFabricanteArticulo').value = '';
            document.getElementById('filtroMarcaArticulo').value = '';
            document.getElementById('seleccionarTodosArt').checked = false;
            cascadaFiltrosUltimoCosto();
            filtrarArticulos();
            actualizarSeleccion();
        }

        function toggleSeleccionTodos(masterCb) {
            document.querySelectorAll('.art-check').forEach(cb => cb.checked = masterCb.checked);
            actualizarSeleccion();
        }

        function actualizarSeleccion() {
            const seleccionados = document.querySelectorAll('.art-check:checked').length;
            const btn = document.getElementById('btnExportarSeleccion');
            const count = document.getElementById('countSeleccion');
            if (seleccionados > 0) {
                btn.style.display = 'inline-block';
                count.textContent = seleccionados;
            } else {
                btn.style.display = 'none';
            }
        }
        var ordenCosteos = 'fecha_despacho';
        function cambiarOrdenCosteos(orden) {
            ordenCosteos = orden;
            document.getElementById('sortFechaDesp').style.background = orden === 'fecha_despacho' ? '#4CAF50' : '#333';
            document.getElementById('sortFechaDesp').style.color = orden === 'fecha_despacho' ? '#fff' : '#aaa';
            document.getElementById('sortFechaDesp').style.border = orden === 'fecha_despacho' ? 'none' : '1px solid #555';
            document.getElementById('sortActualizado').style.background = orden === 'actualizado' ? '#4CAF50' : '#333';
            document.getElementById('sortActualizado').style.color = orden === 'actualizado' ? '#fff' : '#aaa';
            document.getElementById('sortActualizado').style.border = orden === 'actualizado' ? 'none' : '1px solid #555';
            cargarCosteos();
        }
async function cargarCosteos() {
            const loading = document.getElementById('tableLoading');
            loading.classList.add('show');
            try {
                const res = await fetch(API_URL + '/api/costeos/listar?sort=' + ordenCosteos, { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (res.ok && Array.isArray(data)) {
                    todosLosCosteos = data;
                    actualizarDropdownProveedores();
                    aplicarFiltros();
                    document.getElementById('totalCosteos').textContent = data.length;
                    document.getElementById('costeosDefinitivos').textContent = data.filter(c => esDefinitivo(c)).length;
                    document.getElementById('costeosPresupuestos').textContent = data.filter(c => !esDefinitivo(c)).length;
                }
            } catch (err) { console.error(err); }
            finally { loading.classList.remove('show'); }
        }

        function esDefinitivo(costeo) { return costeo.fecha_despacho || costeo.nro_despacho; }
        async function actualizarDropdownProveedores() {
            // Proveedores solo del catálogo (ya filtrados por activos)
            var provsCatalogo = [];
            var fabricantes = [];
            var marcas = [];
            try {
                const res = await fetch(window.location.origin + '/api/maestro/proveedores', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) provsCatalogo = await res.json();
            } catch(e) {}
            try {
                const res = await fetch(window.location.origin + '/api/maestro/fabricantes', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) fabricantes = await res.json();
            } catch(e) {}
            try {
                const res = await fetch(window.location.origin + '/api/maestro/marcas', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) marcas = await res.json();
            } catch(e) {}
            // Solo proveedores activos del catálogo
            const proveedores = [...new Set(provsCatalogo)].sort();
            // Poblar datalists de COMEX
            document.getElementById('listaProveedores').innerHTML = proveedores.map(p => '<option value="' + p + '">').join('');
            var dlFab = document.getElementById('listaFabricantes');
            if (dlFab) dlFab.innerHTML = fabricantes.map(f => '<option value="' + f + '">').join('');
            var dlMar = document.getElementById('listaMarcas');
            if (dlMar) dlMar.innerHTML = marcas.map(m => '<option value="' + m + '">').join('');
            // Poblar datalists de Último Costo
            var dlProvArt = document.getElementById('listaProveedoresArticulo');
            if (dlProvArt) dlProvArt.innerHTML = proveedores.map(p => '<option value="' + p + '">').join('');
            var dlFabArt = document.getElementById('listaFabricantesArticulo');
            if (dlFabArt) dlFabArt.innerHTML = fabricantes.map(f => '<option value="' + f + '">').join('');
            var dlMarArt = document.getElementById('listaMarcasArticulo');
            if (dlMarArt) dlMarArt.innerHTML = marcas.map(m => '<option value="' + m + '">').join('');
        }
        
        function cascadaFiltrosCosteos() {
            const arts = todosLosArticulos || [];
            if (arts.length === 0) return;
            const prov = document.getElementById('filtroProveedor').value.trim().toLowerCase();
            const fab = document.getElementById('filtroFabricante').value.trim().toLowerCase();
            
            // Fábricas: filtrar solo por proveedor
            var artsFab = [...arts];
            if (prov) artsFab = artsFab.filter(a => a.proveedor && a.proveedor.toLowerCase().includes(prov));
            document.getElementById('listaFabricantes').innerHTML = [...new Set(artsFab.map(a => a.empresa_fabrica).filter(f => f))].sort().map(f => '<option value="' + f + '">').join('');
            
            // Marcas: filtrar por proveedor Y/O fábrica (lo que esté seleccionado)
            var artsMarca = [...arts];
            if (prov) artsMarca = artsMarca.filter(a => a.proveedor && a.proveedor.toLowerCase().includes(prov));
            if (fab) artsMarca = artsMarca.filter(a => a.empresa_fabrica && a.empresa_fabrica.toLowerCase().includes(fab));
            document.getElementById('listaMarcas').innerHTML = [...new Set(artsMarca.map(a => a.marca).filter(m => m))].sort().map(m => '<option value="' + m + '">').join('');
        }

        function limpiarFiltros() {
            document.getElementById('filtroNombre').value = '';
            document.getElementById('filtroProveedor').value = '';
            document.getElementById('filtroFabricante').value = '';
            document.getElementById('filtroTipo').value = '';
            document.getElementById('filtroMarca').value = '';
            seleccionados.clear();
            cascadaFiltrosCosteos();
            aplicarFiltros();
        }

        function aplicarFiltros() {
            const nombre = (document.getElementById('filtroNombre').value || '').toLowerCase();
            const proveedor = document.getElementById('filtroProveedor').value;
            const fabricante = document.getElementById('filtroFabricante').value;
            const marca = document.getElementById('filtroMarca').value.toLowerCase();
            const tipo = document.getElementById('filtroTipo').value;
            var filtrados = [...todosLosCosteos];
            if (nombre) filtrados = filtrados.filter(c => c.nombre_costeo && c.nombre_costeo.toLowerCase().includes(nombre));
            if (proveedor) filtrados = filtrados.filter(c => c.proveedor && c.proveedor.toLowerCase().includes(proveedor.toLowerCase()));
            if (fabricante) filtrados = filtrados.filter(c => (c.empresa_fabrica && c.empresa_fabrica.toLowerCase().includes(fabricante.toLowerCase())) || (c.proveedor && c.proveedor.toLowerCase().includes(fabricante.toLowerCase())));
            if (marca) filtrados = filtrados.filter(c => (c.marcas && c.marcas.toLowerCase().includes(marca)) || (c.articulos_nombres && c.articulos_nombres.toLowerCase().includes(marca)));
            if (tipo === 'definitivo') filtrados = filtrados.filter(c => esDefinitivo(c));
            else if (tipo === 'presupuesto') filtrados = filtrados.filter(c => !esDefinitivo(c));
            else if (tipo === 'calculado') filtrados = filtrados.filter(c => c.estado === 'calculado');
            else if (tipo === 'no_calculado') filtrados = filtrados.filter(c => c.estado !== 'calculado');
            costeosFiltrados = filtrados;
            renderizarTabla(filtrados);
            actualizarAccionesMasivas();
        }

        function formatearFecha(fecha) { if (!fecha) return '-'; const d = new Date(fecha); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('es-AR'); }
        function toggleSelectAll() {
            const checkAll = document.getElementById('selectAll').checked;
            if (checkAll) costeosFiltrados.forEach(c => seleccionados.add(c.id));
            else seleccionados.clear();
            renderizarTabla(costeosFiltrados);
            actualizarAccionesMasivas();
        }
        function toggleSeleccion(id) {
            if (seleccionados.has(id)) seleccionados.delete(id);
            else seleccionados.add(id);
            actualizarAccionesMasivas();
            document.getElementById('selectAll').checked = costeosFiltrados.length > 0 && costeosFiltrados.every(c => seleccionados.has(c.id));
        }
        function actualizarAccionesMasivas() {
            document.getElementById('contadorSeleccionados').textContent = seleccionados.size;
            document.getElementById('accionesMasivas').style.display = seleccionados.size > 0 ? 'flex' : 'none';
            var btnComp = document.getElementById('btnCompararSeleccionados');
            if (btnComp) btnComp.style.display = seleccionados.size >= 2 ? 'inline-block' : 'none';
        }

        function renderizarTabla(costeos) {
            const tbody = document.getElementById('costeosBody');
            if (costeos.length === 0) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No hay costeos</td></tr>'; return; }
            tbody.innerHTML = costeos.map(costeo => {
                const def = esDefinitivo(costeo);
                const checked = seleccionados.has(costeo.id) ? 'checked' : '';
                return '<tr>' +
                    '<td class="checkbox-cell"><input type="checkbox" ' + checked + ' onchange="toggleSeleccion(\'' + costeo.id + '\')"></td>' +
                    '<td>' + (costeo.nombre_costeo || '-') + '</td>' +
                    '<td>' + (costeo.proveedor || '-') + '</td>' +
                    '<td style="font-size:12px;">' + (costeo.empresa_fabrica || '-') + '</td>' +
                    '<td>' + (costeo.moneda_principal || 'USD') + '</td>' +
                    '<td>' + (costeo.unidades_totales || 0) + '</td>' +
                    '<td>' + formatearFecha(costeo.fecha_factura) + '</td>' +
                    '<td>' + formatearFecha(costeo.fecha_despacho) + '</td>' +
                    '<td><span class="status-badge ' + (def ? 'status-definitivo' : 'status-presupuesto') + '">' + (def ? 'Definitivo' : 'Presupuesto') + '</span>' +
                    ' <span style="font-size:11px;' + (costeo.estado === 'calculado' ? 'color:#4CAF50;' : 'color:#ff9800;') + '" title="' + (costeo.estado === 'calculado' ? 'Calculado' : 'Sin calcular') + '">' + (costeo.estado === 'calculado' ? '✔' : '⚠') + '</span></td>' +
                    '<td class="actions">' +
                    '<button class="btn btn-warning btn-sm" onclick="calcularCosteo(\'' + costeo.id + '\')">Calc</button>' +
                    '<button class="btn btn-primary btn-sm" onclick="editarCosteo(\'' + costeo.id + '\')">Edit</button>' +
                    '<button class="btn btn-purple btn-sm" onclick="duplicarCosteo(\'' + costeo.id + '\')" title="Duplicar">Dup</button>' +
                    '<button class="btn btn-success btn-sm" onclick="exportarCosteo(\'' + costeo.id + '\')">Excel</button>' +
                    '<button class="btn btn-sm" style="background:#00897B;color:#fff;" onclick="reporteDespacho(\'' + costeo.id + '\')" title="Reporte Importe Despacho (presupuesto impuestos aduana)">📋 Imp</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="eliminarCosteo(\'' + costeo.id + '\')">X</button>' +
                    '</td></tr>';
            }).join('');
        }

async function exportarLegajo(id) {
            try {
                const res = await fetch(API_URL + '/api/costeos/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
                const costeo = await res.json();
                if (res.ok) {
                    var contenido = 'DATOS GENERALES\n';
                    contenido += 'Campo\tValor\n';
                    contenido += 'Nombre Costeo\t' + (costeo.nombre_costeo || '') + '\n';
                    contenido += 'Proveedor\t' + (costeo.proveedor || '') + '\n';
                    contenido += 'Empresa Intermediaria\t' + (costeo.empresa_intermediaria || '') + '\n';
                    contenido += 'Factura Nro\t' + (costeo.factura_nro || '') + '\n';
                    contenido += 'Fecha Factura\t' + (costeo.fecha_factura ? costeo.fecha_factura.split('T')[0] : '') + '\n';
                    contenido += 'Fecha Vencimiento\t' + (costeo.fecha_vencimiento_factura ? costeo.fecha_vencimiento_factura.split('T')[0] : '') + '\n';
                    contenido += 'Fecha Despacho\t' + (costeo.fecha_despacho ? costeo.fecha_despacho.split('T')[0] : '') + '\n';
                    contenido += 'Moneda Principal\t' + (costeo.moneda_principal || '') + '\n';
                    contenido += 'Monto Factura\t' + (costeo.monto_factura || '') + '\n';
                    contenido += 'TC USD\t' + (costeo.tc_usd || '') + '\n';
                    contenido += 'TC EUR\t' + (costeo.tc_eur || '') + '\n';
                    contenido += 'TC GBP\t' + (costeo.tc_gbp || '') + '\n';
                    contenido += 'FOB Monto\t' + (costeo.fob_monto || '') + '\n';
                    contenido += 'Flete Monto\t' + (costeo.flete_monto || '') + '\n';
                    contenido += 'Seguro Monto\t' + (costeo.seguro_monto || '') + '\n';
                    contenido += '\nARTICULOS\n';
                    contenido += 'Cod_Goodies\tCod_Proveedor\tNombre\tCajas\tUnd_Caja\tUnidades\tValor_Origen\tValor_Unit\tPct_Derecho\tPct_Imp_Interno\n';
                    (costeo.articulos || []).forEach(a => {
                        contenido += (a.codigo_goodies || '') + '\t';
                        contenido += (a.codigo_proveedor || '') + '\t';
                        contenido += (a.nombre || '') + '\t';
                        contenido += (a.cantidad_cajas || '') + '\t';
                        contenido += (a.unidades_por_caja || '') + '\t';
                        contenido += (a.unidades_totales || '') + '\t';
                        contenido += (a.valor_proveedor_origen || '') + '\t';
                        contenido += (a.valor_unitario_origen || '') + '\t';
                        contenido += ((a.derechos_porcentaje || 0) * 100) + '\t';
                        contenido += ((a.impuesto_interno_porcentaje || 0) * 100) + '\n';
                    });
                    contenido += '\nGASTOS\n';
                    contenido += 'Descripcion\tProveedor\tNro_Comprobante\tMoneda\tMonto\tPct_Recargo\tObservaciones\tNo_Contable\n';
                    (costeo.gastos_varios || []).forEach(g => {
                        contenido += (g.descripcion || '') + '\t';
                        contenido += (g.proveedor_gasto || '') + '\t';
                        contenido += (g.nro_comprobante || '') + '\t';
                        contenido += (g.moneda || '') + '\t';
                        contenido += (g.monto || '') + '\t';
                        contenido += (g.recargo || '') + '\t';
                        contenido += (g.observaciones || '') + '\t';
                        contenido += (g.no_contable ? 'SI' : '') + '\n';
                    });
                    const blob = new Blob([contenido], { type: 'text/tab-separated-values;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Legajo_' + (costeo.nombre_costeo || 'costeo').replace(/[^a-zA-Z0-9]/g, '_') + '.xls';
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) { alert('Error al exportar legajo'); console.error(err); }
        }
async function duplicarCosteo(id) {
            try {
                const res = await fetch(API_URL + '/api/costeos/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
                const costeo = await res.json();
                if (res.ok) {
                    const nuevoNombre = prompt('Nombre para la copia:', (costeo.nombre_costeo || '') + ' - COPIA');
                    if (!nuevoNombre) return;
                    document.getElementById('cm_nombre').value = nuevoNombre;
                    document.getElementById('cm_proveedor').value = costeo.proveedor || '';
                    document.getElementById('cm_tieneIntermediaria').checked = !!costeo.empresa_intermediaria;
                    document.getElementById('cm_intermediaria').value = costeo.empresa_intermediaria || '';
                    document.getElementById('cm_facturaInterm').value = costeo.factura_intermediaria || '';
                    document.getElementById('cm_fechaFacturaInterm').value = costeo.fecha_factura_intermediaria ? costeo.fecha_factura_intermediaria.split('T')[0] : '';
                    document.getElementById('cm_fechaVencInterm').value = costeo.fecha_vencimiento_intermediaria ? costeo.fecha_vencimiento_intermediaria.split('T')[0] : '';
                    document.getElementById('cm_facturaNro').value = costeo.factura_nro || '';
                    document.getElementById('cm_moneda').value = costeo.moneda_principal || 'USD';
                    document.getElementById('cm_monto').value = costeo.monto_factura || '';
                    document.getElementById('cm_fechaFactura').value = costeo.fecha_factura ? costeo.fecha_factura.split('T')[0] : '';
                    document.getElementById('cm_fechaVenc').value = costeo.fecha_vencimiento_factura ? costeo.fecha_vencimiento_factura.split('T')[0] : '';
                    document.getElementById('cm_fechaDespacho').value = costeo.fecha_despacho ? costeo.fecha_despacho.split('T')[0] : '';
                    document.getElementById('cm_nroDespacho').value = costeo.nro_despacho || '';
                    document.getElementById('cm_tcUsd').value = costeo.tc_usd || '';
                    document.getElementById('cm_tcEur').value = costeo.tc_eur || '';
                    document.getElementById('cm_tcGbp').value = costeo.tc_gbp || '';
                    document.getElementById('cm_fobMoneda').value = costeo.fob_moneda || 'USD';
                    document.getElementById('cm_fobMonto').value = costeo.fob_monto || '';
                    document.getElementById('cm_fleteMoneda').value = costeo.flete_moneda || 'USD';
                    document.getElementById('cm_fleteMonto').value = costeo.flete_monto || '';
                    document.getElementById('cm_seguroMoneda').value = costeo.seguro_moneda || 'USD';
                    document.getElementById('cm_seguroMonto').value = costeo.seguro_monto || '';
                    toggleIntermediaria();
                    // Toggle "cargar por caja" arranca OFF al duplicar: usamos los
                    // valores unitarios ya guardados en DB sin transformar.
                    const cmPorCajaDup = document.getElementById('cm_cargarPorCaja');
                    if (cmPorCajaDup) cmPorCajaDup.checked = false;
                    const thVODup = document.getElementById('thValorOrigen');
                    if (thVODup) thVODup.textContent = 'Valor Origen';
                    const thVFDup = document.getElementById('thValorFabrica');
                    if (thVFDup) thVFDup.textContent = 'Valor Fábrica';
                    articulosManual = (costeo.articulos || []).map(mapearArticuloDesdeDB);
                    if (articulosManual.length === 0) agregarArticulo();
                    renderizarArticulos();
                    gastosManual = (costeo.gastos_varios || []).map(g => ({
                        descripcion: g.descripcion || '',
                        proveedor: g.proveedor_gasto || '',
                        nro_comprobante: g.nro_comprobante || '',
                        moneda: g.moneda || 'USD',
                        monto: g.monto || '',
                        recargo: g.recargo || '',
                        grupo: g.grupo || '',
                        observaciones: g.observaciones || '',
                        no_contable: g.no_contable || false
                    }));
                    if (gastosManual.length === 0) agregarGasto();
                    renderizarGastos();
                    window.costeoEditandoId = null;
                    cambiarTab('datosGenerales');
                    document.getElementById('cargaManualModal').classList.add('show');
setTimeout(function() { toggleConsolidado(); calcularPartesBaseAduana(); }, 100);
                }
            } catch (err) { alert('Error al duplicar costeo'); console.error(err); }
        }
async function editarCosteo(id) {
            try {
                // Limpiar alertas de legajos anteriores
                const alertaDiv = document.getElementById('maestroAlertas');
                if (alertaDiv) { alertaDiv.innerHTML = ''; alertaDiv.style.display = 'none'; }
                const res = await fetch(API_URL + '/api/costeos/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
                const costeo = await res.json();
                if (res.ok) {
                    document.getElementById('cm_nombre').value = costeo.nombre_costeo || '';
                    document.getElementById('cm_proveedor').value = costeo.proveedor || '';
                    document.getElementById('cm_tieneIntermediaria').checked = !!costeo.empresa_intermediaria;
                    document.getElementById('cm_intermediaria').value = costeo.empresa_intermediaria || '';
                    document.getElementById('cm_facturaInterm').value = costeo.factura_intermediaria || '';
                    document.getElementById('cm_fechaFacturaInterm').value = costeo.fecha_factura_intermediaria ? costeo.fecha_factura_intermediaria.split('T')[0] : '';
                    document.getElementById('cm_fechaVencInterm').value = costeo.fecha_vencimiento_intermediaria ? costeo.fecha_vencimiento_intermediaria.split('T')[0] : '';
                    document.getElementById('cm_facturaNro').value = costeo.factura_nro || '';
                    document.getElementById('cm_moneda').value = costeo.moneda_principal || 'USD';
                    document.getElementById('cm_monto').value = costeo.monto_factura || '';
                    document.getElementById('cm_fechaFactura').value = costeo.fecha_factura ? costeo.fecha_factura.split('T')[0] : '';
                    document.getElementById('cm_fechaVenc').value = costeo.fecha_vencimiento_factura ? costeo.fecha_vencimiento_factura.split('T')[0] : '';
                    document.getElementById('cm_fechaDespacho').value = costeo.fecha_despacho ? costeo.fecha_despacho.split('T')[0] : '';
                    document.getElementById('cm_nroDespacho').value = costeo.nro_despacho || '';
                    document.getElementById('cm_tcUsd').value = costeo.tc_usd || '';
                    document.getElementById('cm_tcEur').value = costeo.tc_eur || '';
                    document.getElementById('cm_tcGbp').value = costeo.tc_gbp || '';
                    document.getElementById('cm_fobMoneda').value = costeo.fob_moneda || 'USD';
                    document.getElementById('cm_fobMonto').value = costeo.fob_monto || '';
                    document.getElementById('cm_fleteMoneda').value = costeo.flete_moneda || 'USD';
                    document.getElementById('cm_fleteMonto').value = costeo.flete_monto || '';
                    document.getElementById('cm_seguroMoneda').value = costeo.seguro_moneda || 'USD';
                    document.getElementById('cm_seguroMonto').value = costeo.seguro_monto || '';
                    // Consolidado
                    document.getElementById('cm_esConsolidado').checked = !!costeo.es_consolidado;
                    // Toggle "cargar por caja" arranca OFF al editar: los datos en DB
                    // están como valor_unitario_origen (unitario real), no por caja.
                    const cmPorCajaEdit = document.getElementById('cm_cargarPorCaja');
                    if (cmPorCajaEdit) cmPorCajaEdit.checked = false;
                    const thVOEdit = document.getElementById('thValorOrigen');
                    if (thVOEdit) thVOEdit.textContent = 'Valor Origen';
                    const thVFEdit = document.getElementById('thValorFabrica');
                    if (thVFEdit) thVFEdit.textContent = 'Valor Fábrica';
                    document.getElementById('cm_volumenM3').value = costeo.volumen_m3 || '';
                    document.getElementById('cm_pesoKg').value = costeo.peso_kg || '';
                    proveedoresConsolidado = (costeo.proveedores_consolidado || []).map(p => ({
                        nombre: p.nombre_proveedor || '',
                        fob_total: p.fob_total || '',
                        moneda: p.moneda || 'USD',
                        volumen_m3: p.volumen_m3 || '',
                        peso_kg: p.peso_kg || ''
                    }));
                    toggleIntermediaria();
                    toggleConsolidado();
                    articulosManual = (costeo.articulos || []).map(mapearArticuloDesdeDB);
                    if (articulosManual.length === 0) agregarArticulo();
                    renderizarArticulos();
                    gastosManual = (costeo.gastos_varios || []).map(g => ({
                        descripcion: g.descripcion || '',
                        proveedor: g.proveedor_gasto || '',
                        nro_comprobante: g.nro_comprobante || '',
                        moneda: g.moneda || 'USD',
                        monto: g.monto || '',
                        recargo: g.recargo || '',
                        grupo: g.grupo || '',
                        prorratear_consolidado: g.prorratear_consolidado || false,
                        metodo_prorrateo: g.metodo_prorrateo || 'no_prorratear',
                        observaciones: g.observaciones || '',
                        no_contable: g.no_contable || false
                    }));

                    if (gastosManual.length === 0) agregarGasto();
                    renderizarGastos();
                    window.costeoEditandoId = id;
                    cambiarTab('datosGenerales');
                    document.getElementById('cargaManualModal').classList.add('show');
setTimeout(function() { toggleConsolidado(); calcularPartesBaseAduana(); }, 100);
                }
            } catch (err) { alert('Error al cargar costeo'); console.error(err); }
        }
var costeoIdParaCalcular = null;

async function calcularCosteo(id) {
    if (!confirm('¿Calcular este costeo?')) return;
    await ejecutarCalculo(id, null);
}
async function mostrarModalConsolidado(id) {
    document.getElementById('modalConsolidado').style.display = 'block';
    document.getElementById('consolidadoLoading').style.display = 'block';
    document.getElementById('consolidadoContenido').style.display = 'none';
    
    try {
        const res = await fetch(API_URL + '/api/costeos/' + id + '/preview-consolidado', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        
        if (!data.es_consolidado) {
            alert('Este costeo no es consolidado');
            cerrarModalConsolidado();
            return;
        }
        
        // Mostrar resumen de proveedores
        var htmlProveedores = '<table style="width:100%; border-collapse:collapse;">';
        htmlProveedores += '<tr style="border-bottom:1px solid #555;"><td style="padding:8px;"><strong>' + data.proveedor_actual.nombre + ' (actual)</strong></td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">FOB: $' + data.proveedor_actual.fob.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">Vol: ' + (data.proveedor_actual.volumen_m3 || 0) + ' m³</td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">Peso: ' + (data.proveedor_actual.peso_kg || 0) + ' kg</td></tr>';
        
        for (const prov of data.otros_proveedores) {
            htmlProveedores += '<tr style="border-bottom:1px solid #444;"><td style="padding:8px;">' + prov.nombre + '</td>';
            htmlProveedores += '<td style="padding:8px; text-align:right;">FOB: $' + prov.fob_convertido.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</td>';
            htmlProveedores += '<td style="padding:8px; text-align:right;">Vol: ' + (prov.volumen_m3 || 0) + ' m³</td>';
            htmlProveedores += '<td style="padding:8px; text-align:right;">Peso: ' + (prov.peso_kg || 0) + ' kg</td></tr>';
        }
        
        htmlProveedores += '<tr style="background:#333; font-weight:bold;"><td style="padding:8px;">TOTAL CONSOLIDADO</td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">$' + data.totales.fob.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">' + data.totales.volumen_m3 + ' m³</td>';
        htmlProveedores += '<td style="padding:8px; text-align:right;">' + data.totales.peso_kg + ' kg</td></tr>';
        htmlProveedores += '</table>';
        
        document.getElementById('resumenProveedores').innerHTML = htmlProveedores;
        
        // Mostrar participaciones
        document.getElementById('partFOB').textContent = data.comparativo_metodos.por_fob.participacion;
        document.getElementById('gastosFOB').textContent = '$' + parseFloat(data.comparativo_metodos.por_fob.gastos_estimados).toLocaleString('es-AR', {minimumFractionDigits:2});
        
        document.getElementById('partVolumen').textContent = data.comparativo_metodos.por_volumen.participacion;
        document.getElementById('gastosVolumen').textContent = '$' + parseFloat(data.comparativo_metodos.por_volumen.gastos_estimados).toLocaleString('es-AR', {minimumFractionDigits:2});
        
        document.getElementById('partPeso').textContent = data.comparativo_metodos.por_peso.participacion;
        document.getElementById('gastosPeso').textContent = '$' + parseFloat(data.comparativo_metodos.por_peso.gastos_estimados).toLocaleString('es-AR', {minimumFractionDigits:2});
        
        // Deshabilitar botones si no hay datos
        document.getElementById('btnVolumen').disabled = !data.comparativo_metodos.por_volumen.disponible;
        document.getElementById('btnVolumen').style.opacity = data.comparativo_metodos.por_volumen.disponible ? '1' : '0.5';
        
        document.getElementById('btnPeso').disabled = !data.comparativo_metodos.por_peso.disponible;
        document.getElementById('btnPeso').style.opacity = data.comparativo_metodos.por_peso.disponible ? '1' : '0.5';
        
        // Mostrar gastos a prorratear
        document.getElementById('gastosAProrratear').textContent = '$' + parseFloat(data.gastos.total_a_prorratear).toLocaleString('es-AR', {minimumFractionDigits:2});
        
        document.getElementById('consolidadoLoading').style.display = 'none';
        document.getElementById('consolidadoContenido').style.display = 'block';
        
    } catch (err) {
        console.error('Error:', err);
        alert('Error al cargar preview');
        cerrarModalConsolidado();
    }
}

function cerrarModalConsolidado() {
    document.getElementById('modalConsolidado').style.display = 'none';
    costeoIdParaCalcular = null;
}

async function calcularConMetodo(metodo) {
    if (!costeoIdParaCalcular) return;
    cerrarModalConsolidado();
    await ejecutarCalculo(costeoIdParaCalcular, metodo);
}

async function ejecutarCalculo(id, metodo) {
    try {
        const body = metodo ? JSON.stringify({ metodo: metodo }) : '{}';
        const res = await fetch(API_URL + '/api/costeos/' + id + '/calcular', { 
            method: 'POST', 
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: body
        });
        const data = await res.json();
        
        if (res.ok) { 
            var mensaje = '✅ Costeo calculado!\n\nCosto Total: $' + parseFloat(data.resumen?.costo_total_final_ars || 0).toLocaleString('es-AR');
            if (data.consolidado) {
                mensaje += '\n\n📦 Consolidado - Método: ' + data.consolidado.metodo_usado.toUpperCase();
                mensaje += '\nParticipación aplicada: ' + data.consolidado.participacion_aplicada;
            }
            if (data.avisos && data.avisos.length > 0) {
                mensaje += '\n\n⚠️ AVISOS:\n' + data.avisos.join('\n');
            }
            alert(mensaje); 
            cargarCosteos(); 
        } else { 
            alert('Error: ' + (data.error || 'No se pudo calcular')); 
        }
    } catch (err) { 
        alert('Error de conexión'); 
        console.error(err);
    }
}

        async function exportarCosteo(id) {
            try {
                const res = await fetch(API_URL + '/api/costeos/' + id + '/exportar', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const cd = res.headers.get('Content-Disposition');
                    a.download = cd && cd.match(/filename="(.+)"/) ? cd.match(/filename="(.+)"/)[1] : 'costeo.xlsx';
                    document.body.appendChild(a); a.click(); a.remove();
                    window.URL.revokeObjectURL(url);
                } else { alert('Error al exportar'); }
            } catch (err) { alert('Error de conexion'); }
        }

        async function eliminarCosteo(id) {
            const costeo = todosLosCosteos.find(c => c.id === id);
            const esDefin = costeo && esDefinitivo(costeo);
            if (esDefin) {
                const nombreCosteo = costeo.nombre_costeo || 'este costeo';
                if (!confirm('⚠️ ATENCIÓN: "' + nombreCosteo + '" es un costeo DEFINITIVO.\n\n¿Estás segura de que querés eliminarlo? Esta acción no se puede deshacer.')) return;
                const confirma = prompt('Para confirmar, escribí ELIMINAR:');
                if (confirma !== 'ELIMINAR') { alert('Eliminación cancelada'); return; }
            } else {
                if (!confirm('¿Seguro que querés eliminar este costeo?')) return;
            }
            try {
                const res = await fetch(API_URL + '/api/costeos/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) { alert('Costeo eliminado'); seleccionados.delete(id); cargarCosteos(); }
                else { alert('Error al eliminar'); }
            } catch (err) { alert('Error de conexión'); }
        }

        async function verDetalle(id) {
            try {
                const res = await fetch(API_URL + '/api/costeos/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
                const costeo = await res.json();
                if (res.ok) {
                    document.getElementById('modalTitle').textContent = costeo.nombre_costeo || 'Detalle';
                    document.getElementById('modalBody').innerHTML = '<div class="detail-grid">' +
                        '<div class="detail-item"><div class="detail-label">Proveedor</div><div class="detail-value">' + (costeo.proveedor || '-') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">Factura</div><div class="detail-value">' + (costeo.factura_nro || '-') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">Moneda</div><div class="detail-value">' + (costeo.moneda_principal || 'USD') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">TC USD</div><div class="detail-value">' + (costeo.tc_usd || '-') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">TC EUR</div><div class="detail-value">' + (costeo.tc_eur || '-') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">TC GBP</div><div class="detail-value">' + (costeo.tc_gbp || '-') + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">Unidades</div><div class="detail-value">' + (costeo.unidades_totales || 0) + '</div></div>' +
                        '<div class="detail-item"><div class="detail-label">Total Gastos</div><div class="detail-value">$' + parseFloat(costeo.total_gastos_ars || 0).toLocaleString('es-AR') + '</div></div>' +
                        '<div class="detail-item" style="grid-column: span 2;"><div class="detail-label">INVERSION TOTAL</div><div class="detail-value highlight" style="font-size:24px;">$' + parseFloat(costeo.costo_total_ars || 0).toLocaleString('es-AR') + '</div></div>' +
                        '</div>';
                    document.getElementById('detalleModal').classList.add('show');
                }
            } catch (err) { alert('Error al cargar detalle'); }
        }

        function exportarSeleccionados() {
            if (seleccionados.size === 0) { alert('No hay costeos seleccionados'); return; }
            alert('Funcion en desarrollo: Exportar ' + seleccionados.size + ' costeos');
        }

        function abrirRecalcular() {
            if (seleccionados.size === 0) { alert('No hay costeos seleccionados'); return; }
            document.getElementById('recalcularModal').classList.add('show');
        }

        async function ejecutarRecalcular() {
            const tcUsd = document.getElementById('tcUsdNuevo').value;
            const tcEur = document.getElementById('tcEurNuevo').value;
            const tcGbp = document.getElementById('tcGbpNuevo').value;
            if (!tcUsd && !tcEur && !tcGbp) { alert('Ingresa al menos un tipo de cambio'); return; }
            const ids = Array.from(seleccionados);
            var exitosos = 0, errores = 0;
            for (const id of ids) {
                try {
                    const res = await fetch(API_URL + '/api/costeos/' + id + '/recalcular', {
                        method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tc_usd: tcUsd, tc_eur: tcEur, tc_gbp: tcGbp })
                    });
                    if (res.ok) exitosos++; else errores++;
                } catch (err) { errores++; }
            }
            cerrarModal('recalcularModal');
            alert('Recalculo completado:\n- Exitosos: ' + exitosos + '\n- Errores: ' + errores);
            cargarCosteos();
        }

        var costeoModificado = false;
        function marcarModificado() { costeoModificado = true; }
        function cerrarModal(id) { 
            if (id === 'cargaManualModal' && costeoModificado) {
                if (!confirm('Hay cambios sin guardar. ¿Seguro que querés cerrar?')) return;
            }
            costeoModificado = false;
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('show');
                modal.style.display = '';
            }
        }
        // ========== COMPARATIVO PRESUPUESTO VS DEFINITIVO ==========
        async function compararSeleccionados() {
            const ids = [...seleccionados];
            if (ids.length < 2) { alert('Seleccioná al menos 2 costeos para comparar'); return; }
            if (ids.length > 2) { alert('Seleccioná exactamente 2 costeos para comparar. Tenés ' + ids.length + ' seleccionados.'); return; }
            await mostrarComparativo(ids);
        }

        // Mantener compatibilidad si se llama desde otro lugar
        async function iniciarComparativo(costeoId, proveedor) {
            const ids = [...seleccionados];
            if (ids.length < 2) {
                // Fallback: buscar otro del mismo proveedor
                const mismoProveedor = todosLosCosteos.filter(c => c.proveedor && c.proveedor.toUpperCase().trim() === proveedor.toUpperCase().trim() && c.id !== costeoId);
                if (mismoProveedor.length === 0) { alert('Seleccioná al menos 2 costeos con los checkboxes para comparar.'); return; }
                seleccionados.add(costeoId);
                seleccionados.add(mismoProveedor[0].id);
            }
            await mostrarComparativo([...seleccionados]);
        }

        async function mostrarComparativo(ids) {
            try {
                const promesas = ids.map(id => fetch(API_URL + '/api/costeos/' + id, { headers: { 'Authorization': 'Bearer ' + token } }).then(r => r.json()));
                const costeos = await Promise.all(promesas);
                const c1 = costeos[0], c2 = costeos[1];

                const pctDif = (a, b) => { a = parseFloat(a)||0; b = parseFloat(b)||0; if (b === 0) return a === 0 ? 0 : 100; return ((a - b) / Math.abs(b)) * 100; };
                const fmtNum = (v) => (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
                const fmtFob = (v) => (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:4, maximumFractionDigits:4});
                const fmtPct = (v) => { const n = parseFloat(v); return (n > 0 ? '+' : '') + n.toFixed(2) + '%'; };
                const colorPct = (v) => { const n = parseFloat(v); return n > 2 ? '#f44336' : n < -2 ? '#4CAF50' : n !== 0 ? '#ff9800' : '#aaa'; };
                const tdSt = 'padding:5px 8px;text-align:right;border-bottom:1px solid #333;';
                const difCell = (a, b) => { const d = pctDif(a, b); return '<td style="' + tdSt + 'font-weight:bold;color:' + colorPct(d) + ';">' + fmtPct(d) + '</td>'; };
                const n1 = (c1.nombre_costeo || '').substring(0, 25);
                const n2 = (c2.nombre_costeo || '').substring(0, 25);
                const thRow = '<th style="padding:6px 8px;text-align:right;border-bottom:2px solid #444;color:#4CAF50;font-size:12px;">' + n1 + '</th>' +
                              '<th style="padding:6px 8px;text-align:right;border-bottom:2px solid #444;color:#ff9800;font-size:12px;">' + n2 + '</th>' +
                              '<th style="padding:6px 8px;text-align:right;border-bottom:2px solid #444;color:#64b5f6;font-size:12px;">Dif %</th>';

                var html = '';

                // Guardo el estado del comparativo actual en window para que el flujo de
                // exportar pueda acceder a los ids y nombres vigentes (el usuario puede
                // haber invertido la comparación, y el export debe respetar ese orden).
                window.comparativoActual = { ids: [ids[0], ids[1]], n1: c1.nombre_costeo || '', n2: c2.nombre_costeo || '' };

                // ===== BOTONES DE ACCIÓN (Invertir + Exportar) =====
                const idsJson = JSON.stringify([ids[1], ids[0]]);
                html += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:12px;">';
                // Invertir: swappea qué costeo es la base del cálculo de diferencia %.
                // Re-llama a mostrarComparativo con los ids invertidos.
                html += '<button onclick=\'mostrarComparativo(' + idsJson + ')\' ' +
                        'style="background:#2196F3;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;" ' +
                        'title="Invertir: calcular la diferencia % tomando el otro costeo como base">' +
                        '🔄 Invertir comparación</button>';
                // Exportar: abre modal de selección de secciones (Excel o PDF).
                html += '<button onclick="abrirExportComparativo()" ' +
                        'style="background:#9C27B0;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;" ' +
                        'title="Exportar el comparativo a Excel o PDF">' +
                        '📤 Exportar</button>';
                html += '</div>';

                // ===== ENCABEZADO: 2 tarjetas =====
                html += '<div style="display:flex;gap:12px;margin-bottom:20px;">';
                [c1, c2].forEach((c, i) => {
                    const def = !!c.fecha_despacho;
                    const color = i === 0 ? '#4CAF50' : '#ff9800';
                    html += '<div style="flex:1;background:#1e1e2f;padding:12px;border-radius:8px;border-left:4px solid ' + color + ';">';
                    html += '<h4 style="color:' + color + ';margin:0 0 6px 0;font-size:13px;">' + (def ? '✅ DEFINITIVO' : '📋 PRESUPUESTO') + '</h4>';
                    html += '<p style="margin:3px 0;font-weight:bold;">' + (c.nombre_costeo || '-') + '</p>';
                    html += '<p style="margin:3px 0;font-size:12px;color:#aaa;">Fecha: ' + formatearFecha(c.fecha_despacho || c.fecha_factura) + '</p>';
                    html += '<p style="margin:3px 0;font-size:12px;">Estado: <span style="color:' + (c.estado === 'calculado' ? '#4CAF50' : '#ff9800') + ';">' + (c.estado || 'borrador') + '</span> | Arts: ' + (c.articulos||[]).length + '</p>';
                    html += '</div>';
                });
                html += '</div>';

                // ===== TIPOS DE CAMBIO =====
                html += '<h4 style="color:#2196F3;margin:15px 0 8px 0;">💱 Tipos de Cambio</h4>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#2a2a3e;">';
                html += '<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #444;">Moneda</th>' + thRow;
                html += '</tr></thead><tbody>';
                ['USD','EUR','GBP'].forEach(mon => {
                    const v1 = parseFloat(c1['tc_' + mon.toLowerCase()])||0;
                    const v2 = parseFloat(c2['tc_' + mon.toLowerCase()])||0;
                    if (v1 === 0 && v2 === 0) return;
                    html += '<tr><td style="padding:5px 8px;border-bottom:1px solid #333;font-weight:bold;">' + mon + '</td>';
                    html += '<td style="' + tdSt + '">' + fmtNum(v1) + '</td>';
                    html += '<td style="' + tdSt + '">' + fmtNum(v2) + '</td>';
                    html += difCell(v1, v2) + '</tr>';
                });
                html += '</tbody></table>';

                // ===== BASE ADUANA EN DIVISA =====
                html += '<h4 style="color:#e91e63;margin:20px 0 8px 0;">📦 Base Aduana (FOB + Flete + Seguro) en Divisa</h4>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#2a2a3e;">';
                html += '<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #444;">Concepto</th>';
                html += '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #444;">Mon.</th>' + thRow;
                html += '</tr></thead><tbody>';
                const baseRows = [
                    { label: 'Puesta FOB', monKey: 'moneda_principal', valFn: c => parseFloat(c.es_consolidado ? c.fob_parte : c.fob_monto)||0 },
                    { label: 'Flete Internacional', monKey: 'flete_moneda', valFn: c => parseFloat(c.es_consolidado ? c.flete_parte : c.flete_monto)||0 },
                    { label: 'Seguro', monKey: 'seguro_moneda', valFn: c => parseFloat(c.es_consolidado ? c.seguro_parte : c.seguro_monto)||0 }
                ];
                for (const row of baseRows) {
                    const mon = (c1[row.monKey] || 'USD').toUpperCase();
                    const v1 = row.valFn(c1), v2 = row.valFn(c2);
                    html += '<tr><td style="padding:5px 8px;border-bottom:1px solid #333;">' + row.label + '</td>';
                    html += '<td style="padding:5px 8px;text-align:center;border-bottom:1px solid #333;">' + mon + '</td>';
                    html += '<td style="' + tdSt + '">' + fmtNum(v1) + '</td>';
                    html += '<td style="' + tdSt + '">' + fmtNum(v2) + '</td>';
                    html += difCell(v1, v2) + '</tr>';
                }
                html += '</tbody></table>';

                // ===== GASTOS VARIOS EN DIVISA (sin STABZ) =====
                const gastosMap = new Map();
                [c1, c2].forEach((c, idx) => {
                    (c.gastos_varios || []).forEach(g => {
                        const desc = (g.descripcion || '').toUpperCase().trim();
                        if (desc.includes('STABZ') || (g.proveedor_gasto || '').toUpperCase().includes('STABZ')) return;
                        if (!gastosMap.has(desc)) gastosMap.set(desc, { desc: g.descripcion, moneda: g.moneda || 'USD', valores: [0, 0] });
                        gastosMap.get(desc).valores[idx] = parseFloat(g.monto) || 0;
                        if (g.moneda) gastosMap.get(desc).moneda = g.moneda;
                    });
                });

                if (gastosMap.size > 0) {
                    html += '<h4 style="color:#ff9800;margin:20px 0 8px 0;">📋 Gastos del Legajo en Divisa <span style="font-size:12px;color:#888;">(sin STABZ)</span></h4>';
                    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#2a2a3e;">';
                    html += '<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #444;">Descripción</th>';
                    html += '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #444;">Mon.</th>' + thRow;
                    html += '</tr></thead><tbody>';
                    var t1 = 0, t2 = 0;
                    for (const [key, item] of gastosMap) {
                        const v1 = item.valores[0], v2 = item.valores[1];
                        t1 += v1; t2 += v2;
                        html += '<tr><td style="padding:5px 8px;border-bottom:1px solid #333;">' + (item.desc || '-') + '</td>';
                        html += '<td style="padding:5px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">' + item.moneda + '</td>';
                        html += '<td style="' + tdSt + '">' + (v1 ? fmtNum(v1) : '-') + '</td>';
                        html += '<td style="' + tdSt + '">' + (v2 ? fmtNum(v2) : '-') + '</td>';
                        html += (v1 > 0 && v2 > 0 ? difCell(v1, v2) : '<td style="' + tdSt + '">-</td>') + '</tr>';
                    }
                    html += '<tr style="background:#1a1a2e;font-weight:bold;">';
                    html += '<td colspan="2" style="padding:6px 8px;border-top:2px solid #444;">TOTAL GASTOS</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;">' + fmtNum(t1) + '</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;">' + fmtNum(t2) + '</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;font-weight:bold;color:' + colorPct(pctDif(t1,t2)) + ';">' + fmtPct(pctDif(t1,t2)) + '</td>';
                    html += '</tr></tbody></table>';
                }

                // ===== GASTOS DE ADUANA (ARS) =====
                const gastosAduanaFields = [
                    {key:'despachante',label:'Despachante'},{key:'gestion_senasa',label:'Gestión SENASA'},
                    {key:'gestion_anmat',label:'Gestión ANMAT'},{key:'transporte_internacional',label:'Transporte Intl.'},
                    {key:'gastos_origen',label:'Gastos Origen'},{key:'terminal',label:'Terminal'},
                    {key:'maritima_agencia',label:'Marítima/Agencia'},{key:'bancarios',label:'Bancarios'},
                    {key:'gestor',label:'Gestor'},{key:'transporte_nacional',label:'Transporte Nacional'},
                    {key:'custodia',label:'Custodia'},{key:'sim',label:'SIM'}
                ];
                const ga1 = c1.gastos_aduana || {}, ga2 = c2.gastos_aduana || {};
                const tieneGA = gastosAduanaFields.some(f => (parseFloat(ga1[f.key])||0) > 0 || (parseFloat(ga2[f.key])||0) > 0);

                if (tieneGA) {
                    html += '<h4 style="color:#9C27B0;margin:20px 0 8px 0;">🏛️ Gastos de Aduana (ARS)</h4>';
                    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#2a2a3e;">';
                    html += '<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #444;">Concepto</th>' + thRow;
                    html += '</tr></thead><tbody>';
                    var tga1 = 0, tga2 = 0;
                    for (const f of gastosAduanaFields) {
                        const v1 = parseFloat(ga1[f.key])||0, v2 = parseFloat(ga2[f.key])||0;
                        if (v1 === 0 && v2 === 0) continue;
                        tga1 += v1; tga2 += v2;
                        html += '<tr><td style="padding:5px 8px;border-bottom:1px solid #333;">' + f.label + '</td>';
                        html += '<td style="' + tdSt + '">$' + fmtNum(v1) + '</td>';
                        html += '<td style="' + tdSt + '">$' + fmtNum(v2) + '</td>';
                        html += (v1 > 0 && v2 > 0 ? difCell(v1, v2) : '<td style="' + tdSt + '">-</td>') + '</tr>';
                    }
                    html += '<tr style="background:#1a1a2e;font-weight:bold;">';
                    html += '<td style="padding:6px 8px;border-top:2px solid #444;">TOTAL</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;">$' + fmtNum(tga1) + '</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;">$' + fmtNum(tga2) + '</td>';
                    html += '<td style="padding:6px 8px;text-align:right;border-top:2px solid #444;font-weight:bold;color:' + colorPct(pctDif(tga1,tga2)) + ';">' + fmtPct(pctDif(tga1,tga2)) + '</td>';
                    html += '</tr></tbody></table>';
                }

                // ===== ARTÍCULOS: FOB + ALERTAS =====
                const todosCodigosComp = new Set();
                [c1, c2].forEach(c => (c.articulos||[]).forEach(a => todosCodigosComp.add(a.codigo_goodies)));

                html += '<h4 style="color:#4fc3f7;margin:20px 0 8px 0;">📦 Artículos — FOB Unitario y Alertas</h4>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#2a2a3e;">';
                html += '<th style="padding:6px;text-align:left;border-bottom:2px solid #444;">Artículo</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#4CAF50;font-size:11px;">FOB ' + n1.substring(0,12) + '</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#ff9800;font-size:11px;">FOB ' + n2.substring(0,12) + '</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#64b5f6;font-size:11px;">Dif %</th>';
                html += '<th style="padding:6px;text-align:center;border-bottom:2px solid #444;font-size:11px;">Alertas</th>';
                html += '</tr></thead><tbody>';

                for (const codigo of todosCodigosComp) {
                    const a1 = (c1.articulos||[]).find(a => a.codigo_goodies === codigo);
                    const a2 = (c2.articulos||[]).find(a => a.codigo_goodies === codigo);
                    const nombre = (a1 || a2 || {}).nombre || '';
                    const f1 = a1 ? (parseFloat(a1.fob_unitario_usd)||0) : 0;
                    const f2 = a2 ? (parseFloat(a2.fob_unitario_usd)||0) : 0;
                    const d1 = a1 ? (parseFloat(a1.derechos_porcentaje)||0) : 0;
                    const d2 = a2 ? (parseFloat(a2.derechos_porcentaje)||0) : 0;
                    const ii1 = a1 ? (parseFloat(a1.impuesto_interno_porcentaje)||0) : 0;
                    const ii2 = a2 ? (parseFloat(a2.impuesto_interno_porcentaje)||0) : 0;

                    const alertas = [];
                    if (d1 > 0 && d2 > 0 && d1.toFixed(4) !== d2.toFixed(4)) alertas.push('⚠️ Derechos: ' + (d1*100).toFixed(1) + '% / ' + (d2*100).toFixed(1) + '%');
                    if (ii1 > 0 && ii2 > 0 && ii1.toFixed(4) !== ii2.toFixed(4)) alertas.push('⚠️ Imp.Int: ' + (ii1*100).toFixed(1) + '% / ' + (ii2*100).toFixed(1) + '%');
                    if (f1 > 0 && f2 > 0 && Math.abs(pctDif(f2, f1)) > 5) alertas.push('⚠️ FOB varía ' + Math.abs(pctDif(f2, f1)).toFixed(1) + '%');

                    const tieneAlerta = alertas.length > 0;
                    const rowBg = tieneAlerta ? ' style="background:rgba(244,67,54,0.08);"' : '';
                    html += '<tr' + rowBg + '>';
                    html += '<td style="padding:4px 6px;border-bottom:1px solid #333;"><strong>' + codigo + '</strong><br><small style="color:#aaa;">' + nombre + '</small></td>';
                    html += '<td style="padding:4px 6px;text-align:right;border-bottom:1px solid #333;">' + (f1 ? fmtFob(f1) : '-') + '</td>';
                    html += '<td style="padding:4px 6px;text-align:right;border-bottom:1px solid #333;">' + (f2 ? fmtFob(f2) : '-') + '</td>';
                    html += (f1 > 0 && f2 > 0 ? difCell(f2, f1) : '<td style="' + tdSt + '">-</td>');
                    html += '<td style="padding:4px 6px;border-bottom:1px solid #333;font-size:11px;">' + (tieneAlerta ? alertas.join('<br>') : '<span style="color:#4CAF50;">✔</span>') + '</td>';
                    html += '</tr>';
                }
                html += '</tbody></table>';

                // ===== ARTÍCULOS: COSTO NETO UNITARIO (ARS) =====
                html += '<h4 style="color:#ffd54f;margin:20px 0 8px 0;">💰 Artículos — Costo Neto Unitario (ARS)</h4>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#2a2a3e;">';
                html += '<th style="padding:6px;text-align:left;border-bottom:2px solid #444;">Artículo</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#4CAF50;font-size:11px;">Costo Neto ' + n1.substring(0,12) + '</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#ff9800;font-size:11px;">Costo Neto ' + n2.substring(0,12) + '</th>';
                html += '<th style="padding:6px;text-align:right;border-bottom:2px solid #444;color:#64b5f6;font-size:11px;">Dif %</th>';
                html += '</tr></thead><tbody>';

                for (const codigo of todosCodigosComp) {
                    const a1 = (c1.articulos||[]).find(a => a.codigo_goodies === codigo);
                    const a2 = (c2.articulos||[]).find(a => a.codigo_goodies === codigo);
                    const nombre = (a1 || a2 || {}).nombre || '';
                    const cn1 = a1 ? (parseFloat(a1.costo_unitario_neto_ars)||0) : 0;
                    const cn2 = a2 ? (parseFloat(a2.costo_unitario_neto_ars)||0) : 0;

                    html += '<tr>';
                    html += '<td style="padding:4px 6px;border-bottom:1px solid #333;"><strong>' + codigo + '</strong><br><small style="color:#aaa;">' + nombre + '</small></td>';
                    html += '<td style="padding:4px 6px;text-align:right;border-bottom:1px solid #333;">' + (cn1 ? '$' + fmtNum(cn1) : '-') + '</td>';
                    html += '<td style="padding:4px 6px;text-align:right;border-bottom:1px solid #333;">' + (cn2 ? '$' + fmtNum(cn2) : '-') + '</td>';
                    html += (cn1 > 0 && cn2 > 0 ? difCell(cn2, cn1) : '<td style="' + tdSt + '">-</td>');
                    html += '</tr>';
                }
                html += '</tbody></table>';

                document.getElementById('compPvsDefBody').innerHTML = html;
                document.getElementById('compPvsDefTitle').textContent = 'Comparativo: ' + n1 + ' vs ' + n2;
                document.getElementById('compPvsDefModal').classList.add('show');
            } catch (err) {
                console.error(err);
                alert('Error al generar comparativo: ' + err.message);
            }
        }

        // =============================================
        // EXPORTAR COMPARATIVO (Excel + PDF)
        // =============================================

        // Paso 1: abre el modal de selección de secciones
        function abrirExportComparativo() {
            if (!window.comparativoActual || !window.comparativoActual.ids) {
                alert('No hay un comparativo activo para exportar');
                return;
            }
            document.getElementById('exportCompModal').classList.add('show');
        }

        // Lee el estado de los checkboxes y devuelve el objeto de secciones
        function _leerSeccionesExport() {
            return {
                tc:                  document.getElementById('expSec_tc').checked,
                baseAduana:          document.getElementById('expSec_baseAduana').checked,
                gastosVarios:        document.getElementById('expSec_gastosVarios').checked,
                gastosAduana:        document.getElementById('expSec_gastosAduana').checked,
                articulosFOB:        document.getElementById('expSec_articulosFOB').checked,
                articulosCostoNeto:  document.getElementById('expSec_articulosCostoNeto').checked,
                composicionCostos:   document.getElementById('expSec_composicionCostos').checked
            };
        }

        // Sanitiza un nombre para usarlo como filename (igual criterio que backend)
        function _sanitizarNombreArchivo(nombre) {
            return (nombre || 'Costeo')
                .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '')
                .trim()
                .replace(/\s+/g, '_');
        }

        // Paso 2a: exportar a Excel (backend)
        async function ejecutarExportComparativoExcel() {
            const estado = window.comparativoActual;
            if (!estado || !estado.ids) { alert('No hay comparativo activo'); return; }
            const secciones = _leerSeccionesExport();
            // Validación: al menos una sección marcada
            if (!Object.values(secciones).some(v => v)) {
                alert('Seleccioná al menos una sección para exportar');
                return;
            }
            try {
                const res = await fetch(API_URL + '/api/costeos/comparativo-export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ ids: estado.ids, secciones: secciones })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
                    throw new Error(err.detalles || err.error || 'Error al generar Excel');
                }
                const blob = await res.blob();
                const n1s = _sanitizarNombreArchivo(estado.n1);
                const n2s = _sanitizarNombreArchivo(estado.n2);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Comparativo_' + n1s + '_vs_' + n2s + '.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                cerrarModal('exportCompModal');
            } catch (err) {
                console.error(err);
                alert('Error al exportar Excel: ' + err.message);
            }
        }

        // Paso 2b: exportar a PDF (client-side vía window.print)
        // Abre una ventana nueva con el HTML del comparativo formateado para impresión,
        // y dispara window.print(). El usuario elige "Guardar como PDF" en el diálogo.
        function ejecutarExportComparativoPDF() {
            const estado = window.comparativoActual;
            if (!estado || !estado.ids) { alert('No hay comparativo activo'); return; }
            const secciones = _leerSeccionesExport();
            if (!Object.values(secciones).some(v => v)) {
                alert('Seleccioná al menos una sección para exportar');
                return;
            }

            // Reconstruyo el HTML del comparativo en una ventana nueva, filtrando por secciones.
            // Parto del DOM actual del modal y filtro las secciones no deseadas por su <h4>.
            const bodyHTML = document.getElementById('compPvsDefBody').innerHTML;
            const temp = document.createElement('div');
            temp.innerHTML = bodyHTML;

            // Remuevo los botones de acción (Invertir / Exportar) del HTML a imprimir
            const primerDiv = temp.querySelector('div[style*="justify-content:flex-end"]');
            if (primerDiv) primerDiv.remove();

            // Mapeo de seccion -> texto del <h4> que la identifica
            const mapSecciones = {
                tc: 'Tipos de Cambio',
                baseAduana: 'Base Aduana',
                gastosVarios: 'Gastos Varios',
                gastosAduana: 'Gastos de Aduana',
                articulosFOB: 'FOB Unitario',
                articulosCostoNeto: 'Costo Neto Unitario'
            };
            // Para cada sección desmarcada, ubico su <h4> y remuevo el <h4> + la <table> siguiente
            Object.keys(mapSecciones).forEach(key => {
                if (secciones[key]) return;
                const textoBuscar = mapSecciones[key];
                const h4s = temp.querySelectorAll('h4');
                h4s.forEach(h4 => {
                    if (h4.textContent.indexOf(textoBuscar) !== -1) {
                        // Elimino también la tabla que sigue al h4
                        let next = h4.nextElementSibling;
                        h4.remove();
                        if (next && next.tagName === 'TABLE') next.remove();
                    }
                });
            });

            const htmlFiltrado = temp.innerHTML;
            const titulo = 'Comparativo: ' + estado.n1 + ' vs ' + estado.n2;
            const fechaHoy = new Date().toLocaleDateString('es-AR');

            // Armo documento HTML completo optimizado para impresión.
            // Uso colores claros (fondo blanco, texto negro) porque imprimir el modo oscuro queda ilegible.
            const docHTML = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
                '<title>' + titulo + '</title>' +
                '<style>' +
                'body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; margin: 20px; font-size: 11px; }' +
                'h2 { color: #1A237E; margin: 0 0 8px 0; font-size: 18px; }' +
                'h4 { color: #1A237E; margin: 18px 0 8px 0; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }' +
                'table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }' +
                'th { background: #E8EAF6 !important; color: #1A237E; padding: 6px 8px; text-align: right; border: 1px solid #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
                'th:first-child { text-align: left; }' +
                'td { padding: 5px 8px; border: 1px solid #ddd; text-align: right; }' +
                'td:first-child { text-align: left; }' +
                '.header-info { margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-left: 4px solid #1A237E; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
                '.header-info p { margin: 3px 0; }' +
                '@media print { body { margin: 10mm; } h4 { page-break-after: avoid; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }' +
                '</style></head><body>' +
                '<h2>GOODIES — Comparativo de Costeos</h2>' +
                '<div class="header-info">' +
                '<p><strong>Costeo A (base):</strong> ' + estado.n1 + '</p>' +
                '<p><strong>Costeo B (comparado):</strong> ' + estado.n2 + '</p>' +
                '<p><strong>Fecha de exportación:</strong> ' + fechaHoy + '</p>' +
                '</div>' +
                htmlFiltrado +
                '<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };<\/script>' +
                '</body></html>';

            const ventana = window.open('', '_blank', 'width=1000,height=800');
            if (!ventana) {
                alert('No se pudo abrir la ventana de impresión. Verificá que tu navegador no esté bloqueando pop-ups.');
                return;
            }
            ventana.document.open();
            ventana.document.write(docHTML);
            ventana.document.close();
            cerrarModal('exportCompModal');
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarModal('detalleModal'); cerrarModal('recalcularModal'); cerrarModal('cargaManualModal'); cerrarModal('compPvsDefModal'); cerrarModal('exportCompModal'); } });
function abrirCargaManual() {
            window.costeoEditandoId = null;
            articulosManual = [];
            gastosManual = [];
            proveedoresConsolidado = [];
            // Limpiar alertas de legajos anteriores
            const alertaDiv = document.getElementById('maestroAlertas');
            if (alertaDiv) { alertaDiv.innerHTML = ''; alertaDiv.style.display = 'none'; }
            document.getElementById('cm_nombre').value = '';
            document.getElementById('cm_proveedor').value = '';
            document.getElementById('cm_tieneIntermediaria').checked = false;
            document.getElementById('cm_intermediaria').value = '';
            document.getElementById('cm_intermediariaGroup').style.display = 'none';
           document.getElementById('cm_facturaIntermGroup').style.display = 'none';
            document.getElementById('cm_fechaFacturaIntermGroup').style.display = 'none';
            document.getElementById('cm_fechaVencIntermGroup').style.display = 'none';
            document.getElementById('cm_facturaInterm').value = '';
            document.getElementById('cm_fechaVencInterm').value = '';
            document.getElementById('cm_fechaFacturaInterm').value = '';
            document.getElementById('cm_esConsolidado').checked = false;
            document.getElementById('cm_consolidadoSection').style.display = 'none';
            // Reset toggle "Cargar por caja" y su header
            const cmPorCaja = document.getElementById('cm_cargarPorCaja');
            if (cmPorCaja) cmPorCaja.checked = false;
            const thValorOrigen = document.getElementById('thValorOrigen');
            if (thValorOrigen) thValorOrigen.textContent = 'Valor Origen';
            const thValorFabrica = document.getElementById('thValorFabrica');
            if (thValorFabrica) thValorFabrica.textContent = 'Valor Fábrica';
            document.getElementById('cm_volumenM3').value = '';
            document.getElementById('cm_pesoKg').value = '';
            const thConsolidado = document.getElementById('thConsolidado');
            if (thConsolidado) thConsolidado.style.display = 'none';
            document.getElementById('cm_facturaNro').value = '';
            document.getElementById('cm_moneda').value = 'USD';
            document.getElementById('cm_monto').value = '';
            document.getElementById('cm_fechaFactura').value = '';
            document.getElementById('cm_fechaVenc').value = '';
            document.getElementById('cm_fechaDespacho').value = '';
            document.getElementById('cm_nroDespacho').value = '';
            document.getElementById('cm_tcUsd').value = '';
            document.getElementById('cm_tcEur').value = '';
            document.getElementById('cm_tcGbp').value = '';
            document.getElementById('cm_fobMoneda').value = 'USD';
            document.getElementById('cm_fobMonto').value = '';
            document.getElementById('cm_fleteMoneda').value = 'USD';
            document.getElementById('cm_fleteMonto').value = '';
            document.getElementById('cm_seguroMoneda').value = 'USD';
            document.getElementById('cm_seguroMonto').value = '';
            
            
            agregarArticulo();
            agregarGasto();
            cambiarTab('datosGenerales');
            document.getElementById('cargaManualModal').classList.add('show');
        }
        function toggleIntermediaria() {
            const tiene = document.getElementById('cm_tieneIntermediaria').checked;
            document.getElementById('cm_intermediariaGroup').style.display = tiene ? 'block' : 'none';
            document.getElementById('cm_facturaIntermGroup').style.display = tiene ? 'block' : 'none';
            document.getElementById('cm_fechaFacturaIntermGroup').style.display = tiene ? 'block' : 'none';
            document.getElementById('cm_fechaVencIntermGroup').style.display = tiene ? 'block' : 'none';
            
            renderizarArticulos();
        }
        
        // Variables para consolidado
        var proveedoresConsolidado = [];
        
        function toggleConsolidado() {
            const esConsolidado = document.getElementById('cm_esConsolidado').checked;
            document.getElementById('cm_consolidadoSection').style.display = esConsolidado ? 'block' : 'none';
            const thConsolidado = document.getElementById('thConsolidado');
const thMontoProrrateado = document.getElementById('thMontoProrrateado');
            if (thConsolidado) thConsolidado.style.display = esConsolidado ? 'table-cell' : 'none';
if (thMontoProrrateado) thMontoProrrateado.style.display = esConsolidado ? 'table-cell' : 'none';
const btnVerComparativo = document.getElementById('btnVerComparativo'); if (btnVerComparativo) btnVerComparativo.style.display = esConsolidado ? 'inline-block' : 'none';
const fobParteGroup = document.getElementById('fobParteGroup'); if (fobParteGroup) fobParteGroup.style.display = esConsolidado ? 'block' : 'none';
const fleteParteGroup = document.getElementById('fleteParteGroup'); if (fleteParteGroup) fleteParteGroup.style.display = esConsolidado ? 'block' : 'none';
            const seguroParteGroup = document.getElementById('seguroParteGroup'); if (seguroParteGroup) seguroParteGroup.style.display = esConsolidado ? 'block' : 'none';
            if (esConsolidado) calcularPartesBaseAduana();
            if (esConsolidado && proveedoresConsolidado.length === 0) {
                agregarProveedorConsolidado();
            }
            renderizarProveedoresConsolidado();
            renderizarGastos();
        }
        
        function agregarProveedorConsolidado() {
            proveedoresConsolidado.push({ nombre: '', fob_total: '', moneda: 'USD', volumen_m3: '', peso_kg: '' });
            renderizarProveedoresConsolidado();
        }
        
        function eliminarProveedorConsolidado(idx) {
            proveedoresConsolidado.splice(idx, 1);
            renderizarProveedoresConsolidado();
        }
        
        function renderizarProveedoresConsolidado() {
            const container = document.getElementById('consolidadoProveedoresBody');
            if (!container) return;
            container.innerHTML = proveedoresConsolidado.map((p, idx) => {
                return '<div style="display:flex; gap:10px; margin-bottom:10px; align-items:center; background:#252538; padding:10px; border-radius:5px;">' +
                    '<input type="text" value="' + (p.nombre || '') + '" onchange="proveedoresConsolidado[' + idx + '].nombre=this.value" placeholder="Nombre Proveedor" style="flex:2;">' +
                    '<input type="number" step="0.01" value="' + (p.fob_total || '') + '" onchange="proveedoresConsolidado[' + idx + '].fob_total=this.value" placeholder="FOB Total" style="flex:1;">' +
                    '<select onchange="proveedoresConsolidado[' + idx + '].moneda=this.value" style="flex:0.5;">' +
                        '<option value="USD" ' + (p.moneda === 'USD' ? 'selected' : '') + '>USD</option>' +
                        '<option value="EUR" ' + (p.moneda === 'EUR' ? 'selected' : '') + '>EUR</option>' +
                        '<option value="GBP" ' + (p.moneda === 'GBP' ? 'selected' : '') + '>GBP</option>' +
                    '</select>' +
                    '<input type="number" step="0.01" value="' + (p.volumen_m3 || '') + '" onchange="proveedoresConsolidado[' + idx + '].volumen_m3=this.value" placeholder="m³" style="flex:0.7;">' +
                    '<input type="number" step="0.01" value="' + (p.peso_kg || '') + '" onchange="proveedoresConsolidado[' + idx + '].peso_kg=this.value" placeholder="Kg" style="flex:0.7;">' +
                    '<button class="btn btn-danger btn-sm" onclick="eliminarProveedorConsolidado(' + idx + ')">X</button>' +
                '</div>';
            }).join('');
        }

        function cambiarTab(tabId) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab[onclick*="' + tabId + '"]').classList.add('active');
            document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).classList.add('active');
if (tabId === 'baseAduana') calcularPartesBaseAduana();
        }
function mapearArticuloDesdeDB(a) {
            const dRaw = parseFloat(a.derechos_porcentaje) || 0;
            const iRaw = parseFloat(a.impuesto_interno_porcentaje) || 0;
            return {
                codigo_goodies: a.codigo_goodies || '',
                codigo_proveedor: a.codigo_proveedor || '',
                nombre: a.nombre || '',
                cajas: a.cantidad_cajas || '',
                und_caja: a.unidades_por_caja || '',
                valor_fabrica: (a.valor_proveedor_origen != null && parseFloat(a.valor_proveedor_origen) > 0) ? a.valor_proveedor_origen : '',
                valor_origen: (a.valor_unitario_origen != null && a.valor_unitario_origen !== '') ? a.valor_unitario_origen : '',
                derechos: dRaw > 0 ? (dRaw <= 1 ? +(dRaw * 100).toFixed(4) : dRaw) : '',
                imp_interno: iRaw > 0 ? (iRaw <= 1 ? +(iRaw * 100).toFixed(4) : iRaw) : '',
                aplica_anmat: a.aplica_anmat !== false,
                grupo: a.grupo || ''
            };
        }
function agregarArticulo() {
            const idx = articulosManual.length;
            articulosManual.push({ codigo_goodies: '', codigo_proveedor: '', nombre: '', cajas: '', und_caja: '', valor_fabrica: '', valor_origen: '', derechos: '', imp_interno: '', aplica_anmat: true, grupo: '' });
            renderizarArticulos();
        }

        function eliminarArticulo(idx) {
            articulosManual.splice(idx, 1);
            renderizarArticulos();
        }

        function renderizarArticulos() {
            const tbody = document.getElementById('articulosBody');
            const tieneDatosFabrica = document.getElementById('cm_tieneIntermediaria').checked;
            // Toggle "Cargar precios por caja": si está activo, el input "valor_origen"
            // representa el precio POR CAJA, y al lado mostramos el unitario calculado
            // como auditoría visual. Al guardar, se divide por unidades_por_caja para
            // almacenar el valor_unitario_origen real con la precisión que tenga.
            const porCaja = (document.getElementById('cm_cargarPorCaja') || {}).checked;
            tbody.innerHTML = articulosManual.map((art, idx) => {
                const aplicaAnmat = art.aplica_anmat !== false;
                // Calculo unitarios en tiempo real (valor_origen y valor_fabrica) para
                // mostrarlos debajo de cada input cuando el modo por caja está activo.
                // Feedback visual inmediato para auditar lo que el sistema va a guardar.
                let displayUnitario = '';
                let displayUnitarioFab = '';
                if (porCaja) {
                    const und = parseFloat(art.und_caja) || 0;
                    const valC = parseFloat(art.valor_origen) || 0;
                    if (valC > 0 && und > 0) {
                        const unit = valC / und;
                        displayUnitario = '<div style="font-size:10px;color:#64b5f6;margin-top:2px;" title="Valor unitario calculado internamente">→ unit: $' + unit.toLocaleString('es-AR', {minimumFractionDigits:4, maximumFractionDigits:4}) + '</div>';
                    }
                    const valF = parseFloat(art.valor_fabrica) || 0;
                    if (valF > 0 && und > 0) {
                        const unitF = valF / und;
                        displayUnitarioFab = '<div style="font-size:10px;color:#64b5f6;margin-top:2px;" title="Valor fábrica unitario calculado internamente">→ unit: $' + unitF.toLocaleString('es-AR', {minimumFractionDigits:4, maximumFractionDigits:4}) + '</div>';
                    }
                }
                return '<tr>' +
                    '<td>' + (idx + 1) + '</td>' +
                    '<td><input type="text" value="' + (art.codigo_goodies || '') + '" onchange="articulosManual[' + idx + '].codigo_goodies=this.value" onblur="buscarEnMaestro(' + idx + ', this.value)" style="width:120px;"></td>' +
                    '<td><input type="text" value="' + (art.codigo_proveedor || '') + '" onchange="articulosManual[' + idx + '].codigo_proveedor=this.value" style="width:100px;"></td>' +
                    '<td><input type="text" value="' + (art.nombre || '') + '" onchange="articulosManual[' + idx + '].nombre=this.value" style="width:100%;min-width:280px;"></td>' +
                    '<td><input type="number" step="0.01" value="' + (art.cajas || '') + '" onchange="articulosManual[' + idx + '].cajas=this.value;renderizarArticulos();" style="width:60px;"></td>' +
                    '<td><input type="number" step="0.01" value="' + (art.und_caja || '') + '" onchange="articulosManual[' + idx + '].und_caja=this.value;renderizarArticulos();" style="width:60px;"></td>' +
                    '<td><input type="number" step="0.0001" value="' + (art.valor_fabrica || '') + '" onchange="actualizarValorFabrica(' + idx + ', this.value)" style="width:90px;">' + displayUnitarioFab + '</td>' +
                    '<td><input type="number" step="0.0001" value="' + (art.valor_origen || '') + '" onchange="articulosManual[' + idx + '].valor_origen=this.value;renderizarArticulos();" style="width:90px;">' + displayUnitario + '</td>' +
                    '<td><input type="number" step="0.01" value="' + (art.derechos || '') + '" onchange="articulosManual[' + idx + '].derechos=this.value" style="width:60px;"></td>' +
                    '<td><input type="number" step="0.01" value="' + (art.imp_interno || '') + '" onchange="articulosManual[' + idx + '].imp_interno=this.value" style="width:60px;"></td>' +
                    '<td><input type="checkbox" ' + (aplicaAnmat ? 'checked' : '') + ' onchange="articulosManual[' + idx + '].aplica_anmat=this.checked"></td>' +
                    '<td><input type="text" value="' + (art.grupo || '') + '" onchange="articulosManual[' + idx + '].grupo=this.value" style="width:60px;" placeholder=""></td>' +
                    '<td><button class="btn btn-danger btn-sm" onclick="eliminarArticulo(' + idx + ')">X</button></td>' +
                    '</tr>';
            }).join('');
        }
function actualizarValorFabrica(idx, valor) {
    articulosManual[idx].valor_fabrica = valor;
    const tieneDatosFabrica = document.getElementById('cm_tieneIntermediaria').checked;
    if (tieneDatosFabrica) {
        // No aplico toFixed: preservo la precisión. El display del costeo final
        // se formatea al mostrar, no al guardar. (ej: 0,8025 / 0,97 = 0,82731959...)
        const v = parseFloat(valor);
        articulosManual[idx].valor_origen = isNaN(v) ? '' : (v / 0.97);
    } else {
        articulosManual[idx].valor_origen = valor;
    }
    renderizarArticulos();
}
function recalcularValoresOrigen() {
    const tieneDatosFabrica = document.getElementById('cm_tieneIntermediaria')?.checked;
    articulosManual.forEach(art => {
        const valorFabrica = parseFloat(art.valor_fabrica) || 0;
        if (valorFabrica > 0) {
            if (tieneDatosFabrica) {
                // Misma lógica: preservo precisión completa
                art.valor_origen = valorFabrica / 0.97;
            } else {
                art.valor_origen = art.valor_fabrica;
            }
        }
    });
    renderizarArticulos();
}
// =============================================
// TOGGLE: cargar precios por caja
// =============================================
// Cuando se activa, convertimos los valor_origen existentes de unitario a "por caja"
// (multiplicamos por und_caja). Cuando se desactiva, hacemos lo inverso (dividimos).
// Esto permite usar el toggle tanto en costeos nuevos como al editar uno existente
// sin perder data. El guardado final siempre manda valor_unitario_origen (unitario real)
// al backend; la conversión por caja es solo para la UI.
function toggleCargarPorCaja() {
    const porCaja = document.getElementById('cm_cargarPorCaja').checked;
    // Actualizo los headers de las dos columnas afectadas
    const th = document.getElementById('thValorOrigen');
    if (th) th.textContent = porCaja ? 'Valor x Caja' : 'Valor Origen';
    const thF = document.getElementById('thValorFabrica');
    if (thF) thF.textContent = porCaja ? 'Val. Fábrica x Caja' : 'Valor Fábrica';
    // Convierto los valores actuales al modo nuevo
    articulosManual.forEach(art => {
        const v = parseFloat(art.valor_origen) || 0;
        const und = parseFloat(art.und_caja) || 0;
        if (v > 0 && und > 0) {
            art.valor_origen = porCaja ? (v * und) : (v / und);
        }
        const vf = parseFloat(art.valor_fabrica) || 0;
        if (vf > 0 && und > 0) {
            art.valor_fabrica = porCaja ? (vf * und) : (vf / und);
        }
    });
    renderizarArticulos();
}
        function calcularValoresIntermediaria() {
            const margen = parseFloat(document.getElementById('cm_margenIntermediaria').value) || 0;
            if (margen <= 0 || margen >= 100) { alert('Ingresa un margen valido (entre 0 y 100)'); return; }
            articulosManual.forEach(art => {
                const origen = parseFloat(art.valor_origen) || 0;
                if (origen > 0) {
                    art.valor_intermediaria = (origen / (1 - margen / 100)).toFixed(4);
                }
            });
            renderizarArticulos();
            alert('Valores Intermediaria calculados con margen ' + margen + '%');
        }
function agregarGasto() {
            gastosManual.push({ descripcion: '', proveedor: '', nro_comprobante: '', moneda: 'USD', monto: '', recargo: '', grupo: '', metodo_prorrateo: 'por_fob', prorratear_consolidado: false, observaciones: '', no_contable: false });
            renderizarGastos();
        }

        function eliminarGasto(idx) {
            gastosManual.splice(idx, 1);
            renderizarGastos();
        }
function renderizarGastos() {
            const tbody = document.getElementById('gastosBody');
            const esConsolidado = document.getElementById('cm_esConsolidado')?.checked || false;
            tbody.innerHTML = gastosManual.map((g, idx) => {
                const metodo = g.metodo_prorrateo || 'por_fob';
                // Fix recargo display: if stored as decimal (< 1 and != 0), convert to percentage
                var recargoDisplay = g.recargo || '';
                if (recargoDisplay !== '' && parseFloat(recargoDisplay) !== 0 && Math.abs(parseFloat(recargoDisplay)) < 1) {
                    recargoDisplay = (parseFloat(recargoDisplay) * 100).toFixed(2);
                    gastosManual[idx].recargo = recargoDisplay; // fix in memory too
                }
                return '<tr' + (g.no_contable ? ' style="opacity:0.6;"' : '') + '>' +
                    '<td>' + (idx + 1) + '</td>' +
                    '<td><input type="text" value="' + (g.descripcion || '') + '" onchange="gastosManual[' + idx + '].descripcion=this.value"></td>' +
                    '<td><input type="text" value="' + (g.proveedor || '') + '" onchange="gastosManual[' + idx + '].proveedor=this.value" style="width:100px;"></td>' +
                    '<td><input type="text" value="' + (g.nro_comprobante || '') + '" onchange="gastosManual[' + idx + '].nro_comprobante=this.value" style="width:100px;"></td>' +
                    '<td><select onchange="gastosManual[' + idx + '].moneda=this.value"><option value="USD" ' + (g.moneda === 'USD' ? 'selected' : '') + '>USD</option><option value="EUR" ' + (g.moneda === 'EUR' ? 'selected' : '') + '>EUR</option><option value="GBP" ' + (g.moneda === 'GBP' ? 'selected' : '') + '>GBP</option><option value="ARS" ' + (g.moneda === 'ARS' ? 'selected' : '') + '>ARS</option></select></td>' +
                    '<td><input type="number" step="0.01" value="' + (g.monto || '') + '" onchange="gastosManual[' + idx + '].monto=this.value" style="width:100px;"></td>' +
                    '<td><input type="number" step="0.01" value="' + recargoDisplay + '" onchange="gastosManual[' + idx + '].recargo=this.value" style="width:60px;"></td>' +
                    '<td><input type="text" value="' + (g.grupo || '') + '" onchange="gastosManual[' + idx + '].grupo=this.value" style="width:60px;" placeholder=""></td>' +
                    (esConsolidado ? '<td><select onchange="gastosManual[' + idx + '].metodo_prorrateo=this.value; renderizarGastos();" style="width:100px;"><option value="por_fob" ' + (metodo === 'por_fob' ? 'selected' : '') + '>Por FOB</option><option value="por_volumen" ' + (metodo === 'por_volumen' ? 'selected' : '') + '>Por Volumen</option><option value="por_peso" ' + (metodo === 'por_peso' ? 'selected' : '') + '>Por Peso</option><option value="no_prorratear" ' + (metodo === 'no_prorratear' ? 'selected' : '') + '>No Prorratear</option></select></td>' : '') +
                    (esConsolidado ? '<td style="text-align:right;color:#4CAF50;font-weight:bold;">' + calcularMontoProrrateado(g) + '</td>' : '') +
                    '<td style="text-align:center;"><input type="checkbox" ' + (g.no_contable ? 'checked' : '') + ' onchange="gastosManual[' + idx + '].no_contable=this.checked; renderizarGastos();" title="Excluir de revaluación contable"></td>' +
                    '<td><input type="text" value="' + (g.observaciones || '') + '" onchange="gastosManual[' + idx + '].observaciones=this.value" style="width:120px;"></td>' +
                    '<td><button class="btn btn-danger btn-sm" onclick="eliminarGasto(' + idx + ')">X</button></td>' +
                    '</tr>';
            }).join('');
        }
function calcularPartesBaseAduana() {
            const esConsolidado = document.getElementById('cm_esConsolidado')?.checked || false;
            if (!esConsolidado) return;
            const p = calcularParticipaciones();
const fobMonto = parseFloat(document.getElementById('cm_fobMonto').value) || 0;           
const fleteMonto = parseFloat(document.getElementById('cm_fleteMonto').value) || 0;
            const seguroMonto = parseFloat(document.getElementById('cm_seguroMonto').value) || 0;
const fobParte = (fobMonto * p.fob / 100).toFixed(2);            
const fleteParte = (fleteMonto * p.fob / 100).toFixed(2);
            const seguroParte = (seguroMonto * p.fob / 100).toFixed(2);
document.getElementById('cm_fobParte').value = fobParte;            
document.getElementById('cm_fleteParte').value = fleteParte;
            document.getElementById('cm_seguroParte').value = seguroParte;
        }
function calcularMontoProrrateado(g) {
            const p = calcularParticipaciones();
            const monto = parseFloat(g.monto) || 0;
            const recargo = parseFloat(g.recargo) || 0;
            const montoConRecargo = monto * (1 + recargo / 100);
            const metodo = g.metodo_prorrateo || 'por_fob';
            var pct = 0;
            if (metodo === 'no_prorratear') pct = 100;
            else if (metodo === 'por_fob') pct = p.fob;
            else if (metodo === 'por_volumen') pct = p.volumen;
            else if (metodo === 'por_peso') pct = p.peso;
            return (montoConRecargo * pct / 100).toFixed(2);
        }
 function calcularParticipaciones() {
            const tcUsd = parseFloat(document.getElementById('cm_tcUsd').value) || 1;
            const tcEur = parseFloat(document.getElementById('cm_tcEur').value) || tcUsd;
            const tcGbp = parseFloat(document.getElementById('cm_tcGbp').value) || tcUsd;
            const monedaPrincipal = (document.getElementById('cm_moneda').value || 'USD').toUpperCase();
            var tcPrincipal = tcUsd;
            if (monedaPrincipal === 'EUR') tcPrincipal = tcEur;
            else if (monedaPrincipal === 'GBP') tcPrincipal = tcGbp;
            const montoFactura = parseFloat(document.getElementById('cm_monto').value) || 0;
            var fobActualDivisa = 0;
            if (montoFactura > 0) {
                fobActualDivisa = montoFactura;
            } else {
                articulosManual.forEach(a => {
                    const cajas = parseFloat(a.cajas) || 0;
                    const undCaja = parseFloat(a.und_caja) || 0;
                    const valorOrigen = parseFloat(a.valor_origen) || 0;
                    fobActualDivisa += cajas * undCaja * valorOrigen;
                });
            }
            const fobActual = fobActualDivisa * tcPrincipal;
            const volumenActual = parseFloat(document.getElementById('cm_volumenM3').value) || 0;
            const pesoActual = parseFloat(document.getElementById('cm_pesoKg').value) || 0;
            var fobTotal = fobActual, volumenTotal = volumenActual, pesoTotal = pesoActual;
            proveedoresConsolidado.forEach(p => {
                var fobProv = parseFloat(p.fob_total) || 0;
                const monedaProv = (p.moneda || 'USD').toUpperCase();
                var tcProv = tcUsd;
                if (monedaProv === 'EUR') tcProv = tcEur;
                else if (monedaProv === 'GBP') tcProv = tcGbp;
                const fobProvARS = fobProv * tcProv;
                fobTotal += fobProvARS;
                volumenTotal += parseFloat(p.volumen_m3) || 0;
                pesoTotal += parseFloat(p.peso_kg) || 0;
            });
            return { fob: fobTotal > 0 ? (fobActual / fobTotal * 100) : 0, volumen: volumenTotal > 0 ? (volumenActual / volumenTotal * 100) : 0, peso: pesoTotal > 0 ? (pesoActual / pesoTotal * 100) : 0, fobActual, fobTotal, volumenActual, volumenTotal, pesoActual, pesoTotal };
        }

     function mostrarComparativoParticipaciones() {
            const p = calcularParticipaciones();
            const provActual = document.getElementById('cm_proveedor').value || 'Proveedor Actual';
            const tcUsd = parseFloat(document.getElementById('cm_tcUsd').value) || 1;
            const tcEur = parseFloat(document.getElementById('cm_tcEur').value) || tcUsd;
            const tcGbp = parseFloat(document.getElementById('cm_tcGbp').value) || tcUsd;
            var html = '<div style="padding:10px;"><table style="width:100%;border-collapse:collapse;"><tr style="background:#333;"><th style="padding:12px;text-align:left;">Proveedor</th><th style="padding:12px;text-align:right;">% Por FOB</th><th style="padding:12px;text-align:right;">% Por Volumen</th><th style="padding:12px;text-align:right;">% Por Peso</th></tr>';
            html += '<tr style="background:#1a3a1a;"><td style="padding:12px;font-weight:bold;">' + provActual + ' (actual)</td><td style="padding:12px;text-align:right;color:#4CAF50;font-weight:bold;">' + p.fob.toFixed(2) + '%</td><td style="padding:12px;text-align:right;color:#2196F3;font-weight:bold;">' + p.volumen.toFixed(2) + '%</td><td style="padding:12px;text-align:right;color:#ff9800;font-weight:bold;">' + p.peso.toFixed(2) + '%</td></tr>';
            proveedoresConsolidado.forEach(prov => {
                var fobProv = parseFloat(prov.fob_total) || 0;
                const monedaProv = (prov.moneda || 'USD').toUpperCase();
                var tcProv = tcUsd;
                if (monedaProv === 'EUR') tcProv = tcEur;
                else if (monedaProv === 'GBP') tcProv = tcGbp;
                const fobProvARS = fobProv * tcProv;
                const pctFob = p.fobTotal > 0 ? (fobProvARS / p.fobTotal * 100) : 0;
                const volProv = parseFloat(prov.volumen_m3) || 0;
                const pctVol = p.volumenTotal > 0 ? (volProv / p.volumenTotal * 100) : 0;
                const pesoProv = parseFloat(prov.peso_kg) || 0;
                const pctPeso = p.pesoTotal > 0 ? (pesoProv / p.pesoTotal * 100) : 0;
                html += '<tr style="border-bottom:1px solid #444;"><td style="padding:12px;">' + (prov.nombre || 'Sin nombre') + '</td><td style="padding:12px;text-align:right;">' + pctFob.toFixed(2) + '%</td><td style="padding:12px;text-align:right;">' + pctVol.toFixed(2) + '%</td><td style="padding:12px;text-align:right;">' + pctPeso.toFixed(2) + '%</td></tr>';
            });
            html += '</table></div>';
            document.getElementById('comparativoModalBody').innerHTML = html;
            document.getElementById('consolidadoCompModal').style.display = 'flex';
        }
function refrescarDatosGenerales() {
            recalcularValoresOrigen();
            renderizarProveedoresConsolidado();
            calcularPartesBaseAduana();
            renderizarArticulos();
            renderizarGastos();
            alert('✅ Datos Generales actualizados');
        }

        function refrescarBaseAduana() {
            calcularPartesBaseAduana();
            renderizarGastos();
            alert('✅ Base Aduana recalculada');
        }

        function refrescarArticulos() {
            recalcularValoresOrigen();
            renderizarArticulos();
            calcularPartesBaseAduana();
            renderizarGastos();
            alert('✅ Artículos y participaciones actualizados');
        }

        function refrescarGastos() {
            calcularPartesBaseAduana();
            renderizarGastos();
            alert('✅ Gastos y prorrateos recalculados');
        }

function descargarTemplateArticulos() {
            const contenido = 'Cod_Goodies\tCod_Proveedor\tNombre\tCajas\tUnd_Caja\tValor_Origen\tValor_Interm\tPct_Derecho\tPct_Imp_Interno\n' +
                'COD001\tPROV001\tProducto Ejemplo\t10\t24\t5.50\t6.00\t18\t0\n';
            const blob = new Blob([contenido], { type: 'text/tab-separated-values' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'template_articulos.xls';
            a.click();
            URL.revokeObjectURL(url);
        }

        function descargarTemplateGastos() {
            const contenido = 'Descripcion\tProveedor\tNro_Comprobante\tMoneda\tMonto\tPct_Recargo\tObservaciones\tNo_Contable\n' +
                'Flete Internacional\tTransporte SA\tFC-0001\tUSD\t1500\t3\tEjemplo de gasto\t\n';
            const blob = new Blob([contenido], { type: 'text/tab-separated-values' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'template_gastos.xls';
            a.click();
            URL.revokeObjectURL(url);
        }

        function importarArticulosExcel(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = e.target.result;
                    const lines = data.split('\n').filter(l => l.trim());
                    if (lines.length < 2) { alert('El archivo no tiene datos'); return; }
                    const tieneInterm = document.getElementById('cm_tieneIntermediaria').checked;
                    articulosManual = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split('\t');
                        if (cols.length >= 6) {
                            const valorOrigen = cols[5] || '';
                            const valorInterm = cols[6] || valorOrigen;
                            articulosManual.push({
                                codigo_goodies: cols[0] || '',
                                codigo_proveedor: cols[1] || '',
                                nombre: cols[2] || '',
                                cajas: cols[3] || '',
                                und_caja: cols[4] || '',
                                valor_fabrica: cols[5] || '',
                                valor_origen: valorOrigen,
                                derechos: cols[7] || '',
                                imp_interno: cols[8] || ''
                            });
                        }
                    }
                    renderizarArticulos();
                    alert('Se importaron ' + articulosManual.length + ' articulos');
                } catch (err) {
                    alert('Error al leer el archivo: ' + err.message);
                }
            };
            reader.readAsText(file);
            input.value = '';
        }

        function importarGastosExcel(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = e.target.result;
                    const lines = data.split('\n').filter(l => l.trim());
                    if (lines.length < 2) { alert('El archivo no tiene datos'); return; }
                    gastosManual = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split('\t');
                        if (cols.length >= 5) {
                            gastosManual.push({
                                descripcion: cols[0] || '',
                                proveedor: cols[1] || '',
                                nro_comprobante: cols[2] || '',
                                moneda: cols[3] || 'USD',
                                monto: cols[4] || '',
                                recargo: cols[5] || '',
                                observaciones: cols[6] || '',
                                no_contable: (cols[7] || '').toUpperCase() === 'SI'
                            });
                        }
                    }
                    renderizarGastos();
                    alert('Se importaron ' + gastosManual.length + ' gastos');
                } catch (err) {
                    alert('Error al leer el archivo: ' + err.message);
                }
            };
            reader.readAsText(file);
            input.value = '';
        }

        async function guardarCargaManual() {
            const nombre = document.getElementById('cm_nombre').value.trim();
            const proveedor = document.getElementById('cm_proveedor').value.trim();
            const moneda = document.getElementById('cm_moneda').value;
            if (!nombre) { alert('El nombre del costeo es obligatorio'); cambiarTab('datosGenerales'); return; }
            if (!proveedor) { alert('El proveedor es obligatorio'); cambiarTab('datosGenerales'); return; }
            if (articulosManual.length === 0 || !articulosManual[0].nombre) { alert('Debe agregar al menos un articulo'); cambiarTab('articulos'); return; }
            const tieneIntermediaria = document.getElementById('cm_tieneIntermediaria').checked;
            // Toggle por caja: si está activo, valor_origen en la UI representa el precio
            // por caja, por lo que al enviar al backend lo dividimos por unidades_por_caja
            // para obtener el valor_unitario_origen real (con toda la precisión que tenga).
            const porCaja = (document.getElementById('cm_cargarPorCaja') || {}).checked;
            const articulos = articulosManual.filter(a => a.nombre).map(a => {
                const undCaja = parseFloat(a.und_caja) || 0;
                let valorUnitario = parseFloat(a.valor_origen) || 0;
                let valorFabrica = parseFloat(a.valor_fabrica) || 0;
                if (porCaja && undCaja > 0) {
                    valorUnitario = valorUnitario / undCaja;
                    valorFabrica = valorFabrica / undCaja;
                }
                return {
                    codigo_goodies: a.codigo_goodies || 'S/COD',
                    codigo_proveedor: a.codigo_proveedor || '',
                    nombre: a.nombre,
                    cantidad_cajas: parseFloat(a.cajas) || 0,
                    unidades_por_caja: undCaja,
                    valor_fabrica: valorFabrica,
                    valor_unitario_origen: valorUnitario,
                    derechos_porcentaje: (parseFloat(a.derechos) || 0) / 100,
                    impuesto_interno_porcentaje: (parseFloat(a.imp_interno) || 0) / 100,
                    aplica_anmat: a.aplica_anmat !== false,
                    grupo: a.grupo || ''
                };
            });
            const gastos = gastosManual.filter(g => g.descripcion).map(g => ({
                descripcion: g.descripcion,
                proveedor_gasto: g.proveedor || '',
                nro_comprobante: g.nro_comprobante || 'ESTIMADO',
                moneda: g.moneda || 'USD',
                monto: parseFloat(g.monto) || 0,
                recargo: parseFloat(g.recargo) || 0,
                grupo: g.grupo || '',
                prorratear_consolidado: g.prorratear_consolidado || false,
metodo_prorrateo: g.metodo_prorrateo || 'por_fob',
monto_prorrateado: parseFloat(calcularMontoProrrateado(g)) || 0,
                observaciones: g.observaciones || '',
                no_contable: g.no_contable || false
            }));
            const esConsolidado = document.getElementById('cm_esConsolidado').checked;
            const datos = {
                nombre_costeo: nombre,
                proveedor: proveedor,
                tiene_intermediaria: tieneIntermediaria,
                empresa_intermediaria: tieneIntermediaria ? document.getElementById('cm_intermediaria').value : null,
                factura_intermediaria: tieneIntermediaria ? document.getElementById('cm_facturaInterm').value : null,
                fecha_factura_intermediaria: tieneIntermediaria ? document.getElementById('cm_fechaFacturaInterm').value : null,
                fecha_vencimiento_intermediaria: tieneIntermediaria ? document.getElementById('cm_fechaVencInterm').value : null,
                factura_nro: document.getElementById('cm_facturaNro').value,
                moneda_principal: moneda,
                monto_factura: parseFloat(document.getElementById('cm_monto').value) || 0,
                fecha_factura: document.getElementById('cm_fechaFactura').value || null,
                fecha_vencimiento_factura: document.getElementById('cm_fechaVenc').value || null,
                fecha_despacho: document.getElementById('cm_fechaDespacho').value || null,
                nro_despacho: document.getElementById('cm_nroDespacho').value || null,
                tc_usd: parseFloat(document.getElementById('cm_tcUsd').value) || null,
                tc_eur: parseFloat(document.getElementById('cm_tcEur').value) || null,
                tc_gbp: parseFloat(document.getElementById('cm_tcGbp').value) || null,
                fob_moneda: document.getElementById('cm_fobMoneda').value,
                fob_monto: parseFloat(document.getElementById('cm_fobMonto').value) || 0,
                flete_moneda: document.getElementById('cm_fleteMoneda').value,
                flete_monto: parseFloat(document.getElementById('cm_fleteMonto').value) || 0,
                seguro_moneda: document.getElementById('cm_seguroMoneda').value,
                seguro_monto: parseFloat(document.getElementById('cm_seguroMonto').value) || 0,
fob_parte: parseFloat(document.getElementById('cm_fobParte')?.value) || 0,
                flete_parte: parseFloat(document.getElementById('cm_fleteParte')?.value) || 0,
                seguro_parte: parseFloat(document.getElementById('cm_seguroParte')?.value) || 0,
                es_consolidado: esConsolidado,
                volumen_m3: esConsolidado ? parseFloat(document.getElementById('cm_volumenM3').value) || null : null,
                peso_kg: esConsolidado ? parseFloat(document.getElementById('cm_pesoKg').value) || null : null,
                proveedores_consolidado: esConsolidado ? proveedoresConsolidado : [],
                articulos: articulos,
                gastos: gastos
            };
            try {
                var url = API_URL + '/api/costeos/manual';
                var method = 'POST';
                if (window.costeoEditandoId) {
                    url = API_URL + '/api/costeos/' + window.costeoEditandoId + '/actualizar';
                    method = 'PUT';
                }
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });
                const data = await res.json();
                if (res.ok) {
                    costeoModificado = false;
                    var msgBase = window.costeoEditandoId ? 'Costeo actualizado exitosamente!' : 'Costeo guardado exitosamente!';
                    
                    // Info sobre catálogo
                    if (data.catalogo) {
                        if (data.catalogo.nuevosAgregados && data.catalogo.nuevosAgregados.length > 0) {
                            msgBase += '\n\n📦 Se agregaron ' + data.catalogo.nuevosAgregados.length + ' artículo(s) nuevos al catálogo.';
                        }
                        if (data.catalogo.completados && data.catalogo.completados.length > 0) {
                            msgBase += '\n✅ Se completaron ' + data.catalogo.completados.length + ' dato(s) vacíos en el catálogo.';
                        }
                    }
                    // Info sobre sincronización proveedor/fábrica al catálogo (preguntar antes de aplicar)
                    if (data.catalogo_sync) {
                        const hasProv = data.catalogo_sync.proveedor_cambios && data.catalogo_sync.proveedor_cambios.length > 0;
                        const hasFab = data.catalogo_sync.fabrica_cambios && data.catalogo_sync.fabrica_cambios.length > 0;
                        if (hasProv || hasFab) {
                            var syncMsg = '⚠️ Se detectaron diferencias con el catálogo maestro:\n';
                            if (hasProv) {
                                syncMsg += '\n📋 Proveedor de Origen:';
                                data.catalogo_sync.proveedor_cambios.forEach(c => {
                                    syncMsg += '\n  ' + c.codigo + ': "' + c.antes + '" → "' + c.despues + '"';
                                });
                            }
                            if (hasFab) {
                                syncMsg += '\n\n🏭 Empresa Fábrica:';
                                data.catalogo_sync.fabrica_cambios.forEach(c => {
                                    syncMsg += '\n  ' + c.codigo + ': "' + c.antes + '" → "' + c.despues + '"';
                                });
                            }
                            syncMsg += '\n\n¿Querés actualizar el catálogo con estos valores del costeo?';
                            if (confirm(syncMsg)) {
                                fetch(API_URL + '/api/costeos/sync-catalogo', {
                                    method: 'POST',
                                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data.catalogo_sync)
                                }).then(r => r.json()).then(d => {
                                    if (d.ok) alert('✅ Catálogo actualizado: ' + d.actualizados + ' cambio(s) aplicados');
                                    else alert('Error al sincronizar: ' + (d.error || 'desconocido'));
                                }).catch(e => console.error('Error sync catálogo:', e));
                            }
                        }
                    }
                    alert(msgBase);

                    // Mostrar diferencias encontradas y preguntar
                    if (data.catalogo && data.catalogo.diferencias && data.catalogo.diferencias.length > 0) {
                        mostrarDiferenciasCatalogo(data.catalogo.diferencias);
                    }

                    window.costeoEditandoId = null;
                    cerrarModal('cargaManualModal');
                    cargarCosteos();
                } else {
                    alert('Error: ' + (data.error || 'No se pudo guardar'));
                }
            } catch (err) {
                alert('Error de conexion');
                console.error(err);
            }
        }

        // ============ CATÁLOGO MAESTRO ============

        async function cargarStatsMaestro() {
            try {
                const res = await fetch(`${window.location.origin}/api/maestro/stats`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                document.getElementById('totalMaestro').textContent = data.total || 0;
                if (data.ultima_actualizacion) {
                    const fecha = new Date(data.ultima_actualizacion);
                    var info = '📅 Última actualización: ' + fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
                    if (data.proveedores_activos !== undefined) {
                        info += '<br>Proveedores activos: <strong>' + data.proveedores_activos + '</strong>';
                        if (data.proveedores_inactivos > 0) info += ' | Inactivos: <strong style="color:#f44336;">' + data.proveedores_inactivos + '</strong>';
                        else info += ' <span style="color:#ff9800;">(ningún proveedor marcado como inactivo)</span>';
                    }
                    if (data.fabricas_activas !== undefined) {
                        info += '<br>Fábricas activas: <strong>' + data.fabricas_activas + '</strong>';
                        if (data.fabricas_inactivas > 0) info += ' | Inactivas: <strong style="color:#f44336;">' + data.fabricas_inactivas + '</strong>';
                    }
                    info += '<br>Artículos activos: <strong style="color:#4CAF50;">' + (data.total || 0) + '</strong>';
                    if (data.totalInactivos > 0) info += ' | Inactivos: <strong style="color:#f44336;">' + data.totalInactivos + '</strong>';
                    info += ' | Total: ' + (data.totalGeneral || 0);
                    document.getElementById('catalogoFechaActualizacion').innerHTML = info;
                }
                cargarProveedoresMaestro();
            } catch (e) {
                document.getElementById('totalMaestro').textContent = '0';
            }
        }

        async function cargarProveedoresMaestro() {
            try {
                const res = await fetch(`${window.location.origin}/api/maestro/proveedores`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const proveedores = await res.json();
                const datalist = document.getElementById('listaProveedoresMaestro');
                if (datalist) {
                    datalist.innerHTML = proveedores.map(p => '<option value="' + p + '">').join('');
                }
            } catch (e) {
                console.error('Error cargando proveedores maestro:', e);
            }
        }

        async function cargarMarcasDelProveedor() {
            const proveedor = document.getElementById('cm_proveedor').value;
            const select = document.getElementById('selectMarcaMaestro');
            if (!select) return;

            select.innerHTML = '<option value="">Filtrar por marca...</option>';

            if (!proveedor) return;

            try {
                const res = await fetch(`${window.location.origin}/api/maestro/marcas?proveedor=${encodeURIComponent(proveedor)}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const marcas = await res.json();
                for (const m of marcas) {
                    select.innerHTML += '<option value="' + m + '">' + m + '</option>';
                }
            } catch (e) {
                console.error('Error cargando marcas:', e);
            }
        }

        async function importarCatalogoMaestro(input) {
            if (!input.files || !input.files[0]) return;
            const file = input.files[0];
            const formData = new FormData();
            formData.append('archivo', file);

            try {
                // Paso 1: Previsualizar cambios
                const resPrev = await fetch(`${window.location.origin}/api/maestro/previsualizar`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                const preview = await resPrev.json();
                if (!resPrev.ok) { alert('Error: ' + (preview.error || 'No se pudo analizar')); input.value = ''; return; }

                // Armar resumen
                var msg = '📋 RESUMEN DE IMPORTACIÓN\n';
                msg += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
                msg += 'Total en Excel: ' + preview.total_excel + '\n';
                msg += '🆕 Artículos nuevos: ' + preview.nuevos.length + '\n';
                msg += '✅ Datos a completar (vacíos): ' + (preview.completados || 0) + '\n';
                msg += '⚡ Sin cambios: ' + preview.sin_cambios + '\n';

                if (preview.cambios && preview.cambios.length > 0) {
                    msg += '\n⚠️ DATOS QUE CAMBIAN (' + preview.cambios.length + ' artículos):\n';
                    for (const cambio of preview.cambios.slice(0, 10)) {
                        msg += '\n' + cambio.codigo + ' - ' + cambio.nombre + ':';
                        for (const c of cambio.campos) {
                            if (c.tipo === 'cambio') {
                                msg += '\n  ' + c.campo + ': ' + c.antes + ' → ' + c.despues;
                            }
                        }
                    }
                    if (preview.cambios.length > 10) msg += '\n... y ' + (preview.cambios.length - 10) + ' más';
                }

                if (preview.alertas_proveedor && preview.alertas_proveedor.length > 0) {
                    msg += '\n\n🔴 ALERTA — Códigos con PROVEEDOR DIFERENTE (' + preview.alertas_proveedor.length + '):\n';
                    for (const a of preview.alertas_proveedor.slice(0, 10)) {
                        msg += '\n  ' + a.codigo + ': en sistema "' + a.proveedor_actual + '" → Excel "' + a.proveedor_excel + '"';
                    }
                    if (preview.alertas_proveedor.length > 10) msg += '\n  ... y ' + (preview.alertas_proveedor.length - 10) + ' más';
                    msg += '\n\nVerificá si es correcto antes de continuar.';
                }

                msg += '\n\n¿Aplicar estos cambios?';

                if (!confirm(msg)) { input.value = ''; return; }

                // Paso 2: Aplicar importación
                const formData2 = new FormData();
                formData2.append('archivo', file);
                const res = await fetch(`${window.location.origin}/api/maestro/importar`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData2
                });
                const data = await res.json();
                if (res.ok) {
                    alert('✅ Catálogo actualizado:\n- Nuevos: ' + data.importados + '\n- Actualizados: ' + data.actualizados + '\n- Errores: ' + data.errores);
                    cargarStatsMaestro();
                    // Mostrar resumen en la tarjeta
                    const statsDiv = document.getElementById('catalogoImportStats');
                    if (statsDiv) {
                        statsDiv.style.display = 'block';
                        statsDiv.innerHTML = '<div style="color:#4CAF50;font-weight:bold;margin-bottom:5px;">📋 Última importación</div>' +
                            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">' +
                            '<span style="color:#aaa;">Total en Excel:</span><span style="color:#fff;">' + preview.total_excel + '</span>' +
                            '<span style="color:#aaa;">🆕 Nuevos:</span><span style="color:#4CAF50;">' + data.importados + '</span>' +
                            '<span style="color:#aaa;">✏️ Con cambios:</span><span style="color:#ff9800;">' + data.actualizados + '</span>' +
                            '<span style="color:#aaa;">⚡ Sin cambios:</span><span style="color:#888;">' + (preview.sin_cambios || 0) + '</span>' +
                            '<span style="color:#aaa;">❌ Errores:</span><span style="color:' + (data.errores > 0 ? '#f44336' : '#888') + ';">' + data.errores + '</span>' +
                            '</div>';
                    }
                } else {
                    alert('Error: ' + (data.error || 'No se pudo importar'));
                }
            } catch (e) {
                alert('Error de conexión al importar catálogo');
                console.error(e);
            }
            input.value = '';
        }

        // =============================================
        // IMPORTAR DATOS LOGÍSTICOS
        // =============================================
        var logisticosData = null;

        async function importarDatosLogisticos(input) {
            var file = input.files[0];
            if (!file) return;
            var previewDiv = document.getElementById('logisticosPreview');
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = '<p style="color:#888;">Analizando archivo y buscando matches en el catálogo...</p>';

            try {
                var formData = new FormData();
                formData.append('archivo', file);
                var resp = await fetch(API_URL + '/api/maestro/logisticos/preview', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                var data = await resp.json();
                if (data.error) { previewDiv.innerHTML = '<p style="color:#f44336;">Error: ' + data.error + '</p>'; input.value = ''; return; }

                logisticosData = data.resultados;

                var html = '<h4 style="color:#ff9800;margin-bottom:8px;">📐 Preview Datos Logísticos (' + data.total + ' artículos)</h4>';
                html += '<p style="font-size:12px;color:#aaa;">✅ Matched: <strong style="color:#4CAF50;">' + data.matched + '</strong> | ❌ Sin match: <strong style="color:#f44336;">' + data.unmatched + '</strong></p>';

                html += '<div style="max-height:300px;overflow-y:auto;"><table style="width:100%;font-size:11px;">';
                html += '<thead><tr style="background:#2a2a3e;"><th>Código Prov</th><th>Descripción Depósito</th><th>Peso Kg</th><th>L×A×H cm</th><th>Match →</th><th>Código Goodies</th><th>Nombre Catálogo</th><th>Conf.</th><th>✓</th></tr></thead><tbody>';

                data.resultados.forEach(function(r, i) {
                    var matchColor = r.match ? (r.confianza >= 80 ? '#4CAF50' : '#ff9800') : '#f44336';
                    var checked = r.match && r.confianza >= 60 ? 'checked' : '';
                    html += '<tr style="border-bottom:1px solid #333;">';
                    html += '<td>' + r.codigo_proveedor + '</td>';
                    html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + r.descripcion + '</td>';
                    html += '<td>' + (r.pieza_peso_kg || '-') + '</td>';
                    html += '<td>' + (r.pieza_largo_cm || '-') + '×' + (r.pieza_ancho_cm || '-') + '×' + (r.pieza_alto_cm || '-') + '</td>';
                    html += '<td style="color:' + matchColor + ';font-size:10px;">' + (r.metodo_match || '❌') + '</td>';
                    html += '<td>' + (r.match ? '<strong>' + r.match.codigo_goodies + '</strong>' : '<input type="text" placeholder="Buscar..." onkeyup="buscarMatchLogistico(this,' + i + ')" style="width:80px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:2px 4px;font-size:10px;border-radius:3px;">') + '</td>';
                    html += '<td style="font-size:10px;color:#aaa;">' + (r.match ? r.match.nombre_catalogo.substring(0, 30) : '') + '</td>';
                    html += '<td style="color:' + matchColor + ';">' + (r.confianza || 0) + '%</td>';
                    html += '<td><input type="checkbox" class="log-check" data-idx="' + i + '" ' + checked + ' ' + (r.match ? '' : 'disabled') + '></td>';
                    html += '</tr>';
                });

                html += '</tbody></table></div>';
                html += '<div style="margin-top:10px;display:flex;gap:8px;">';
                html += '<button class="btn btn-success" onclick="aplicarDatosLogisticos()">✅ Aplicar seleccionados al catálogo</button>';
                html += '<button class="btn btn-secondary" onclick="document.getElementById(\'logisticosPreview\').style.display=\'none\'">Cancelar</button>';
                html += '</div>';

                previewDiv.innerHTML = html;
            } catch(e) {
                previewDiv.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>';
            }
            input.value = '';
        }

        async function buscarMatchLogistico(input, idx) {
            var q = input.value.trim();
            if (q.length < 2) return;
            try {
                var resp = await fetch(API_URL + '/api/maestro/logisticos/buscar-catalogo?q=' + encodeURIComponent(q), { headers: { 'Authorization': 'Bearer ' + token } });
                var arts = await resp.json();
                if (arts.length > 0) {
                    // Take first result
                    logisticosData[idx].match = {
                        codigo_goodies: arts[0].codigo_goodies,
                        nombre_catalogo: arts[0].nombre,
                        proveedor: arts[0].proveedor,
                        marca: arts[0].marca
                    };
                    logisticosData[idx].confianza = 100;
                    logisticosData[idx].metodo_match = 'manual';
                    // Refresh the row
                    var row = input.closest('tr');
                    var cells = row.querySelectorAll('td');
                    cells[4].innerHTML = '<span style="color:#2196F3;">manual</span>';
                    cells[5].innerHTML = '<strong>' + arts[0].codigo_goodies + '</strong>';
                    cells[6].innerHTML = '<span style="font-size:10px;color:#aaa;">' + arts[0].nombre.substring(0, 30) + '</span>';
                    cells[7].innerHTML = '<span style="color:#2196F3;">100%</span>';
                    var cb = cells[8].querySelector('input');
                    if (cb) { cb.disabled = false; cb.checked = true; }
                }
            } catch(e) { /* silently fail */ }
        }

        async function aplicarDatosLogisticos() {
            if (!logisticosData) return;
            var checks = document.querySelectorAll('.log-check:checked');
            if (checks.length === 0) { alert('Seleccioná al menos un artículo'); return; }

            var matches = [];
            checks.forEach(function(cb) {
                var idx = parseInt(cb.dataset.idx);
                var r = logisticosData[idx];
                if (r && r.match) {
                    matches.push({
                        codigo_goodies: r.match.codigo_goodies,
                        pieza_peso_kg: r.pieza_peso_kg,
                        pieza_largo_cm: r.pieza_largo_cm,
                        pieza_ancho_cm: r.pieza_ancho_cm,
                        pieza_alto_cm: r.pieza_alto_cm,
                        confirmar: true
                    });
                }
            });

            if (!confirm('¿Aplicar datos de peso y dimensiones a ' + matches.length + ' artículos del catálogo?')) return;

            try {
                var resp = await fetch(API_URL + '/api/maestro/logisticos/aplicar', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matches: matches })
                });
                var resultado = await resp.json();
                alert('✅ Datos logísticos aplicados:\n- Actualizados: ' + resultado.actualizados + '\n- Errores: ' + resultado.errores);
                document.getElementById('logisticosPreview').style.display = 'none';
            } catch(e) { alert('Error: ' + e.message); }
        }

        async function descargarCatalogo() {
            try {
                const res = await fetch(`${window.location.origin}/api/maestro/descargar`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'CATALOGO_GOODIES.xlsx';
                    a.click();
                    window.URL.revokeObjectURL(url);
                } else {
                    alert('Error al descargar catálogo');
                }
            } catch (e) {
                alert('Error de conexión');
                console.error(e);
            }
        }

        // Mostrar diferencias entre costeo y catálogo
        function mostrarDiferenciasCatalogo(diferencias) {
            var msg = '⚠️ DIFERENCIAS CON EL CATÁLOGO\n';
            msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            msg += 'Se encontraron datos distintos a los del catálogo.\n';
            msg += '¿Querés actualizar el catálogo con los valores del costeo?\n\n';

            const actualizaciones = [];
            for (const dif of diferencias) {
                msg += dif.codigo + ' - ' + dif.nombre + ':\n';
                for (const c of dif.conflictos) {
                    msg += '  ' + c.label + ': catálogo=' + c.valor_catalogo + ' → costeo=' + c.valor_costeo + '\n';
                    actualizaciones.push({ codigo: dif.codigo, campo: c.campo, valor: c.valor_nuevo_raw });
                }
                msg += '\n';
            }

            if (confirm(msg)) {
                // Aplicar actualizaciones confirmadas
                fetch(`${window.location.origin}/api/catalogo/actualizar-confirmado`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actualizaciones })
                }).then(r => r.json()).then(data => {
                    alert('✅ Catálogo actualizado: ' + (data.actualizados || 0) + ' campo(s) modificados.');
                }).catch(e => console.error('Error actualizando catálogo:', e));
            }
        }

        async function buscarEnMaestro(idx, codigo) {
            if (!codigo || codigo.length < 3) return;
            codigo = codigo.trim().toUpperCase();
            if (['MUESTRAS','MUESTRA','POS','PENDIENTE','BBB'].includes(codigo)) return;

            try {
                const res = await fetch(`${window.location.origin}/api/maestro/buscar?q=${encodeURIComponent(codigo)}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const articulos = await res.json();
                
                const exacto = articulos.find(a => a.codigo.toUpperCase() === codigo);
                if (exacto) {
                    var cambios = [];
                    // Nombre
                    if (!articulosManual[idx].nombre || articulosManual[idx].nombre === '') {
                        articulosManual[idx].nombre = exacto.nombre;
                        cambios.push('nombre');
                    } else if (articulosManual[idx].nombre.toUpperCase().trim() !== exacto.nombre.toUpperCase().trim()) {
                        const alertaDiv = document.getElementById('maestroAlertas');
                        alertaDiv.style.display = 'block';
                        // Limitar a máximo 20 alertas visibles
                        const existingAlerts = alertaDiv.querySelectorAll('.alerta-nombre');
                        if (existingAlerts.length >= 20) { existingAlerts[existingAlerts.length - 1].remove(); }
                        const clearBtn = alertaDiv.querySelector('.btn-limpiar-alertas') ? '' : '<div style="text-align:right;margin-bottom:5px;"><button class="btn-limpiar-alertas" onclick="document.getElementById(\'maestroAlertas\').innerHTML=\'\';document.getElementById(\'maestroAlertas\').style.display=\'none\';" style="background:#555;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;">✕ Limpiar alertas</button></div>';
                        if (clearBtn) alertaDiv.innerHTML = clearBtn + alertaDiv.innerHTML;
                        const alertHtml = '<div class="alerta-nombre" style="background:#ff9800;color:#000;padding:8px;border-radius:5px;margin-bottom:5px;font-size:12px;">⚠️ ' + codigo + ': nombre actual "' + articulosManual[idx].nombre + '" ≠ catálogo "' + exacto.nombre + '"</div>';
                        const btnEl = alertaDiv.querySelector('.btn-limpiar-alertas');
                        if (btnEl) { btnEl.parentElement.insertAdjacentHTML('afterend', alertHtml); }
                        else { alertaDiv.innerHTML = alertHtml + alertaDiv.innerHTML; }
                    }
                    // Derechos
                    if ((!articulosManual[idx].derechos || articulosManual[idx].derechos === '') && exacto.derechos_porcentaje != null) {
                        articulosManual[idx].derechos = (parseFloat(exacto.derechos_porcentaje) * 100).toFixed(2);
                        cambios.push('derechos ' + (exacto.derechos_porcentaje * 100).toFixed(1) + '%');
                    }
                    // Imp. Interno
                    if ((!articulosManual[idx].imp_interno || articulosManual[idx].imp_interno === '') && exacto.imp_interno_porcentaje != null) {
                        articulosManual[idx].imp_interno = (parseFloat(exacto.imp_interno_porcentaje) * 100).toFixed(2);
                        cambios.push('imp.int. ' + (exacto.imp_interno_porcentaje * 100).toFixed(2) + '%');
                    }
                    // Und/Caja
                    if ((!articulosManual[idx].und_caja || articulosManual[idx].und_caja === '') && exacto.unidades_por_caja) {
                        articulosManual[idx].und_caja = exacto.unidades_por_caja;
                        cambios.push('und/caja ' + exacto.unidades_por_caja);
                    }
                    // Valor Origen
                    if ((!articulosManual[idx].valor_origen || articulosManual[idx].valor_origen === '') && exacto.ultimo_valor_origen) {
                        articulosManual[idx].valor_origen = exacto.ultimo_valor_origen;
                        cambios.push('valor ' + exacto.ultimo_valor_origen);
                    }
                    // Valor Fábrica
                    if ((!articulosManual[idx].valor_fabrica || articulosManual[idx].valor_fabrica === '') && exacto.ultimo_valor_fabrica) {
                        articulosManual[idx].valor_fabrica = exacto.ultimo_valor_fabrica;
                        cambios.push('val.fab ' + exacto.ultimo_valor_fabrica);
                    }
                    if (cambios.length > 0) {
                        renderizarArticulos();
                        const alertaDiv = document.getElementById('maestroAlertas');
                        alertaDiv.style.display = 'block';
                        alertaDiv.innerHTML = '<div style="background:#4CAF50;color:#fff;padding:8px;border-radius:5px;margin-bottom:5px;">✅ ' + codigo + ': completado → ' + cambios.join(', ') + '</div>' + alertaDiv.innerHTML;
                    } else {
                        renderizarArticulos();
                    }
                }
            } catch (e) {
                console.error('Error buscando en catálogo:', e);
            }
        }

        async function cargarArticulosDesdeCatalogo() {
            const proveedor = document.getElementById('cm_proveedor').value.trim();
            const fabrica = document.getElementById('cm_intermediaria').value.trim();
            if (!proveedor && !fabrica) {
                alert('Completá al menos el Proveedor de Origen o la Empresa Fábrica en Datos Generales');
                cambiarTab('datosGenerales');
                return;
            }
            try {
                var url = API_URL + '/api/maestro/catalogo?activos=true';
                if (proveedor) url += '&proveedor=' + encodeURIComponent(proveedor);
                if (fabrica) url += '&empresa_fabrica=' + encodeURIComponent(fabrica);
                const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
                const articulos = await resp.json();
                if (!Array.isArray(articulos) || articulos.length === 0) {
                    alert('No se encontraron artículos en el catálogo para' + (proveedor ? ' Proveedor: ' + proveedor : '') + (fabrica ? ' Fábrica: ' + fabrica : ''));
                    return;
                }
                const yaExisten = articulosManual.filter(a => a.codigo_goodies).map(a => a.codigo_goodies.toUpperCase());
                const nuevos = articulos.filter(a => !yaExisten.includes((a.codigo_goodies || '').toUpperCase()));
                if (nuevos.length === 0) {
                    alert('Todos los artículos del catálogo ya están cargados en este costeo');
                    return;
                }
                if (!confirm('Se van a agregar ' + nuevos.length + ' artículos del catálogo' + (proveedor ? '\nProveedor: ' + proveedor : '') + (fabrica ? '\nFábrica: ' + fabrica : '') + '\n\n¿Continuar?')) return;
                // Limpiar artículos vacíos
                articulosManual = articulosManual.filter(a => a.codigo_goodies || a.nombre);
                for (const art of nuevos) {
                    const derechosPct = art.derechos_porcentaje ? (parseFloat(art.derechos_porcentaje) > 1 ? parseFloat(art.derechos_porcentaje) : parseFloat(art.derechos_porcentaje) * 100) : 0;
                    const impIntPct = art.imp_interno_porcentaje ? (parseFloat(art.imp_interno_porcentaje) > 1 ? parseFloat(art.imp_interno_porcentaje) : parseFloat(art.imp_interno_porcentaje) * 100) : 0;
                    articulosManual.push({
                        codigo_goodies: art.codigo_goodies || '',
                        codigo_proveedor: '',
                        nombre: art.nombre || '',
                        cajas: 0,
                        und_caja: 0,
                        valor_fabrica: 0,
                        valor_origen: 0,
                        derechos: derechosPct,
                        imp_interno: impIntPct,
                        anmat: true,
                        grupo: ''
                    });
                }
                renderizarArticulos();
                alert('✅ ' + nuevos.length + ' artículos agregados desde el catálogo');
            } catch(e) { alert('Error: ' + e.message); }
        }

        async function completarDesdeCatalogo() {
            const articulosConCodigo = articulosManual.filter(a => a.codigo_goodies && a.codigo_goodies.length >= 3);
            if (articulosConCodigo.length === 0) {
                alert('No hay artículos con Código Goodies para buscar.');
                return;
            }
            var completados = 0;
            var noEncontrados = [];
            const alertaDiv = document.getElementById('maestroAlertas');
            alertaDiv.style.display = 'block';
            alertaDiv.innerHTML = '<div style="background:#2196F3;color:#fff;padding:8px;border-radius:5px;">🔍 Buscando ' + articulosConCodigo.length + ' artículos en catálogo...</div>';

            for (let i = 0; i < articulosManual.length; i++) {
                const art = articulosManual[i];
                if (!art.codigo_goodies || art.codigo_goodies.length < 3) continue;
                const codigo = art.codigo_goodies.trim().toUpperCase();
                if (['MUESTRAS','MUESTRA','POS','PENDIENTE','BBB'].includes(codigo)) continue;

                try {
                    const resCat = await fetch(`${window.location.origin}/api/catalogo/buscar/${encodeURIComponent(codigo)}`, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (resCat.ok) {
                        const cat = await resCat.json();
                        var cambiosArt = [];
                        if ((!art.nombre || art.nombre === '') && cat.nombre) {
                            articulosManual[i].nombre = cat.nombre;
                            cambiosArt.push('nombre');
                        }
                        if ((!art.derechos || art.derechos === '') && cat.derechos_porcentaje != null) {
                            articulosManual[i].derechos = (parseFloat(cat.derechos_porcentaje) * 100).toFixed(2);
                            cambiosArt.push('der ' + (cat.derechos_porcentaje * 100).toFixed(2) + '%');
                        }
                        if ((!art.imp_interno || art.imp_interno === '') && cat.imp_interno_porcentaje != null) {
                            articulosManual[i].imp_interno = (parseFloat(cat.imp_interno_porcentaje) * 100).toFixed(2);
                            cambiosArt.push('imp.int ' + (cat.imp_interno_porcentaje * 100).toFixed(2) + '%');
                        }
                        if ((!art.codigo_proveedor || art.codigo_proveedor === '') && cat.codigo_elaborador) {
                            articulosManual[i].codigo_proveedor = cat.codigo_elaborador;
                            cambiosArt.push('cod.prov');
                        }
                        if ((!art.und_caja || art.und_caja === '') && cat.unidades_por_caja) {
                            articulosManual[i].und_caja = cat.unidades_por_caja;
                            cambiosArt.push('und/caja');
                        }
                        if ((!art.valor_origen || art.valor_origen === '') && cat.ultimo_valor_origen) {
                            articulosManual[i].valor_origen = cat.ultimo_valor_origen;
                            cambiosArt.push('valor');
                        }
                        if ((!art.valor_fabrica || art.valor_fabrica === '') && cat.ultimo_valor_fabrica) {
                            articulosManual[i].valor_fabrica = cat.ultimo_valor_fabrica;
                            cambiosArt.push('val.fab');
                        }
                        if (cambiosArt.length > 0) completados++;
                    } else {
                        noEncontrados.push(codigo);
                    }
                } catch (e) { noEncontrados.push(codigo); }
            }

            renderizarArticulos();
            var msg = '<div style="background:#4CAF50;color:#fff;padding:8px;border-radius:5px;margin-bottom:5px;">✅ Catálogo: ' + completados + ' artículos completados</div>';
            if (noEncontrados.length > 0) {
                msg += '<div style="background:#ff9800;color:#000;padding:8px;border-radius:5px;margin-bottom:5px;">⚠️ No encontrados (' + noEncontrados.length + '): ' + noEncontrados.slice(0, 10).join(', ') + (noEncontrados.length > 10 ? '...' : '') + '</div>';
            }
            alertaDiv.innerHTML = msg;
        }

        async function cargarArticulosDelProveedor() {
            const proveedor = document.getElementById('cm_proveedor').value;
            if (!proveedor) {
                alert('Primero ingrese el proveedor en Datos Generales');
                return;
            }

            try {
                const res = await fetch(`${window.location.origin}/api/maestro/por-proveedor?proveedor=${encodeURIComponent(proveedor)}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const articulos = await res.json();

                if (!articulos || articulos.length === 0) {
                    alert('No se encontraron artículos para "' + proveedor + '" en el catálogo maestro.\n\nVerifique que el nombre del proveedor coincida con el catálogo.');
                    return;
                }

                if (!confirm('Se encontraron ' + articulos.length + ' artículos de "' + proveedor + '".\n\n¿Cargar todos? (COMEX deberá completar cajas, valores, derechos, etc.)')) {
                    return;
                }

                agregarArticulosDesdeMaestro(articulos);
            } catch (e) {
                alert('Error al cargar artículos del proveedor');
                console.error(e);
            }
        }

        async function cargarArticulosPorMarca() {
            const marca = document.getElementById('selectMarcaMaestro').value;
            if (!marca) {
                alert('Seleccione una marca del desplegable');
                return;
            }

            const proveedor = document.getElementById('cm_proveedor').value;

            try {
                const res = await fetch(`${window.location.origin}/api/maestro/por-marca?marca=${encodeURIComponent(marca)}&proveedor=${encodeURIComponent(proveedor)}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const articulos = await res.json();

                if (!articulos || articulos.length === 0) {
                    alert('No se encontraron artículos de marca "' + marca + '"');
                    return;
                }

                if (!confirm('Se encontraron ' + articulos.length + ' artículos de marca "' + marca + '".\n\n¿Cargar todos?')) {
                    return;
                }

                agregarArticulosDesdeMaestro(articulos);
            } catch (e) {
                alert('Error al cargar artículos por marca');
                console.error(e);
            }
        }

        function agregarArticulosDesdeMaestro(articulos) {
            const existentes = articulosManual.map(a => (a.codigo_goodies || '').toUpperCase());
            var agregados = 0;

            for (const art of articulos) {
                if (!existentes.includes(art.codigo.toUpperCase())) {
                    articulosManual.push({
                        codigo_goodies: art.codigo,
                        codigo_proveedor: '',
                        nombre: art.nombre,
                        cajas: '',
                        und_caja: '',
                        valor_fabrica: '',
                        valor_origen: '',
                        derechos: '',
                        imp_interno: '',
                        aplica_anmat: true,
                        grupo: ''
                    });
                    agregados++;
                }
            }

            renderizarArticulos();
            alert('Se cargaron ' + agregados + ' artículos nuevos.\n' + (articulos.length - agregados) + ' ya existían.\n\nComplete cajas, valores y derechos para cada uno.');
        }

        async function validarArticulosContraMaestro() {
            const articulosParaValidar = articulosManual.filter(a => a.codigo_goodies && a.nombre);
            if (articulosParaValidar.length === 0) return;

            try {
                const res = await fetch(`${window.location.origin}/api/maestro/validar`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ articulos: articulosParaValidar })
                });
                const data = await res.json();

                const alertaDiv = document.getElementById('maestroAlertas');
                if (data.alertas && data.alertas.length > 0) {
                    alertaDiv.style.display = 'block';
                    alertaDiv.innerHTML = data.alertas.map(a => 
                        '<div style="background:' + (a.tipo === 'NO_EXISTE' ? '#f44336' : '#ff9800') + ';color:#fff;padding:8px;border-radius:5px;margin-bottom:5px;">⚠️ ' + a.mensaje + '</div>'
                    ).join('');
                } else {
                    alertaDiv.style.display = 'none';
                    alertaDiv.innerHTML = '';
                }
            } catch (e) {
                console.error('Error validando:', e);
            }
        }


    // =============================================
    // TC DESDE BNA (OPCIONAL)
    // =============================================
    async function traerTCBNA(prefix) {
        // prefix: '' = costeo form (cm_tcUsd), 'rev_' = revaluación (rev_tcUsd), 'recalc_' = recalcular (tcUsdNuevo)
        var idMap;
        if (prefix === 'rev_') {
            idMap = { usd: 'rev_tcUsd', eur: 'rev_tcEur', gbp: 'rev_tcGbp', fecha: 'bnaFechaRev' };
        } else if (prefix === 'recalc_') {
            idMap = { usd: 'tcUsdNuevo', eur: 'tcEurNuevo', gbp: 'tcGbpNuevo', fecha: null };
        } else {
            idMap = { usd: 'cm_tcUsd', eur: 'cm_tcEur', gbp: 'cm_tcGbp', fecha: 'bnaFecha' };
        }

        try {
            var resp = await fetch(API_URL + '/api/admin/cotizaciones-bna', { headers: { 'Authorization': 'Bearer ' + token } });
            var data = await resp.json();
            if (data.error) { alert('Error BNA: ' + data.error); return; }
            
            var cotiz = data.cotizaciones || {};
            var llenados = [];
            
            // Solo llenar campos VACÍOS (no pisa valores ya cargados)
            if (cotiz.USD) {
                var el = document.getElementById(idMap.usd);
                if (el && !el.value) { el.value = cotiz.USD.venta; llenados.push('USD: ' + cotiz.USD.venta); }
                else if (el && el.value) { llenados.push('USD: ya tenía ' + el.value + ' (BNA: ' + cotiz.USD.venta + ')'); }
            }
            if (cotiz.EUR) {
                var el = document.getElementById(idMap.eur);
                if (el && !el.value) { el.value = cotiz.EUR.venta; llenados.push('EUR: ' + cotiz.EUR.venta); }
                else if (el && el.value) { llenados.push('EUR: ya tenía ' + el.value + ' (BNA: ' + cotiz.EUR.venta + ')'); }
            }
            if (cotiz.GBP) {
                var el = document.getElementById(idMap.gbp);
                if (el && !el.value) { el.value = cotiz.GBP.venta; llenados.push('GBP: ' + cotiz.GBP.venta); }
                else if (el && el.value) { llenados.push('GBP: ya tenía ' + el.value + ' (BNA: ' + cotiz.GBP.venta + ')'); }
            }
            
            if (idMap.fecha) {
                var fechaEl = document.getElementById(idMap.fecha);
                if (fechaEl) fechaEl.textContent = '📅 BNA ' + data.fecha;
            }
            
            alert('🏦 Cotizaciones BNA (' + data.fecha + '):\n\n' + llenados.join('\n') + '\n\nNota: no se pisaron valores ya cargados.');
        } catch(e) { alert('Error al conectar con BNA: ' + e.message); }
    }
