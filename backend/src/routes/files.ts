import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { apiLogger } from '../utils/logger';
import { endpointRateLimiter } from '../middleware/rateLimiter';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

// Apply rate limiting to file endpoints
router.use(endpointRateLimiter('upload'));

/**
 * POST /upload
 * Upload a file attachment for chat
 */
router.post('/upload', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const file = req.file;
    const fileId = path.basename(file.filename, path.extname(file.filename));

    const attachment = {
      id: fileId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/api/v1/files/${fileId}`,
    };

    apiLogger.info('File uploaded:', { fileId, originalName: file.originalname, size: file.size });

    res.json({ success: true, data: attachment });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:fileId
 * Serve an uploaded file
 */
router.get('/:fileId', (req: Request, res: Response) => {
  const { fileId } = req.params;
  // Sanitize: only allow UUID-format characters (lowercase hex + hyphens)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(fileId)) {
    res.status(400).json({ success: false, error: 'Invalid file ID' });
    return;
  }

  // Look for the file with any extension
  const files = fs.readdirSync(UPLOADS_DIR);
  const match = files.find(f => f.startsWith(fileId));

  if (!match) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, match);
  res.sendFile(filePath);
});

export default router;
