// =============================================
// MÓDULO COMERCIAL - Listas, Acuerdos, Precios, Márgenes
// =============================================


    // =============================================
    // MÓDULO COMERCIAL - LISTAS DE PRECIOS
    // =============================================
    var listasPrecios = [];
    var acuerdosComerciales = [];
    var listasSeleccionadas = new Set();
    var rubrosDisponibles = [];

    async function cargarListas() {
        try {
            const resp = await fetch(API_URL + '/api/comercial/listas', { headers: { 'Authorization': 'Bearer ' + token } });
            listasPrecios = await resp.json();
            // Por defecto seleccionar las que estaban activas
            listasPrecios.forEach(l => { if (l.activa) listasSeleccionadas.add(l.id); });
            renderListas();
            renderListasInline();
            actualizarSelectsListas();
            cargarRubrosDisponibles();
        } catch(e) { console.error('Error cargando listas:', e); }
    }

    async function cargarRubrosDisponibles() {
        try {
            const resp = await fetch(API_URL + '/api/maestro/rubros', { headers: { 'Authorization': 'Bearer ' + token } });
            if (resp.ok) rubrosDisponibles = await resp.json();
        } catch(e) { rubrosDisponibles = []; }
    }

    function renderListas() {
        const body = document.getElementById('listasBody');
        if (!body) return;
        const editSt = 'background:#1e1e2f;border:1px solid #555;color:#fff;padding:3px 5px;border-radius:3px;width:60px;text-align:center;font-size:12px;';
        const obsSt = 'background:#1e1e2f;border:1px solid #555;color:#fff;padding:3px 5px;border-radius:3px;width:120px;font-size:12px;';
        body.innerHTML = listasPrecios.map(l => {
            const sel = listasSeleccionadas.has(l.id);
            const editing = l._editing;
            if (editing) {
                return `<tr style="background:rgba(33,150,243,0.08);">
                    <td><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleListaSeleccion('${l.id}', this.checked)"></td>
                    <td><input style="${editSt}width:100px;" value="${l.nombre}" id="ed_nombre_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_margen_goodies||0}" id="ed_mg_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_logistico||0}" id="ed_log_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_financiero||0}" id="ed_fin_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_comision||0}" id="ed_com_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_iibb||0}" id="ed_iibb_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_otro||0}" id="ed_otro_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_margen_cliente||0}" id="ed_mc_${l.id}"></td>
                    <td><input type="number" step="0.1" style="${editSt}" value="${l.pct_markup_tradicional||0}" id="ed_mt_${l.id}"></td>
                    <td><input style="${obsSt}" value="${l.observacion||''}" id="ed_obs_${l.id}"></td>
                    <td class="actions" style="white-space:nowrap;">
                        <button class="btn btn-sm btn-success" onclick="guardarListaInline('${l.id}')" title="Guardar">💾</button>
                        <button class="btn btn-sm btn-secondary" onclick="cancelarEdicionLista('${l.id}')" title="Cancelar">✕</button>
                    </td>
                </tr>`;
            }
            return `<tr>
                <td><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleListaSeleccion('${l.id}', this.checked)"></td>
                <td style="font-weight:bold;">${l.nombre}</td>
                <td>${parseFloat(l.pct_margen_goodies||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_logistico||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_financiero||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_comision||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_iibb||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_otro||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_margen_cliente||0).toFixed(2)}%</td>
                <td>${parseFloat(l.pct_markup_tradicional||0).toFixed(2)}%</td>
                <td style="font-size:11px;color:#aaa;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.observacion||''}">${l.observacion || '-'}</td>
                <td class="actions" style="white-space:nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editarListaInline('${l.id}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarLista('${l.id}')" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }

    function toggleListaSeleccion(id, checked) {
        if (checked) listasSeleccionadas.add(id);
        else listasSeleccionadas.delete(id);
        renderListasInline();
    }

    function toggleSelectAllListas() {
        const checked = document.getElementById('selectAllListas').checked;
        listasPrecios.forEach(l => {
            if (checked) listasSeleccionadas.add(l.id);
            else listasSeleccionadas.delete(l.id);
        });
        renderListas();
        renderListasInline();
    }

    function renderListasInline() {
        ['listasCheckPrecios', 'listasCheckMargenes'].forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '<span style="color:#888;font-size:11px;margin-right:5px;align-self:center;">Listas:</span>';
            listasPrecios.forEach(l => {
                const sel = listasSeleccionadas.has(l.id);
                const label = document.createElement('label');
                label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:12px;color:' + (sel ? '#fff' : '#888') + ';cursor:pointer;padding:3px 8px;background:' + (sel ? 'rgba(79,195,247,0.15)' : 'transparent') + ';border-radius:4px;border:1px solid ' + (sel ? '#4fc3f7' : '#444') + ';';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = sel;
                cb.onchange = function() {
                    toggleListaSeleccion(l.id, this.checked);
                    renderListas();
                };
                label.appendChild(cb);
                label.appendChild(document.createTextNode(l.nombre));
                container.appendChild(label);
            });
        });
    }

    function editarListaInline(id) {
        const lista = listasPrecios.find(l => l.id === id);
        if (lista) { lista._editing = true; renderListas(); }
    }

    function cancelarEdicionLista(id) {
        const lista = listasPrecios.find(l => l.id === id);
        if (lista) { delete lista._editing; renderListas(); }
    }

    async function guardarListaInline(id) {
        const data = {
            nombre: document.getElementById('ed_nombre_' + id).value,
            pct_logistico: parseFloat(document.getElementById('ed_log_' + id).value) || 0,
            pct_iibb: parseFloat(document.getElementById('ed_iibb_' + id).value) || 0,
            pct_financiero: parseFloat(document.getElementById('ed_fin_' + id).value) || 0,
            pct_comision: parseFloat(document.getElementById('ed_com_' + id).value) || 0,
            pct_margen_cliente: parseFloat(document.getElementById('ed_mc_' + id).value) || 0,
            pct_margen_goodies: parseFloat(document.getElementById('ed_mg_' + id).value) || 0,
            pct_markup_tradicional: parseFloat(document.getElementById('ed_mt_' + id).value) || 0,
            pct_otro: parseFloat(document.getElementById('ed_otro_' + id).value) || 0,
            observacion: document.getElementById('ed_obs_' + id).value,
            activa: listasSeleccionadas.has(id)
        };
        try {
            await fetch(API_URL + '/api/comercial/listas/' + id, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await cargarListas();
        } catch(e) { alert('Error al guardar: ' + e.message); }
    }

    function actualizarSelectsListas() {
        const selects = ['acuerdoListaSelect','simLista'];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const val = sel.value;
            sel.innerHTML = '<option value="">Seleccionar Lista...</option>' +
                listasPrecios.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
            if (val) sel.value = val;
        });
    }

    async function cargarListasPorDefecto() {
        try {
            const resp = await fetch(API_URL + '/api/comercial/listas/seed', {
                method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
            });
            const data = await resp.json();
            alert('✅ ' + (data.message || 'Listas creadas'));
            cargarListas();
        } catch(e) { alert('Error: ' + e.message); }
    }

    function abrirNuevaLista() {
        const nombre = prompt('Nombre de la lista:');
        if (!nombre) return;
        fetch(API_URL + '/api/comercial/listas', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, pct_logistico: 0, pct_iibb: 3.5, pct_financiero: 0, pct_comision: 0, pct_margen_cliente: 0 })
        }).then(() => cargarListas()).catch(e => alert('Error: ' + e.message));
    }

    // Keep editarLista as fallback but not used anymore
    async function editarLista(id) { editarListaInline(id); }

    async function eliminarLista(id) {
        if (!confirm('¿Eliminar esta lista?')) return;
        await fetch(API_URL + '/api/comercial/listas/' + id, {
            method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
        });
        listasSeleccionadas.delete(id);
        cargarListas();
    }

    // =============================================
    // MÓDULO COMERCIAL - ACUERDOS
    // =============================================
    async function cargarAcuerdos() {
        try {
            const resp = await fetch(API_URL + '/api/comercial/acuerdos', { headers: { 'Authorization': 'Bearer ' + token } });
            acuerdosComerciales = await resp.json();
            renderAcuerdos();
        } catch(e) { console.error('Error cargando acuerdos:', e); }
    }

    const TIPO_ACUERDO_LABELS = {
        'flat': 'Flat (s/Bruto)',
        'desc_oc': 'Desc. en OC',
        'nota_credito': 'Nota de Crédito',
        'factura_cliente': 'Factura del Cliente'
    };
    const BASE_CALCULO_LABELS = {
        'bruto': 'Sobre Precio Acordado',
        'neto_post_desc_oc': 'Sobre Neto post OC',
        'neto_post_nota_credito': 'Sobre Neto post NC',
        'neto_post_factura_cliente': 'Sobre Neto post Fact.Cli'
    };

    function renderAcuerdos() {
        const body = document.getElementById('acuerdosBody');
        if (!body) return;
        body.innerHTML = acuerdosComerciales.map(a => {
            const lista = listasPrecios.find(l => l.id === a.lista_id);
            const editing = a._editing;
            const rubrosArr = (a.rubros || '').split(',').filter(r => r.trim());
            const tipoLabel = TIPO_ACUERDO_LABELS[a.tipo_acuerdo] || 'Flat (s/Bruto)';
            const baseLabel = BASE_CALCULO_LABELS[a.base_calculo] || 'Sobre Precio Acordado';
            const orden = a.orden || 1;

            if (editing) {
                const editSt = 'background:#1e1e2f;border:1px solid #555;color:#fff;padding:3px 5px;border-radius:3px;font-size:11px;';
                const rubrosCheckboxes = rubrosDisponibles.map(r => {
                    const checked = rubrosArr.includes(r) ? 'checked' : '';
                    return `<label style="display:inline-flex;align-items:center;gap:3px;margin:2px 6px 2px 0;font-size:11px;"><input type="checkbox" class="rubro-check-${a.id}" value="${r}" ${checked}>${r}</label>`;
                }).join('');
                return `<tr style="background:rgba(33,150,243,0.08);">
                    <td>${lista ? lista.nombre : '-'}</td>
                    <td>${a.categoria}</td>
                    <td><input type="number" step="0.1" style="${editSt}width:60px;" value="${a.pct_acuerdo}" id="ed_acuerdo_pct_${a.id}">
                        ${a.tipo_acuerdo === 'desc_oc' ? '<br><span style="font-size:9px;color:#888;">OC2:</span><input type="number" step="0.1" style="' + editSt + 'width:50px;" value="' + (a.pct_acuerdo_2||0) + '" id="ed_acuerdo_pct2_' + a.id + '"> <span style="font-size:9px;color:#888;">OC3:</span><input type="number" step="0.1" style="' + editSt + 'width:50px;" value="' + (a.pct_acuerdo_3||0) + '" id="ed_acuerdo_pct3_' + a.id + '">' : ''}
                    </td>
                    <td><select style="${editSt}" id="ed_acuerdo_tipo_${a.id}">
                        <option value="flat" ${a.tipo_acuerdo==='flat'?'selected':''}>Flat (s/Bruto)</option>
                        <option value="desc_oc" ${a.tipo_acuerdo==='desc_oc'?'selected':''}>Desc. en OC</option>
                        <option value="nota_credito" ${a.tipo_acuerdo==='nota_credito'?'selected':''}>Nota de Crédito</option>
                        <option value="factura_cliente" ${a.tipo_acuerdo==='factura_cliente'?'selected':''}>Factura del Cliente</option>
                    </select></td>
                    <td><input type="number" min="1" max="10" style="${editSt}width:40px;" value="${orden}" id="ed_acuerdo_orden_${a.id}"></td>
                    <td><select style="${editSt}" id="ed_acuerdo_base_${a.id}">
                        <option value="bruto" ${a.base_calculo==='bruto'?'selected':''}>Sobre Precio Acordado</option>
                        <option value="neto_post_desc_oc" ${a.base_calculo==='neto_post_desc_oc'?'selected':''}>Sobre Neto post OC</option>
                        <option value="neto_post_nota_credito" ${a.base_calculo==='neto_post_nota_credito'?'selected':''}>Sobre Neto post NC</option>
                        <option value="neto_post_factura_cliente" ${a.base_calculo==='neto_post_factura_cliente'?'selected':''}>Neto post Fact.Cli.</option>
                    </select></td>
                    <td style="max-width:250px;">${rubrosCheckboxes || '<span style="color:#888;">Sin rubros</span>'}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn btn-sm btn-success" onclick="guardarAcuerdoInline('${a.id}')" title="Guardar">💾</button>
                        <button class="btn btn-sm btn-secondary" onclick="cancelarEdicionAcuerdo('${a.id}')" title="Cancelar">✕</button>
                    </td>
                </tr>`;
            }
            const tipoColor = a.tipo_acuerdo === 'desc_oc' ? '#4fc3f7' : a.tipo_acuerdo === 'nota_credito' ? '#ff9800' : a.tipo_acuerdo === 'factura_cliente' ? '#f44336' : '#4CAF50';
            const pct2 = parseFloat(a.pct_acuerdo_2) || 0;
            const pct3 = parseFloat(a.pct_acuerdo_3) || 0;
            const pctDisplay = a.pct_acuerdo + '%' + (pct2 > 0 ? ' → ' + pct2 + '%' : '') + (pct3 > 0 ? ' → ' + pct3 + '%' : '');
            return `<tr>
                <td>${lista ? lista.nombre : a.lista_id}</td>
                <td>${a.categoria}</td>
                <td>${pctDisplay}</td>
                <td style="color:${tipoColor};">${tipoLabel}</td>
                <td style="text-align:center;">${orden}</td>
                <td style="font-size:11px;">${baseLabel}</td>
                <td style="font-size:11px;color:#aaa;">${rubrosArr.length > 0 ? rubrosArr.join(', ') : '<span style="color:#666;">Todos</span>'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editarAcuerdoInline('${a.id}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarAcuerdo('${a.id}')" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }

    function editarAcuerdoInline(id) {
        const a = acuerdosComerciales.find(x => x.id === id);
        if (a) { a._editing = true; renderAcuerdos(); }
    }

    function cancelarEdicionAcuerdo(id) {
        const a = acuerdosComerciales.find(x => x.id === id);
        if (a) { delete a._editing; renderAcuerdos(); }
    }

    async function guardarAcuerdoInline(id) {
        const pct = parseFloat(document.getElementById('ed_acuerdo_pct_' + id).value) || 0;
        const pct2El = document.getElementById('ed_acuerdo_pct2_' + id);
        const pct3El = document.getElementById('ed_acuerdo_pct3_' + id);
        const pct_acuerdo_2 = pct2El ? parseFloat(pct2El.value) || 0 : 0;
        const pct_acuerdo_3 = pct3El ? parseFloat(pct3El.value) || 0 : 0;
        const tipo_acuerdo = document.getElementById('ed_acuerdo_tipo_' + id).value;
        const orden = parseInt(document.getElementById('ed_acuerdo_orden_' + id).value) || 1;
        const base_calculo = document.getElementById('ed_acuerdo_base_' + id).value;
        const checks = document.querySelectorAll('.rubro-check-' + id + ':checked');
        const rubros = [...checks].map(c => c.value).join(',');
        try {
            await fetch(API_URL + '/api/comercial/acuerdos/' + id, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pct_acuerdo: pct, pct_acuerdo_2, pct_acuerdo_3, tipo_acuerdo, orden, base_calculo, rubros })
            });
            await cargarAcuerdos();
        } catch(e) { alert('Error: ' + e.message); }
    }

    async function agregarAcuerdo() {
        const lista_id = document.getElementById('acuerdoListaSelect').value;
        const categoria = document.getElementById('acuerdoCategoriaSelect').value;
        const pct_acuerdo = parseFloat(document.getElementById('acuerdoPct').value) || 0;
        const pct_acuerdo_2 = parseFloat(document.getElementById('acuerdoPct2').value) || 0;
        const pct_acuerdo_3 = parseFloat(document.getElementById('acuerdoPct3').value) || 0;
        const tipo_acuerdo = document.getElementById('acuerdoTipo').value;
        const orden = parseInt(document.getElementById('acuerdoOrden').value) || 1;
        const base_calculo = document.getElementById('acuerdoBase').value;
        if (!lista_id) { alert('Seleccioná una lista'); return; }
        if (!pct_acuerdo) { alert('Ingresá un porcentaje'); return; }
        await fetch(API_URL + '/api/comercial/acuerdos', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lista_id, categoria, pct_acuerdo, pct_acuerdo_2, pct_acuerdo_3, tipo_acuerdo, orden, base_calculo })
        });
        document.getElementById('acuerdoPct').value = '';
        document.getElementById('acuerdoPct2').value = '';
        document.getElementById('acuerdoPct3').value = '';
        cargarAcuerdos();
    }

    async function eliminarAcuerdo(id) {
        if (!confirm('¿Eliminar acuerdo?')) return;
        await fetch(API_URL + '/api/comercial/acuerdos/' + id, {
            method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
        });
        cargarAcuerdos();
    }

    // =============================================
    // MÓDULO COMERCIAL - CÁLCULO DE PRECIOS (Costo → Precio)
    // =============================================
    var articulosPrecios = [];
    var articulosPreciosTodos = [];
    var preciosSeleccionados = new Set();
    var ultimosResultadosPrecios = null;
    var ultimosResultadosMargenes = null;

    async function cargarArticulosParaPrecios() {
        try {
            const resp = await fetch(API_URL + '/api/costeos/ultimos-costos', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            if (!Array.isArray(data)) throw new Error('Datos inválidos');

            articulosPreciosTodos = data.map(a => ({
                codigo_goodies: a.codigo_goodies || a.codigo,
                nombre: a.nombre,
                proveedor: a.proveedor || '',
                empresa_fabrica: a.empresa_fabrica || '',
                marca: a.marca || '',
                rubro: a.rubro || '',
                costo_neto: parseFloat(a.costo_neto || a.costo_unitario_neto_ars) || 0,
                iva_pct: a.iva_porcentaje ? (parseFloat(a.iva_porcentaje) * 100) : 21,
                imp_interno_pct: a.imp_interno_porcentaje ? (parseFloat(a.imp_interno_porcentaje) * 100) : 0
            })).filter(a => a.costo_neto > 0);

            poblarDropdownsPrecios(articulosPreciosTodos);
            preciosSeleccionados = new Set(articulosPreciosTodos.map(a => a.codigo_goodies));
            articulosPrecios = [...articulosPreciosTodos];
            renderArticulosPrecios();
            alert('✅ ' + articulosPrecios.length + ' artículos con costo cargados');
        } catch(e) { alert('Error: ' + e.message); console.error(e); }
    }

    function poblarDropdownsPrecios(arts) {
        const proveedores = [...new Set(arts.map(a => a.proveedor).filter(p => p))].sort();
        const fabricas = [...new Set(arts.map(a => a.empresa_fabrica).filter(f => f))].sort();
        const marcas = [...new Set(arts.map(a => a.marca).filter(m => m))].sort();
        document.getElementById('filtroPrecioProveedor').innerHTML = '<option value="">Todos los proveedores</option>' + proveedores.map(p => '<option>' + p + '</option>').join('');
        document.getElementById('filtroPrecioFabricante').innerHTML = '<option value="">Todas las fábricas</option>' + fabricas.map(f => '<option>' + f + '</option>').join('');
        document.getElementById('filtroPrecioMarca').innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option>' + m + '</option>').join('');
    }

    function cascadaFiltrosPrecios() {
        const prov = document.getElementById('filtroPrecioProveedor').value;
        const fab = document.getElementById('filtroPrecioFabricante').value;
        
        var artsFab = [...articulosPreciosTodos];
        if (prov) artsFab = artsFab.filter(a => a.proveedor === prov);
        const fabricas = [...new Set(artsFab.map(a => a.empresa_fabrica).filter(f => f))].sort();
        document.getElementById('filtroPrecioFabricante').innerHTML = '<option value="">Todas las fábricas</option>' + fabricas.map(f => '<option' + (f === fab ? ' selected' : '') + '>' + f + '</option>').join('');
        
        var artsMarca = [...articulosPreciosTodos];
        if (prov) artsMarca = artsMarca.filter(a => a.proveedor === prov);
        if (fab) artsMarca = artsMarca.filter(a => a.empresa_fabrica === fab);
        const marcas = [...new Set(artsMarca.map(a => a.marca).filter(m => m))].sort();
        const marcaSel = document.getElementById('filtroPrecioMarca').value;
        document.getElementById('filtroPrecioMarca').innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option' + (m === marcaSel ? ' selected' : '') + '>' + m + '</option>').join('');
    }

    function filtrarArticulosPrecios() {
        const texto = (document.getElementById('filtroPrecioTexto').value || '').toLowerCase();
        const proveedor = document.getElementById('filtroPrecioProveedor').value;
        const fabrica = document.getElementById('filtroPrecioFabricante').value;
        const marca = document.getElementById('filtroPrecioMarca').value;
        articulosPrecios = articulosPreciosTodos.filter(a => {
            return (!texto || a.codigo_goodies.toLowerCase().includes(texto) || a.nombre.toLowerCase().includes(texto)) &&
                   (!proveedor || a.proveedor === proveedor) &&
                   (!fabrica || a.empresa_fabrica === fabrica) &&
                   (!marca || a.marca === marca);
        });
        // Al filtrar, seleccionar todos los filtrados (limpia selección anterior)
        preciosSeleccionados = new Set(articulosPrecios.map(a => a.codigo_goodies));
        renderArticulosPrecios();
    }

    function toggleSelectAllPrecios() {
        const checked = document.getElementById('selectAllPrecios').checked;
        if (checked) articulosPrecios.forEach(a => preciosSeleccionados.add(a.codigo_goodies));
        else articulosPrecios.forEach(a => preciosSeleccionados.delete(a.codigo_goodies));
        renderArticulosPrecios();
    }

    function togglePrecioCheck(codigo) {
        if (preciosSeleccionados.has(codigo)) preciosSeleccionados.delete(codigo);
        else preciosSeleccionados.add(codigo);
    }

    function renderArticulosPrecios() {
        const body = document.getElementById('articulosPreciosBody');
        if (!body) return;
        body.innerHTML = articulosPrecios.map(a => {
            const chk = preciosSeleccionados.has(a.codigo_goodies) ? 'checked' : '';
            return '<tr>' +
                '<td><input type="checkbox" ' + chk + ' onchange="togglePrecioCheck(\'' + a.codigo_goodies + '\')"></td>' +
                '<td>' + a.codigo_goodies + '</td><td>' + a.nombre + '</td><td>' + a.proveedor + '</td><td>' + a.rubro + '</td>' +
                '<td style="text-align:right;font-weight:bold;">$' + a.costo_neto.toFixed(2) + '</td>' +
                '<td style="text-align:center;">' + a.iva_pct.toFixed(0) + '%</td>' +
                '<td style="text-align:center;">' + (a.imp_interno_pct > 0 ? a.imp_interno_pct.toFixed(0) + '%' : '-') + '</td>' +
                '</tr>';
        }).join('');
    }

    async function calcularPrecios() {
        // Solo artículos que están en la vista filtrada Y tildados
        const codigos = articulosPrecios.filter(a => preciosSeleccionados.has(a.codigo_goodies)).map(a => a.codigo_goodies);
        if (codigos.length === 0) { alert('Seleccioná al menos un artículo de los filtrados'); return; }
        const listasIds = [...listasSeleccionadas];
        if (listasIds.length === 0) { alert('Seleccioná al menos una lista de precios (checkboxes en Listas de Precios)'); return; }

        try {
            const resp = await fetch(API_URL + '/api/comercial/calcular-precios', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigos, lista_ids: listasIds })
            });
            const resultados = await resp.json();
            ultimosResultadosPrecios = resultados;
            renderResultadoPrecios(resultados);
        } catch(e) { alert('Error: ' + e.message); }
    }

    function renderResultadoPrecios(resultados) {
        const div = document.getElementById('resultadoPrecios');
        if (!div || !resultados.length) { if(div) div.innerHTML = '<p style="color:#ff9800;">No hay resultados.</p>'; return; }

        const listas = resultados[0].precios.map(p => p.lista_nombre);
        const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});

        var html = '<h4 style="color:#4CAF50;margin:10px 0;">Resultados: Cadena de Precios por Lista</h4>';

        // Detectar si alguna lista tiene distribuidor, tradicional o acuerdos cadena
        const hayDistribuidor = resultados.some(r => r.precios.some(p => p.pct_margen_cliente > 0));
        const hayTradicional = resultados.some(r => r.precios.some(p => p.pct_markup_trad > 0));
        const hayCadena = resultados.some(r => r.precios.some(p => p.tiene_acuerdos_cadena));
        const colsPorLista = 3 + (hayCadena ? 2 : 0) + (hayDistribuidor ? 1 : 0) + (hayTradicional ? 1 : 0) + 1;

        html += '<div class="table-container" style="overflow-x:auto;"><table style="font-size:11px;">';
        html += '<thead><tr style="background:#2a2a3e;">';
        html += '<th style="position:sticky;left:0;background:#2a2a3e;z-index:2;">Artículo</th>';
        html += '<th style="text-align:right;">Costo Neto</th>';
        listas.forEach(l => {
            html += '<th colspan="' + colsPorLista + '" style="text-align:center;border-left:2px solid #555;">' + l + '</th>';
        });
        html += '</tr>';
        // Sub-headers
        html += '<tr style="background:#1e1e2f;font-size:10px;">';
        html += '<th style="position:sticky;left:0;background:#1e1e2f;z-index:2;"></th><th></th>';
        listas.forEach(() => {
            html += '<th style="text-align:right;border-left:2px solid #555;">Neto Goodies</th>';
            html += '<th style="text-align:right;color:#ff9800;">CM $</th>';
            if (hayCadena) html += '<th style="text-align:right;color:#ce93d8;">Bruto Acord.</th>';
            html += '<th style="text-align:right;">Fact. Goodies</th>';
            if (hayCadena) html += '<th style="text-align:right;color:#4CAF50;">Neto Real</th>';
            if (hayDistribuidor) html += '<th style="text-align:right;">Neto Super/Dist.</th>';
            if (hayTradicional) html += '<th style="text-align:right;">Neto Trad.</th>';
            html += '<th style="text-align:right;color:#4CAF50;">PVP Est.</th>';
        });
        html += '</tr></thead><tbody>';

        resultados.forEach(r => {
            html += '<tr>';
            html += '<td style="position:sticky;left:0;background:#12121e;z-index:1;"><strong>' + r.codigo_goodies + '</strong><br><small style="color:#aaa;">' + (r.nombre||'').substring(0,30) + '</small></td>';
            html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(r.costo_neto) + '</td>';
            r.precios.forEach(p => {
                const margenColor = (p.pcts.margen_goodies || 0) >= 20 ? '#4CAF50' : '#ff9800';
                html += '<td style="text-align:right;border-left:2px solid #555;">' + fmtMoney(p.precio_neto_goodies) + '<br><small style="color:' + margenColor + ';">MG:' + (p.pcts.margen_goodies||0).toFixed(0) + '%</small></td>';
                html += '<td style="text-align:right;color:#ff9800;font-weight:bold;">' + fmtMoney(p.margen_goodies_monto) + '</td>';
                if (hayCadena) {
                    html += '<td style="text-align:right;">' + (p.tiene_acuerdos_cadena ? fmtMoney(p.precio_bruto_acordado) + '<br><small style="color:#ce93d8;">+' + p.pct_acuerdo_cadena_total + '%</small>' : '<small style="color:#555;">-</small>') + '</td>';
                }
                html += '<td style="text-align:right;">' + fmtMoney(p.factura_goodies) + '</td>';
                if (hayCadena) {
                    html += '<td style="text-align:right;">' + (p.tiene_acuerdos_cadena ? '<span style="color:#4CAF50;font-weight:bold;">' + fmtMoney(p.neto_real_goodies) + '</span>' : fmtMoney(p.precio_neto_goodies)) + '</td>';
                }
                if (hayDistribuidor) {
                    html += '<td style="text-align:right;">' + (p.precio_neto_cliente ? fmtMoney(p.precio_neto_cliente) + '<br><small style="color:#aaa;">mg:' + p.pct_margen_cliente + '%</small>' : '<small style="color:#555;">-</small>') + '</td>';
                }
                if (hayTradicional) {
                    html += '<td style="text-align:right;">' + (p.precio_neto_trad ? fmtMoney(p.precio_neto_trad) + '<br><small style="color:#aaa;">mk:' + p.pct_markup_trad + '%</small>' : '<small style="color:#555;">-</small>') + '</td>';
                }
                html += '<td style="text-align:right;font-weight:bold;color:#4CAF50;">' + (p.pvp_estimado ? fmtMoney(p.pvp_estimado) : '-') + '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Desglose expandible por artículo
        html += '<details style="margin-top:15px;"><summary style="cursor:pointer;color:#4fc3f7;font-weight:bold;">📋 Ver desglose detallado del primer artículo</summary>';
        if (resultados.length > 0) {
            const r = resultados[0];
            html += '<div style="margin-top:10px;padding:10px;background:#1e1e2f;border-radius:6px;">';
            html += '<p><strong>' + r.codigo_goodies + '</strong> — ' + r.nombre + '</p>';
            html += '<p>Costo Neto: <strong>' + fmtMoney(r.costo_neto) + '</strong> | IVA: ' + r.iva_pct + '% | Imp.Int: ' + r.imp_interno_pct + '%</p>';
            r.precios.forEach(p => {
                html += '<div style="margin-top:10px;padding:10px;background:#12121e;border-radius:4px;border-left:3px solid #4CAF50;">';
                html += '<p style="font-weight:bold;color:#4fc3f7;font-size:14px;">' + p.lista_nombre + '</p>';
                // Paso 1
                html += '<p style="margin-top:8px;"><strong style="color:#ff9800;">Paso 1 — Precio Neto Goodies</strong> (gross-up)</p>';
                html += '<p>Fórmula: ' + fmtMoney(r.costo_neto) + ' ÷ (1 - ' + p.suma_pct.toFixed(1) + '%) = <strong>' + fmtMoney(p.precio_neto_goodies) + '</strong></p>';
                html += '<p style="font-size:11px;color:#aaa;">Σ% = MG ' + (p.pcts.margen_goodies||0) + '% + Log ' + (p.pcts.logistico||0) + '% + IIBB ' + (p.pcts.iibb||0) + '% + Fin ' + (p.pcts.financiero||0) + '% + Com ' + (p.pcts.comision||0) + '%' + (p.pcts.otro_costo > 0 ? ' + Otro ' + p.pcts.otro_costo + '%' : '') + (p.pct_acuerdo_flat > 0 ? ' + Acuerdo(flat) ' + p.pct_acuerdo_flat + '%' : '') + ' = ' + p.suma_pct.toFixed(1) + '%</p>';
                html += '<p style="font-size:11px;color:#aaa;">Desglose: Margen ' + fmtMoney(p.margen_goodies_monto) + ' | Log ' + fmtMoney(p.logistico_monto) + ' | IIBB ' + fmtMoney(p.iibb_monto) + ' | Fin ' + fmtMoney(p.financiero_monto) + ' | Com ' + fmtMoney(p.comision_monto) + (p.otro_costo_monto > 0 ? ' | Otro ' + fmtMoney(p.otro_costo_monto) : '') + (p.acuerdo_flat_monto > 0 ? ' | Acuerdo(flat) ' + fmtMoney(p.acuerdo_flat_monto) : '') + '</p>';
                // Paso 1b: Acuerdos cadena
                if (p.tiene_acuerdos_cadena) {
                    const TIPO_LABELS = {desc_oc:'Desc. en OC',nota_credito:'Nota de Crédito',factura_cliente:'Factura del Cliente'};
                    const BASE_LABELS = {bruto:'Precio Acordado',neto_post_desc_oc:'Post OC',neto_post_nota_credito:'Post NC',neto_post_factura_cliente:'Post Fact.Cli'};
                    html += '<p style="margin-top:8px;"><strong style="color:#ce93d8;">Paso 1b — Acuerdos en Cadena</strong> (Σ ' + p.pct_acuerdo_cadena_total + '% → gross-up segunda capa)</p>';
                    html += '<p>Precio Bruto Acordado = ' + fmtMoney(p.precio_neto_goodies) + ' ÷ (1 - ' + p.pct_acuerdo_cadena_total + '%) = <strong>' + fmtMoney(p.precio_bruto_acordado) + '</strong></p>';
                    html += '<table style="font-size:11px;margin:5px 0;width:100%;"><tr style="color:#aaa;"><th>Orden</th><th>Tipo</th><th>%</th><th>Base</th><th>Base $</th><th>Monto</th><th>Neto post</th></tr>';
                    p.detalle_acuerdos_cadena.forEach(d => {
                        const tipoColor = d.tipo === 'desc_oc' ? '#4fc3f7' : d.tipo === 'nota_credito' ? '#ff9800' : '#f44336';
                        html += '<tr><td>' + d.orden + '</td><td style="color:' + tipoColor + ';">' + (TIPO_LABELS[d.tipo]||d.tipo) + '</td><td>' + d.pct + '%</td><td style="font-size:10px;">' + (BASE_LABELS[d.base_calculo]||d.base_calculo) + '</td><td>' + fmtMoney(d.base_valor) + '</td><td style="color:#f44336;">-' + fmtMoney(d.monto) + '</td><td>' + fmtMoney(d.neto_post) + '</td></tr>';
                    });
                    html += '</table>';
                    html += '<p style="font-size:12px;">Goodies factura: <strong>' + fmtMoney(p.precio_facturado_goodies) + '</strong> (bruto - desc. OC)</p>';
                    if (p.total_nc > 0) html += '<p style="font-size:11px;color:#ff9800;">NC a emitir: -' + fmtMoney(p.total_nc) + '</p>';
                    if (p.total_fact_cli > 0) html += '<p style="font-size:11px;color:#f44336;">Fact. del cliente: -' + fmtMoney(p.total_fact_cli) + '</p>';
                    html += '<p style="font-size:12px;">Neto real Goodies: <strong style="color:#4CAF50;">' + fmtMoney(p.neto_real_goodies) + '</strong> <small>(= ' + fmtMoney(p.precio_neto_goodies) + ' verificación ✓)</small></p>';
                }
                // Paso 2
                html += '<p style="margin-top:8px;"><strong style="color:#ff9800;">Paso 2 — Factura Goodies</strong></p>';
                html += '<p>' + fmtMoney(p.precio_facturado_goodies || p.precio_neto_goodies) + ' + IVA ' + fmtMoney((p.precio_facturado_goodies || p.precio_neto_goodies) * r.iva_pct / 100) + (r.imp_interno_pct > 0 ? ' + Imp.Int ' + fmtMoney((p.precio_facturado_goodies || p.precio_neto_goodies) * r.imp_interno_pct / 100) : '') + ' = <strong>' + fmtMoney(p.factura_goodies) + '</strong></p>';
                // Paso 3
                if (p.pct_margen_cliente > 0) {
                    const labelCliente = p.tiene_acuerdos_cadena ? 'Super' : 'Distribuidor';
                    const labelBase = p.tiene_acuerdos_cadena ? 'Bruto Acordado + Imp.Int' : 'Neto Goodies + Imp.Int';
                    html += '<p style="margin-top:8px;"><strong style="color:#ff9800;">Paso 3 — ' + labelCliente + '</strong> (margen gross-up ' + p.pct_margen_cliente + '%)</p>';
                    html += '<p>Su costo = ' + labelBase + ' = ' + fmtMoney(p.costo_cliente) + '</p>';
                    html += '<p>Su precio neto = ' + fmtMoney(p.costo_cliente) + ' ÷ (1 - ' + p.pct_margen_cliente + '%) = <strong>' + fmtMoney(p.precio_neto_cliente) + '</strong></p>';
                }
                // Paso 4
                if (p.pct_markup_trad > 0) {
                    html += '<p style="margin-top:8px;"><strong style="color:#ff9800;">Paso 4 — Tradicional</strong> (markup ' + p.pct_markup_trad + '%)</p>';
                    html += '<p>Su costo = ' + fmtMoney(p.costo_trad) + '</p>';
                    html += '<p>Su precio neto = ' + fmtMoney(p.costo_trad) + ' × (1 + ' + p.pct_markup_trad + '%) = <strong>' + fmtMoney(p.precio_neto_trad) + '</strong></p>';
                }
                // PVP
                html += '<p style="margin-top:8px;"><strong style="color:#4CAF50;">PVP Estimado: ' + (p.pvp_estimado ? fmtMoney(p.pvp_estimado) : '-') + '</strong>';
                if (p.precio_neto_trad) html += ' <small>(' + fmtMoney(p.precio_neto_trad) + ' + IVA ' + r.iva_pct + '%)</small>';
                html += '</p>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</details>';

        div.innerHTML = html;
    }

    function exportarPrecios() {
        if (!ultimosResultadosPrecios || !ultimosResultadosPrecios.length) { alert('Primero calculá los precios'); return; }
        const hayDistribuidor = ultimosResultadosPrecios.some(r => r.precios.some(p => p.pct_margen_cliente > 0));
        const hayTradicional = ultimosResultadosPrecios.some(r => r.precios.some(p => p.pct_markup_trad > 0));
        const hayCadena = ultimosResultadosPrecios.some(r => r.precios.some(p => p.tiene_acuerdos_cadena));
        const wsData = [['Código', 'Nombre', 'Proveedor', 'Rubro', 'Costo Neto', 'IVA%', 'Imp.Int%']];
        const listas = ultimosResultadosPrecios[0].precios.map(p => p.lista_nombre);
        listas.forEach(l => {
            wsData[0].push(l + ' - Neto Goodies', l + ' - CM $');
            if (hayCadena) wsData[0].push(l + ' - Bruto Acord.', l + ' - Neto Real');
            wsData[0].push(l + ' - Fact. Goodies');
            if (hayDistribuidor) wsData[0].push(l + ' - Neto Super/Dist.');
            if (hayTradicional) wsData[0].push(l + ' - Neto Trad.');
            wsData[0].push(l + ' - PVP Est.');
        });
        ultimosResultadosPrecios.forEach(r => {
            const row = [r.codigo_goodies, r.nombre, r.proveedor || '', r.rubro || '', r.costo_neto, r.iva_pct, r.imp_interno_pct];
            r.precios.forEach(p => {
                row.push(p.precio_neto_goodies, p.margen_goodies_monto);
                if (hayCadena) row.push(p.tiene_acuerdos_cadena ? p.precio_bruto_acordado : '', p.tiene_acuerdos_cadena ? p.neto_real_goodies : p.precio_neto_goodies);
                row.push(p.factura_goodies);
                if (hayDistribuidor) row.push(p.precio_neto_cliente || '');
                if (hayTradicional) row.push(p.precio_neto_trad || '');
                row.push(p.pvp_estimado || '');
            });
            wsData.push(row);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Precios');
        XLSX.writeFile(wb, 'Precios_Goodies_' + new Date().toISOString().split('T')[0] + '.xlsx');
    }

    // =============================================
    // MÓDULO COMERCIAL - CÁLCULO MÁRGENES
    // =============================================
    var articulosPvp = [];
    var articulosPvpTodos = [];

    async function cargarArticulosParaMargen() {
        try {
            const resp = await fetch(API_URL + '/api/costeos/ultimos-costos', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            articulosPvpTodos = (Array.isArray(data) ? data : []).map(a => ({
                codigo_goodies: a.codigo_goodies || a.codigo,
                nombre: a.nombre,
                proveedor: a.proveedor || '',
                empresa_fabrica: a.empresa_fabrica || '',
                marca: a.marca || '',
                rubro: a.rubro || '',
                costo_neto: parseFloat(a.costo_neto || a.costo_unitario_neto_ars) || 0,
                pvp: 0
            })).filter(a => a.costo_neto > 0);
            const proveedores = [...new Set(articulosPvpTodos.map(a => a.proveedor).filter(p => p))].sort();
            const fabricantes = [...new Set(articulosPvpTodos.map(a => a.empresa_fabrica).filter(f => f))].sort();
            const marcas = [...new Set(articulosPvpTodos.map(a => a.marca).filter(m => m))].sort();
            var sel = document.getElementById('filtroMargenProveedor');
            if (sel) sel.innerHTML = '<option value="">Todos los proveedores</option>' + proveedores.map(p => '<option value="' + p + '">' + p + '</option>').join('');
            sel = document.getElementById('filtroMargenFabricante');
            if (sel) sel.innerHTML = '<option value="">Todas las fábricas</option>' + fabricantes.map(f => '<option value="' + f + '">' + f + '</option>').join('');
            sel = document.getElementById('filtroMargenMarca');
            if (sel) sel.innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option value="' + m + '">' + m + '</option>').join('');
            // También poblar filtros del simulador
            sel = document.getElementById('filtroSimProveedor');
            if (sel) sel.innerHTML = '<option value="">Todos los proveedores</option>' + proveedores.map(p => '<option value="' + p + '">' + p + '</option>').join('');
            sel = document.getElementById('filtroSimFabricante');
            if (sel) sel.innerHTML = '<option value="">Todas las fábricas</option>' + fabricantes.map(f => '<option value="' + f + '">' + f + '</option>').join('');
            sel = document.getElementById('filtroSimMarca');
            if (sel) sel.innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option value="' + m + '">' + m + '</option>').join('');
            // Poblar dropdown de artículos del simulador
            poblarSimArticulos(articulosPvpTodos);
            articulosPvp = [...articulosPvpTodos];
            renderArticulosPvp();
            alert('✅ ' + articulosPvp.length + ' artículos cargados');
        } catch(e) { alert('Error: ' + e.message); }
    }

    function filtrarArticulosPvp() {
        const texto = (document.getElementById('filtroMargenTexto').value || '').toLowerCase();
        const proveedor = document.getElementById('filtroMargenProveedor').value;
        const fabricante = document.getElementById('filtroMargenFabricante').value;
        const marca = document.getElementById('filtroMargenMarca').value;
        articulosPvp = articulosPvpTodos.filter(a => {
            const matchTexto = !texto || a.codigo_goodies.toLowerCase().includes(texto) || a.nombre.toLowerCase().includes(texto);
            const matchProv = !proveedor || a.proveedor === proveedor;
            const matchFab = !fabricante || a.empresa_fabrica === fabricante;
            const matchMarca = !marca || a.marca === marca;
            return matchTexto && matchProv && matchFab && matchMarca;
        });
        renderArticulosPvp();
    }

    function cascadaFiltrosMargenes() {
        const prov = document.getElementById('filtroMargenProveedor').value;
        const fab = document.getElementById('filtroMargenFabricante').value;
        
        var artsFab = [...articulosPvpTodos];
        if (prov) artsFab = artsFab.filter(a => a.proveedor === prov);
        const fabricas = [...new Set(artsFab.map(a => a.empresa_fabrica).filter(f => f))].sort();
        document.getElementById('filtroMargenFabricante').innerHTML = '<option value="">Todas las fábricas</option>' + fabricas.map(f => '<option' + (f === fab ? ' selected' : '') + '>' + f + '</option>').join('');
        
        var artsMarca = [...articulosPvpTodos];
        if (prov) artsMarca = artsMarca.filter(a => a.proveedor === prov);
        if (fab) artsMarca = artsMarca.filter(a => a.empresa_fabrica === fab);
        const marcas = [...new Set(artsMarca.map(a => a.marca).filter(m => m))].sort();
        const marcaSel = document.getElementById('filtroMargenMarca').value;
        document.getElementById('filtroMargenMarca').innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option' + (m === marcaSel ? ' selected' : '') + '>' + m + '</option>').join('');
    }

    function renderArticulosPvp() {
        const body = document.getElementById('articulosPvpBody');
        if (!body) return;
        body.innerHTML = articulosPvp.map((a, i) => {
            const idxAll = articulosPvpTodos.findIndex(t => t.codigo_goodies === a.codigo_goodies);
            return `<tr>
            <td>${a.codigo_goodies}</td><td>${a.nombre}</td><td>${a.proveedor}</td>
            <td>$${a.costo_neto.toFixed(2)}</td>
            <td><input type="number" step="0.01" value="${a.pvp || ''}" onchange="actualizarPvp('${a.codigo_goodies}', this.value)" style="width:100px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:4px;border-radius:3px;"></td>
        </tr>`;
        }).join('');
    }

    function actualizarPvp(codigo, valor) {
        const pvp = parseFloat(valor) || 0;
        const art = articulosPvpTodos.find(a => a.codigo_goodies === codigo);
        if (art) art.pvp = pvp;
        const artFilt = articulosPvp.find(a => a.codigo_goodies === codigo);
        if (artFilt) artFilt.pvp = pvp;
    }

    function descargarTemplatePvp() {
        if (articulosPvpTodos.length === 0) { alert('Primero cargá artículos del catálogo'); return; }
        const wsData = [['Código', 'Nombre', 'Proveedor', 'Costo Neto', 'PVP']];
        articulosPvpTodos.forEach(a => { wsData.push([a.codigo_goodies, a.nombre, a.proveedor, a.costo_neto, '']); });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch:18},{wch:45},{wch:20},{wch:14},{wch:14}];
        XLSX.utils.book_append_sheet(wb, ws, 'PVP');
        XLSX.writeFile(wb, 'Template_PVP_Goodies.xlsx');
    }

    function subirTemplatePvp() {
        const file = document.getElementById('pvpExcelFile').files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                var cargados = 0;
                for (let i = 1; i < rows.length; i++) {
                    const codigo = String(rows[i][0] || '').trim();
                    const pvp = parseFloat(rows[i][4]) || 0;
                    if (codigo && pvp > 0) {
                        const art = articulosPvpTodos.find(a => a.codigo_goodies === codigo);
                        if (art) { art.pvp = pvp; cargados++; }
                    }
                }
                articulosPvp = [...articulosPvpTodos];
                filtrarArticulosPvp();
                alert('✅ ' + cargados + ' PVPs cargados desde Excel');
            } catch(err) { alert('Error leyendo Excel: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
    }

    async function calcularMargenes() {
        const artConPvp = articulosPvpTodos.filter(a => a.pvp > 0);
        if (artConPvp.length === 0) { alert('Ingresá al menos un PVP'); return; }
        const listasIds = [...listasSeleccionadas];
        if (listasIds.length === 0) { alert('Seleccioná al menos una lista de precios (checkboxes en Listas de Precios)'); return; }

        try {
            const resp = await fetch(API_URL + '/api/comercial/calcular-margenes', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ articulos_pvp: artConPvp.map(a => ({ codigo_goodies: a.codigo_goodies, pvp: a.pvp })), lista_ids: listasIds })
            });
            const resultados = await resp.json();
            ultimosResultadosMargenes = resultados;
            renderResultadoMargenes(resultados);
        } catch(e) { alert('Error: ' + e.message); }
    }

    function renderResultadoMargenes(resultados) {
        const div = document.getElementById('resultadoMargenes');
        if (!div || !resultados.length) return;

        const listas = resultados[0].margenes.map(m => m.lista_nombre);
        const fmtMoney = v => '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
        const hayCadena = resultados.some(r => r.margenes.some(m => m.tiene_acuerdos_cadena));
        const colsPorLista = 2 + (hayCadena ? 1 : 0);

        var html = '<h4 style="color:#ff9800;margin:10px 0;">Margen Goodies real por lista (desde PVP)</h4>';
        html += '<div class="table-container" style="overflow-x:auto;"><table style="font-size:11px;">';
        html += '<thead><tr style="background:#2a2a3e;">';
        html += '<th style="position:sticky;left:0;background:#2a2a3e;z-index:2;">Artículo</th>';
        html += '<th style="text-align:right;">Costo Neto</th>';
        html += '<th style="text-align:right;">PVP</th>';
        listas.forEach(l => {
            html += '<th colspan="' + colsPorLista + '" style="text-align:center;border-left:2px solid #555;">' + l + '</th>';
        });
        html += '</tr>';
        html += '<tr style="background:#1e1e2f;font-size:10px;">';
        html += '<th style="position:sticky;left:0;background:#1e1e2f;z-index:2;"></th><th></th><th></th>';
        listas.forEach(() => {
            html += '<th style="text-align:right;border-left:2px solid #555;">Ingreso Neto</th>';
            if (hayCadena) html += '<th style="text-align:right;">Neto Goodies</th>';
            html += '<th style="text-align:right;">Margen %</th>';
        });
        html += '</tr></thead><tbody>';

        resultados.forEach(r => {
            html += '<tr>';
            html += '<td style="position:sticky;left:0;background:#12121e;z-index:1;"><strong>' + r.codigo_goodies + '</strong><br><small style="color:#aaa;">' + (r.nombre||'').substring(0,30) + '</small></td>';
            html += '<td style="text-align:right;">' + fmtMoney(r.costo_neto) + '</td>';
            html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(r.pvp) + '</td>';
            r.margenes.forEach(m => {
                const color = m.margen_pct < 10 ? '#f44336' : m.margen_pct < 20 ? '#ff9800' : '#4CAF50';
                html += '<td style="text-align:right;border-left:2px solid #555;">' + fmtMoney(m.ingreso_neto) + '</td>';
                if (hayCadena) {
                    html += '<td style="text-align:right;">' + fmtMoney(m.precio_neto_goodies);
                    if (m.tiene_acuerdos_cadena && m.precio_bruto_acordado) {
                        html += '<br><small style="color:#ce93d8;">Bruto: ' + fmtMoney(m.precio_bruto_acordado) + '</small>';
                    }
                    html += '</td>';
                }
                html += '<td style="text-align:center;color:' + color + ';font-weight:bold;font-size:14px;">' + m.margen_pct.toFixed(1) + '%';
                if (m.margen_punta_punta_super !== null) {
                    html += '<br><small style="color:#aaa;font-weight:normal;font-size:10px;">Super PaP: ' + m.margen_punta_punta_super.toFixed(0) + '%</small>';
                }
                html += '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Desglose del primer artículo
        html += '<details style="margin-top:15px;"><summary style="cursor:pointer;color:#4fc3f7;font-weight:bold;">📋 Ver desglose inverso del primer artículo</summary>';
        if (resultados.length > 0) {
            const r = resultados[0];
            html += '<div style="margin-top:10px;padding:10px;background:#1e1e2f;border-radius:6px;">';
            html += '<p><strong>' + r.codigo_goodies + '</strong> — ' + r.nombre + '</p>';
            html += '<p>PVP: <strong>' + fmtMoney(r.pvp) + '</strong> | Costo Neto: <strong>' + fmtMoney(r.costo_neto) + '</strong> | IVA: ' + r.iva_pct + '% | Imp.Int: ' + r.imp_interno_pct + '%</p>';
            r.margenes.forEach(m => {
                const color = m.margen_pct < 10 ? '#f44336' : m.margen_pct < 20 ? '#ff9800' : '#4CAF50';
                html += '<div style="margin-top:10px;padding:10px;background:#12121e;border-radius:4px;border-left:3px solid ' + color + ';">';
                html += '<p style="font-weight:bold;color:#4fc3f7;font-size:14px;">' + m.lista_nombre + '</p>';
                // Paso a paso inverso
                html += '<p style="margin-top:5px;"><strong style="color:#ff9800;">PVP → quitar IVA</strong>: ' + fmtMoney(r.pvp) + ' ÷ (1 + ' + r.iva_pct + '%) = ' + fmtMoney(m.precio_neto_final) + '</p>';
                if (m.pcts_usados.markup_trad > 0) {
                    html += '<p><strong style="color:#ff9800;">Desandar Markup Trad.</strong> (' + m.pcts_usados.markup_trad + '%): ' + fmtMoney(m.precio_neto_final) + ' ÷ (1 + ' + m.pcts_usados.markup_trad + '%) = ' + fmtMoney(m.costo_trad) + '</p>';
                }
                if (m.pcts_usados.margen_cliente > 0) {
                    const labelCliente = m.tiene_acuerdos_cadena ? 'Super' : 'Distribuidor';
                    html += '<p><strong style="color:#ff9800;">Desandar Margen ' + labelCliente + '</strong> (' + m.pcts_usados.margen_cliente + '%): × (1 - ' + m.pcts_usados.margen_cliente + '%) = Base + Int.</p>';
                }
                if (r.imp_interno_pct > 0) {
                    html += '<p><strong style="color:#ff9800;">Quitar Imp. Internos</strong>: ÷ (1 + ' + r.imp_interno_pct + '%)</p>';
                }
                if (m.tiene_acuerdos_cadena) {
                    html += '<p><strong style="color:#ce93d8;">Desandar Acuerdos Cadena</strong> (' + m.pct_acuerdo_cadena_total + '%): Bruto ' + fmtMoney(m.precio_bruto_acordado) + ' × (1 - ' + m.pct_acuerdo_cadena_total + '%) = <strong>' + fmtMoney(m.precio_neto_goodies) + '</strong></p>';
                }
                const totalPctGastos = m.pcts_usados.logistico + m.pcts_usados.iibb + m.pcts_usados.financiero + m.pcts_usados.comision + m.pcts_usados.otro_costo + (m.pcts_usados.acuerdo_flat || 0);
                html += '<p><strong style="color:#ff9800;">Deducciones Goodies</strong> (' + totalPctGastos.toFixed(1) + '% de ' + fmtMoney(m.precio_neto_goodies) + '): -' + fmtMoney(m.total_deducciones) + '</p>';
                html += '<p><strong>Ingreso Neto Goodies:</strong> ' + fmtMoney(m.ingreso_neto) + '</p>';
                html += '<p style="font-size:14px;margin-top:5px;"><strong style="color:' + color + ';">Margen Goodies: (' + fmtMoney(m.ingreso_neto) + ' - ' + fmtMoney(r.costo_neto) + ') ÷ ' + fmtMoney(r.costo_neto) + ' = ' + m.margen_pct.toFixed(1) + '%</strong></p>';
                if (m.margen_punta_punta_super !== null) {
                    html += '<p style="font-size:11px;color:#aaa;">Margen punta a punta del super: ' + m.margen_punta_punta_super.toFixed(1) + '% (referencia informativa)</p>';
                }
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</details>';

        // Alertas de margen bajo
        const alertasMargen = [];
        resultados.forEach(r => {
            r.margenes.forEach(m => {
                if (m.margen_pct < 10 && r.costo_neto > 0) {
                    alertasMargen.push({ codigo: r.codigo_goodies, nombre: r.nombre, lista: m.lista_nombre, margen: m.margen_pct });
                }
            });
        });
        if (alertasMargen.length > 0) {
            html = '<div style="background:rgba(244,67,54,0.1);border:1px solid #f44336;border-radius:6px;padding:10px 15px;margin-bottom:15px;">' +
                '<p style="color:#f44336;font-weight:bold;">⚠️ ' + alertasMargen.length + ' artículo(s) con margen menor al 10%:</p>' +
                '<div style="max-height:120px;overflow-y:auto;font-size:11px;">' +
                alertasMargen.map(a => '<p style="margin:2px 0;color:#f44336;">' + a.codigo + ' — ' + a.lista + ': <strong>' + a.margen.toFixed(1) + '%</strong></p>').join('') +
                '</div></div>' + html;
        }

        div.innerHTML = html;
    }

    function exportarMargenes() {
        if (!ultimosResultadosMargenes || !ultimosResultadosMargenes.length) { alert('Primero calculá los márgenes'); return; }
        const listas = ultimosResultadosMargenes[0].margenes.map(m => m.lista_nombre);
        const wsData = [['Código', 'Nombre', 'Rubro', 'Costo Neto', 'PVP', 'IVA%', 'Imp.Int%']];
        listas.forEach(l => { wsData[0].push(l + ' - Neto Goodies', l + ' - Ingreso Neto', l + ' - Margen %'); });
        ultimosResultadosMargenes.forEach(r => {
            const row = [r.codigo_goodies, r.nombre, r.rubro || '', r.costo_neto, r.pvp, r.iva_pct, r.imp_interno_pct];
            r.margenes.forEach(m => { row.push(m.precio_neto_goodies, m.ingreso_neto, m.margen_pct); });
            wsData.push(row);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Márgenes');
        XLSX.writeFile(wb, 'Margenes_Goodies_' + new Date().toISOString().split('T')[0] + '.xlsx');
    }

    // =============================================
    // MÓDULO COMERCIAL - SIMULADOR DESCUENTO
    // =============================================
    async function simularDescuento() {
        const codigo = document.getElementById('simArticulo').value;
        const lista_id = document.getElementById('simLista').value;
        const precio = parseFloat(document.getElementById('simPrecio').value) || 0;
        const cantidad = parseInt(document.getElementById('simCantidad').value) || 0;

        if (!codigo || !lista_id || !precio || !cantidad) { alert('Completá todos los campos'); return; }

        try {
            const resp = await fetch(API_URL + '/api/comercial/simular-descuento', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_goodies: codigo, lista_id, precio_actual: precio, cantidad_actual: cantidad })
            });
            const data = await resp.json();
            renderSimulador(data);
        } catch(e) { alert('Error: ' + e.message); }
    }

    function renderSimulador(data) {
        const div = document.getElementById('resultadoSimulador');
        if (!div) return;

        var html = '<div style="background:#2a2a3e;padding:15px;border-radius:8px;margin-bottom:15px;">';
        html += '<p style="color:#4CAF50;font-weight:bold;">' + data.nombre + ' | Lista: ' + data.lista_nombre + '</p>';
        html += '<p style="color:#aaa;">Costo Neto: $' + data.costo_neto.toFixed(2) + ' | Ingreso Neto Actual: $' + data.ingreso_neto_actual.toFixed(2) + '</p>';
        html += '<p style="color:#aaa;">Ganancia Unit: $' + data.ganancia_unit_actual.toFixed(2) + ' | Ganancia Total: $' + data.ganancia_total_actual.toFixed(2) + '</p>';
        html += '</div>';

        html += '<table><thead><tr><th>Aumento Volumen</th><th>Nueva Cantidad</th><th>Precio Mínimo</th><th style="color:#4CAF50;">Descuento Máximo</th><th>Ganancia Total</th></tr></thead><tbody>';
        data.escenarios.forEach(e => {
            html += '<tr><td>+' + e.aumento_volumen_pct + '%</td><td>' + e.nueva_cantidad + '</td><td>$' + e.precio_minimo.toFixed(2) + '</td>';
            html += '<td style="color:#4CAF50;font-weight:bold;font-size:16px;">' + e.descuento_max_pct.toFixed(1) + '%</td>';
            html += '<td>$' + e.ganancia_total_nueva.toFixed(2) + '</td></tr>';
        });
        html += '</tbody></table>';

        div.innerHTML = html;
    }

// === SIMULADOR - DATA + OVERRIDE ===
    var articulosSimTodos = [];
    async function cargarArticulosSimulador() {
        try {
            const resp = await fetch(API_URL + '/api/costeos/ultimos-costos', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await resp.json();
            articulosSimTodos = Array.isArray(data) ? data : [];
            // Poblar filtros si no están ya poblados
            const proveedores = [...new Set(articulosSimTodos.map(a => a.proveedor).filter(p => p))].sort();
            const fabricantes = [...new Set(articulosSimTodos.map(a => a.empresa_fabrica).filter(f => f))].sort();
            const marcas = [...new Set(articulosSimTodos.map(a => a.marca).filter(m => m))].sort();
            var sel = document.getElementById('filtroSimProveedor');
            if (sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Todos los proveedores</option>' + proveedores.map(p => '<option value="' + p + '">' + p + '</option>').join('');
            sel = document.getElementById('filtroSimFabricante');
            if (sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Todas las fábricas</option>' + fabricantes.map(f => '<option value="' + f + '">' + f + '</option>').join('');
            sel = document.getElementById('filtroSimMarca');
            if (sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option value="' + m + '">' + m + '</option>').join('');
            poblarSimArticulos(articulosSimTodos);
        } catch(e) { console.error(e); }
    }

    function poblarSimArticulos(arts) {
        const sel = document.getElementById('simArticulo');
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar...</option>' +
            arts.map(a => '<option value="' + (a.codigo_goodies || a.codigo) + '">' + (a.codigo_goodies || a.codigo) + ' - ' + a.nombre + '</option>').join('');
    }

    function cascadaFiltrosSim() {
        const prov = document.getElementById('filtroSimProveedor').value;
        const fab = document.getElementById('filtroSimFabricante').value;

        var artsFab = [...articulosSimTodos];
        if (prov) artsFab = artsFab.filter(a => a.proveedor === prov);
        const fabricas = [...new Set(artsFab.map(a => a.empresa_fabrica).filter(f => f))].sort();
        document.getElementById('filtroSimFabricante').innerHTML = '<option value="">Todas las fábricas</option>' + fabricas.map(f => '<option' + (f === fab ? ' selected' : '') + '>' + f + '</option>').join('');

        var artsMarca = [...articulosSimTodos];
        if (prov) artsMarca = artsMarca.filter(a => a.proveedor === prov);
        if (fab) artsMarca = artsMarca.filter(a => a.empresa_fabrica === fab);
        const marcas = [...new Set(artsMarca.map(a => a.marca).filter(m => m))].sort();
        const marcaSel = document.getElementById('filtroSimMarca').value;
        document.getElementById('filtroSimMarca').innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => '<option' + (m === marcaSel ? ' selected' : '') + '>' + m + '</option>').join('');
    }

    function filtrarArticulosSim() {
        const proveedor = document.getElementById('filtroSimProveedor').value;
        const fabricante = document.getElementById('filtroSimFabricante').value;
        const marca = document.getElementById('filtroSimMarca').value;
        const filtrados = articulosSimTodos.filter(a => {
            const matchProv = !proveedor || a.proveedor === proveedor;
            const matchFab = !fabricante || a.empresa_fabrica === fabricante;
            const matchMarca = !marca || a.marca === marca;
            return matchProv && matchFab && matchMarca;
        });
        poblarSimArticulos(filtrados);
    }


    // =============================================
    // MERCADO LIBRE - CALCULADORA
    // =============================================
    var mlArticulos = [];
    var mlResultados = null;

    // Toggle columna Esencial según canal
    document.addEventListener('DOMContentLoaded', function() {
        var sel = document.getElementById('mlCanal');
        if (sel) sel.addEventListener('change', function() {
            var th = document.getElementById('mlThEsencial');
            if (th) th.style.display = this.value === 'full_super' ? '' : 'none';
            // Update existing rows
            document.querySelectorAll('.ml-esencial-cell').forEach(function(td) {
                td.style.display = sel.value === 'full_super' ? '' : 'none';
            });
        });
    });

    async function cargarArticulosML() {
        try {
            // Load both ultimos costos and catalog for physical data
            var [respCostos, respCatalogo] = await Promise.all([
                fetch(API_URL + '/api/costeos/ultimos-costos', { headers: { 'Authorization': 'Bearer ' + token } }),
                fetch(API_URL + '/api/maestro/catalogo?activos=true', { headers: { 'Authorization': 'Bearer ' + token } })
            ]);
            var costos = await respCostos.json();
            var catalogo = await respCatalogo.json();
            if (!Array.isArray(costos)) throw new Error('Datos inválidos');
            
            // Index catalog by codigo for fast lookup
            var catMap = {};
            if (Array.isArray(catalogo)) catalogo.forEach(function(c) { catMap[(c.codigo_goodies||'').toUpperCase()] = c; });
            
            mlArticulos = costos.filter(function(a) { return (parseFloat(a.costo_neto || a.costo_unitario_neto_ars) || 0) > 0; }).map(function(a) {
                var codigo = a.codigo_goodies || a.codigo;
                var cat = catMap[(codigo||'').toUpperCase()] || {};
                return {
                    codigo_goodies: codigo,
                    nombre: a.nombre || '',
                    costo_neto: parseFloat(a.costo_neto || a.costo_unitario_neto_ars) || 0,
                    precio_ml: 0,
                    peso_kg: parseFloat(cat.peso_unitario_kg) || 0,
                    largo_cm: parseFloat(cat.largo_cm) || 0,
                    ancho_cm: parseFloat(cat.ancho_cm) || 0,
                    alto_cm: parseFloat(cat.alto_cm) || 0,
                    es_esencial: cat.es_esencial_ml || false,
                    unidades_por_caja: parseInt(cat.unidades_por_caja_ml) || 1,
                    tipo_caja: cat.tipo_caja_ml || 'mediana'
                };
            });
            
            var conPeso = mlArticulos.filter(function(a) { return a.peso_kg > 0; }).length;
            renderArticulosML();
            alert('✅ ' + mlArticulos.length + ' artículos cargados (' + conPeso + ' con datos de peso/dimensiones del catálogo)');
        } catch(e) { alert('Error: ' + e.message); }
    }

    function renderArticulosML() {
        var body = document.getElementById('mlArticulosBody');
        if (!body) return;
        var canal = document.getElementById('mlCanal').value;
        var showEsencial = canal === 'full_super';
        var th = document.getElementById('mlThEsencial');
        if (th) th.style.display = showEsencial ? '' : 'none';

        body.innerHTML = mlArticulos.map(function(a, i) {
            return '<tr>' +
                '<td>' + a.codigo_goodies + '</td>' +
                '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + a.nombre + '</td>' +
                '<td style="text-align:right;">$' + a.costo_neto.toLocaleString('es-AR', {minimumFractionDigits:2}) + '</td>' +
                '<td><input type="number" value="' + (a.precio_ml || '') + '" onchange="mlArticulos[' + i + '].precio_ml=parseFloat(this.value)||0" style="width:80px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:3px;border-radius:3px;font-size:11px;"></td>' +
                '<td><input type="number" value="' + (a.peso_kg || '') + '" step="0.1" onchange="mlArticulos[' + i + '].peso_kg=parseFloat(this.value)||0" style="width:55px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:3px;border-radius:3px;font-size:11px;"></td>' +
                '<td style="white-space:nowrap;">' +
                    '<input type="number" value="' + (a.largo_cm || '') + '" placeholder="L" onchange="mlArticulos[' + i + '].largo_cm=parseFloat(this.value)||0" style="width:38px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:3px;border-radius:3px;font-size:10px;">×' +
                    '<input type="number" value="' + (a.ancho_cm || '') + '" placeholder="A" onchange="mlArticulos[' + i + '].ancho_cm=parseFloat(this.value)||0" style="width:38px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:3px;border-radius:3px;font-size:10px;">×' +
                    '<input type="number" value="' + (a.alto_cm || '') + '" placeholder="H" onchange="mlArticulos[' + i + '].alto_cm=parseFloat(this.value)||0" style="width:38px;background:#1e1e2f;border:1px solid #444;color:#fff;padding:3px;border-radius:3px;font-size:10px;">' +
                '</td>' +
                '<td class="ml-esencial-cell" style="' + (showEsencial ? '' : 'display:none;') + '"><input type="checkbox" ' + (a.es_esencial ? 'checked' : '') + ' onchange="mlArticulos[' + i + '].es_esencial=this.checked"></td>' +
                '</tr>';
        }).join('');
    }

    async function calcularML() {
        var artConPrecio = mlArticulos.filter(function(a) { return a.precio_ml > 0; });
        if (artConPrecio.length === 0) { alert('Ingresá al menos un Precio ML'); return; }

        var canal = document.getElementById('mlCanal').value;
        var comision = parseFloat(document.getElementById('mlComision').value) || 14;
        var otrosCostos = {
            pctIIBB: parseFloat(document.getElementById('mlIIBB').value) || 0,
            pctFinanciero: parseFloat(document.getElementById('mlFinanciero').value) || 0,
            pctLogisticoInterno: parseFloat(document.getElementById('mlLogistico').value) || 0
        };

        try {
            var resp = await fetch(API_URL + '/api/comercial/ml/calcular', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articulos: artConPrecio.map(function(a) {
                        return {
                            codigo_goodies: a.codigo_goodies,
                            nombre: a.nombre,
                            precio_venta: a.precio_ml,
                            costo_producto: a.costo_neto,
                            peso_kg: a.peso_kg,
                            largo_cm: a.largo_cm,
                            ancho_cm: a.ancho_cm,
                            alto_cm: a.alto_cm,
                            es_esencial: a.es_esencial
                        };
                    }),
                    canal: canal,
                    comision_pct: comision,
                    otros_costos: otrosCostos
                })
            });
            var resultados = await resp.json();
            mlResultados = resultados;
            renderResultadosML(resultados, canal);
        } catch(e) { alert('Error: ' + e.message); }
    }

    function renderResultadosML(resultados, canal) {
        var div = document.getElementById('resultadoML');
        if (!div) return;
        var fmtMoney = function(v) { return '$' + (parseFloat(v)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); };
        var canalLabel = canal === 'flex' ? 'Flex' : 'Full Súper';

        // Resumen
        var totalMargen = 0, totalIngresoNeto = 0, alertas = 0;
        resultados.forEach(function(r) {
            totalMargen += r.margen_pesos;
            totalIngresoNeto += r.ingreso_neto;
            if (r.margen_pct < 10) alertas++;
        });

        var html = '<h4 style="color:#ffe600;margin:10px 0;">🛒 Resultados ML — Canal: ' + canalLabel + ' (' + resultados.length + ' artículos)</h4>';

        if (alertas > 0) {
            html += '<div style="background:rgba(244,67,54,0.1);border:1px solid #f44336;border-radius:6px;padding:8px 12px;margin-bottom:10px;">';
            html += '<span style="color:#f44336;font-weight:bold;">⚠️ ' + alertas + ' artículo(s) con margen menor al 10%</span></div>';
        }

        html += '<div class="table-container" style="overflow-x:auto;"><table style="font-size:11px;">';
        html += '<thead><tr style="background:#2a2a3e;">';
        html += '<th>Artículo</th><th style="text-align:right;">Costo</th><th style="text-align:right;">Precio ML</th>';
        html += '<th style="text-align:right;">Comisión</th><th style="text-align:right;">Costo Fijo</th>';
        html += '<th style="text-align:right;">Total Costos</th><th style="text-align:right;">Ingreso Neto</th>';
        html += '<th style="text-align:right;">Margen $</th><th style="text-align:center;">Margen %</th>';
        html += '<th>Peso Efec.</th><th>Detalle</th>';
        html += '</tr></thead><tbody>';

        resultados.forEach(function(r) {
            var margenColor = r.margen_pct < 0 ? '#f44336' : r.margen_pct < 10 ? '#ff9800' : '#4CAF50';
            html += '<tr>';
            html += '<td><strong>' + r.codigo_goodies + '</strong><br><small style="color:#aaa;">' + (r.nombre||'').substring(0,25) + '</small></td>';
            html += '<td style="text-align:right;">' + fmtMoney(r.costo_producto) + '</td>';
            html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(r.precio_venta) + '</td>';
            html += '<td style="text-align:right;color:#ff9800;">' + fmtMoney(r.comision_monto) + '<br><small>' + r.comision_pct + '%</small></td>';
            html += '<td style="text-align:right;color:#f44336;">' + fmtMoney(r.costo_fijo.costo) + (r.costo_fijo.tope_aplicado ? '<br><small style="color:#ff9800;">tope 25%</small>' : '') + '</td>';
            html += '<td style="text-align:right;">' + fmtMoney(r.total_costos) + '</td>';
            html += '<td style="text-align:right;font-weight:bold;">' + fmtMoney(r.ingreso_neto) + '</td>';
            html += '<td style="text-align:right;color:' + margenColor + ';font-weight:bold;">' + fmtMoney(r.margen_pesos) + '</td>';
            html += '<td style="text-align:center;color:' + margenColor + ';font-weight:bold;font-size:13px;">' + r.margen_pct.toFixed(1) + '%</td>';
            html += '<td style="font-size:10px;">' + r.peso_efectivo + ' kg' + (r.peso_volumetrico > r.peso_fisico ? '<br><small style="color:#ff9800;">vol</small>' : '') + '</td>';
            html += '<td style="font-size:10px;color:#aaa;">' + r.costo_fijo.detalle + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Desglose primer artículo
        if (resultados.length > 0) {
            var r = resultados[0];
            html += '<details style="margin-top:10px;"><summary style="cursor:pointer;color:#ffe600;font-weight:bold;font-size:12px;">📋 Desglose del primer artículo</summary>';
            html += '<div style="margin-top:8px;padding:12px;background:#12121e;border-radius:6px;font-size:12px;">';
            html += '<p><strong>' + r.codigo_goodies + '</strong> — ' + r.nombre + '</p>';
            html += '<p>Precio ML: <strong>' + fmtMoney(r.precio_venta) + '</strong> | Costo: ' + fmtMoney(r.costo_producto) + '</p>';
            html += '<p style="margin-top:8px;color:#ff9800;"><strong>Costos ML:</strong></p>';
            html += '<p>• Comisión ML (' + r.comision_pct + '%): -' + fmtMoney(r.comision_monto) + '</p>';
            html += '<p>• Costo fijo unidad: -' + fmtMoney(r.costo_fijo.costo) + ' <small style="color:#aaa;">(' + r.costo_fijo.detalle + ')</small></p>';
            if (r.iibb_monto > 0) html += '<p>• IIBB: -' + fmtMoney(r.iibb_monto) + '</p>';
            if (r.financiero_monto > 0) html += '<p>• Financiero: -' + fmtMoney(r.financiero_monto) + '</p>';
            if (r.logistico_interno_monto > 0) html += '<p>• Logístico interno: -' + fmtMoney(r.logistico_interno_monto) + '</p>';
            html += '<p style="margin-top:5px;font-weight:bold;">Total costos: -' + fmtMoney(r.total_costos) + ' (' + (r.precio_venta > 0 ? (r.total_costos / r.precio_venta * 100).toFixed(1) : 0) + '% del precio)</p>';
            html += '<p style="margin-top:8px;">Ingreso Neto: <strong>' + fmtMoney(r.ingreso_neto) + '</strong></p>';
            html += '<p style="font-size:14px;margin-top:5px;color:' + (r.margen_pct < 10 ? '#f44336' : '#4CAF50') + ';"><strong>Margen: ' + fmtMoney(r.margen_pesos) + ' (' + r.margen_pct.toFixed(1) + '% sobre costo)</strong></p>';
            if (r.envio_gratis_obligatorio) html += '<p style="color:#ffe600;">📦 Envío gratis obligatorio (≥ $33.000)</p>';
            html += '<p style="margin-top:5px;font-size:11px;color:#aaa;">Peso: ' + r.peso_fisico + ' kg físico | ' + r.peso_volumetrico + ' kg volumétrico | <strong>' + r.peso_efectivo + ' kg efectivo</strong></p>';
            html += '</div></details>';
        }

        div.innerHTML = html;
    }

    function exportarML() {
        if (!mlResultados || !mlResultados.length) { alert('Primero calculá ML'); return; }
        var wsData = [['Código', 'Nombre', 'Costo Neto', 'Precio ML', 'Canal', 'Peso Efectivo',
            'Comisión ML', 'Costo Fijo', 'Total Costos', 'Ingreso Neto', 'Margen $', 'Margen %', 'Detalle Costo Fijo']];
        mlResultados.forEach(function(r) {
            wsData.push([r.codigo_goodies, r.nombre, r.costo_producto, r.precio_venta, r.canal,
                r.peso_efectivo, r.comision_monto, r.costo_fijo.costo, r.total_costos,
                r.ingreso_neto, r.margen_pesos, r.margen_pct, r.costo_fijo.detalle]);
        });
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'ML Costos');
        XLSX.writeFile(wb, 'ML_Costos_' + new Date().toISOString().split('T')[0] + '.xlsx');
    }
