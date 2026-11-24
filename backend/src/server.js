const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.clientUrl.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API berjalan di http://localhost:${config.port}`);
})