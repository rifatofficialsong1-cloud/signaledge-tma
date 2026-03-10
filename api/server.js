require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const axios = require('axios');
const { RSI } = require('technicalindicators');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// তোর দেওয়া ওয়ালেট অ্যাড্রেস
const WALLET_ADDRESS = 'UQD0VDtfdPv0WptptIIOgUM59VV1zIf4sYBpz1eMilieijTB';

// MongoDB কানেকশন
const MONGO_URI = 'mongodb+srv://mdrifat0pq_db_user:JNC8m3E0dFGyUUEu@cluster0.oik4mbq.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected")).catch(e => console.log("❌ DB Error:", e));

// ইউজার ডাটা স্কিমা
const User = mongoose.model('User', new mongoose.Schema({
    chatId: Number,
    level: { type: String, default: 'Free' }, // Free, Basic, Pro, VIP
    expireDate: Date
}));

// TON পেমেন্ট ভেরিফিকেশন API
app.use(express.json());

app.post('/api/verify-ton', async (req, res) => {
    const { chatId, utransactionHash, plan } = req.body;

    try {
        // Toncenter Public API দিয়ে ট্রানজেকশন চেক
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${WALLET_ADDRESS}&limit=10`);
        const transactions = response.data.result;

        // চেক করা হচ্ছে ইউজারের হ্যাশ ট্রানজেকশন লিস্টে আছে কি না
        const found = transactions.find(tx => tx.transaction_id.hash === utransactionHash);

        if (found) {
            // পেমেন্ট সফল হলে ডাটাবেসে ইউজার লেভেল আপডেট করা
            await User.findOneAndUpdate({ chatId }, { level: plan });
            return res.json({ success: true, message: `Your ${plan} membership is now ACTIVE! 🚀` });
        } else {
            return res.json({ success: false, message: "Transaction not found. Make sure you sent TON to the right address." });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        res.json({ success: false, message: "Blockchain verification failed. Try again later." });
    }
});

// সিগন্যাল ডাটা API (মিনি অ্যাপ এখান থেকে ডাটা নিবে)
app.get('/api/signals', async (req, res) => {
    // এখানে আমরা আপাতত ৩টি ফ্রি সিগন্যাল দিচ্ছি
    const signals = [
        { symbol: "BTC/USDT", price: "Loading...", rsi: "35.2", signal: "BUY" },
        { symbol: "ETH/USDT", price: "Loading...", rsi: "68.5", signal: "SELL" },
        { symbol: "SOL/USDT", price: "Loading...", rsi: "50.0", signal: "WAIT" }
    ];
    res.json(signals);
});

// টেলিগ্রাম বট কমান্ড
bot.start(async (ctx) => {
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { chatId: ctx.chat.id }, { upsert: true });
    ctx.replyWithMarkdown(`🔥 *SIGNAL EDGE AI* তে স্বাগতম!\n\nসেরা ক্রিপ্টো সিগন্যাল দেখতে নিচের বাটনে ক্লিক করো।`, 
    Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Open Mini App', `https://${process.env.VERCEL_URL || 'signaledge-tma-xzlu.vercel.app'}`)]
    ]));
});

// Vercel এর জন্য এক্সপোর্ট
module.exports = bot.webhookCallback('/api/bot');
app.post('/api/bot', (req, res) => bot.handleUpdate(req.body, res));

// লোকাল টেস্টের জন্য (অপশনাল)
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => console.log('Server running on port 3000'));
           }
