import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';

const router = Router();

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware: 10 submissions per hour per email
const rateLimitMiddleware = (req: Request, res: Response, next: Function) => {
  const email = req.body.email || 'anonymous';
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  
  const userLimit = rateLimitStore.get(email);
  
  if (!userLimit || now > userLimit.resetTime) {
    // First request or reset time passed
    rateLimitStore.set(email, { count: 1, resetTime: now + oneHour });
    next();
  } else if (userLimit.count < 10) {
    // Under limit
    userLimit.count++;
    next();
  } else {
    // Over limit
    logger.warn({ 
      requestId: (req as any).id, 
      email, 
      route: req.originalUrl, 
      method: req.method 
    }, 'Rate limit exceeded for feedback submission');
    res.status(429).json({ 
      error: 'Too many feedback submissions. Please try again later.' 
    });
  }
};

// Middleware to log all incoming requests to this router
router.use((req, res, next) => {
  logger.info({
    requestId: (req as any).id,
    method: req.method,
    path: req.originalUrl,
  }, 'Incoming request to /api/feedback router');
  next();
});

// POST /api/feedback
router.post('/', rateLimitMiddleware, async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  logger.info({ 
    body: req.body, 
    requestId, 
    route: req.originalUrl, 
    method: req.method 
  }, '[feedback] Incoming request');

  try {
    const { message, email, app_version } = req.body;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      logger.warn({ 
        requestId, 
        route: req.originalUrl, 
        method: req.method, 
        messageReceived: message 
      }, 'Missing or empty "message" in request body for /feedback');
      return res.status(400).json({ 
        error: 'Missing or empty "message" in request body' 
      });
    }

    // Validate optional fields
    if (email && typeof email !== 'string') {
      logger.warn({ 
        requestId, 
        route: req.originalUrl, 
        method: req.method, 
        emailReceived: email 
      }, 'Invalid "email" type in request body for /feedback');
      return res.status(400).json({ 
        error: 'Invalid "email" type in request body' 
      });
    }

    if (app_version && typeof app_version !== 'string') {
      logger.warn({ 
        requestId, 
        route: req.originalUrl, 
        method: req.method, 
        appVersionReceived: app_version 
      }, 'Invalid "app_version" type in request body for /feedback');
      return res.status(400).json({ 
        error: 'Invalid "app_version" type in request body' 
      });
    }

    // Insert feedback into database
    const { data, error } = await supabaseAdmin
      .from('user_feedback')
      .insert({
        message: message.trim(),
        email: email?.trim() || null,
        app_version: app_version?.trim() || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ 
        requestId, 
        error, 
        route: req.originalUrl, 
        method: req.method 
      }, 'Database error inserting feedback');
      return res.status(500).json({ 
        error: 'Failed to save feedback. Please try again.' 
      });
    }

    logger.info({ 
      requestId, 
      feedbackId: data.id, 
      email: email || 'anonymous',
      route: req.originalUrl, 
      method: req.method 
    }, 'Feedback submitted successfully');

    res.status(200).json({ 
      message: 'Feedback submitted successfully',
      id: data.id 
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ 
      requestId, 
      err: error, 
      route: req.originalUrl, 
      method: req.method 
    }, 'Unexpected error in feedback submission');
    res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
});

export { router as feedbackRouter }; 