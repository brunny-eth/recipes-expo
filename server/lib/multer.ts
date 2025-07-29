// NOTE: Install multer and its types: npm install multer @types/multer
import multer from 'multer';
import logger from './logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/gif'
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
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
};

// Configure multer with storage, file filter, and size limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only allow single file upload
  }
}); 