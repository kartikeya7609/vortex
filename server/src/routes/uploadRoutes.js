import express from 'express';
import cloudinary from '../config/cloudinary.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/upload/image
 * @desc    Upload an image asset to Cloudinary (base64 string or remote image URL)
 * @access  Private
 */
router.post('/image', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { image, folder } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data (URL or base64 string) is required.' });
    }

    const uploadOptions = {
      folder: folder || 'aarohan_puzzles',
      resource_type: 'image',
    };

    const result = await cloudinary.uploader.upload(image, uploadOptions);

    console.log(`[Cloudinary] Image uploaded successfully: ${result.secure_url}`);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded to Cloudinary successfully.',
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error) {
    console.error('[Cloudinary Upload Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Cloudinary upload failed. Check the image and storage configuration.',
    });
  }
});

/**
 * @route   POST /api/v1/upload/signature
 * @desc    Generate signed parameters for direct frontend Cloudinary uploads
 * @access  Private
 */
router.post('/signature', requireAuth, requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = req.body.folder || 'aarohan_puzzles';

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      cloudinary.config().api_secret
    );

    return res.status(200).json({
      success: true,
      signature,
      timestamp,
      cloudName: cloudinary.config().cloud_name,
      apiKey: cloudinary.config().api_key,
      folder,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not create an upload signature.' });
  }
});

export default router;
