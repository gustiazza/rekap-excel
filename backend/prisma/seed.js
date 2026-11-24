require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SATKER = [
  'BRMP Perkebunan',
  'BRMP Tanaman Rempah, Obat dan Aromatik',
  'BRMP Tanaman Industri dan Penyegar',
  'BRMP Tanaman Pemanis dan Serat',
  'BRMP Tanaman Palma',
];

async function main() {
  // Daftar satker (aman dijalankan berulang)
  for (const name of SATKER) {
    await prisma.satker.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Satker siap: ${SATKER.length}`);

  const nip = String(process.env.ADMIN_NIP || '000000000000000001').trim();
  if (!/^\d{5,25}$/.test(nip)) throw new Error('ADMIN_NIP harus berupa angka 5-25 digit.');
  const name = process.env.ADMIN_NAME || 'Administrator';
  const password = process.env.ADMIN_PASSWORD || 'Admin12345!';

  if (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) {
    console.log('Admin sudah ada.');
    return;
  }
  await prisma.user.create({
    data: { name, nip, password: await bcrypt.hash(password, 10), role: 'ADMIN', status: 'ACTIVE' },
  });
  console.log(`Admin dibuat dengan NIP: ${nip}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
