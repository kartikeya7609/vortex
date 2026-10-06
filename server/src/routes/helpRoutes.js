import express from 'express';
import { getAllFAQs } from '../services/store.js';

const router = express.Router();

/**
 * @route   GET /api/v1/help
 * @desc    Fetch all active FAQs and support topics
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const faqs = await getAllFAQs();
    return res.status(200).json({ success: true, count: faqs.length, faqs });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch FAQs: ' + error.message });
  }
});

export default router;
