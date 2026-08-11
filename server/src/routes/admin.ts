import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { WithdrawalRequest } from '../models/WithdrawalRequest.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { parseBody, asyncRoute } from '../utils/http.js';
import { creditBalance } from '../services/earnings.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const decisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().trim().max(500).optional(),
});

router.post(
  '/withdrawals/:id/decide',
  asyncRoute(async (req, res) => {
    const body = parseBody(decisionSchema, req, res);
    if (!body) return;

    const wd = await WithdrawalRequest.findById(req.params.id);
    if (!wd) {
      res.status(404).json({ error: 'Withdrawal not found' });
      return;
    }
    if (wd.status !== 'pending') {
      res.status(409).json({ error: `Already ${wd.status}` });
      return;
    }

    if (body.action === 'approve') {
      wd.status = 'approved';
    } else {
      // Refund the reserved balance.
      await creditBalance(wd.userId.toString(), 'adjustment', wd.amountCents, {
        note: 'Withdrawal rejected - refund',
        metadata: { withdrawalId: String(wd._id) },
      });
      wd.status = 'rejected';
    }
    if (body.adminNote) wd.adminNote = body.adminNote;
    wd.decidedAt = new Date();
    await wd.save();

    res.json({ ok: true, status: wd.status });
  }),
);

// Mark a withdrawal as paid after off-app payout.
router.post(
  '/withdrawals/:id/paid',
  asyncRoute(async (req, res) => {
    const wd = await WithdrawalRequest.findById(req.params.id);
    if (!wd) {
      res.status(404).json({ error: 'Withdrawal not found' });
      return;
    }
    if (wd.status !== 'approved') {
      res.status(409).json({ error: `Must be approved before payout (got ${wd.status})` });
      return;
    }
    wd.status = 'paid';
    await wd.save();
    res.json({ ok: true, status: wd.status });
  }),
);

router.get(
  '/withdrawals',
  asyncRoute(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter = status ? { status } : {};
    const docs = await WithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('userId', 'email displayName')
      .lean();
    res.json({ withdrawals: docs });
  }),
);

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  type: z.enum(['external_link', 'install_check', 'survey']),
  rewardCents: z.number().int().positive(),
  url: z.string().url().optional().default(''),
  requirements: z.string().max(1000).optional().default(''),
  active: z.boolean().optional().default(true),
  cooldownMs: z.number().int().nonnegative().optional().default(0),
  sortOrder: z.number().int().optional().default(0),
});

router.post(
  '/tasks',
  asyncRoute(async (req, res) => {
    const body = parseBody(taskSchema, req, res);
    if (!body) return;
    const task = await Task.create(body);
    res.status(201).json({ task });
  }),
);

router.get(
  '/users/summary',
  asyncRoute(async (_req, res) => {
    const [userCount, pendingWithdrawals, totalBalance] = await Promise.all([
      User.countDocuments(),
      WithdrawalRequest.countDocuments({ status: 'pending' }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$balanceCents' } } }]),
    ]);
    res.json({
      userCount,
      pendingWithdrawals,
      totalBalanceCents: totalBalance[0]?.total ?? 0,
    });
  }),
);

export default router;