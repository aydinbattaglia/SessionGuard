import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import stripeRoutes from './routes/stripe.js';

const app = express();

// Stripe webhook needs the raw body before any JSON parsing
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors());

// Limit /verify to prevent email enumeration abuse
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use('/verify', verifyLimiter);

app.use('/', stripeRoutes);

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SessionGuard API] listening on port ${PORT}`));
