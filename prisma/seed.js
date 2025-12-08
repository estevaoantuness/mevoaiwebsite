import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // =============================================
  // 1. CONFIGURAÇÕES PADRÃO
  // =============================================
  const defaultSettings = [
    {
      key: 'default_checkout_time',
      value: '11:00'
    },
    {
      key: 'default_checkin_time',
      value: '15:00'
    },
    {
      key: 'message_template',
      value: 'Olá (nome da funcionária)! Hoje tem limpeza no (nome do imóvel) às (horário). Bom trabalho!'
    },
    {
      key: 'app_name',
      value: 'Mevo'
    },
    {
      key: 'timezone',
      value: 'America/Sao_Paulo'
    }
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    });
  }
  console.log('✅ Configurações padrão criadas');

  // =============================================
  // 2. TEMPLATES DE MENSAGENS PADRÃO
  // =============================================
  const defaultTemplates = [
    {
      name: 'Boas-vindas',
      type: 'welcome',
      channel: 'whatsapp',
      content: `Olá {{guest_name}}! 🏠

Seja bem-vindo(a) ao {{property_name}}!

📅 Check-in: {{checkin_date}} às {{checkin_time}}
📅 Checkout: {{checkout_date}} às {{checkout_time}}

📶 WiFi: {{wifi_name}}
🔑 Senha: {{wifi_password}}

{{access_instructions}}

Qualquer dúvida, estamos à disposição!

Até breve! 😊`
    },
    {
      name: 'Lembrete de Check-in',
      type: 'checkin_reminder',
      channel: 'whatsapp',
      content: `Olá {{guest_name}}! 📅

Lembrando que seu check-in no {{property_name}} é amanhã às {{checkin_time}}!

{{access_instructions}}

Boa viagem! 🚗`
    },
    {
      name: 'Lembrete de Checkout',
      type: 'checkout_reminder',
      channel: 'whatsapp',
      content: `Olá {{guest_name}}! 🏠

Lembrando que seu checkout do {{property_name}} é amanhã às {{checkout_time}}.

Por favor, lembre-se de:
• Verificar se não esqueceu nada
• Deixar as chaves no local indicado
• Fechar janelas e portas

Esperamos que tenha tido uma ótima estadia! 😊`
    },
    {
      name: 'Notificação de Limpeza',
      type: 'cleaning',
      channel: 'whatsapp',
      content: `Olá {{employee_name}}! 🧹

Hoje tem limpeza no {{property_name}} às {{checkout_time}}.

Bom trabalho! 💪`
    },
    {
      name: 'Solicitação de Avaliação',
      type: 'review_request',
      channel: 'whatsapp',
      content: `Olá {{guest_name}}! ⭐

Esperamos que tenha curtido sua estadia no {{property_name}}!

Se puder, deixe uma avaliação. Sua opinião é muito importante para nós!

Obrigado e até a próxima! 😊`
    },
    {
      name: 'Boas-vindas (Email)',
      type: 'welcome',
      channel: 'email',
      subject: 'Bem-vindo ao {{property_name}}!',
      content: `<h1>Olá {{guest_name}}!</h1>

<p>Seja bem-vindo(a) ao <strong>{{property_name}}</strong>!</p>

<h2>Detalhes da sua reserva</h2>
<ul>
  <li><strong>Check-in:</strong> {{checkin_date}} às {{checkin_time}}</li>
  <li><strong>Checkout:</strong> {{checkout_date}} às {{checkout_time}}</li>
</ul>

<h2>Informações de acesso</h2>
<ul>
  <li><strong>WiFi:</strong> {{wifi_name}}</li>
  <li><strong>Senha:</strong> {{wifi_password}}</li>
</ul>

<h2>Instruções de acesso</h2>
<p>{{access_instructions}}</p>

<p>Qualquer dúvida, estamos à disposição!</p>

<p>Até breve! 😊</p>`
    }
  ];

  for (const template of defaultTemplates) {
    const existing = await prisma.messageTemplate.findFirst({
      where: {
        type: template.type,
        channel: template.channel,
        userId: null // Template global
      }
    });

    if (!existing) {
      await prisma.messageTemplate.create({
        data: {
          ...template,
          isActive: true,
          userId: null // Template global
        }
      });
    }
  }
  console.log('✅ Templates de mensagens padrão criados');

  // =============================================
  // 3. USUÁRIO ADMIN (apenas se não existir)
  // =============================================
  const adminEmail = 'admin@mevo.app';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Administrador',
        role: 'admin'
      }
    });
    console.log('✅ Usuário admin criado (admin@mevo.app / admin123)');
    console.log('⚠️  IMPORTANTE: Altere a senha do admin em produção!');
  } else {
    console.log('ℹ️  Usuário admin já existe');
  }

  console.log('');
  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
