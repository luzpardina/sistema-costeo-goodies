const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const costeoRoutes = require('./routes/costeoRoutes');
const revaluacionRoutes = require('./routes/revaluacionRoutes');
const maestroRoutes = require('./routes/maestroRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/costeos', costeoRoutes);
app.use('/api/revaluaciones', revaluacionRoutes);
app.use('/api/maestro', maestroRoutes);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a PostgreSQL exitosa');

        try {
            await sequelize.query("ALTER TABLE gastos_varios ADD COLUMN IF NOT EXISTS metodo_prorrateo VARCHAR(20) DEFAULT 'por_fob';");
            console.log('✅ Columna metodo_prorrateo verificada');
        } catch (e) { console.log('Columna metodo_prorrateo ya existe'); }

        try {
            await sequelize.query("ALTER TABLE gastos_varios ADD COLUMN IF NOT EXISTS monto_prorrateado DECIMAL(15,2);");
            console.log('✅ Columna monto_prorrateado verificada');
        } catch (e) { console.log('Columna monto_prorrateado ya existe'); }

        await sequelize.sync({ alter: true });
        console.log('✅ Modelos sincronizados con la base de datos');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error);
        process.exit(1);
    }
}

iniciarServidor();