// NOTE: Install multer and its types: npm install multer @types/multer
import multer from 'multer';
import logger from './logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/gif',
  'application/pdf'
];

// Configure multer for in-memory storage
const storage = multer.memoryStorage();

// File filter to validate image types
const fileFilter = (req: any, file: any, cb: (error: Error | null, acceptFile?: boolean) => void) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn({ 
      mimetype: file.mimetype, 
      originalname: file.originalname,
      allowedTypes: ALLOWED_MIME_TYPES 
    }, 'Rejected file upload: unsupported mime type');
    cb(new Error('Only JPEG, PNG, WebP, GIF images and PDF files are allowed'));
  }
};

// Configure multer for single file upload
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only allow single file upload
  }
});

// Configure multer for multiple file uploads
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10 // Allow up to 10 files
  }
}); 