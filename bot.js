import fetch from 'node-fetch';

// ============================================
// STEP 1: Get these from Telegram and Google
// We'll add them as Railway environment variables
// ============================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper: Send message to Telegram
async function sendMessage(chatId, text, parseMode = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text: text };
  if (parseMode) body.parse_mode = parseMode;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

// Helper: Get crypto price (free CoinGecko API)
async function getPrice(ticker) {
  const id = ticker === 'BTC' ? 'bitcoin' : ticker === 'ETH' ? 'ethereum' : null;
  if (!id) return null;
  
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const data = await res.json();
    return data[id]?.usd;
  } catch (e) {
    return null;
  }
}

// Helper: Get AI signal from Gemini
async function getSignal(ticker, price) {
  const prompt = `Based on general market knowledge of ${ticker} at $${price}, give a binary options signal. Return ONLY one word: CALL (price will go UP) or PUT (price will go DOWN). No other text.`;
  
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    const data = await res.json();
    let signal = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
    if (signal !== 'CALL' && signal !== 'PUT') signal = 'WAIT';
    return signal;
  } catch (e) {
    return 'ERROR';
  }
}

// Main bot handler
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const command = text.split(' ')[0];
  const ticker = text.split(' ')[1]?.toUpperCase();

  // /start command
  if (command === '/start') {
    await sendMessage(chatId,
      '🤖 *Binary Options Signal Bot*\n\n' +
      'Commands:\n' +
      '/signal BTC - Get CALL/PUT signal\n' +
      '/price BTC - Get current price\n' +
      '/help - Trading guide\n\n' +
      '⚠️ Demo only - Practice on Quotex (qxbroker.com)',
      'Markdown'
    );
    return;
  }

  // /help command
  if (command === '/help') {
    await sendMessage(chatId,
      '📚 *How to Trade*\n\n' +
      '1. Open qxbroker.com → Demo\n' +
      '2. Send /signal BTC\n' +
      '3. CALL → Click UP button\n' +
      '4. PUT → Click DOWN button\n' +
      '5. Set expiry to 5 minutes\n' +
      '6. Use $1 virtual money\n\n' +
      '⚠️ Demo only - Not financial advice',
      'Markdown'
    );
    return;
  }

  // /price command
  if (command === '/price') {
    if (!ticker || (ticker !== 'BTC' && ticker !== 'ETH')) {
      await sendMessage(chatId, 'Usage: /price BTC or /price ETH');
      return;
    }
    const price = await getPrice(ticker);
    if (price) {
      await sendMessage(chatId, `💰 ${ticker}: $${price} USD`);
    } else {
      await sendMessage(chatId, '❌ Price fetch failed');
    }
    return;
  }

  // /signal command
  if (command === '/signal') {
    if (!ticker || (ticker !== 'BTC' && ticker !== 'ETH')) {
      await sendMessage(chatId, 'Usage: /signal BTC or /signal ETH');
      return;
    }
    
    await sendMessage(chatId, `🔍 Analyzing ${ticker}...`);
    
    const price = await getPrice(ticker);
    const priceDisplay = price ? `$${price}` : 'unknown';
    const signal = await getSignal(ticker, price);
    
    let emoji, direction, action;
    if (signal === 'CALL') {
      emoji = '🟢'; direction = 'UP'; action = 'Click the UP button';
    } else if (signal === 'PUT') {
      emoji = '🔴'; direction = 'DOWN'; action = 'Click the DOWN button';
    } else if (signal === 'WAIT') {
      emoji = '⚪'; direction = 'WAIT'; action = 'No clear signal - wait 5 minutes';
    } else {
      emoji = '❌'; direction = 'ERROR'; action = 'Try again in a moment';
    }
    
    await sendMessage(chatId,
      `${emoji} *${ticker} Signal*\n\n` +
      `Action: *${direction}*\n` +
      `Price: ${priceDisplay}\n` +
      `Expiry: 5 minutes\n\n` +
      `📊 ${action}\n\n` +
      `⚠️ Demo only`,
      'Markdown'
    );
    return;
  }
}

// Polling mode - keeps bot running continuously on Railway
async function startBot() {
  console.log('🤖 Bot starting...');
  let lastUpdateId = 0;
  
  while (true) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${lastUpdateId + 1}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.ok && data.result) {
        for (const update of data.result) {
          if (update.message && update.message.text) {
            console.log(`📨 Received: ${update.message.text}`);
            await handleMessage(update.message);
            lastUpdateId = update.update_id;
          }
        }
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Keep the process alive on Railway
console.log('🚀 Binary Options Signal Bot');
console.log('Waiting for messages...');
startBot();
