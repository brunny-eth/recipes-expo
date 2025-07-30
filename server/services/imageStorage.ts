import { supabaseAdmin } from '../lib/supabaseAdmin';
import { createLogger } from '../lib/logger';
import { createHash } from 'crypto';

const logger = createLogger('imageStorage');

export type ImageUploadResult = {
    publicUrl: string | null;
    storagePath: string | null;
    success: boolean;
    error?: string;
    uploadedSize?: number;
};

/**
 * Upload an image buffer to Supabase storage and return the public URL
 */
export async function uploadCoverImage(
    imageBuffer: Buffer,
    recipeId: number | string,
    mimeType: string = 'image/jpeg',
    requestId?: string
): Promise<ImageUploadResult> {
    try {
        logger.info({ 
            requestId, 
            recipeId, 
            imageSize: imageBuffer.length,
            mimeType
        }, 'Starting cover image upload');

        // Generate a unique filename to avoid conflicts
        const imageHash = createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
        const extension = getFileExtension(mimeType);
        const filename = `${recipeId}_${imageHash}${extension}`;
        const storagePath = `cover-images/${filename}`;

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('recipe-images')
            .upload(storagePath, imageBuffer, {
                contentType: mimeType,
                upsert: true // Allow overwriting if file exists
            });

        if (uploadError) {
            logger.error({ 
                requestId, 
                recipeId, 
                error: uploadError.message,
                storagePath
            }, 'Failed to upload cover image');
            
            return {
                publicUrl: null,
                storagePath: null,
                success: false,
                error: uploadError.message
            };
        }

        // Get the public URL
        const { data: publicUrlData } = supabaseAdmin.storage
            .from('recipe-images')
            .getPublicUrl(storagePath);

        if (!publicUrlData?.publicUrl) {
            logger.error({ 
                requestId, 
                recipeId, 
                storagePath 
            }, 'Failed to get public URL for uploaded image');
            
            return {
                publicUrl: null,
                storagePath,
                success: false,
                error: 'Failed to generate public URL'
            };
        }

        logger.info({ 
            requestId, 
            recipeId, 
            storagePath,
            publicUrl: publicUrlData.publicUrl,
            uploadedSize: imageBuffer.length
        }, 'Successfully uploaded cover image');

        return {
            publicUrl: publicUrlData.publicUrl,
            storagePath,
            success: true,
            uploadedSize: imageBuffer.length
        };

    } catch (error: any) {
        logger.error({ 
            requestId, 
            recipeId, 
            error: error.message,
            stack: error.stack
        }, 'Unexpected error uploading cover image');
        
        return {
            publicUrl: null,
            storagePath: null,
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete a cover image from storage
 */
export async function deleteCoverImage(
    storagePath: string,
    requestId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        logger.info({ requestId, storagePath }, 'Deleting cover image');

        const { error } = await supabaseAdmin.storage
            .from('recipe-images')
            .remove([storagePath]);

        if (error) {
            logger.error({ 
                requestId, 
                storagePath, 
                error: error.message 
            }, 'Failed to delete cover image');
            
            return {
                success: false,
                error: error.message
            };
        }

        logger.info({ requestId, storagePath }, 'Successfully deleted cover image');
        return { success: true };

    } catch (error: any) {
        logger.error({ 
            requestId, 
            storagePath, 
            error: error.message 
        }, 'Unexpected error deleting cover image');
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update a recipe's cover image URL in the database
 */
export async function updateRecipeCoverImage(
    recipeId: number,
    coverImageUrl: string | null,
    requestId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        logger.info({ 
            requestId, 
            recipeId, 
            coverImageUrl 
        }, 'Updating recipe cover image URL');

        // First, get the current recipe data
        const { data: currentData, error: fetchError } = await supabaseAdmin
            .from('processed_recipes_cache')
            .select('recipe_data')
            .eq('id', recipeId)
            .single();

        if (fetchError || !currentData) {
            logger.error({ 
                requestId, 
                recipeId, 
                error: fetchError?.message || 'No data found'
            }, 'Failed to fetch current recipe data for cover image update');
            
            return {
                success: false,
                error: fetchError?.message || 'Recipe not found'
            };
        }

        // Update the recipe_data JSONB with the cover image URL
        const updatedRecipeData = {
            ...currentData.recipe_data,
            image: coverImageUrl // Store as 'image' field in the recipe data
        };

        const { error } = await supabaseAdmin
            .from('processed_recipes_cache')
            .update({ 
                recipe_data: updatedRecipeData,
                last_processed_at: new Date().toISOString()
            })
            .eq('id', recipeId);

        if (error) {
            logger.error({ 
                requestId, 
                recipeId, 
                error: error.message 
            }, 'Failed to update recipe cover image URL');
            
            return {
                success: false,
                error: error.message
            };
        }

        logger.info({ 
            requestId, 
            recipeId, 
            coverImageUrl 
        }, 'Successfully updated recipe cover image URL');
        
        return { success: true };

    } catch (error: any) {
        logger.error({ 
            requestId, 
            recipeId, 
            error: error.message 
        }, 'Unexpected error updating recipe cover image URL');
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process and upload a PDF cover image in one operation
 */
export async function processPDFCoverImage(
    imageBuffer: Buffer,
    recipeId: number,
    confidence: 'high' | 'medium' | 'low',
    method: string,
    requestId?: string
): Promise<ImageUploadResult & { confidence: string; method: string }> {
    const uploadResult = await uploadCoverImage(
        imageBuffer, 
        recipeId, 
        'image/jpeg', // PDFs typically extract as JPEG
        requestId
    );

    // Update the recipe with the cover image URL if upload was successful
    if (uploadResult.success && uploadResult.publicUrl) {
        const dbResult = await updateRecipeCoverImage(
            recipeId, 
            uploadResult.publicUrl, 
            requestId
        );

        if (!dbResult.success) {
            logger.warn({ 
                requestId, 
                recipeId, 
                uploadSuccess: true,
                dbUpdateSuccess: false,
                dbError: dbResult.error
            }, 'Image uploaded successfully but failed to update database');
        }
    }

    return {
        ...uploadResult,
        confidence,
        method
    };
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
    const mimeToExtension: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
    };

    return mimeToExtension[mimeType.toLowerCase()] || '.jpg';
} 