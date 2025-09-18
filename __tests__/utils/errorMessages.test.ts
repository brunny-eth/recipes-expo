import { describe, it, expect, vi } from 'vitest';

// Mock the networkUtils module to avoid React Native NetInfo issues in Node.js
vi.mock('../../utils/networkUtils', () => ({
  isOfflineError: vi.fn((error: Error | string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return errorMessage.includes('Network request failed') || 
           errorMessage.includes('Failed to fetch') ||
           errorMessage.includes('network error') ||
           errorMessage.includes('ERR_NETWORK');
  })
}));

import { getErrorMessage, getNetworkErrorMessage, getSubmissionErrorMessage } from '../../utils/errorMessages';
import { normalizeAppError } from '../../utils/normalizeAppError';
import { ParseErrorCode } from '../../common/types/errors';

describe('Error Messages - Current Behavior Snapshots', () => {
  describe('getErrorMessage - ParseErrorCode mapping', () => {
    describe('INVALID_INPUT', () => {
      it('returns URL message when no context provided', () => {
        const message = getErrorMessage(ParseErrorCode.INVALID_INPUT);
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try again."
        `);
      });

      it('returns image message when context is "image"', () => {
        const message = getErrorMessage(ParseErrorCode.INVALID_INPUT, 'image');
        expect(message).toMatchInlineSnapshot(`
          "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions."
        `);
      });

      it('returns image message when context is "images"', () => {
        const message = getErrorMessage(ParseErrorCode.INVALID_INPUT, 'images');
        expect(message).toMatchInlineSnapshot(`
          "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions."
        `);
      });

      it('returns raw_text message when context is "raw_text"', () => {
        const message = getErrorMessage(ParseErrorCode.INVALID_INPUT, 'raw_text');
        expect(message).toMatchInlineSnapshot(`
          "Please be a bit more descriptive. Try something like 'arugula pizza' or 'lasagna'."
        `);
      });

      it('returns URL message for unknown context', () => {
        const message = getErrorMessage(ParseErrorCode.INVALID_INPUT, 'unknown_context');
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try again."
        `);
      });
    });

    describe('GENERATION_FAILED', () => {
      it('returns URL message when no context provided', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_FAILED);
        expect(message).toMatchInlineSnapshot(`
          "We couldn't process that recipe. Please try again."
        `);
      });

      it('returns image message when context is "image"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_FAILED, 'image');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find a recipe in those images. Try clearer images with steps and ingredients."
        `);
      });

      it('returns image message when context is "images"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_FAILED, 'images');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find a recipe in those images. Try clearer images with steps and ingredients."
        `);
      });

      it('returns raw_text message when context is "raw_text"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_FAILED, 'raw_text');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't understand the recipe you pasted. Try adding more detail."
        `);
      });

      it('returns URL message for unknown context', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_FAILED, 'unknown_context');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't process that recipe. Please try again."
        `);
      });
    });

    describe('GENERATION_EMPTY', () => {
      it('returns generic message when no context provided', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY);
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find enough recipe details in that text. Please include ingredients and cooking instructions."
        `);
      });

      it('returns image message when context is "image"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY, 'image');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find enough recipe details in those images. Please make sure the images clearly show ingredients and cooking instructions."
        `);
      });

      it('returns image message when context is "images"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY, 'images');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find enough recipe details in those images. Please make sure the images clearly show ingredients and cooking instructions."
        `);
      });

      it('returns url message when context is "url"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY, 'url');
        expect(message).toMatchInlineSnapshot(`
          "No recipe found at that URL. Please try a different link or paste the recipe text directly."
        `);
      });

      it('returns raw_text message when context is "raw_text"', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY, 'raw_text');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find enough recipe details in that text. Please be more specific about what you'd like to cook - try including ingredients, cooking method, or dietary preferences."
        `);
      });

      it('returns generic message for unknown context', () => {
        const message = getErrorMessage(ParseErrorCode.GENERATION_EMPTY, 'unknown_context');
        expect(message).toMatchInlineSnapshot(`
          "We couldn't find enough recipe details in that text. Please include ingredients and cooking instructions."
        `);
      });
    });

    describe('FINAL_VALIDATION_FAILED', () => {
      it('returns generic message when no context provided', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED);
        expect(message).toMatchInlineSnapshot(`
          "The recipe details seem incomplete. Please add more ingredients or cooking steps and try again."
        `);
      });

      it('returns image message when context is "image"', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED, 'image');
        expect(message).toMatchInlineSnapshot(`
          "The recipe from those images seems incomplete. Please try uploading images with more complete recipe information."
        `);
      });

      it('returns image message when context is "images"', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED, 'images');
        expect(message).toMatchInlineSnapshot(`
          "The recipe from those images seems incomplete. Please try uploading images with more complete recipe information."
        `);
      });

      it('returns url message when context is "url"', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED, 'url');
        expect(message).toMatchInlineSnapshot(`
          "The recipe from that URL seems incomplete. Please try a different link or paste the recipe text directly."
        `);
      });

      it('returns raw_text message when context is "raw_text"', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED, 'raw_text');
        expect(message).toMatchInlineSnapshot(`
          "The recipe details seem incomplete. Please add more specific ingredients or cooking steps - the more details you provide, the better we can help!"
        `);
      });

      it('returns generic message for unknown context', () => {
        const message = getErrorMessage(ParseErrorCode.FINAL_VALIDATION_FAILED, 'unknown_context');
        expect(message).toMatchInlineSnapshot(`
          "The recipe details seem incomplete. Please add more ingredients or cooking steps and try again."
        `);
      });
    });

    describe('UNSUPPORTED_INPUT_TYPE', () => {
      it('returns unsupported input message', () => {
        const message = getErrorMessage(ParseErrorCode.UNSUPPORTED_INPUT_TYPE);
        expect(message).toMatchInlineSnapshot(`
          "Please try pasting a link with a recipe in it, or just search for a similar recipe."
        `);
      });

      it('returns same message regardless of context', () => {
        const messageWithContext = getErrorMessage(ParseErrorCode.UNSUPPORTED_INPUT_TYPE, 'url');
        const messageWithoutContext = getErrorMessage(ParseErrorCode.UNSUPPORTED_INPUT_TYPE);
        expect(messageWithContext).toBe(messageWithoutContext);
      });
    });

    describe('Default case', () => {
      it('returns generic message for unknown error code', () => {
        const message = getErrorMessage('UNKNOWN_ERROR' as ParseErrorCode);
        expect(message).toMatchInlineSnapshot(`
          "Something went wrong while processing your recipe. Please try again."
        `);
      });
    });
  });

  describe('getNetworkErrorMessage - Network and HTTP error handling', () => {
    describe('Offline errors', () => {
      it('handles offline error', () => {
        const error = new Error('Network request failed');
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Please check your internet connection and try again."
        `);
      });
    });

    describe('Backend configuration errors', () => {
      it('handles backend URL not configured', () => {
        const error = 'Backend URL not configured';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Recipe service is temporarily unavailable. Please try again in a few moments."
        `);
      });
    });

    describe('HTTP status codes', () => {
      it('handles 400 Bad Request', () => {
        const error = 'Bad Request';
        const message = getNetworkErrorMessage(error, 400);
        expect(message).toMatchInlineSnapshot(`
          "Invalid recipe format. Please check your input and try again."
        `);
      });

      it('handles 404 Not Found', () => {
        const error = 'Not Found';
        const message = getNetworkErrorMessage(error, 404);
        expect(message).toMatchInlineSnapshot(`
          "Recipe service not found. Please try again in a few moments."
        `);
      });

      it('handles 429 Too Many Requests', () => {
        const error = 'Too Many Requests';
        const message = getNetworkErrorMessage(error, 429);
        expect(message).toMatchInlineSnapshot(`
          "Too many requests. Please wait a moment and try again."
        `);
      });

      it('handles 500 Internal Server Error', () => {
        const error = 'Internal Server Error';
        const message = getNetworkErrorMessage(error, 500);
        expect(message).toMatchInlineSnapshot(`
          "Recipe service is having issues. Please try again in a few minutes."
        `);
      });

      it('handles 503 Service Unavailable', () => {
        const error = 'Service Unavailable';
        const message = getNetworkErrorMessage(error, 503);
        expect(message).toMatchInlineSnapshot(`
          "Recipe service is temporarily down. Please try again later."
        `);
      });

      it('handles other 5xx errors', () => {
        const error = 'Gateway Timeout';
        const message = getNetworkErrorMessage(error, 504);
        expect(message).toMatchInlineSnapshot(`
          "Our recipe service is having technical difficulties. Please try again later."
        `);
      });
    });

    describe('Database errors', () => {
      it('handles Supabase errors', () => {
        const error = 'supabase connection failed';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Can't connect to our recipe database right now. Please check your connection and try again."
        `);
      });

      it('handles database errors', () => {
        const error = 'database timeout';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Can't connect to our recipe database right now. Please check your connection and try again."
        `);
      });

      it('handles connection errors', () => {
        const error = 'connection refused';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Can't connect to our recipe database right now. Please check your connection and try again."
        `);
      });
    });

    describe('Cache/RPC errors', () => {
      it('handles RPC errors', () => {
        const error = 'rpc call failed';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Having trouble checking saved recipes. Your recipe will still be processed, but it may take a moment longer."
        `);
      });

      it('handles cache errors', () => {
        const error = 'cache miss';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Having trouble checking saved recipes. Your recipe will still be processed, but it may take a moment longer."
        `);
      });
    });

    describe('URL parsing errors', () => {
      it('handles URL normalization errors', () => {
        const error = 'URL normalization failed';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please check your input and try again."
        `);
      });
    });

    describe('Generic fallback', () => {
      it('handles unknown errors', () => {
        const error = 'Some random error';
        const message = getNetworkErrorMessage(error);
        expect(message).toMatchInlineSnapshot(`
          "Something unexpected happened when trying to process your recipe. 
          If the problem continues, try pasting recipe text directly."
        `);
      });
    });
  });

  describe('getSubmissionErrorMessage - Submission stage error handling', () => {
    describe('Validation stage', () => {
      it('handles validation errors', () => {
        const error = 'Invalid input';
        const message = getSubmissionErrorMessage('validation', error);
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try again."
        `);
      });

      it('handles validation errors with URL context', () => {
        const error = 'Invalid input';
        const message = getSubmissionErrorMessage('validation', error, 'url');
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try a recipe URL."
        `);
      });

      it('handles validation errors with raw_text context', () => {
        const error = 'Invalid input';
        const message = getSubmissionErrorMessage('validation', error, 'raw_text');
        expect(message).toMatchInlineSnapshot(`
          "Please be a bit more descriptive. Try something like 'arugula pizza' or 'lasagna'."
        `);
      });

      it('handles validation errors with image context', () => {
        const error = 'Invalid input';
        const message = getSubmissionErrorMessage('validation', error, 'image');
        expect(message).toMatchInlineSnapshot(`
          "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions."
        `);
      });

      it('handles validation errors with images context (plural)', () => {
        const error = 'Invalid input';
        const message = getSubmissionErrorMessage('validation', error, 'images');
        expect(message).toMatchInlineSnapshot(`
          "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions."
        `);
      });
    });

    describe('Authentication stage', () => {
      it('handles authentication errors', () => {
        const error = 'Unauthorized';
        const message = getSubmissionErrorMessage('authentication', error);
        expect(message).toMatchInlineSnapshot(`
          "Authentication issue. Please try logging in again."
        `);
      });
    });

    describe('Cache check stage', () => {
      it('handles cache check errors', () => {
        const error = 'Cache error';
        const message = getSubmissionErrorMessage('cache_check', error);
        expect(message).toMatchInlineSnapshot(`
          "Having trouble checking saved recipes, but we'll still process your recipe."
        `);
      });
    });

    describe('Analytics tracking stage', () => {
      it('handles analytics tracking errors', () => {
        const error = 'Analytics failed';
        const message = getSubmissionErrorMessage('analytics_tracking', error);
        expect(message).toMatchInlineSnapshot(`
          "There was a tracking issue, but we'll still process your recipe."
        `);
      });
    });

    describe('Recipe submission stage', () => {
      it('handles timeout errors', () => {
        const error = 'Request timeout';
        const message = getSubmissionErrorMessage('recipe_submission', error);
        expect(message).toMatchInlineSnapshot(`
          "Recipe processing is taking longer than usual. Please try again."
        `);
      });

      it('handles network errors', () => {
        const error = 'Network request failed';
        const message = getSubmissionErrorMessage('recipe_submission', error);
        expect(message).toMatchInlineSnapshot(`
          "We're having trouble processing that recipe. Please try again or paste the recipe text directly."
        `);
      });

      it('handles fetch errors', () => {
        const error = 'Failed to fetch';
        const message = getSubmissionErrorMessage('recipe_submission', error);
        expect(message).toMatchInlineSnapshot(`
          "Network issue while submitting recipe. Please check your connection and try again."
        `);
      });

      it('handles generic submission errors', () => {
        const error = 'Some submission error';
        const message = getSubmissionErrorMessage('recipe_submission', error);
        expect(message).toMatchInlineSnapshot(`
          "We're having trouble processing that recipe. Please try again or paste the recipe text directly."
        `);
      });
    });

    describe('Result processing stage', () => {
      it('handles result processing errors', () => {
        const error = 'Processing failed';
        const message = getSubmissionErrorMessage('result_processing', error);
        expect(message).toMatchInlineSnapshot(`
          "There was an issue processing the recipe results. Please try again."
        `);
      });
    });

    describe('Navigation stages', () => {
      it('handles navigation_routing errors', () => {
        const error = 'Navigation failed';
        const message = getSubmissionErrorMessage('navigation_routing', error);
        expect(message).toMatchInlineSnapshot(`
          "There was an issue during the submission process. The recipe was not processed. Please try submitting again."
        `);
      });

      it('handles navigation errors', () => {
        const error = 'Navigation failed';
        const message = getSubmissionErrorMessage('navigation', error);
        expect(message).toMatchInlineSnapshot(`
          "There was an issue during the submission process. The recipe was not processed. Please try submitting again."
        `);
      });
    });

    describe('Parsing stage', () => {
      it('handles timeout errors', () => {
        const error = 'Parsing timeout';
        const message = getSubmissionErrorMessage('parsing', error);
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try again."
        `);
      });

      it('handles generic parsing errors', () => {
        const error = 'Parsing failed';
        const message = getSubmissionErrorMessage('parsing', error);
        expect(message).toMatchInlineSnapshot(`
          "That doesn't look like a valid recipe. Please try again."
        `);
      });
    });

    describe('Default case', () => {
      it('falls back to network error message for unknown stage', () => {
        const error = 'Some error';
        const message = getSubmissionErrorMessage('unknown_stage', error);
        // Should fall back to getNetworkErrorMessage
        expect(message).toMatchInlineSnapshot(`
          "Something unexpected happened when trying to process your recipe. 
          If the problem continues, try pasting recipe text directly."
        `);
      });
    });
  });

  describe('Context Flow Integration Tests', () => {
    describe('useRecipeSubmission context mapping', () => {
      it('maps URL input type to url context for validation errors', () => {
        const error = 'Invalid input';
        const result = normalizeAppError(error, { 
          stage: 'validation',
          context: 'url' // This simulates what useRecipeSubmission now passes
        });
        
        expect(result.code).toBe('SUBMISSION_VALIDATION');
        expect(result.title).toBe('Submission Error');
        expect(result.message).toContain("That doesn't look like a valid recipe. Please try a recipe URL.");
        expect(result.severity).toBe('warn'); // Validation errors are warnings, not errors
        expect(result.retryable).toBe(false); // User needs to fix input first
      });

      it('maps raw_text input type to raw_text context for validation errors', () => {
        const error = 'Invalid input';
        const result = normalizeAppError(error, { 
          stage: 'validation',
          context: 'raw_text' // This simulates what useRecipeSubmission now passes
        });
        
        expect(result.code).toBe('SUBMISSION_VALIDATION');
        expect(result.title).toBe('Submission Error');
        expect(result.message).toContain("Please be a bit more descriptive. Try something like 'arugula pizza' or 'lasagna'.");
        expect(result.severity).toBe('warn'); // Validation errors are warnings, not errors
        expect(result.retryable).toBe(false); // User needs to fix input first
      });

      it('maps image input type to image context for validation errors', () => {
        const error = 'Invalid input';
        const result = normalizeAppError(error, { 
          stage: 'validation',
          context: 'image' // This simulates what useRecipeSubmission now passes
        });
        
        expect(result.code).toBe('SUBMISSION_VALIDATION');
        expect(result.title).toBe('Submission Error');
        expect(result.message).toContain("Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions.");
        expect(result.severity).toBe('warn'); // Validation errors are warnings, not errors
        expect(result.retryable).toBe(false); // User needs to fix input first
      });

      it('handles backend parsing failures as generation errors (not network errors)', () => {
        const error = 'Could not process the input provided';
        const result = normalizeAppError(error, { 
          stage: 'parsing',
          context: 'raw_text'
        });
        
        // Backend parsing failures should be classified as generation errors, not network errors
        expect(result.code).toBe('SUBMISSION_PARSING');
        expect(result.title).toBe('Submission Error');
        expect(result.message).toBe("We couldn't understand the recipe you pasted. Try adding more detail.");
        expect(result.severity).toBe('warn'); // Parsing errors are warnings
        expect(result.retryable).toBe(false); // User needs to fix input first
      });
    });
  });

  describe('normalizeAppError - Error normalization and classification', () => {
    describe('Permission errors', () => {
      it('handles camera permission errors with context', () => {
        const error = 'Camera permission denied';
        const result = normalizeAppError(error, { context: 'camera' });
        
        expect(result.code).toBe('PERMISSION_REQUIRED');
        expect(result.title).toBe('Permission Required');
        expect(result.message).toContain("We need permission to continue");
        expect(result.message).toContain("You can change this in Settings");
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
        expect(result.requiresPermission).toBe('camera');
      });

      it('handles photo permission errors with context', () => {
        const error = 'Photo access denied';
        const result = normalizeAppError(error, { context: 'photo' });
        
        expect(result.code).toBe('PERMISSION_REQUIRED');
        expect(result.title).toBe('Permission Required');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
        expect(result.requiresPermission).toBe('photos');
      });

      it('handles document permission errors with context', () => {
        const error = 'Document access denied';
        const result = normalizeAppError(error, { context: 'documents' });
        
        expect(result.code).toBe('PERMISSION_REQUIRED');
        expect(result.title).toBe('Permission Required');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
        expect(result.requiresPermission).toBe('documents');
      });

      it('handles permission errors by message content', () => {
        const error = 'User did not grant permission';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('PERMISSION_REQUIRED');
        expect(result.title).toBe('Permission Required');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
      });
    });

    describe('Authentication errors', () => {
      it('handles authentication required errors', () => {
        const error = 'User not logged in';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('AUTH_REQUIRED');
        expect(result.title).toBe('Authentication Required');
        expect(result.message).toContain("You need to be logged in to continue");
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
        expect(result.requiresLogin).toBe(true);
      });

      it('handles unauthorized errors', () => {
        const error = 'Unauthorized access';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('AUTH_REQUIRED');
        expect(result.title).toBe('Authentication Required');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
        expect(result.requiresLogin).toBe(true);
      });
    });

    describe('Network and HTTP errors', () => {
      it('handles network errors', () => {
        const error = 'Network request failed';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.title).toBe('Network Error');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(true);
      });

      it('handles HTTP 500 errors', () => {
        const error = 'Internal Server Error';
        const result = normalizeAppError(error, { statusCode: 500 });
        
        expect(result.code).toBe('HTTP_500');
        expect(result.title).toBe('Network Error');
        expect(result.severity).toBe('error');
        expect(result.retryable).toBe(true);
      });

      it('handles HTTP 400 errors', () => {
        const error = 'Bad Request';
        const result = normalizeAppError(error, { statusCode: 400 });
        
        expect(result.code).toBe('HTTP_400');
        expect(result.title).toBe('Network Error');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(true);
      });
    });

    describe('Submission stage errors', () => {
      it('handles validation stage errors', () => {
        const error = 'Invalid input';
        const result = normalizeAppError(error, { stage: 'validation' });
        
        expect(result.code).toBe('SUBMISSION_VALIDATION');
        expect(result.title).toBe('Submission Error');
        expect(result.message).toContain("That doesn't look like a valid recipe");
        expect(result.severity).toBe('warn'); // Validation errors are warnings
        expect(result.retryable).toBe(false); // User needs to fix input first
      });

      it('handles parsing stage errors', () => {
        const error = 'Parsing failed';
        const result = normalizeAppError(error, { stage: 'parsing' });
        
        expect(result.code).toBe('SUBMISSION_PARSING');
        expect(result.title).toBe('Submission Error');
        expect(result.severity).toBe('warn'); // Parsing errors are warnings
        expect(result.retryable).toBe(false); // User needs to fix input first
      });
    });

    describe('Parsing/input context errors', () => {
      it('handles URL context errors', () => {
        const error = 'Invalid URL';
        const result = normalizeAppError(error, { context: 'url' });
        
        expect(result.code).toBe('PARSING_ERROR');
        expect(result.title).toBe('Invalid Input');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false); // INVALID_INPUT is not retryable - user needs to fix input
        // Note: The actual message comes from getErrorMessage with undefined errorCode
        // which falls back to the default case
      });

      it('handles text context errors', () => {
        const error = 'Invalid text';
        const result = normalizeAppError(error, { context: 'text' });
        
        expect(result.code).toBe('PARSING_ERROR');
        expect(result.title).toBe('Invalid Input');
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false); // INVALID_INPUT is not retryable - user needs to fix input
        // Note: The actual message comes from getErrorMessage with undefined errorCode
        // which falls back to the default case
      });
    });

    describe('Mise recipe conflicts', () => {
      it('handles mise recipe already exists', () => {
        const error = 'Recipe already in mise en place';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('MISE_RECIPE_EXISTS');
        expect(result.title).toBe('Oops');
        expect(result.message).toBe(error);
        expect(result.severity).toBe('info');
        expect(result.retryable).toBe(false);
      });
    });

    describe('Validation errors', () => {
      it('handles limit exceeded errors', () => {
        const error = 'Too many ingredients';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.title).toBe('Validation Error');
        expect(result.message).toBe(error);
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
      });

      it('handles validation errors', () => {
        const error = 'Validation failed';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.title).toBe('Validation Error');
        expect(result.message).toBe(error);
        expect(result.severity).toBe('warn');
        expect(result.retryable).toBe(false);
      });
    });

    describe('Default fallback', () => {
      it('handles unknown errors', () => {
        const error = 'Some random error';
        const result = normalizeAppError(error);
        
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.title).toBe('Something Went Wrong');
        expect(result.message).toBe(error);
        expect(result.severity).toBe('error');
        expect(result.retryable).toBe(true);
      });
    });

    describe('Error message extraction', () => {
      it('extracts message from Error objects', () => {
        const error = new Error('Test error message');
        const result = normalizeAppError(error);
        
        expect(result.message).toBe('Test error message');
      });

      it('extracts message from string errors', () => {
        const error = 'String error message';
        const result = normalizeAppError(error);
        
        expect(result.message).toBe('String error message');
      });

      it('handles JSON stringified errors', () => {
        const error = JSON.stringify({ error: { message: 'JSON error message' } });
        const result = normalizeAppError(error);
        
        expect(result.message).toBe('JSON error message');
      });

      it('handles objects with message property', () => {
        const error = { message: 'Object error message' };
        const result = normalizeAppError(error);
        
        expect(result.message).toBe('Object error message');
      });

      it('handles null/undefined errors', () => {
        const result = normalizeAppError(null);
        
        expect(result.message).toBe('An unknown error occurred.');
      });
    });
  });
});
