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
    let deletionErrors: string[] = [];

    // Delete user_saved_recipes first (has foreign key to user_saved_folders)
    try {
      const { error, count } = await supabaseAdmin
        .from('user_saved_recipes')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      
      if (error) {
        logger.warn({ requestId, userId, table: 'user_saved_recipes', error: error.message }, 'Failed to delete from user_saved_recipes');
        deletionErrors.push(`user_saved_recipes: ${error.message}`);
      } else {
        logger.info({ requestId, userId, table: 'user_saved_recipes', deletedCount: count }, 'Successfully deleted records from user_saved_recipes');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ requestId, userId, table: 'user_saved_recipes', error: errorMsg }, 'Exception while deleting from user_saved_recipes');
      deletionErrors.push(`user_saved_recipes: ${errorMsg}`);
    }

    // Delete user_saved_folders (only non-system folders)
    // System folders need to be orphaned (user_id set to NULL) before user deletion
    try {
      // First, delete user-created folders
      const { error: deleteError, count: deleteCount } = await supabaseAdmin
        .from('user_saved_folders')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .eq('is_system', false);
      
      if (deleteError) {
        logger.warn({ requestId, userId, table: 'user_saved_folders', error: deleteError.message }, 'Failed to delete user folders');
        deletionErrors.push(`user_saved_folders: ${deleteError.message}`);
      } else {
        logger.info({ requestId, userId, table: 'user_saved_folders', deletedCount: deleteCount }, 'Successfully deleted user-created folders');
      }

      // Then, orphan system folders (set user_id to NULL so user can be deleted)
      const { error: orphanError, count: orphanCount } = await supabaseAdmin
        .from('user_saved_folders')
        .update({ user_id: null as any })  // Type assertion needed for NULL
        .eq('user_id', userId)
        .eq('is_system', true);
      
      if (orphanError) {
        logger.warn({ requestId, userId, table: 'user_saved_folders', error: orphanError.message }, 'Failed to orphan system folders');
        deletionErrors.push(`user_saved_folders (orphan): ${orphanError.message}`);
      } else {
        logger.info({ requestId, userId, table: 'user_saved_folders', orphanedCount: orphanCount }, 'Successfully orphaned system folders');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ requestId, userId, table: 'user_saved_folders', error: errorMsg }, 'Exception while handling user_saved_folders');
      deletionErrors.push(`user_saved_folders: ${errorMsg}`);
    }

    // Delete user_mise_recipes
    try {
      const { error, count } = await supabaseAdmin
        .from('user_mise_recipes')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      
      if (error) {
        logger.warn({ requestId, userId, table: 'user_mise_recipes', error: error.message }, 'Failed to delete from user_mise_recipes');
        deletionErrors.push(`user_mise_recipes: ${error.message}`);
      } else {
        logger.info({ requestId, userId, table: 'user_mise_recipes', deletedCount: count }, 'Successfully deleted records from user_mise_recipes');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ requestId, userId, table: 'user_mise_recipes', error: errorMsg }, 'Exception while deleting from user_mise_recipes');
      deletionErrors.push(`user_mise_recipes: ${errorMsg}`);
    }

    // Delete user_shopping_list_item_states
    try {
      const { error, count } = await supabaseAdmin
        .from('user_shopping_list_item_states')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      
      if (error) {
        logger.warn({ requestId, userId, table: 'user_shopping_list_item_states', error: error.message }, 'Failed to delete from user_shopping_list_item_states');
        deletionErrors.push(`user_shopping_list_item_states: ${error.message}`);
      } else {
        logger.info({ requestId, userId, table: 'user_shopping_list_item_states', deletedCount: count }, 'Successfully deleted records from user_shopping_list_item_states');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ requestId, userId, table: 'user_shopping_list_item_states', error: errorMsg }, 'Exception while deleting from user_shopping_list_item_states');
      deletionErrors.push(`user_shopping_list_item_states: ${errorMsg}`);
    }

    // 3️⃣ Delete the auth user (this is the permanent step)
    // This should cascade-delete remaining data or orphan it (depending on DB setup)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      logger.error({ 
        requestId, 
        userId, 
        error: deleteUserError.message,
        errorCode: (deleteUserError as any).code,
        errorStatus: (deleteUserError as any).status,
        fullError: JSON.stringify(deleteUserError),
        deletionErrors: deletionErrors.length > 0 ? deletionErrors : 'none'
      }, 'Failed to delete auth user');
      return res.status(500).json({ 
        error: 'Failed to delete account',
        details: deleteUserError.message,
        code: (deleteUserError as any).code
      });
    }

    logger.info({ 
      requestId, 
      userId, 
      userEmail: user.email,
      deletionWarnings: deletionErrors.length > 0 ? deletionErrors : 'none'
    }, 'Successfully deleted user account');

    res.status(200).json({ 
      success: true,
      message: 'Account successfully deleted',
      warnings: deletionErrors.length > 0 ? deletionErrors : undefined
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

