require('dotenv').config();
const { sendMessage, isConfigured } = require('../whatsappService');

async function testWhatsApp() {
    console.log('Testing WhatsApp/Evolution API integration...\n');

    if (!isConfigured()) {
        console.log('⚠️  Evolution API not configured');
        console.log('\nTo enable WhatsApp messaging, add to .env:');
        console.log('EVOLUTION_API_URL=https://your-evolution-api.com');
        console.log('EVOLUTION_API_KEY=your-api-key');
        console.log('EVOLUTION_INSTANCE_NAME=your-instance-name');
        console.log('\nThe system will work in SIMULATED mode (messages logged to console)');
        return;
    }

    console.log('✅ Evolution API is configured');

    const testPhone = process.env.TEST_PHONE || '+5511999999999';
    const testMessage = 'Teste de integração Mevo - ' + new Date().toLocaleString('pt-BR');

    console.log(`\nSending test message to ${testPhone}...`);

    try {
        const result = await sendMessage(testPhone, testMessage);

        if (result.success) {
            console.log('✅ Message sent successfully!');
            console.log('Response:', JSON.stringify(result.data, null, 2));
        } else {
            console.log('❌ Failed to send message');
            console.log('Error:', result.error);
            console.log('Status:', result.status);
        }
    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
    }
}

testWhatsApp();
