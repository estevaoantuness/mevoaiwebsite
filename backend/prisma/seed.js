import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Criar usuário admin se não existir
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@mevo.app' }
  });

  if (!adminExists) {
    await prisma.user.create({
      data: {
        email: 'admin@mevo.app',
        passwordHash: bcrypt.hashSync('admin', 10)
      }
    });
    console.log('Admin user created: admin@mevo.app / admin');
  } else {
    console.log('Admin user already exists');
  }

  // Criar configuração padrão de horário de checkout
  await prisma.setting.upsert({
    where: { key: 'default_checkout_time' },
    update: {},
    create: {
      key: 'default_checkout_time',
      value: '11:00'
    }
  });
  console.log('Default settings configured');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
