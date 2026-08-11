import { randomBytes } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { parseBody, asyncRoute } from '../utils/http.js';
import { creditBalance } from '../services/earnings.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().max(60).optional(),
  referralCode: z.string().trim().max(20).optional(),
  deviceId: z.string().trim().max(128).optional(),
});

function generateReferralCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

router.post(
  '/signup',
  asyncRoute(async (req, res) => {
    const body = parseBody(signupSchema, req, res);
    if (!body) return;

    const existing = await User.findOne({ email: body.email });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    let referrer: mongoose.Types.ObjectId | null = null;
    if (body.referralCode) {
      const ref = await User.findOne({ referralCode: body.referralCode.toUpperCase() });
      if (ref) referrer = ref._id;
    }

    const user = await User.create({
      email: body.email,
      passwordHash,
      displayName: body.displayName ?? '',
      referralCode: generateReferralCode(),
      referredByCode: body.referralCode?.toUpperCase() ?? null,
      deviceId: body.deviceId ?? '',
      isAdmin: config.adminEmails.includes(body.email),
    });

    if (referrer) {
      // Placeholder reservation: bonus credited once new user completes onboarding (terms).
      const { referralRewardCents } = config;
      await creditBalance(
        referrer.toString(),
        'referral',
        referralRewardCents,
        {
          note: `Referral bonus for inviting ${body.email}`,
          metadata: { referredUserId: String(user._id) },
        },
      ).catch((err) => console.warn('[referral] credit failed', err.message));
    }

    const token = signToken(user);
    res.status(201).json({
      token,
      user: publicUser(user),
    });
  }),
);

const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post(
  '/signin',
  asyncRoute(async (req, res) => {
    const body = parseBody(signinSchema, req, res);
    if (!body) return;

    const user = await User.findOne({ email: body.email });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json({ user: publicUser(user) });
  }),
);

router.get(
  '/transactions',
  requireAuth,
  asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const docs = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments({ userId: req.userId });
    res.json({ transactions: docs, page, total, hasMore: page * limit < total });
  }),
);

export function publicUser(user: {
  _id: unknown;
  email?: string;
  displayName?: string;
  isAdmin?: boolean;
  balanceCents?: number;
  lifetimeEarnedCents?: number;
  referralCode?: string | null;
  termsAccepted?: { version?: number | null; acceptedAt?: Date | null } | null;
}) {
  return {
    id: String(user._id),
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    isAdmin: !!user.isAdmin,
    balanceCents: user.balanceCents ?? 0,
    lifetimeEarnedCents: user.lifetimeEarnedCents ?? 0,
    referralCode: user.referralCode ?? '',
    termsAccepted: {
      version: user.termsAccepted?.version ?? null,
      acceptedAt: user.termsAccepted?.acceptedAt ?? null,
    },
  };
}

export default router;