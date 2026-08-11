import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { AdReward } from '../models/AdReward.js';
import { User } from '../models/User.js';
import { parseBody, asyncRoute } from '../utils/http.js';
import { creditBalance } from '../services/earnings.js';

const router = Router();

router.use(requireAuth);

// POST /ads/start
// Issues a fresh nonce for a rewarded ad. The app uses it as the AdMob
// SSV customData and then calls /ads/complete with the same nonce.
const startSchema = z.object({ deviceId: z.string().max(128).optional(), adUnitId: z.string().max(255).optional() });

router.post(
  '/start',
  asyncRoute(async (req, res) => {
    const body = parseBody(startSchema, req, res);
    if (!body) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const creditedToday = await AdReward.countDocuments({
      userId: req.userId,
      status: 'credited',
      creditedAt: { $gte: startOfDay },
    });

    if (creditedToday >= config.adDailyCap) {
      res.status(429).json({ error: 'Daily ad limit reached', reward: 0 });
      return;
    }

    const nonce = randomBytes(16).toString('hex');
    const ad = await AdReward.create({
      userId: req.userId,
      nonce,
      adUnitId: body.adUnitId ?? '',
      deviceId: body.deviceId ?? '',
      status: 'pending',
      rewardCents: config.adRewardCents,
    });

    res.json({
      nonce: ad.nonce,
      rewardCents: config.adRewardCents,
      expiresInMs: config.adNonceTtlMs,
    });
  }),
);

const completeSchema = z.object({ nonce: z.string().uuid().or(z.string().length(32)).or(z.string()) });

router.post(
  '/complete',
  asyncRoute(async (req, res) => {
    const body = parseBody(completeSchema, req, res);
    if (!body) return;

    const ad = await AdReward.findOne({ nonce: body.nonce, userId: req.userId });
    if (!ad) {
      res.status(404).json({ error: 'Unknown ad reward' });
      return;
    }
    if (ad.status !== 'pending') {
      res.status(409).json({ error: 'Ad reward already settled' });
      return;
    }

    const ageMs = Date.now() - ad.createdAt.getTime();
    if (ageMs > config.adNonceTtlMs) {
      ad.status = 'void';
      await ad.save();
      res.status(410).json({ error: 'Ad reward expired' });
      return;
    }

    ad.status = 'credited';
    ad.creditedAt = new Date();
    await ad.save();

    const user = await User.findById(req.userId);
    const tx = await creditBalance(req.userId!, 'ad', ad.rewardCents, {
      note: 'Rewarded video ad',
      metadata: { nonce: ad.nonce, adUnitId: ad.adUnitId },
    });
    res.json({ ok: true, rewardCents: ad.rewardCents, runningBalanceCents: tx.runningBalance });
  }),
);

export default router;