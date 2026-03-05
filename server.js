const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const costeoRoutes = require('./routes/costeoRoutes');
const revaluacionRoutes = require('./routes/revaluacionRoutes');
const maestroRoutes = require('./routes/maestroRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');

// === NUEVAS RUTAS ===
const comercialRoutes = require('./routes/comercialRoutes');
const contableRoutes = require('./routes/contableRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// === SEGURIDAD ===
app.use(helmet({
    contentSecurityPolicy: false,  // Permitir inline scripts (necesario por ahora)
    crossOriginEmbedderPolicy: false
}));

// CORS: solo permitir el origen propio
const allowedOrigins = [
    process.env.APP_URL || 'https://sistema-costeo-goodies-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5173'
];
app.use(cors({
    origin: function(origin, callback) {
        // Permitir requests sin origin (mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
        callback(null, true); // Por ahora permisivo, restringir cuando esté estable
    },
    credentials: true
}));

// Rate limiting para login (anti fuerza bruta)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // máximo 10 intentos
    message: { error: 'Demasiados intentos de login. Esperá 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting general (anti abuso)
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 200, // 200 requests por minuto
    message: { error: 'Demasiadas peticiones. Intentá de nuevo en un momento.' },
    standardHeaders: true,
    legacyHeaders: false
});

// === RENDIMIENTO ===
app.use(compression());

// === LOGGING ===
const { requestLogger } = require('./utils/logger');
app.use(requestLogger);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Aplicar rate limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/costeos', costeoRoutes);
app.use('/api/revaluaciones', revaluacionRoutes);
app.use('/api/maestro', maestroRoutes);
app.use('/api/catalogo', catalogoRoutes);

// === NUEVAS RUTAS ===
app.use('/api/comercial', comercialRoutes);
app.use('/api/contable', contableRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Health check completo
app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        const [result] = await sequelize.query('SELECT COUNT(*) as count FROM costeos');
        res.json({ 
            status: 'OK', 
            timestamp: new Date(),
            db: 'connected',
            costeos: result[0].count,
            uptime: Math.round(process.uptime()) + 's',
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', db: 'disconnected', error: error.message });
    }
});

// HTTPS redirect en producción
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Error handler centralizado
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err.message);
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message
    });
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

        // Crear índices para rendimiento
        try {
            const addIndexes = require('./migrations/addIndexes');
            await addIndexes(sequelize);
        } catch (e) { console.log('Índices: ', e.message); }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error);
        process.exit(1);
    }
}

iniciarServidor();
