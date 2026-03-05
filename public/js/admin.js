// =============================================
// ADMIN + Herramientas (Buscador, Historial, Dashboard, Reporte)
// =============================================


    // =============================================
    // ADMIN - GESTIÓN DE USUARIOS
    // =============================================
    function mostrarFormUsuario() {
        var form = document.getElementById('formNuevoUsuario');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        document.getElementById('nuevoUserEmail').value = '';
        document.getElementById('nuevoUserNombre').value = '';
        document.getElementById('nuevoUserPass').value = '';
        document.getElementById('nuevoUserRol').value = 'visualizador';
    }

    async function crearUsuario() {
        var email = document.getElementById('nuevoUserEmail').value.trim();
        var nombre = document.getElementById('nuevoUserNombre').value.trim();
        var password = document.getElementById('nuevoUserPass').value;
        var rol = document.getElementById('nuevoUserRol').value;
        if (!email || !nombre || !password) { alert('Completá email, nombre y contraseña'); return; }
        if (password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
        try {
            var resp = await fetch(API_URL + '/api/auth/register', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password, nombre: nombre, rol: rol })
            });
            var data = await resp.json();
            if (!resp.ok) { alert('Error: ' + (data.error || 'No se pudo crear')); return; }
            alert('✅ Usuario creado: ' + email + ' (' + rol + ')');
            document.getElementById('formNuevoUsuario').style.display = 'none';
            cargarUsuarios();
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function cargarUsuarios() {
        var div = document.getElementById('listaUsuarios');
        div.innerHTML = '<p style="color:#888;">Cargando...</p>';
        try {
            var resp = await fetch(API_URL + '/api/admin/usuarios', { headers: { 'Authorization': 'Bearer ' + token } });
            var users = await resp.json();
            if (!Array.isArray(users) || users.length === 0) { div.innerHTML = '<p>No hay usuarios.</p>'; return; }
            var ROL_COLORS = { admin: '#f44336', comex: '#4fc3f7', comercial: '#ff9800', contable: '#4CAF50', visualizador: '#888' };
            var html = '<table style="width:100%;"><thead><tr style="background:#2a2a3e;"><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>';
            users.forEach(function(u) {
                var color = ROL_COLORS[u.rol] || '#aaa';
                var activo = u.activo !== false;
                html += '<tr style="' + (activo ? '' : 'opacity:0.5;') + '">';
                html += '<td>' + (u.nombre || '-') + '</td>';
                html += '<td>' + u.email + '</td>';
                html += '<td><select onchange="cambiarRolUsuario(\'' + u.id + '\', this.value)" style="background:#1e1e2f;border:1px solid #444;color:' + color + ';padding:3px;border-radius:3px;font-size:11px;font-weight:bold;">';
                ['admin', 'comex', 'comercial', 'contable', 'visualizador'].forEach(function(r) {
                    html += '<option value="' + r + '" ' + (u.rol === r ? 'selected' : '') + '>' + r + '</option>';
                });
                html += '</select></td>';
                html += '<td><button class="btn btn-sm" style="padding:2px 8px;font-size:10px;background:' + (activo ? '#4CAF50' : '#f44336') + ';color:#fff;border:none;border-radius:3px;" onclick="toggleActivoUsuario(\'' + u.id + '\',' + !activo + ')">' + (activo ? '✅ Activo' : '❌ Inactivo') + '</button></td>';
                html += '<td><button class="btn btn-sm" style="padding:2px 8px;font-size:10px;background:#ff9800;color:#fff;border:none;border-radius:3px;" onclick="resetPasswordUsuario(\'' + u.id + '\',\'' + u.email + '\')">🔑 Reset Pass</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            div.innerHTML = html;
        } catch(e) { div.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>'; }
    }

    async function cambiarRolUsuario(id, rol) {
        try {
            await fetch(API_URL + '/api/admin/usuarios/' + id, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol: rol })
            });
            cargarUsuarios();
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function toggleActivoUsuario(id, activo) {
        if (!confirm(activo ? '¿Activar este usuario?' : '¿Desactivar este usuario? No podrá loguearse.')) return;
        try {
            await fetch(API_URL + '/api/admin/usuarios/' + id, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: activo })
            });
            cargarUsuarios();
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function resetPasswordUsuario(id, email) {
        var newPass = prompt('Nueva contraseña para ' + email + ' (mín 6 caracteres):');
        if (!newPass || newPass.length < 6) { alert('Contraseña inválida'); return; }
        try {
            await fetch(API_URL + '/api/admin/usuarios/' + id + '/password', {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPass })
            });
            alert('✅ Contraseña actualizada para ' + email);
        } catch(e) { alert('Error: ' + e.message); }
    }

    // =============================================
    // ADMIN - PARÁMETROS DEL SISTEMA
    // =============================================
    async function cargarConfigSistema() {
        var div = document.getElementById('configBody');
        div.innerHTML = '<p style="color:#888;">Cargando...</p>';
        try {
            // Seed defaults if first time
            await fetch(API_URL + '/api/admin/config/seed', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
            var resp = await fetch(API_URL + '/api/admin/config', { headers: { 'Authorization': 'Bearer ' + token } });
            var configs = await resp.json();
            if (!Array.isArray(configs) || configs.length === 0) {
                div.innerHTML = '<p style="color:#888;">No hay parámetros configurados.</p>';
                return;
            }
            var html = '<table style="width:100%;"><thead><tr style="background:#2a2a3e;"><th>Clave</th><th>Valor</th><th>Descripción</th><th>Acción</th></tr></thead><tbody>';
            configs.forEach(function(c) {
                html += '<tr>';
                html += '<td style="font-weight:bold;color:#4fc3f7;">' + c.clave + '</td>';
                html += '<td><input type="text" value="' + c.valor + '" id="cfg_' + c.clave + '" style="background:#1e1e2f;border:1px solid #444;color:#fff;padding:4px 8px;border-radius:3px;width:80px;"></td>';
                html += '<td style="color:#aaa;">' + (c.descripcion || '') + '</td>';
                html += '<td><button class="btn btn-sm btn-success" onclick="guardarConfig(\'' + c.clave + '\')">💾</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            div.innerHTML = html;
        } catch(e) { div.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>'; }
    }

    async function guardarConfig(clave) {
        var valor = document.getElementById('cfg_' + clave).value;
        try {
            await fetch(API_URL + '/api/admin/config/' + clave, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor: valor })
            });
            alert('✅ Guardado: ' + clave + ' = ' + valor);
        } catch(e) { alert('Error: ' + e.message); }
    }

    // =============================================
    // ADMIN - LOG DE AUDITORÍA
    // =============================================
    async function cargarAuditoria() {
        var div = document.getElementById('auditoriaBody');
        div.innerHTML = '<p style="color:#888;">Cargando...</p>';
        try {
            var resp = await fetch(API_URL + '/api/admin/auditoria?limit=50', { headers: { 'Authorization': 'Bearer ' + token } });
            var logs = await resp.json();
            if (!Array.isArray(logs) || logs.length === 0) {
                div.innerHTML = '<p style="color:#888;">No hay registros de auditoría.</p>';
                return;
            }
            var ACCION_COLORS = { crear: '#4CAF50', actualizar: '#ff9800', eliminar: '#f44336', calcular: '#4fc3f7', login: '#ce93d8', exportar: '#888', revaluar: '#00bcd4' };
            var html = '<table style="width:100%;font-size:11px;"><thead><tr style="background:#2a2a3e;">';
            html += '<th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th>';
            html += '</tr></thead><tbody>';
            logs.forEach(function(l) {
                var fecha = l.created_at ? new Date(l.created_at).toLocaleString('es-AR') : '-';
                var color = ACCION_COLORS[l.accion] || '#aaa';
                html += '<tr>';
                html += '<td style="white-space:nowrap;">' + fecha + '</td>';
                html += '<td>' + (l.usuario_email || '-') + '</td>';
                html += '<td style="color:' + color + ';font-weight:bold;">' + (l.accion || '-') + '</td>';
                html += '<td>' + (l.entidad || '-') + '</td>';
                html += '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">' + (l.detalle || '-') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            div.innerHTML = html;
        } catch(e) { div.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>'; }
    }

    // =============================================
    // ADMIN - EXPORTAR / IMPORTAR CONFIGURACIÓN
    // =============================================
    async function exportarConfiguracion() {
        try {
            const [listasResp, acuerdosResp] = await Promise.all([
                fetch(API_URL + '/api/comercial/listas', { headers: { 'Authorization': 'Bearer ' + token } }),
                fetch(API_URL + '/api/comercial/acuerdos', { headers: { 'Authorization': 'Bearer ' + token } })
            ]);
            const listas = await listasResp.json();
            const acuerdos = await acuerdosResp.json();
            const config = {
                exportado: new Date().toISOString(),
                sistema: 'Sistema de Costeo GOODIES',
                listas_precios: listas.map(l => { const { id, created_at, updated_at, ...datos } = l; return datos; }),
                acuerdos_comerciales: acuerdos.map(a => {
                    const lista = listas.find(l => l.id === a.lista_id);
                    const { id, lista_id, created_at, updated_at, ...datos } = a;
                    return { ...datos, lista_nombre: lista ? lista.nombre : 'Desconocida' };
                })
            };
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Config_Goodies_' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            alert('✅ Configuración exportada: ' + config.listas_precios.length + ' listas, ' + config.acuerdos_comerciales.length + ' acuerdos');
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function importarConfiguracion() {
        const fileInput = document.getElementById('importConfigFile');
        const file = fileInput.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            if (!config.listas_precios) { alert('Archivo inválido: no contiene listas_precios'); return; }
            const confirmMsg = '¿Importar configuración?\n\n' +
                '• ' + config.listas_precios.length + ' listas de precios\n' +
                '• ' + (config.acuerdos_comerciales || []).length + ' acuerdos comerciales\n\n' +
                'ATENCIÓN: Esto creará las listas y acuerdos nuevos (no elimina los existentes).';
            if (!confirm(confirmMsg)) { fileInput.value = ''; return; }
            // Crear listas
            const listasCreadas = {};
            for (const l of config.listas_precios) {
                const resp = await fetch(API_URL + '/api/comercial/listas', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(l)
                });
                const nueva = await resp.json();
                listasCreadas[l.nombre] = nueva.id;
            }
            // Crear acuerdos
            var acuerdosOk = 0;
            for (const a of (config.acuerdos_comerciales || [])) {
                const listaId = listasCreadas[a.lista_nombre];
                if (!listaId) continue;
                const { lista_nombre, ...datos } = a;
                await fetch(API_URL + '/api/comercial/acuerdos', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...datos, lista_id: listaId })
                });
                acuerdosOk++;
            }
            alert('✅ Importación completada:\n• ' + Object.keys(listasCreadas).length + ' listas creadas\n• ' + acuerdosOk + ' acuerdos creados');
            cargarListas();
            cargarAcuerdos();
            fileInput.value = '';
        } catch(e) { alert('Error al importar: ' + e.message); fileInput.value = ''; }
    }

    // =============================================
    // BUSCADOR RÁPIDO GLOBAL
    // =============================================
    var buscarGlobalTimeout = null;
    function buscarGlobal(q) {
        const div = document.getElementById('buscadorResultados');
        if (q.length < 2) { div.style.display = 'none'; return; }
        clearTimeout(buscarGlobalTimeout);
        buscarGlobalTimeout = setTimeout(async () => {
            try {
                const resp = await fetch(API_URL + '/api/costeos/buscar?q=' + encodeURIComponent(q), { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await resp.json();
                const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
                const fmtFecha = f => f ? new Date(f).toLocaleDateString('es-AR') : '-';
                var html = '';

                if (data.articulos && data.articulos.length > 0) {
                    html += '<div style="padding:6px 12px;background:#2a2a3e;color:#4fc3f7;font-size:11px;font-weight:bold;">ARTÍCULOS (' + data.articulos.length + ')</div>';
                    data.articulos.forEach(a => {
                        const actColor = a.activo ? '#4CAF50' : '#f44336';
                        html += '<div style="padding:8px 12px;border-bottom:1px solid #333;cursor:pointer;" onmouseover="this.style.background=\'#2a2a3e\'" onmouseout="this.style.background=\'transparent\'" onclick="expandirBusquedaArticulo(this)">';
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                        html += '<div><strong style="color:#fff;">' + a.codigo_goodies + '</strong> <span style="color:#aaa;font-size:12px;">' + (a.nombre || '').substring(0, 40) + '</span></div>';
                        html += '<div style="text-align:right;">';
                        if (a.ultimo_costo) html += '<span style="color:#4CAF50;font-weight:bold;">' + fmtMoney(a.ultimo_costo) + '</span>';
                        else html += '<span style="color:#666;">Sin costo</span>';
                        html += '</div></div>';
                        html += '<div style="font-size:11px;color:#888;margin-top:2px;">' + a.proveedor + (a.empresa_fabrica ? ' → ' + a.empresa_fabrica : '') + (a.marca ? ' | ' + a.marca : '') + ' <span style="color:' + actColor + ';">' + (a.activo ? '● Activo' : '● Inactivo') + '</span> <button onclick="event.stopPropagation();verHistorial(\'' + a.codigo_goodies + '\')" style="background:#2a2a3e;border:1px solid #555;color:#4fc3f7;padding:1px 6px;border-radius:3px;cursor:pointer;font-size:10px;margin-left:5px;">📈 Historial</button></div>';
                        // Detalle expandible
                        html += '<div class="busq-detalle" style="display:none;margin-top:6px;padding:6px;background:#12121e;border-radius:4px;font-size:11px;">';
                        if (a.ultimo_costeo_nombre) html += '<p style="color:#aaa;">Último costeo: <strong style="color:#fff;">' + a.ultimo_costeo_nombre + '</strong> (' + fmtFecha(a.ultimo_costeo_fecha) + ')</p>';
                        if (a.costeos && a.costeos.length > 0) {
                            html += '<p style="color:#888;margin-top:4px;">Aparece en ' + a.cantidad_costeos + ' costeo(s):</p>';
                            a.costeos.forEach(c => {
                                const estColor = c.estado === 'calculado' ? '#4CAF50' : '#ff9800';
                                html += '<div style="display:flex;justify-content:space-between;padding:2px 0;">';
                                html += '<span style="color:' + estColor + ';">' + (c.estado === 'calculado' ? '✔' : '⚠') + ' ' + c.nombre + '</span>';
                                html += '<span style="color:#aaa;">' + fmtFecha(c.fecha_despacho) + ' | ' + fmtMoney(c.costo_neto) + '</span>';
                                html += '</div>';
                            });
                        }
                        html += '</div></div>';
                    });
                }

                if (data.costeos && data.costeos.length > 0) {
                    html += '<div style="padding:6px 12px;background:#2a2a3e;color:#ff9800;font-size:11px;font-weight:bold;">COSTEOS (' + data.costeos.length + ')</div>';
                    data.costeos.forEach(c => {
                        const estColor = c.estado === 'calculado' ? '#4CAF50' : '#ff9800';
                        html += '<div style="padding:8px 12px;border-bottom:1px solid #333;cursor:pointer;" onmouseover="this.style.background=\'#2a2a3e\'" onmouseout="this.style.background=\'transparent\'" onclick="editarCosteo(\'' + c.id + '\'); cerrarBuscador();">';
                        html += '<div style="display:flex;justify-content:space-between;">';
                        html += '<span><strong style="color:#fff;">' + (c.nombre_costeo || 'Sin nombre') + '</strong> <span style="color:#aaa;font-size:12px;">' + (c.proveedor || '') + '</span></span>';
                        html += '<span style="color:' + estColor + ';">' + (c.estado === 'calculado' ? '✔' : '⚠') + ' ' + fmtFecha(c.fecha_despacho) + '</span>';
                        html += '</div></div>';
                    });
                }

                if (!html) html = '<div style="padding:15px;color:#666;text-align:center;">No se encontraron resultados para "' + q + '"</div>';
                div.innerHTML = html;
                div.style.display = 'block';
            } catch(e) { console.error('Error buscando:', e); }
        }, 300);
    }

    function expandirBusquedaArticulo(el) {
        const det = el.querySelector('.busq-detalle');
        if (det) det.style.display = det.style.display === 'none' ? 'block' : 'none';
    }

    function cerrarBuscador() {
        document.getElementById('buscadorResultados').style.display = 'none';
        document.getElementById('buscadorGlobal').value = '';
    }

    // =============================================
    // HISTORIAL DE PRECIOS POR ARTÍCULO
    // =============================================
    async function verHistorial(codigo) {
        cerrarBuscador();
        document.getElementById('modalHistorial').style.display = 'block';
        document.getElementById('historialTitulo').textContent = '📈 Historial de Costos — ' + codigo;
        document.getElementById('historialContenido').innerHTML = '<p style="color:#888;">Cargando...</p>';
        try {
            const resp = await fetch(API_URL + '/api/costeos/historial/' + encodeURIComponent(codigo), { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            if (data.error) { document.getElementById('historialContenido').innerHTML = '<p style="color:#f44336;">Error: ' + data.error + '</p>'; return; }
            const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
            const fmtFecha = f => f ? new Date(f).toLocaleDateString('es-AR') : '-';

            var html = '<p><strong>' + data.nombre + '</strong> | Proveedor: ' + (data.proveedor || '-') + (data.marca ? ' | Marca: ' + data.marca : '') + '</p>';

            if (!data.historial || data.historial.length === 0) {
                html += '<p style="color:#888;margin-top:15px;">No hay costeos con fecha de despacho para este artículo.</p>';
            } else {
                // Mini gráfico de barras con CSS
                const costos = data.historial.map(h => h.costo_neto);
                const maxCosto = Math.max(...costos);

                html += '<div style="margin:15px 0;padding:10px;background:#12121e;border-radius:6px;">';
                html += '<div style="display:flex;align-items:flex-end;gap:3px;height:120px;padding:0 5px;">';
                data.historial.forEach(h => {
                    const pct = maxCosto > 0 ? (h.costo_neto / maxCosto) * 100 : 0;
                    const estColor = h.estado === 'calculado' ? '#4CAF50' : '#ff9800';
                    html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;" title="' + h.costeo_nombre + ': ' + fmtMoney(h.costo_neto) + '">';
                    html += '<span style="font-size:9px;color:#aaa;margin-bottom:2px;">' + fmtMoney(h.costo_neto) + '</span>';
                    html += '<div style="width:100%;max-width:60px;background:' + estColor + ';border-radius:3px 3px 0 0;height:' + Math.max(pct, 5) + '%;min-height:4px;"></div>';
                    html += '<span style="font-size:8px;color:#666;margin-top:2px;text-align:center;line-height:1;">' + fmtFecha(h.fecha_despacho).replace(/\//g, '/') + '</span>';
                    html += '</div>';
                });
                html += '</div></div>';

                // Tabla detalle
                html += '<table style="width:100%;font-size:12px;margin-top:10px;"><thead><tr style="background:#2a2a3e;">';
                html += '<th>Fecha Despacho</th><th>Costeo</th><th>Estado</th><th>TC USD</th><th>FOB Unit.</th><th style="text-align:right;">Costo Neto</th><th style="text-align:right;">Var %</th>';
                html += '</tr></thead><tbody>';
                data.historial.forEach((h, i) => {
                    const estColor = h.estado === 'calculado' ? '#4CAF50' : '#ff9800';
                    var varPct = '';
                    if (i > 0 && data.historial[i-1].costo_neto > 0) {
                        const diff = ((h.costo_neto - data.historial[i-1].costo_neto) / data.historial[i-1].costo_neto) * 100;
                        const diffColor = diff > 0 ? '#f44336' : diff < 0 ? '#4CAF50' : '#aaa';
                        varPct = '<span style="color:' + diffColor + ';">' + (diff > 0 ? '+' : '') + diff.toFixed(1) + '%</span>';
                    }
                    html += '<tr>';
                    html += '<td>' + fmtFecha(h.fecha_despacho) + '</td>';
                    html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + h.costeo_nombre + '">' + h.costeo_nombre + '</td>';
                    html += '<td style="color:' + estColor + ';">' + (h.estado === 'calculado' ? '✔' : '⚠') + '</td>';
                    html += '<td>' + (h.tc_usd || '-') + '</td>';
                    html += '<td>' + (h.moneda || 'USD') + ' ' + h.fob_unitario.toFixed(2) + '</td>';
                    html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(h.costo_neto) + '</td>';
                    html += '<td style="text-align:right;">' + varPct + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table>';
            }

            document.getElementById('historialContenido').innerHTML = html;
        } catch(e) { document.getElementById('historialContenido').innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>'; }
    }

    // =============================================
    // DASHBOARD RESUMEN
    // =============================================
    var dashboardCargado = false;
    document.addEventListener('DOMContentLoaded', () => {
        const det = document.getElementById('dashboardDetails');
        if (det) det.addEventListener('toggle', () => { if (det.open && !dashboardCargado) cargarDashboard(); });
    });

    function cargarDashboard() {
        dashboardCargado = true;
        const costeos = todosLosCosteos;
        if (!costeos || costeos.length === 0) {
            document.getElementById('dashboardContent').innerHTML = '<p style="color:#888;grid-column:1/-1;">No hay costeos cargados.</p>';
            return;
        }

        const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0});
        var html = '';

        // 1. Costeos por Proveedor (top 8)
        const porProv = {};
        costeos.forEach(c => { const p = c.proveedor || 'Sin Proveedor'; porProv[p] = (porProv[p] || 0) + 1; });
        const topProvs = Object.entries(porProv).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxProv = topProvs[0] ? topProvs[0][1] : 1;

        html += '<div style="background:#12121e;border-radius:8px;padding:12px;border:1px solid #333;">';
        html += '<p style="color:#4fc3f7;font-weight:bold;font-size:12px;margin-bottom:8px;">Costeos por Proveedor</p>';
        topProvs.forEach(([prov, cant]) => {
            const pct = (cant / maxProv) * 100;
            html += '<div style="margin:4px 0;display:flex;align-items:center;gap:6px;">';
            html += '<span style="font-size:10px;color:#aaa;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + prov + '">' + prov + '</span>';
            html += '<div style="flex:1;background:#1a1a2e;border-radius:3px;height:14px;"><div style="width:' + pct + '%;background:#4fc3f7;height:100%;border-radius:3px;"></div></div>';
            html += '<span style="font-size:11px;color:#fff;width:20px;text-align:right;">' + cant + '</span>';
            html += '</div>';
        });
        html += '</div>';

        // 2. Evolución TC USD (últimos 15 costeos con fecha despacho)
        const costeosConTC = costeos.filter(c => c.fecha_despacho && c.tc_usd).sort((a, b) => new Date(a.fecha_despacho) - new Date(b.fecha_despacho)).slice(-15);
        if (costeosConTC.length > 1) {
            const tcs = costeosConTC.map(c => parseFloat(c.tc_usd));
            const maxTC = Math.max(...tcs);
            const minTC = Math.min(...tcs);
            const rangoTC = maxTC - minTC || 1;

            html += '<div style="background:#12121e;border-radius:8px;padding:12px;border:1px solid #333;">';
            html += '<p style="color:#ff9800;font-weight:bold;font-size:12px;margin-bottom:8px;">TC USD — Últimos ' + costeosConTC.length + ' despachos</p>';
            html += '<div style="display:flex;align-items:flex-end;gap:2px;height:80px;">';
            costeosConTC.forEach(c => {
                const tc = parseFloat(c.tc_usd);
                const pct = ((tc - minTC) / rangoTC) * 80 + 20;
                const fecha = new Date(c.fecha_despacho).toLocaleDateString('es-AR', {month:'short', year:'2-digit'});
                html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;" title="' + c.nombre_costeo + ': TC ' + tc + '">';
                html += '<span style="font-size:8px;color:#aaa;">' + tc.toFixed(0) + '</span>';
                html += '<div style="width:100%;background:#ff9800;border-radius:2px 2px 0 0;height:' + pct + '%;"></div>';
                html += '</div>';
            });
            html += '</div>';
            html += '<div style="display:flex;justify-content:space-between;font-size:9px;color:#666;margin-top:2px;">';
            const fechaFirst = new Date(costeosConTC[0].fecha_despacho).toLocaleDateString('es-AR', {month:'short', year:'2-digit'});
            const fechaLast = new Date(costeosConTC[costeosConTC.length-1].fecha_despacho).toLocaleDateString('es-AR', {month:'short', year:'2-digit'});
            html += '<span>' + fechaFirst + '</span><span>' + fechaLast + '</span></div>';
            html += '</div>';
        }

        // 3. Resumen rápido
        const calculados = costeos.filter(c => c.estado === 'calculado').length;
        const sinDespacho = costeos.filter(c => !c.fecha_despacho).length;
        const monedas = {};
        costeos.forEach(c => { const m = c.moneda_principal || 'USD'; monedas[m] = (monedas[m] || 0) + 1; });

        html += '<div style="background:#12121e;border-radius:8px;padding:12px;border:1px solid #333;">';
        html += '<p style="color:#4CAF50;font-weight:bold;font-size:12px;margin-bottom:8px;">Resumen General</p>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">';
        html += '<div>Total: <strong style="color:#fff;">' + costeos.length + '</strong></div>';
        html += '<div>Calculados: <strong style="color:#4CAF50;">' + calculados + '</strong></div>';
        html += '<div>Sin despacho: <strong style="color:#ff9800;">' + sinDespacho + '</strong></div>';
        html += '<div>Monedas: <strong style="color:#fff;">' + Object.entries(monedas).map(([m,c]) => m + ':' + c).join(' ') + '</strong></div>';
        html += '</div></div>';

        // 4. Top artículos más costosos
        const artsConCosto = todosLosArticulos || [];
        if (artsConCosto.length > 0) {
            const topArts = [...artsConCosto].filter(a => a.costo_neto).sort((a, b) => parseFloat(b.costo_neto) - parseFloat(a.costo_neto)).slice(0, 8);
            const maxArt = topArts[0] ? parseFloat(topArts[0].costo_neto) : 1;

            html += '<div style="background:#12121e;border-radius:8px;padding:12px;border:1px solid #333;">';
            html += '<p style="color:#ce93d8;font-weight:bold;font-size:12px;margin-bottom:8px;">Top Artículos por Costo Neto</p>';
            topArts.forEach(a => {
                const costo = parseFloat(a.costo_neto);
                const pct = (costo / maxArt) * 100;
                html += '<div style="margin:4px 0;display:flex;align-items:center;gap:6px;">';
                html += '<span style="font-size:10px;color:#aaa;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (a.nombre||a.codigo_goodies) + '">' + (a.codigo_goodies || '-') + '</span>';
                html += '<div style="flex:1;background:#1a1a2e;border-radius:3px;height:14px;"><div style="width:' + pct + '%;background:#ce93d8;height:100%;border-radius:3px;"></div></div>';
                html += '<span style="font-size:10px;color:#fff;width:70px;text-align:right;">' + fmtMoney(costo) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        document.getElementById('dashboardContent').innerHTML = html;
    }

    // =============================================
    // REPORTE IMPORTE DESPACHO
    // =============================================
    async function reporteDespacho(id) {
        document.getElementById('modalHistorial').style.display = 'block';
        document.getElementById('historialTitulo').textContent = '📋 Reporte Importe Despacho';
        document.getElementById('historialContenido').innerHTML = '<p style="color:#888;">Cargando...</p>';
        try {
            const resp = await fetch(API_URL + '/api/costeos/reporte-despacho/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            if (data.error) { document.getElementById('historialContenido').innerHTML = '<p style="color:#f44336;">' + data.error + '</p>'; return; }
            const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
            const fmtFecha = f => f ? new Date(f).toLocaleDateString('es-AR') : '-';

            var html = '<div style="display:flex;justify-content:space-between;margin-bottom:15px;">';
            html += '<div><strong style="color:#fff;font-size:16px;">' + data.nombre_costeo + '</strong><br><span style="color:#aaa;">' + (data.proveedor||'') + '</span></div>';
            html += '<div style="text-align:right;"><span style="color:#aaa;">Despacho: ' + fmtFecha(data.fecha_despacho) + '</span><br><span style="color:#aaa;">TC: ' + data.moneda + ' ' + data.tc_principal + '</span></div>';
            html += '</div>';

            // Resumen CIF
            html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:15px;">';
            html += '<div style="background:#1a1a2e;padding:10px;border-radius:6px;text-align:center;"><div style="color:#888;font-size:11px;">FOB ' + data.moneda + '</div><div style="color:#4fc3f7;font-weight:bold;">' + data.fob_divisa.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</div></div>';
            html += '<div style="background:#1a1a2e;padding:10px;border-radius:6px;text-align:center;"><div style="color:#888;font-size:11px;">FOB ARS</div><div style="color:#fff;font-weight:bold;">' + fmtMoney(data.fob_pesos) + '</div></div>';
            html += '<div style="background:#1a1a2e;padding:10px;border-radius:6px;text-align:center;"><div style="color:#888;font-size:11px;">Flete + Seguro</div><div style="color:#fff;">' + fmtMoney(data.flete_pesos + data.seguro_pesos) + '</div></div>';
            html += '<div style="background:#1a1a2e;padding:10px;border-radius:6px;text-align:center;"><div style="color:#888;font-size:11px;">CIF ARS</div><div style="color:#4CAF50;font-weight:bold;">' + fmtMoney(data.cif_pesos) + '</div></div>';
            html += '</div>';

            // Resumen impuestos
            html += '<div style="background:#12121e;border-radius:8px;padding:15px;margin-bottom:15px;border:1px solid #333;">';
            html += '<h4 style="color:#ff9800;margin-bottom:10px;">Presupuesto de Impuestos Aduaneros</h4>';
            html += '<table style="width:100%;font-size:13px;">';
            html += '<tr><td style="padding:4px 0;">Derechos de Importación</td><td style="text-align:right;font-weight:bold;">' + fmtMoney(data.resumen.derechos) + '</td></tr>';
            html += '<tr><td style="padding:4px 0;">Tasa de Estadística (3%)</td><td style="text-align:right;">' + fmtMoney(data.resumen.estadistica) + '</td></tr>';
            html += '<tr><td style="padding:4px 0;">IVA (21%)</td><td style="text-align:right;">' + fmtMoney(data.resumen.iva) + '</td></tr>';
            html += '<tr><td style="padding:4px 0;">IVA Adicional (20%)</td><td style="text-align:right;">' + fmtMoney(data.resumen.iva_adicional) + '</td></tr>';
            if (data.resumen.imp_interno > 0) html += '<tr><td style="padding:4px 0;">Impuesto Interno</td><td style="text-align:right;">' + fmtMoney(data.resumen.imp_interno) + '</td></tr>';
            html += '<tr><td style="padding:4px 0;">ANMAT</td><td style="text-align:right;">' + fmtMoney(data.resumen.anmat) + '</td></tr>';
            html += '<tr style="border-top:2px solid #555;"><td style="padding:8px 0;font-weight:bold;color:#ff9800;font-size:15px;">TOTAL A PAGAR EN ADUANA</td><td style="text-align:right;font-weight:bold;color:#ff9800;font-size:15px;">' + fmtMoney(data.resumen.total) + '</td></tr>';
            html += '</table></div>';

            // Total operación
            html += '<div style="background:#1a3a1a;border:1px solid #4CAF50;border-radius:6px;padding:12px;margin-bottom:15px;display:flex;justify-content:space-between;font-size:14px;">';
            html += '<span style="color:#4CAF50;font-weight:bold;">TOTAL OPERACIÓN (FOB + Flete + Seguro + Impuestos)</span>';
            html += '<span style="color:#4CAF50;font-weight:bold;font-size:16px;">' + fmtMoney(data.cif_pesos + data.resumen.total) + '</span>';
            html += '</div>';

            // Detalle por artículo
            html += '<details><summary style="cursor:pointer;color:#4fc3f7;font-weight:bold;font-size:12px;">📋 Detalle por artículo (' + data.articulos.length + ')</summary>';
            html += '<table style="width:100%;font-size:11px;margin-top:10px;"><thead><tr style="background:#2a2a3e;">';
            html += '<th>Código</th><th>Nombre</th><th>Derechos%</th><th>Derechos</th><th>Estad.</th><th>IVA</th><th>IVA Adic.</th><th>Imp.Int</th><th>ANMAT</th><th style="text-align:right;">Total</th>';
            html += '</tr></thead><tbody>';
            data.articulos.forEach(a => {
                html += '<tr>';
                html += '<td>' + a.codigo_goodies + '</td>';
                html += '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (a.nombre||'').substring(0,30) + '</td>';
                html += '<td>' + a.derechos_pct + '%</td>';
                html += '<td>' + fmtMoney(a.derechos) + '</td>';
                html += '<td>' + fmtMoney(a.estadistica) + '</td>';
                html += '<td>' + fmtMoney(a.iva) + '</td>';
                html += '<td>' + fmtMoney(a.iva_adicional) + '</td>';
                html += '<td>' + (a.imp_interno > 0 ? fmtMoney(a.imp_interno) : '-') + '</td>';
                html += '<td>' + fmtMoney(a.anmat) + '</td>';
                html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(a.total_impuestos) + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></details>';

            document.getElementById('historialContenido').innerHTML = html;
        } catch(e) { document.getElementById('historialContenido').innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>'; }
    }

    // Cerrar buscador al hacer clic fuera
    document.addEventListener('click', function(e) {
        const buscador = document.getElementById('buscadorGlobal');
        const resultados = document.getElementById('buscadorResultados');
        if (buscador && resultados && !buscador.contains(e.target) && !resultados.contains(e.target)) {
            resultados.style.display = 'none';
        }
    });

