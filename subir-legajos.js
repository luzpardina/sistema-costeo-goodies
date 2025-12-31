const fs = require('fs');
const path = require('path');

const CARPETA = 'C:\\Users\\Admin\\Desktop\\legajps a subir sistema nuevo';
const API = 'https://sistema-costeo-goodies-production.up.railway.app';

async function run() {
    const fetch = (await import('node-fetch')).default;
    const FormData = (await import('form-data')).default;
    
    // Login
    let res = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lpardina@goodies.com.ar', password: 'admin123' })
    });
    let data = await res.json();
    let token = data.token;
    console.log('Token OK');
    
    // Leer archivos
    let archivos = fs.readdirSync(CARPETA).filter(f => f.endsWith('.xlsx'));
    console.log('Archivos: ' + archivos.length);
    
    // Subir cada uno
    for (let i = 0; i < archivos.length; i++) {
        let archivo = path.join(CARPETA, archivos[i]);
        console.log((i+1) + '/' + archivos.length + ' ' + archivos[i]);
        
        let form = new FormData();
        form.append('archivo', fs.createReadStream(archivo));
        
        try {
            let r = await fetch(API + '/api/costeos/importar', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, ...form.getHeaders() },
                body: form
            });
            let result = await r.json();
            if (result.error) {
                console.log('  Error: ' + result.error);
            } else {
                console.log('  OK');
            }
        } catch(e) {
            console.log('  Error: ' + e.message);
        }
    }
    console.log('FIN');
}

run();