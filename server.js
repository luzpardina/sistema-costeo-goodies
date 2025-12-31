const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const sequelize = require('./config/database');
const { Usuario, Empresa, Costeo, ArticuloCosteo, GastosAduana, GastosVarios, Revaluacion, RevaluacionArticulo } = require('./models');
const authRoutes = require('./routes/authRoutes');
const costeoRoutes = require('./routes/costeoRoutes');
const revaluacionRoutes = require('./routes/revaluacionRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/costeos', costeoRoutes);
app.use('/api/revaluaciones', revaluacionRoutes);

app.get('/', (req, res) => {
    res.json({ mensaje: 'Sistema de Costeo - API funcionando', version: '2.0.0' });
});

app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ estado: 'OK', database: 'Conectado' });
    } catch (error) {
        res.status(500).json({ estado: 'ERROR', database: 'Desconectado' });
    }
});

const iniciarServidor = async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexion a PostgreSQL exitosa');
        await sequelize.sync({ alter: true });
        console.log('Modelos sincronizados');
        app.listen(PORT, () => {
            console.log('Servidor corriendo en puerto ' + PORT);
        });
    } catch (error) {
        console.error('Error al iniciar:', error);
        process.exit(1);
    }
};

iniciarServidor();