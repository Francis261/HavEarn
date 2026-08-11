import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { TermsVersion } from '../models/TermsVersion.js';
import { User } from '../models/User.js';
import { parseBody, asyncRoute } from '../utils/http.js';

const router = Router();

router.get(
  '/current',
  asyncRoute(async (_req, res) => {
    const terms = await TermsVersion.findOne({ active: true }).sort({ version: -1 }).lean();
    if (!terms) {
      res.status(404).json({ error: 'Terms not published yet' });
      return;
    }
    res.json({ terms: { version: terms.version, title: terms.title, content: terms.content } });
  }),
);

const acceptSchema = z.object({ version: z.number().int().positive() });

router.post(
  '/accept',
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = parseBody(acceptSchema, req, res);
    if (!body) return;

    const terms = await TermsVersion.findOne({ version: body.version, active: true }).lean();
    if (!terms) {
      res.status(404).json({ error: 'No active terms with that version' });
      return;
    }

    const user = await User.findByIdAndUpdate(req.userId, {
      termsAccepted: { version: body.version, acceptedAt: new Date() },
    }).select('-passwordHash');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ ok: true, termsAccepted: user.termsAccepted });
  }),
);

export default router;