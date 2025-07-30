import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '../lib/logger';

const logger = createLogger('extractCoverImageFromPDF');

export type ImageExtractionResult = {
    imageBuffer: Buffer | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    method: 'embedded_image' | 'page_render' | 'failed';
    imageCount: number;
    selectedImageSize?: number;
    error?: string;
};

/**
 * Extracts the best cover image from a PDF using multiple strategies
 * 1. First tries to extract embedded images using pdfimages
 * 2. Falls back to rendering first page using ImageMagick
 * 3. Selects the largest/best quality image
 */
export async function extractCoverImageFromPDF(
    pdfBuffer: Buffer,
    requestId?: string
): Promise<ImageExtractionResult> {
    const tempId = randomUUID();
    const inputPath = `/tmp/${tempId}.pdf`;
    const outputPrefix = `/tmp/${tempId}`;
    
    let cleanupPaths: string[] = [inputPath];

    try {
        logger.info({ 
            requestId, 
            pdfSize: pdfBuffer.length, 
            tempId 
        }, 'Starting PDF image extraction');

        // Write PDF to temp file
        await fs.writeFile(inputPath, pdfBuffer);

        // Strategy 1: Try extracting embedded images with pdfimages
        const embeddedResult = await extractEmbeddedImages(inputPath, outputPrefix, tempId, requestId);
        
        if (embeddedResult.imageBuffer) {
            await cleanup(cleanupPaths.concat(embeddedResult.cleanupPaths || []));
            return embeddedResult;
        }

        logger.info({ requestId, tempId }, 'No suitable embedded images found, falling back to page render');

        // Strategy 2: Fallback to full-page render with ImageMagick
        const renderResult = await renderFirstPage(inputPath, outputPrefix, tempId, requestId);
        
        await cleanup(cleanupPaths.concat(renderResult.cleanupPaths || []));
        return renderResult;

    } catch (error: any) {
        logger.error({ 
            requestId, 
            tempId, 
            error: error.message, 
            stack: error.stack 
        }, 'PDF image extraction failed');
        
        await cleanup(cleanupPaths);
        return {
            imageBuffer: null,
            confidence: 'none',
            method: 'failed',
            imageCount: 0,
            error: error.message
        };
    }
}

/**
 * Extract embedded images using pdfimages utility
 */
async function extractEmbeddedImages(
    inputPath: string, 
    outputPrefix: string, 
    tempId: string,
    requestId?: string
): Promise<ImageExtractionResult & { cleanupPaths?: string[] }> {
    return new Promise((resolve) => {
        const proc = spawn('pdfimages', ['-j', '-png', inputPath, outputPrefix]);
        const cleanupPaths: string[] = [];

        proc.on('exit', async (code) => {
            try {
                logger.debug({ requestId, tempId, exitCode: code }, 'pdfimages process exited');

                const files = await fs.readdir('/tmp');
                const imageFiles = files.filter(f => 
                    f.startsWith(tempId) && 
                    f.match(/\.(jpg|jpeg|png|ppm|pbm)$/i)
                );

                cleanupPaths.push(...imageFiles.map(f => path.join('/tmp', f)));

                logger.info({ 
                    requestId, 
                    tempId, 
                    imageCount: imageFiles.length 
                }, 'Found embedded images');

                if (imageFiles.length === 0) {
                    return resolve({
                        imageBuffer: null,
                        confidence: 'none',
                        method: 'embedded_image',
                        imageCount: 0,
                        cleanupPaths
                    });
                }

                // Select the best image (largest file size as proxy for quality)
                const bestImage = await selectBestImage(imageFiles, requestId);
                
                if (!bestImage) {
                    return resolve({
                        imageBuffer: null,
                        confidence: 'low',
                        method: 'embedded_image',
                        imageCount: imageFiles.length,
                        cleanupPaths
                    });
                }

                const imagePath = path.join('/tmp', bestImage.filename);
                const imageBuffer = await fs.readFile(imagePath);

                // Determine confidence based on image characteristics
                const confidence = calculateImageConfidence(
                    imageBuffer, 
                    imageFiles.length, 
                    bestImage.size
                );

                logger.info({ 
                    requestId, 
                    tempId,
                    selectedImage: bestImage.filename,
                    imageSize: bestImage.size,
                    confidence
                }, 'Selected best embedded image');

                resolve({
                    imageBuffer,
                    confidence,
                    method: 'embedded_image',
                    imageCount: imageFiles.length,
                    selectedImageSize: bestImage.size,
                    cleanupPaths
                });

            } catch (error: any) {
                logger.error({ 
                    requestId, 
                    tempId, 
                    error: error.message 
                }, 'Error processing embedded images');
                
                resolve({
                    imageBuffer: null,
                    confidence: 'none',
                    method: 'embedded_image',
                    imageCount: 0,
                    error: error.message,
                    cleanupPaths
                });
            }
        });

        proc.on('error', (error) => {
            logger.error({ 
                requestId, 
                tempId, 
                error: error.message 
            }, 'pdfimages process error');
            
            resolve({
                imageBuffer: null,
                confidence: 'none',
                method: 'embedded_image',
                imageCount: 0,
                error: error.message,
                cleanupPaths
            });
        });
    });
}

/**
 * Render first page using ImageMagick as fallback
 */
async function renderFirstPage(
    inputPath: string, 
    outputPrefix: string, 
    tempId: string,
    requestId?: string
): Promise<ImageExtractionResult & { cleanupPaths?: string[] }> {
    const outputPath = `${outputPrefix}_page1.jpg`;
    const cleanupPaths = [outputPath];

    return new Promise((resolve) => {
        // Convert first page of PDF to JPEG with good quality
        const proc = spawn('convert', [
            '-density', '300',        // High DPI for quality
            '-quality', '85',         // Good JPEG quality
            `${inputPath}[0]`,        // First page only
            outputPath
        ]);

        proc.on('exit', async (code) => {
            try {
                logger.debug({ requestId, tempId, exitCode: code }, 'ImageMagick convert process exited');

                const stats = await fs.stat(outputPath);
                const imageBuffer = await fs.readFile(outputPath);

                // Page renders are generally medium confidence
                const confidence: 'high' | 'medium' | 'low' = 
                    imageBuffer.length > 100000 ? 'medium' : 'low';

                logger.info({ 
                    requestId, 
                    tempId,
                    renderedSize: stats.size,
                    confidence
                }, 'Successfully rendered PDF first page');

                resolve({
                    imageBuffer,
                    confidence,
                    method: 'page_render',
                    imageCount: 1,
                    selectedImageSize: stats.size,
                    cleanupPaths
                });

            } catch (error: any) {
                logger.error({ 
                    requestId, 
                    tempId, 
                    error: error.message 
                }, 'Error reading rendered page');
                
                resolve({
                    imageBuffer: null,
                    confidence: 'none',
                    method: 'page_render',
                    imageCount: 0,
                    error: error.message,
                    cleanupPaths
                });
            }
        });

        proc.on('error', (error) => {
            logger.error({ 
                requestId, 
                tempId, 
                error: error.message 
            }, 'ImageMagick convert process error');
            
            resolve({
                imageBuffer: null,
                confidence: 'none',
                method: 'page_render',
                imageCount: 0,
                error: error.message,
                cleanupPaths
            });
        });
    });
}

/**
 * Select the best image from available options based on file size and format
 */
async function selectBestImage(
    imageFiles: string[], 
    requestId?: string
): Promise<{ filename: string; size: number } | null> {
    try {
        const imageStats = await Promise.all(
            imageFiles.map(async (filename) => {
                try {
                    const stats = await fs.stat(path.join('/tmp', filename));
                    return { filename, size: stats.size };
                } catch {
                    return null;
                }
            })
        );

        const validImages = imageStats.filter(Boolean) as { filename: string; size: number }[];
        
        if (validImages.length === 0) return null;

        // Prefer larger images, but filter out tiny ones (likely icons/decorations)
        const suitableImages = validImages.filter(img => img.size > 5000); // > 5KB
        
        if (suitableImages.length === 0) {
            // If no suitable images, take the largest available
            return validImages.reduce((best, current) => 
                current.size > best.size ? current : best
            );
        }

        // Return the largest suitable image
        const bestImage = suitableImages.reduce((best, current) => 
            current.size > best.size ? current : best
        );

        logger.debug({ 
            requestId, 
            totalImages: validImages.length,
            suitableImages: suitableImages.length,
            selectedImage: bestImage.filename,
            selectedSize: bestImage.size
        }, 'Image selection completed');

        return bestImage;

    } catch (error: any) {
        logger.error({ requestId, error: error.message }, 'Error selecting best image');
        return null;
    }
}

/**
 * Calculate confidence score based on image characteristics
 */
function calculateImageConfidence(
    imageBuffer: Buffer, 
    totalImages: number, 
    imageSize: number
): 'high' | 'medium' | 'low' {
    // High confidence: Large image from PDF with few images (likely hero image)
    if (imageSize > 50000 && totalImages <= 3) {
        return 'high';
    }
    
    // Medium confidence: Decent sized image or single image
    if (imageSize > 20000 || totalImages === 1) {
        return 'medium';
    }
    
    // Low confidence: Small image or many images (might be decorative)
    return 'low';
}

/**
 * Clean up temporary files
 */
async function cleanup(paths: string[]): Promise<void> {
    await Promise.all(
        paths.map(async (filePath) => {
            try {
                await fs.unlink(filePath);
            } catch {
                // Ignore cleanup errors
            }
        })
    );
} 