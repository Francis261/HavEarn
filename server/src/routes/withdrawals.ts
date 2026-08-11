import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { WithdrawalRequest, type WithdrawalRequestDoc } from '../models/WithdrawalRequest.js';
import { User } from '../models/User.js';
import { parseBody, asyncRoute } from '../utils/http.js';
import { creditBalance } from '../services/earnings.js';

const router = Router();

router.use(requireAuth);

function serialize(d: Record<string, unknown> & { _id: unknown }) {
  return {
    id: String(d._id),
    method: d.method,
    destination: d.destination,
    amountCents: d.amountCents,
    status: d.status,
    adminNote: d.adminNote ?? '',
    createdAt: d.createdAt,
    decidedAt: d.decidedAt ?? null,
  };
}

router.get(
  '/methods',
  asyncRoute(async (_req, res) => {
    res.json({
      methods: [
        { method: 'paypal', label: 'PayPal', placeholder: 'email@example.com' },
        { method: 'crypto', label: 'Crypto (USDT/BTC)', placeholder: 'wallet address' },
      ],
      minWithdrawalCents: config.minWithdrawalCents,
    });
  }),
);

const createSchema = z.object({
  method: z.enum(['paypal', 'crypto']),
  destination: z.string().trim().min(3).max(256),
  amountCents: z.number().int().positive(),
});

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = parseBody(createSchema, req, res);
    if (!body) return;

    if (body.amountCents < config.minWithdrawalCents) {
      res
        .status(422)
        .json({ error: `Minimum withdrawal is ${(config.minWithdrawalCents / 100).toFixed(2)}` });
      return;
    }

    const hasPending = await WithdrawalRequest.exists({
      userId: req.userId,
      status: { $in: ['pending', 'approved'] },
    });
    if (hasPending) {
      res.status(409).json({ error: 'You already have a withdrawal in progress' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user || user.balanceCents < body.amountCents) {
      res.status(422).json({ error: 'Insufficient balance' });
      return;
    }

    // Deduct from balance up-front; restored as a refund if rejected.
    const tx = await creditBalance(req.userId!, 'withdrawal', -body.amountCents, {
      note: `Withdrawal to ${body.method}`,
      metadata: { method: body.method },
    });

    const wd = await WithdrawalRequest.create({
      userId: req.userId,
      method: body.method,
      destination: body.destination,
      amountCents: body.amountCents,
      status: 'pending',
    });

    res.status(201).json({ withdrawal: serialize(wd.toObject()), runningBalanceCents: tx.runningBalance });
  }),
);

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const docs = await WithdrawalRequest.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ withdrawals: docs.map((d) => serialize({ ...d, _id: d._id })) });
  }),
);

export default router;