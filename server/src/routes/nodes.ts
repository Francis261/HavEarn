import { randomBytes } from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Node } from '../models/Node.js';
import { User } from '../models/User.js';
import { asyncRoute } from '../utils/http.js';
import { config } from '../config.js';

const router = Router();

router.use(requireAuth);

// Create or refresh the device (node) used for bandwidth sharing.
router.post(
  '/register',
  asyncRoute(async (req, res) => {
    const existing = await Node.findOne({ userId: req.userId });

    let node = existing;
    if (!node) {
      node = await Node.create({
        userId: req.userId,
        token: randomBytes(24).toString('hex'),
        label: 'My device',
        status: 'offline',
      });
    }

    const user = await User.findById(req.userId).select('termsAccepted');
    const termsOk =
      user?.termsAccepted?.version != null &&
      (await (await import('../models/TermsVersion.js')).TermsVersion.findOne({
        version: user.termsAccepted.version,
        active: true,
      })) != null;

    res.json({
      node: {
        id: String(node._id),
        token: node.token,
        label: node.label,
        status: node.status,
      },
      relayWsUrl: config.relayWsUrl,
      canShare: termsOk,
    });
  }),
);

export default router;