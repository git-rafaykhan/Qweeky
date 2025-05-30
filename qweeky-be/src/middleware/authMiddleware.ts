import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { secret } from '../config';

// Extend Request interface to add userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  if (!token) {
    return res.status(401).json({ message: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string };
    req.userId = decoded.userId;
    next();
    
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
