import { Node } from '../models/Node.js';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { creditBalance } from './earnings.js';

const GB = 1024 * 1024 * 1024;

/**
 * Accounts relayed bytes to a node, converting full gigabytes into earnings at
 * the configured rate. Fractional bytes accumulate in `residualBytes` so users
 * are not penalized for partial gigabytes.
 */
export async function creditBandwidth(nodeId: string, bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;

  const node = await Node.findById(nodeId);
  if (!node) return;

  node.totalBytes += bytes;
  node.residualBytes += bytes;

  let earnedCents = 0;
  while (node.residualBytes >= GB) {
    node.residualBytes -= GB;
    earnedCents += config.bandwidthRatePerGb;
  }

  await node.save();

  if (earnedCents <= 0) return;

  const user = await User.findById(node.userId).lean();
  if (!user) return;

  node.earnedCents += earnedCents;
  await node.save();

  await creditBalance(
    user._id.toString(),
    'bandwidth',
    earnedCents,
    {
      note: `Bandwidth shared (${(bytes / GB).toFixed(2)} GB session)`,
      metadata: { nodeId: String(node._id), bytes },
    },
  ).catch((err) => console.warn('[bandwidth] credit failed', err.message));
}