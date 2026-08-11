import { Router } from 'express';

const router = Router();

const PRIVACY = `# HavEarn Privacy Policy

Effective: latest published version

## What we collect
- **Account data:** email, password (hashed), device identifier, referral relationships.
- **Earnings data:** balance, transaction history (ads, tasks, bandwidth, withdrawals).
- **Relay metadata:** while Bandwidth Sharing is active we record IP metadata, connection
  volumes and session timestamps needed to pair traffic, meter bandwidth and bill earnings.
  We do not inspect payload contents.
- **Ad data:** served by Google AdMob under its own privacy policy; ad availability and
  reward events are recorded for verification.

## How we use it
To operate your account, verify rewards, pay withdrawals, prevent fraud, and route residential
proxy traffic as described in the Terms.

## Sharing
- Relayed traffic may carry requests that originate from third parties (see Terms).
- We engage processors (hosting, AdMob, analytics) that are bound by data agreements.
- We never sell your personal data.

## Data retention
Account data is retained while your account is active. Relayed traffic metadata is retained for
billing and abuse-prevention purposes and then aggregated.

## Your rights
You may request access, correction, or deletion of your personal data, disable Bandwidth
Sharing at any time, and delete your account by contacting support.

## Contact
support@havearn.example
`;

router.get('/privacy', (_req, res) => {
  res.type('text/plain').send(PRIVACY);
});

export default router;