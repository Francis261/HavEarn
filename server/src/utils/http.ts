import type { Request, Response } from 'express';
import { ZodSchema } from 'zod';

export function parseBody<T>(schema: ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(422).json({
      error: 'Validation failed',
      issues: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return null;
  }
  return result.data;
}

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((err) => {
      console.error('[api] error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    });
  };
}