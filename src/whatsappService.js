const axios = require('axios');

const evolutionApiUrl = process.env.EVOLUTION_API_URL;
const evolutionApiKey = process.env.EVOLUTION_API_KEY;
const evolutionInstanceName = process.env.EVOLUTION_INSTANCE_NAME;

const isConfigured = () => {
    return Boolean(evolutionApiUrl && evolutionApiKey && evolutionInstanceName);
};

const formatPhoneNumber = (phone) => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Ensure it starts with country code (55 for Brazil)
    if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
    }

    return cleaned;
};

const sendMessage = async (phone, message, retries = 3) => {
    if (!isConfigured()) {
        console.warn('Evolution API not configured. Message not sent:', { phone, message });
        return {
            success: false,
            error: 'Evolution API not configured',
            simulated: true,
        };
    }

    const formattedPhone = formatPhoneNumber(phone);

    const payload = {
        number: formattedPhone,
        text: message,
    };

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(
                `${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionApiKey,
                    },
                    timeout: 10000, // 10 seconds timeout
                }
            );

            return {
                success: true,
                data: response.data,
                attempt,
            };
        } catch (error) {
            lastError = error;

            const errorMessage = error.response?.data?.message || error.message;
            console.error(`Evolution API error (attempt ${attempt}/${retries}):`, {
                phone: formattedPhone,
                status: error.response?.status,
                message: errorMessage,
            });

            // Don't retry on client errors (4xx)
            if (error.response?.status >= 400 && error.response?.status < 500) {
                break;
            }

            // Wait before retrying (exponential backoff)
            if (attempt < retries) {
                const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    return {
        success: false,
        error: lastError.response?.data?.message || lastError.message,
        status: lastError.response?.status,
    };
};

const sendBulkMessages = async (messages) => {
    const results = [];

    for (const msg of messages) {
        const result = await sendMessage(msg.phone, msg.message);
        results.push({
            ...result,
            phone: msg.phone,
            recipientName: msg.recipientName,
        });

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
};

module.exports = {
    sendMessage,
    sendBulkMessages,
    isConfigured,
    formatPhoneNumber,
};
