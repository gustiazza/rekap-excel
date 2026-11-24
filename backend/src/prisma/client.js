const { execSync } = require('node:child_process');

function loadPrisma() {
  const { PrismaClient } = require('@prisma/client');
  new PrismaClient(); // gagal bila client belum digenerate
  return PrismaClient;
}

let PrismaClient;
try {
  PrismaClient = loadPrisma();
} catch (e) {
  console.log('Prisma Client belum dibuat, menjalankan "prisma generate"...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  Object.keys(require.cache).forEach((k) => {
    if (k.includes('.prisma') || k.includes('@prisma')) delete require.cache[k];
  });
  PrismaClient = loadPrisma();
}

module.exports = new PrismaClient();