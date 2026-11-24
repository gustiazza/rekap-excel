const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { timing } = require('./prisma/client');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));

if (process.env.LOG_TIMING === '1') {
  app.use((req, res, next) => {
    const store = { count: 0, dbMs: 0 };
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const total = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(
        `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode}  total ${total.toFixed(0)} ms | ${store.count} query, db ${store.dbMs.toFixed(0)} ms`
      );
    });
    timing.run(store, next);
  });
}

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API berjalan di http://localhost:${config.port}`);
});
