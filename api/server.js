require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const axios = require('axios');
const { RSI } = require('technicalindicators');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB কানেকশন
const MONGO_URI = 'mongodb+srv://mdrifat0pq_db_user:JNC8m3E0dFGyUUEu@cluster0.oik4mbq.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected")).catch(e => console.log("❌ DB Error:", e));

// ইউজার ডাটা স্কিমা
const User = mongoose.model('User', new mongoose.Schema({
    chatId: Number,
    level: { type: String, default: 'Free' }, // Free, Basic, Pro, VIP
    paymentStatus: { type: String, default: 'Unpaid' }
}));

// সিগন্যাল জেনারেটর ফাংশন
async function getMarketSignals() {
    try {
        const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=true');
        return res.data.map(coin => {
            const prices = coin.sparkline_in_7d.price;
            const rsi = RSI.calculate({ values: prices, period: 14 });
            const lastRsi = rsi[rsi.length - 1];
            return {
                name: coin.symbol.toUpperCase(),
                price: coin.current_price,
                rsi: lastRsi ? lastRsi.toFixed(1) : 50,
                signal: lastRsi < 35 ? "BUY" : lastRsi > 65 ? "SELL" : "WAIT"
            };
        });
    } catch (err) { return []; }
}

// API Endpoint: মিনি অ্যাপ এখান থেকে ডেটা নিবে
app.get('/api/signals', async (req, res) => {
    const signals = await getMarketSignals();
    res.json(signals);
});

// টেলিগ্রাম বট কমান্ড
bot.start(async (ctx) => {
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { chatId: ctx.chat.id }, { upsert: true });
    ctx.replyWithMarkdown(`🔥 *SIGNAL EDGE* এ স্বাগতম! \n\nনিচের বাটনে ক্লিক করে ডার্ক মোড মিনি অ্যাপটি ওপেন করো এবং লেটেস্ট সিগন্যাল দেখো।`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Open Mini App', `https://${process.env.VERCEL_URL}`)]
    ]));
});

// Vercel এর জন্য এক্সপোর্ট
module.exports = bot.webhookCallback('/api/bot');
app.use(express.json());
app.post('/api/bot', (req, res) => bot.handleUpdate(req.body, res));
app.listen(3000);
