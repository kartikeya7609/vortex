import crypto from 'crypto';
import sharp from 'sharp';
import cloudinary from '../config/cloudinary.js';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PIECES = 64;

export const validateImagePayload = (mimeType, sizeBytes, rows = 3, cols = 3) => {
  const r = Number(rows);
  const c = Number(cols);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 2 || c < 2 || r > 8 || c > 8 || r * c > MAX_PIECES) {
    return { isValid: false, message: 'Rows and columns must be between 2 and 8, with at most 64 pieces.' };
  }
  if (mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(String(mimeType).toLowerCase())) {
    return { isValid: false, message: 'Unsupported image format. Upload a JPEG, PNG, or WebP image.' };
  }
  if (Number(sizeBytes) > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, message: 'Image size exceeds the 5 MB limit.' };
  }
  return { isValid: true };
};

const payloadToBuffer = async (payload) => {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload !== 'string' || !payload.trim()) throw new Error('Image data is required.');
  const dataUri = payload.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/i);
  const raw = dataUri ? dataUri[1] : payload;
  if (!/^[A-Za-z0-9+/]+=*$/.test(raw) || raw.length % 4 !== 0) throw new Error('Image must be supplied as a base64 encoded JPEG, PNG, or WebP file.');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) throw new Error('Invalid image data or image exceeds 5 MB.');
  return buffer;
};

// Compatibility helper for old puzzle seed/config paths; new puzzles use real crops below.
export const processGridSections = (imageUrl, gridRows = 3, gridCols = 3) =>
  Array.from({ length: gridRows * gridCols }, (_, originalIndex) => ({
    sectionIndex: originalIndex,
    row: Math.floor(originalIndex / gridCols),
    col: originalIndex % gridCols,
    imageUrl,
  }));

export const uploadAndProcessPuzzleImage = async (imagePayload, gridRows = 3, gridCols = 3) => {
  const rows = Number(gridRows);
  const cols = Number(gridCols);
  const valid = validateImagePayload('', 0, rows, cols);
  if (!valid.isValid) throw new Error(valid.message);

  const source = await payloadToBuffer(imagePayload);
  const metadata = await sharp(source, { failOn: 'error', limitInputPixels: 40000000 }).metadata();
  if (!ALLOWED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error('Unsupported or malformed image. Upload a JPEG, PNG, or WebP image.');
  }

  const puzzleCode = `PZL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const uploaded = [];
  try {
    let originalUrl = `data:image/${metadata.format};base64,${source.toString('base64')}`;
    let originalPublicId = `orig_${puzzleCode}`;
    try {
      const original = await cloudinary.uploader.upload(`data:image/${metadata.format};base64,${source.toString('base64')}`, {
        folder: 'aarohan_puzzles/originals', resource_type: 'image', format: 'jpg',
      });
      uploaded.push(original.public_id);
      originalUrl = original.secure_url;
      originalPublicId = original.public_id;
    } catch (origErr) {
      console.warn(`[Cloudinary Original Upload Warning]:`, origErr.message);
    }

    const cellWidth = Math.floor(metadata.width / cols);
    const cellHeight = Math.floor(metadata.height / rows);
    if (cellWidth < 1 || cellHeight < 1) throw new Error('Image dimensions are too small for the selected grid.');

    const pieceTasks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const originalIndex = row * cols + column;
        const left = column * cellWidth;
        const top = row * cellHeight;
        const width = column === cols - 1 ? metadata.width - left : cellWidth;
        const height = row === rows - 1 ? metadata.height - top : cellHeight;
        
        pieceTasks.push(async () => {
          const piece = await sharp(source).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
          const pieceId = `${puzzleCode}-P${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
          let secureUrl = `data:image/jpeg;base64,${piece.toString('base64')}`;
          let cPublicId = `fallback_${pieceId}`;

          try {
            const pieceUpload = await cloudinary.uploader.upload(`data:image/jpeg;base64,${piece.toString('base64')}`, {
              folder: `aarohan_puzzles/${puzzleCode}/pieces`,
              resource_type: 'image',
              public_id: pieceId,
              overwrite: false,
            });
            uploaded.push(pieceUpload.public_id);
            secureUrl = pieceUpload.secure_url;
            cPublicId = pieceUpload.public_id;
          } catch (cErr) {
            console.warn(`[Cloudinary Piece Upload Warning for ${pieceId}]:`, cErr.message);
          }

          return {
            pieceId,
            originalIndex,
            row,
            col: column,
            column,
            imageUrl: secureUrl,
            cloudinaryPublicId: cPublicId,
          };
        });
      }
    }

    const pieces = await Promise.all(pieceTasks.map((fn) => fn()));
    pieces.sort((a, b) => a.originalIndex - b.originalIndex);

    return {
      puzzleCode,
      originalUrl,
      originalPublicId,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      rows,
      columns: cols,
      pieces,
      correctOrder: pieces.map((piece) => piece.pieceId),
    };
  } catch (error) {
    if (uploaded.length) {
      await Promise.allSettled(uploaded.map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' })));
    }
    throw error;
  }
};
