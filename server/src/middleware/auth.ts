import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userIsAdmin?: boolean;
    }
  }
}

export interface JwtPayload {
  sub: string;
  role?: 'admin' | 'user';
}

export function signToken(user: { _id: unknown; isAdmin?: boolean }): string {
  const payload: JwtPayload = { sub: String(user._id), role: user.isAdmin ? 'admin' : 'user' };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
    req.userId = decoded.sub;
    req.userIsAdmin = decoded.role === 'admin';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await User.findById(req.userId).select('-passwordHash').lean();
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  res.locals.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.userIsAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}