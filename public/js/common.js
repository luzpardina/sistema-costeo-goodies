// =============================================
// COMMON - Auth, Login, Core Functions
// =============================================

        // Global 401 handler: detect expired sessions on ANY API call
        (function() {
            var originalFetch = window.fetch;
            window.fetch = function(url, options) {
                return originalFetch.apply(this, arguments).then(function(response) {
                    if (response.status === 401 && url.toString().includes('/api/') && !url.toString().includes('/api/auth/login')) {
                        alert('⚠️ Tu sesión expiró. Se va a recargar la página para que inicies sesión nuevamente.');
                        logout();
                        location.reload();
                    }
                    return response;
                });
            };
        })();

        document.addEventListener('DOMContentLoaded', () => { if (token && usuario) { mostrarApp(); } });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const msgEl = document.getElementById('loginMessage');
            try {
                const res = await fetch(API_URL + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                const data = await res.json();
                if (res.ok) { token = data.token; usuario = data.usuario; localStorage.setItem('token', token); localStorage.setItem('usuario', JSON.stringify(usuario)); mostrarApp(); }
                else { msgEl.className = 'message error'; msgEl.textContent = data.error || 'Error al iniciar sesion'; }
            } catch (err) { msgEl.className = 'message error'; msgEl.textContent = 'Error de conexion.'; }
        });

        function mostrarApp() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'block'; document.getElementById('userName').textContent = usuario.nombre; cargarCosteos(); cargarUltimosCostos(); cargarHistorialRevaluaciones(); cargarStatsMaestro(); setTimeout(function(){ if (typeof cargarArticulosSimulador === 'function') cargarArticulosSimulador(); }, 2000); }
        function logout() { token = null; usuario = null; localStorage.removeItem('token'); localStorage.removeItem('usuario'); document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; }
        function toggleImportExcel() { const area = document.getElementById('importExcelArea'); if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none'; }

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
            uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
            uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); const file = e.dataTransfer.files[0]; if (file) seleccionarArchivo(file); });
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) seleccionarArchivo(e.target.files[0]); });
        }

        function seleccionarArchivo(file) { if (!file.name.match(/\.xlsx?$/i)) { alert('Solo se permiten archivos Excel'); return; } selectedFile = file; var fn = document.getElementById('fileName'); if (fn) fn.textContent = file.name; var ib = document.getElementById('importBtn'); if (ib) ib.disabled = false; }

        async function importarExcel() {
            if (!selectedFile) return;
            const msgEl = document.getElementById('importMessage'); const loading = document.getElementById('importLoading'); const btn = document.getElementById('importBtn');
            if (btn) btn.disabled = true; loading.classList.add('show'); msgEl.className = 'message';
            const formData = new FormData(); formData.append('archivo', selectedFile);
            try {
                const res = await fetch(API_URL + '/api/costeos/precargar', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
                const data = await res.json();
                if (res.ok) {
                    msgEl.className = 'message success'; 
                    msgEl.textContent = 'Excel leido - Revisá los datos y guardá';
                    selectedFile = null; 
                    var fn = document.getElementById('fileName'); if (fn) fn.textContent = '';
                    var iea = document.getElementById('importExcelArea'); if (iea) iea.style.display = 'none';
                    precargarDatosEnFormulario(data);
                }
                else { msgEl.className = 'message error'; msgEl.textContent = data.error || 'Error al leer Excel'; }
            } catch (err) { msgEl.className = 'message error'; msgEl.textContent = 'Error de conexion'; }
            finally { loading.classList.remove('show'); if (btn) btn.disabled = !selectedFile; }
        }

        function precargarDatosEnFormulario(data) {
            document.getElementById('cm_nombre').value = data.nombre_costeo || '';
            document.getElementById('cm_proveedor').value = data.proveedor || '';
            document.getElementById('cm_tieneIntermediaria').checked = false;
            const tieneInterm = !!data.empresa_intermediaria;
            document.getElementById('cm_tieneIntermediaria').checked = tieneInterm;
            document.getElementById('cm_intermediaria').value = data.empresa_intermediaria || '';
            document.getElementById('cm_facturaInterm').value = data.factura_intermediaria || '';
            document.getElementById('cm_fechaFacturaInterm').value = data.fecha_factura_intermediaria ? data.fecha_factura_intermediaria.split('T')[0] : '';
            document.getElementById('cm_fechaVencInterm').value = data.fecha_vencimiento_intermediaria ? data.fecha_vencimiento_intermediaria.split('T')[0] : '';
            document.getElementById('cm_facturaNro').value = data.factura_nro || '';
            document.getElementById('cm_moneda').value = data.moneda_principal || 'USD';
            document.getElementById('cm_monto').value = data.monto_factura || '';
            document.getElementById('cm_fechaFactura').value = data.fecha_factura ? data.fecha_factura.split('T')[0] : '';
            document.getElementById('cm_fechaVenc').value = data.fecha_vencimiento_factura ? data.fecha_vencimiento_factura.split('T')[0] : '';
            document.getElementById('cm_fechaDespacho').value = data.fecha_despacho ? data.fecha_despacho.split('T')[0] : '';
            document.getElementById('cm_tcUsd').value = data.tc_usd || '';
            document.getElementById('cm_tcEur').value = data.tc_eur || '';
            document.getElementById('cm_tcGbp').value = data.tc_gbp || '';
            document.getElementById('cm_fobMoneda').value = data.fob_moneda || 'USD';
            document.getElementById('cm_fobMonto').value = data.fob_monto || '';
            document.getElementById('cm_fleteMoneda').value = data.flete_moneda || 'USD';
            document.getElementById('cm_fleteMonto').value = data.flete_monto || '';
            document.getElementById('cm_seguroMoneda').value = data.seguro_moneda || 'USD';
            document.getElementById('cm_seguroMonto').value = data.seguro_monto || '';
            document.getElementById('cm_intermediariaGroup').style.display = tieneInterm ? 'block' : 'none';
            document.getElementById('cm_facturaIntermGroup').style.display = tieneInterm ? 'block' : 'none';
            document.getElementById('cm_fechaFacturaIntermGroup').style.display = tieneInterm ? 'block' : 'none';
            document.getElementById('cm_fechaVencIntermGroup').style.display = tieneInterm ? 'block' : 'none';
            document.getElementById('intermediariaMargenGroup').style.display = tieneInterm ? 'flex' : 'none';
            articulosManual = (data.articulos || []).map(a => {
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
                };
            });
            if (articulosManual.length === 0) agregarArticulo();
            renderizarArticulos();
            gastosManual = (data.gastos || []).map(g => ({
                descripcion: g.descripcion || '',
                proveedor: g.proveedor_gasto || '',
                nro_comprobante: g.nro_comprobante || '',
                moneda: g.moneda || 'USD',
                monto: g.monto || '',
                recargo: g.recargo || '',
                observaciones: g.observaciones || '',
                no_contable: g.no_contable || false
            }));
            if (gastosManual.length === 0) agregarGasto();
            renderizarGastos();
            window.costeoEditandoId = null;
            cambiarTab('datosGenerales');
            document.getElementById('cargaManualModal').classList.add('show');
        }
        
var todosLosArticulos = [];
        var articulosFiltrados = [];


    // =============================================
    // NAVEGACIÓN DE MÓDULOS
    // =============================================
    function cambiarModulo(modulo) {
        ['comex','comercial','contable','admin'].forEach(m => {
            const div = document.getElementById('mod' + m.charAt(0).toUpperCase() + m.slice(1));
            const btn = document.getElementById('btnMod' + m.charAt(0).toUpperCase() + m.slice(1));
            if (div) div.style.display = m === modulo ? 'block' : 'none';
            if (btn) {
                btn.style.background = m === modulo ? '#4CAF50' : 'transparent';
                btn.style.color = m === modulo ? '#fff' : '#888';
            }
        });
        // Cargar datos del módulo al entrar
        if (modulo === 'comercial') { cargarListas().then(() => cargarAcuerdos()); }
        if (modulo === 'contable') { cargarHistorialValuaciones(); cargarRevaluacionesDisponibles(); }
    }
