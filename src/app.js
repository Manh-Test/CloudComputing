const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const employeeRoutes = require('./routes/employeeRoutes');
const { getPool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/employees', employeeRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 as alive');
        res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
    } catch (err) {
        // Return 200 so Load Balancer health check passes while DB completes initialization
        res.status(200).json({ status: 'INITIALIZING', database: 'CONNECTING', error: err.message, timestamp: new Date() });
    }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server & initialize DB connection pool asynchronously
app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`🚀 Express App running on http://localhost:${PORT}`);
    console.log(`=======================================================`);
    
    try {
        await getPool();
        console.log(`✅ System initialized and ready to handle requests.`);
    } catch (err) {
        console.error(`⚠️ Initial DB connection failed. App will retry on request:`, err.message);
    }
});
