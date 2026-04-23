// ============================================================================
// SISTEMA DE TICKETS DE SOPORTE — Cliente
// ============================================================================
// Maneja la creación, listado y visualización de tickets. Expone funciones
// globales vía window.* para que los onclick del HTML las encuentren.
// Depende de: API_URL, token (definidos en el <script> inline de index.html).

(function() {
    'use strict';

    // ------------------------------------------------------------------------
    // Crear ticket
    // ------------------------------------------------------------------------
    async function enviarTicket() {
        const divResultado = document.getElementById('ticketResultado');
        const titulo = document.getElementById('ticketTitulo').value.trim();
        const descripcion = document.getElementById('ticketDescripcion').value.trim();
        const tipo = document.getElementById('ticketTipo').value;
        const prioridad = document.getElementById('ticketPrioridad').value;

        if (!titulo) {
            divResultado.innerHTML = '<p style="color:#f44336;">El título es obligatorio.</p>';
            return;
        }
        if (!descripcion) {
            divResultado.innerHTML = '<p style="color:#f44336;">La descripción es obligatoria.</p>';
            return;
        }

        divResultado.innerHTML = '<p style="color:#aaa;">Enviando...</p>';

        try {
            const resp = await fetch(API_URL + '/api/soporte', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tipo, titulo, descripcion, prioridad,
                    // Captura automática de contexto
                    url_contexto: window.location.href,
                    user_agent: navigator.userAgent
                })
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: 'Error desconocido' }));
                throw new Error(err.error || 'Error al crear ticket');
            }

            const data = await resp.json();
            divResultado.innerHTML =
                '<div style="padding:12px;background:#1a3a1a;border-radius:6px;border:1px solid #2d5a2d;">' +
                '<strong style="color:#4CAF50;">✅ Ticket creado</strong><br>' +
                '<span style="color:#aaa;">Número: <strong>#' + data.ticket.numero + '</strong></span><br>' +
                '<span style="color:#aaa;">Estado: <strong>' + data.ticket.estado + '</strong></span><br>' +
                '<span style="font-size:11px;color:#888;">Podés hacer seguimiento desde "Mis Tickets".</span>' +
                '</div>';

            // Limpiar formulario
            document.getElementById('ticketTitulo').value = '';
            document.getElementById('ticketDescripcion').value = '';
            document.getElementById('ticketTipo').value = 'consulta';
            document.getElementById('ticketPrioridad').value = 'media';

            // Auto-cerrar en 2s
            setTimeout(() => {
                cerrarModal('nuevoTicketModal');
                divResultado.innerHTML = '';
            }, 2500);
        } catch (e) {
            divResultado.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>';
        }
    }

    // ------------------------------------------------------------------------
    // Abrir modal de nuevo ticket
    // ------------------------------------------------------------------------
    function abrirNuevoTicket() {
        // Si el modal de "mis tickets" está abierto, cerrarlo primero
        cerrarModal('misTicketsModal');
        document.getElementById('ticketResultado').innerHTML = '';
        document.getElementById('nuevoTicketModal').classList.add('show');
    }

    // ------------------------------------------------------------------------
    // Mis tickets: lista y detalle
    // ------------------------------------------------------------------------
    async function abrirMisTickets() {
        cerrarModal('nuevoTicketModal');
        document.getElementById('misTicketsModal').classList.add('show');
        cargarMisTickets();
    }

    async function cargarMisTickets() {
        const div = document.getElementById('misTicketsLista');
        div.innerHTML = '<p style="color:#aaa;">Cargando tickets...</p>';

        try {
            const resp = await fetch(API_URL + '/api/soporte', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: 'Error' }));
                throw new Error(err.error);
            }
            const data = await resp.json();

            if (!data.tickets || data.tickets.length === 0) {
                div.innerHTML = '<p style="color:#888;padding:30px;text-align:center;">No tenés tickets todavía. Apretá "+ Nuevo Ticket" para crear uno.</p>';
                return;
            }

            const estadoEmoji = {
                abierto: '🔵',
                en_progreso: '🟡',
                resuelto: '🟢',
                cerrado: '⚫'
            };
            const tipoEmoji = {
                bug: '🐛',
                sugerencia: '💡',
                consulta: '❓',
                mejora: '✨'
            };
            const prioColor = {
                baja: '#aaa',
                media: '#4fc3f7',
                alta: '#ff9800',
                critica: '#f44336'
            };

            let html = '<div style="font-size:11px;color:#888;margin-bottom:10px;">' + data.total + ' ticket(s)</div>';
            for (const t of data.tickets) {
                const tipo = tipoEmoji[t.tipo] || '📝';
                const estado = estadoEmoji[t.estado] || '⚪';
                const color = prioColor[t.prioridad] || '#aaa';
                const fecha = new Date(t.created_at).toLocaleString('es-AR');
                const tieneRespuesta = t.respuesta_admin ? '<span style="color:#4CAF50;margin-left:8px;">💬 Respondido</span>' : '';
                html += '<div onclick="verDetalleTicket(\'' + t.id + '\')" style="padding:12px;margin-bottom:8px;background:#2a2a3e;border-radius:6px;cursor:pointer;border-left:3px solid ' + color + ';">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<div><span style="font-weight:bold;">' + tipo + ' #' + t.numero + ' - ' + t.titulo + '</span>' + tieneRespuesta + '</div>';
                html += '<div style="font-size:11px;">' + estado + ' ' + t.estado + '</div>';
                html += '</div>';
                html += '<div style="font-size:11px;color:#888;margin-top:4px;">' + fecha + ' | Prioridad: ' + t.prioridad + '</div>';
                html += '</div>';
            }
            div.innerHTML = html;
        } catch (e) {
            div.innerHTML = '<p style="color:#f44336;">Error cargando tickets: ' + e.message + '</p>';
        }
    }

    async function verDetalleTicket(id) {
        cerrarModal('misTicketsModal');
        const div = document.getElementById('detalleTicketContenido');
        div.innerHTML = '<p style="color:#aaa;">Cargando...</p>';
        document.getElementById('detalleTicketModal').classList.add('show');

        try {
            const resp = await fetch(API_URL + '/api/soporte/' + id, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) throw new Error((await resp.json()).error);
            const { ticket } = await resp.json();

            document.getElementById('detalleTicketTitulo').textContent = '#' + ticket.id.slice(0, 8) + ' — ' + ticket.titulo;

            let html = '';
            html += '<div style="margin-bottom:15px;">';
            html += '<span style="padding:3px 10px;background:#444;border-radius:4px;margin-right:5px;">' + ticket.tipo + '</span>';
            html += '<span style="padding:3px 10px;background:#444;border-radius:4px;margin-right:5px;">' + ticket.estado + '</span>';
            html += '<span style="padding:3px 10px;background:#444;border-radius:4px;">prioridad: ' + ticket.prioridad + '</span>';
            html += '</div>';
            html += '<div style="font-size:11px;color:#888;margin-bottom:15px;">Creado por ' + ticket.usuario_email + ' el ' + new Date(ticket.created_at).toLocaleString('es-AR') + '</div>';
            html += '<h4 style="color:#4fc3f7;">Descripción</h4>';
            html += '<div style="background:#1a1a2e;padding:12px;border-radius:6px;white-space:pre-wrap;margin-bottom:15px;">' + escapeHtml(ticket.descripcion) + '</div>';
            if (ticket.url_contexto) {
                html += '<div style="font-size:11px;color:#888;margin-bottom:10px;">URL: ' + escapeHtml(ticket.url_contexto) + '</div>';
            }
            if (ticket.respuesta_admin) {
                html += '<h4 style="color:#4CAF50;">Respuesta</h4>';
                html += '<div style="background:#1a3a1a;padding:12px;border-radius:6px;white-space:pre-wrap;border-left:3px solid #4CAF50;margin-bottom:10px;">' + escapeHtml(ticket.respuesta_admin) + '</div>';
                if (ticket.respondido_por) {
                    html += '<div style="font-size:11px;color:#888;">Por ' + escapeHtml(ticket.respondido_por) + ' el ' + new Date(ticket.respondido_at).toLocaleString('es-AR') + '</div>';
                }
            } else {
                html += '<p style="color:#888;font-style:italic;">Todavía no hay respuesta del equipo de soporte.</p>';
            }
            div.innerHTML = html;
        } catch (e) {
            div.innerHTML = '<p style="color:#f44336;">Error: ' + e.message + '</p>';
        }
    }

    // Helper: escapar HTML para prevenir XSS al renderizar descripciones de usuarios
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Exponer funciones usadas por onclick del HTML
    window.enviarTicket = enviarTicket;
    window.abrirNuevoTicket = abrirNuevoTicket;
    window.abrirMisTickets = abrirMisTickets;
    window.cargarMisTickets = cargarMisTickets;
    window.verDetalleTicket = verDetalleTicket;
})();
