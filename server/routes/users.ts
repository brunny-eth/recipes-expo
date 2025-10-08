import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

const router = Router();

// DELETE /api/users/delete-account
// Deletes the authenticated user's account and all associated data
router.delete('/delete-account', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    // 1️⃣ Extract and verify JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn({ requestId }, 'Account deletion attempted without Authorization header');
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn({ requestId }, 'Account deletion attempted with malformed Authorization header');
      return res.status(401).json({ error: 'Invalid Authorization header format' });
    }

    // Verify the JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn({ requestId, error: authError?.message }, 'Account deletion attempted with invalid token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = user.id;
    logger.info({ requestId, userId, userEmail: user.email }, 'Starting account deletion process');

    // 2️⃣ Delete user-related data from all tables
    const tablesToDelete = [
      'user_saved_recipes',        // User's saved recipes (must delete before folders due to FK)
      'user_saved_folders',        // User's folders
      'mise_recipes',              // User's meal planning recipes
      'shopping_list_item_states', // User's grocery list check states
    ];

    let deletionErrors: string[] = [];

    for (const table of tablesToDelete) {
      try {
        const { error, count } = await supabaseAdmin
          .from(table)
          .delete({ count: 'exact' })
          .eq('user_id', userId);
        
        if (error) {
          logger.warn({ requestId, userId, table, error: error.message }, `Failed to delete from ${table}`);
          deletionErrors.push(`${table}: ${error.message}`);
        } else {
          logger.info({ requestId, userId, table, deletedCount: count }, `Successfully deleted records from ${table}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn({ requestId, userId, table, error: errorMsg }, `Exception while deleting from ${table}`);
        deletionErrors.push(`${table}: ${errorMsg}`);
      }
    }

    // 3️⃣ Delete the auth user (this is the permanent step)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      logger.error({ 
        requestId, 
        userId, 
        error: deleteUserError.message,
        deletionErrors 
      }, 'Failed to delete auth user');
      return res.status(500).json({ 
        error: 'Failed to delete account',
        details: deleteUserError.message 
      });
    }

    logger.info({ 
      requestId, 
      userId, 
      userEmail: user.email,
      deletionErrors: deletionErrors.length > 0 ? deletionErrors : 'none'
    }, 'Successfully deleted user account');

    res.status(200).json({ 
      success: true,
      message: 'Account successfully deleted',
      partialFailures: deletionErrors.length > 0 ? deletionErrors : undefined
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ 
      requestId, 
      error: error.message, 
      stack: error.stack 
    }, 'Unexpected error during account deletion');
    
    res.status(500).json({ 
      error: 'Failed to delete account',
      details: error.message 
    });
  }
});

export default router;

