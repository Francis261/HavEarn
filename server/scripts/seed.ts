import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { TermsVersion } from '../src/models/TermsVersion.js';
import { Task } from '../src/models/Task.js';

const TERMS = `# HavEarn Terms & Conditions

Last updated: {date}

By creating an account and using HavEarn ("the App"), you agree to the following terms.

## 1. Minimum age
You must be at least 13 years old (or the age of digital consent in your country) to use the App. By accepting these terms you confirm you meet the minimum age requirement.

## 2. Participation and consent
- You may choose to share your device's **unused internet connection** ("Bandwidth Sharing") with our network. This connection is used as part of a residential proxy network operated by HavEarn and its partners, and requests routed through your device may originate from third parties.
- You consent to network traffic — including URLs, IP addresses, headers and payloads — passing through your device while Bandwidth Sharing is active.
- You may disable Bandwidth Sharing at any time from the Share screen.

## 3. Earnings
- You earn credits ("balance") for completed tasks, rewarded advertisements and shared bandwidth. Earnings rates may change at any time.
- Rewards are subject to verification. Fraudulent or automated activity voids rewards.
- Balances have no cash value until a withdrawal is approved and paid via a supported payout method.

## 4. Advertisements
Watching ads is entirely voluntary and each rewarded ad is credited only after successful completion. Ad availability varies by region.

## 5. Withdrawals
- Minimum withdrawal thresholds apply and are displayed before you request a payout.
- You may hold only one pending or approved withdrawal request at a time.
- Withdrawals are processed manually and subject to review before payout.

## 6. Prohibited conduct
You may not:
- create multiple accounts or automate any earning flow;
- tamper with, reverse engineer, or interfere with the App or relay network;
- use the App to route unlawful traffic, including spam, credential stuffing, fraud, or any activity that violates the applicable terms of your internet service provider or hosting provider;
- transfer or sell your account.

## 7. Privacy
See our Privacy Policy for details on data collection, including device identifiers, IP metadata and relayed traffic metadata. Bandwidth Sharing traffic is not monitored for content, but volume and endpoint metadata are recorded for billing and abuse prevention.

## 8. Limitation of liability
The App is provided "as is". HavEarn is not liable for indirect, incidental, or consequential damages arising from use of the App or disruption of your device's connectivity.

## 9. Changes & termination
We may update these terms (with notice in-app), amend rates, or suspend accounts that violate these terms. Continued use after version changes constitutes acceptance.

## 10. Contact
Questions: support@havearn.example
`;

const TASKS = [
  {
    title: 'Follow us on X (Twitter)',
    description: 'Follow @HavEarn on X to earn.',
    type: 'external_link',
    rewardCents: 100,
    url: 'https://x.com/havearn',
    requirements: 'Must hold the account for at least 24h after completion.',
    sortOrder: 1,
  },
  {
    title: 'Install demo partner app',
    description: 'Install the partner app, open it once, then submit.',
    type: 'install_check',
    rewardCents: 300,
    url: 'https://example.com/partner-app',
    requirements: 'Install + open once; verified by admin before approval.',
    sortOrder: 2,
  },
  {
    title: 'Take a short survey',
    description: 'Complete a 2-minute market research survey.',
    type: 'survey',
    rewardCents: 150,
    url: 'https://example.com/survey',
    requirements: 'Submit valid responses.',
    sortOrder: 3,
  },
];

async function seed(): Promise<void> {
  await mongoose.connect(config.mongodbUri);
  console.log('[seed] connected');

  const existing = await TermsVersion.findOne({ active: true }).sort({ version: -1 });
  const nextVersion = (existing?.version ?? 0) + 1;
  if (!existing) {
    await TermsVersion.create({
      version: nextVersion,
      title: 'Terms & Conditions',
      content: TERMS.replace('{date}', new Date().toISOString().slice(0, 10)),
    });
    console.log(`[seed] terms v${nextVersion} created`);
  } else {
    console.log(`[seed] terms already exist (current v${existing.version})`);
  }

  const taskCount = await Task.countDocuments();
  if (taskCount === 0) {
    await Task.create(TASKS);
    console.log(`[seed] seeded ${TASKS.length} tasks`);
  } else {
    console.log(`[seed] ${taskCount} tasks already present`);
  }

  await mongoose.disconnect();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});