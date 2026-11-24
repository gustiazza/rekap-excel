const { AsyncLocalStorage } = require('node:async_hooks');
const { PrismaClient } = require('@prisma/client');

const base = new PrismaClient();

// Pengukuran waktu (opsional): jalankan backend dengan LOG_TIMING=1.
// Setiap request mencatat total waktu, jumlah query, dan waktu yang dihabiskan di database.
const timing = new AsyncLocalStorage();

const client =
  process.env.LOG_TIMING === '1'
    ? base.$extends({
        query: {
          async $allOperations({ operation, model, args, query }) {
            const t0 = process.hrtime.bigint();
            try {
              return await query(args);
            } finally {
              const ms = Number(process.hrtime.bigint() - t0) / 1e6;
              const store = timing.getStore();
              if (store) {
                store.count += 1;
                store.dbMs += ms;
                if (ms > 300) console.log(`   · query lambat ${ms.toFixed(0)} ms  ${model ? `${model}.` : ''}${operation}`);
              }
            }
          },
        },
      })
    : base;

module.exports = client;
module.exports.timing = timing;