import { Router } from 'express';
import Stripe from 'stripe';
import { upsertSubscription, getSubscription } from '../db.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function planFromPriceId(priceId) {
  return priceId === process.env.STRIPE_ANNUAL_PRICE_ID ? 'annual' : 'monthly';
}

// POST /create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const { plan = 'monthly', email } = req.body;

  const priceId = plan === 'annual'
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  if (!priceId) return res.status(500).json({ error: 'Price ID not configured' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.CANCEL_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /verify?email=...
router.get('/verify', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });

  const sub = getSubscription(email);
  const active = ACTIVE_STATUSES.has(sub?.status);
  res.json({ active, tier: active ? 'pro' : 'free', plan: sub?.plan ?? null });
});

// POST /webhook  (raw body — mounted before express.json in index.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const email = session.customer_details?.email?.toLowerCase();
        if (!email) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price?.id;

        upsertSubscription({
          email,
          customerId: session.customer,
          subId: session.subscription,
          status: 'active',
          plan: planFromPriceId(priceId),
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        const priceId = subscription.items.data[0]?.price?.id;
        upsertSubscription({
          email,
          customerId: subscription.customer,
          subId: subscription.id,
          status: subscription.status,
          plan: planFromPriceId(priceId),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        upsertSubscription({
          email,
          customerId: subscription.customer,
          subId: subscription.id,
          status: 'canceled',
          plan: 'monthly',
        });
        break;
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
  }

  res.json({ received: true });
});

export default router;
