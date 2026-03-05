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
    
    // Parse table rows
    const monedaMap = {
        'Dolar U.S.A': 'USD',
        'Euro': 'EUR',
        'Libra Esterlina': 'GBP'
    };
    
    const cotizaciones = {};
    
    // Match table rows: Moneda | Compra | Venta
    const rowRegex = /\|\s*([^|]+?)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const monedaNombre = match[1].trim();
        // BNA returns values with 4 implied decimals — divide by 10000
        const compraRaw = parseFloat(match[2]);
        const ventaRaw = parseFloat(match[3]);
        const compra = compraRaw > 100000 ? compraRaw / 10000 : compraRaw;
        const venta = ventaRaw > 100000 ? ventaRaw / 10000 : ventaRaw;
        
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
                    const compra = parseFloat(cells[i + 1].replace(/\./g, '').replace(',', '.'));
                    const venta = parseFloat(cells[i + 2].replace(/\./g, '').replace(',', '.'));
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
