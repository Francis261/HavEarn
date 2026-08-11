import { randomBytes } from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { Task } from '../models/Task.js';
import { TaskCompletion } from '../models/TaskCompletion.js';
import { asyncRoute } from '../utils/http.js';
import { creditBalance } from '../services/earnings.js';

const router = Router();

router.use(requireAuth);

// Enrich tasks with the current user completion state
function publicTask(
  task: Record<string, unknown>,
  completion?: { status: string; rewardCents: number } | null,
) {
  return {
    id: String(task._id),
    title: task.title,
    description: task.description,
    type: task.type,
    rewardCents: task.rewardCents,
    url: task.url,
    requirements: task.requirements,
    cooldownMs: task.cooldownMs,
    status: completion?.status ?? 'available',
  };
}

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const tasks = await Task.find({ active: true }).sort({ sortOrder: 1 }).lean();
    const completions = await TaskCompletion.find({ userId: req.userId }).lean();
    const statusByTask = new Map(completions.map((c) => [String(c.taskId), c]));

    res.json({
      tasks: tasks.map((t) => publicTask(t, statusByTask.get(String(t._id)) ?? null)),
    });
  }),
);

// Claim a task: creates a pending completion. For external-link/survey tasks we
// auto-approve (self-moderated MVP). install_check stays pending for admin review.
router.post(
  '/:id/complete',
  asyncRoute(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, active: true });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const existing = await TaskCompletion.findOne({ userId: req.userId, taskId: task._id });
    if (existing) {
      res.status(409).json({ error: 'Task already in progress', status: existing.status });
      return;
    }

    const autoApprove = task.type !== 'install_check';
    const reward = task.rewardCents;

    const completion = await TaskCompletion.create({
      userId: req.userId,
      taskId: task._id,
      status: autoApprove ? 'approved' : 'pending',
      rewardCents: autoApprove ? reward : config.taskBaseRewardCents,
      claimToken: randomBytes(12).toString('hex'),
      decidedAt: autoApprove ? new Date() : null,
    });

    if (autoApprove) {
      const tx = await creditBalance(req.userId!, 'task', reward, {
        note: `Task: ${task.title}`,
        metadata: { taskId: String(task._id), completionId: String(completion._id) },
      });
      res.json({
        ok: true,
        status: completion.status,
        rewardCents: reward,
        runningBalanceCents: tx.runningBalance,
      });
      return;
    }

    res.json({
      ok: true,
      status: 'pending',
      rewardCents: completion.rewardCents,
      note: 'Submission received. Reward is added once reviewed.',
    });
  }),
);

export default router;