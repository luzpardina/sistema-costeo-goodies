/**
 * Servicio para obtener cotizaciones del BNA
 * Fuente: https://www.bna.com.ar/Cotizador/MonedasHistorico
 */

const BNA_URL = 'https://www.bna.com.ar/Cotizador/MonedasHistorico';

/**
 * Fetch y parsear cotizaciones del BNA
 * @returns {Object} { fecha, cotizaciones: { USD: {compra, venta}, EUR: {compra, venta}, GBP: {compra, venta} } }
 */
async function obtenerCotizacionesBNA() {
    const fetch = require('node-fetch');
    
    const response = await fetch(BNA_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 10000
    });
    
    if (!response.ok) {
        throw new Error('BNA no disponible (HTTP ' + response.status + ')');
    }
    
    const html = await response.text();
    
    // Parse date
    const fechaMatch = html.match(/Fecha:\s*([0-9\/]+)/i);
    const fecha = fechaMatch ? fechaMatch[1].trim() : new Date().toLocaleDateString('es-AR');
    
    /**
     * Parse number from BNA - handles both formats:
     * Argentine: "1.400,5000" (dot=thousands, comma=decimal) → 1400.5
     * English:   "1400.5000" (dot=decimal) → 1400.5
     */
    function parseArgNum(str) {
        if (!str) return 0;
        const s = String(str).trim();
        if (s.includes(',')) {
            // Argentine format: remove dots (thousands), comma → dot (decimal)
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // English format: dot is decimal
        return parseFloat(s) || 0;
    }

    const monedaMap = {
        'Dolar U.S.A': 'USD',
        'Euro': 'EUR',
        'Libra Esterlina': 'GBP'
    };
    
    const cotizaciones = {};

    // Parse table rows from markdown format (from web_fetch proxy)
    const rowRegex = /\|\s*([^|]+?)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const monedaNombre = match[1].trim();
        const compra = parseArgNum(match[2]);
        const venta = parseArgNum(match[3]);
        
        for (const [nombre, iso] of Object.entries(monedaMap)) {
            if (monedaNombre.includes(nombre) || monedaNombre === nombre) {
                cotizaciones[iso] = {
                    moneda: iso,
                    nombre: monedaNombre,
                    compra: compra,
                    venta: venta
                };
            }
        }
    }
    
    // Fallback: try different parsing if markdown-style didn't work
    if (Object.keys(cotizaciones).length === 0) {
        // Try HTML table parsing
        const tdRegex = /<td[^>]*>([^<]+)<\/td>/g;
        const cells = [];
        let m;
        while ((m = tdRegex.exec(html)) !== null) {
            cells.push(m[1].trim());
        }
        
        for (let i = 0; i < cells.length - 2; i++) {
            const cellText = cells[i];
            for (const [nombre, iso] of Object.entries(monedaMap)) {
                if (cellText.includes(nombre)) {
                    const compra = parseArgNum(cells[i + 1]);
                    const venta = parseArgNum(cells[i + 2]);
                    if (!isNaN(compra) && !isNaN(venta)) {
                        cotizaciones[iso] = { moneda: iso, nombre: cellText, compra, venta };
                    }
                }
            }
        }
    }
    
    return {
        fecha,
        fuente: 'Banco de la Nación Argentina',
        url: BNA_URL,
        cotizaciones
    };
}

module.exports = { obtenerCotizacionesBNA };
