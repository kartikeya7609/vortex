import express from 'express';
import { requireAuth, requireProfileComplete, requireRole } from '../middleware/auth.js';
import {
  getPublishedCaseForParticipant,
  submitQuestionAnswer,
  unlockHint,
  getAllAdminCases,
  createAdminCase,
  updateAdminCase,
  togglePublishAdminCase,
  deleteAdminCase,
  getAdminClues,
  createAdminClue,
  updateAdminClue,
  deleteAdminClue,
  getAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  getAdminHints,
  createAdminHint,
  updateAdminHint,
  deleteAdminHint,
  getAdminAttempts,
} from '../services/detectiveService.js';
import { logAdminAudit } from '../services/store.js';

const router = express.Router();

/* ============================================================================
   PARTICIPANT ROUTES (GATED ON BACKEND QUALIFICATION & AUTH)
   ============================================================================ */

/**
 * @route   GET /api/v1/detective/case
 * @desc    Fetch published Detective Case & attempt state for participant
 * @access  Private (Profile Complete & Round 1 Qualified)
 */
router.get('/case', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({
        success: false,
        code: 'NO_TEAM',
        message: 'Round 2 access denied: You must be in a team to access the Detective Case.',
      });
    }

    const data = await getPublishedCaseForParticipant(req.user.teamId, req.user);
    if (!data.isEligible) {
      return res.status(403).json({
        success: false,
        code: data.code || 'UNQUALIFIED',
        message: data.reason || 'Round 2 access denied: Team is not qualified.',
      });
    }

    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch detective case: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/detective/submit-answer
 * @desc    Submit MCQ option for current question in Detective Case
 * @access  Private (Profile Complete & Round 1 Qualified)
 */
router.post('/submit-answer', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'No team associated.' });
    }

    const { questionId, selectedOptionIndex } = req.body;
    if (!questionId || selectedOptionIndex === undefined) {
      return res.status(400).json({ success: false, message: 'Question ID and selected option index are required.' });
    }

    const result = await submitQuestionAnswer(req.user.teamId, questionId, selectedOptionIndex, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/v1/detective/use-hint
 * @desc    Unlock a hint for current case (deducts penalty server-side)
 * @access  Private (Profile Complete & Round 1 Qualified)
 */
router.post('/use-hint', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'No team associated.' });
    }

    const { hintId } = req.body;
    if (!hintId) {
      return res.status(400).json({ success: false, message: 'Hint ID is required.' });
    }

    const result = await unlockHint(req.user.teamId, hintId, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

/* ============================================================================
   ADMIN MANAGEMENT ROUTES (RESTRICTED TO ADMINS & SUPER ADMINS)
   ============================================================================ */

const adminAuth = [requireAuth, requireRole('admin', 'super_admin')];

// Admin Case Management
router.get('/admin/cases', adminAuth, async (req, res) => {
  try {
    const cases = await getAllAdminCases();
    return res.status(200).json({ success: true, cases });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/cases', adminAuth, async (req, res) => {
  try {
    const { title, description, difficulty, timeLimitSeconds, maximumScore, status } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Case title is required.' });

    const newCase = await createAdminCase({
      title: title.trim(),
      description: (description || '').trim(),
      difficulty: difficulty || 'Medium',
      timeLimitSeconds: parseInt(timeLimitSeconds) || 1800,
      maximumScore: parseInt(maximumScore) || 500,
      status: status || 'DRAFT',
    });

    await logAdminAudit(req.user, 'CREATE_DETECTIVE_CASE', 'DetectiveCase', newCase._id, newCase.title, null, newCase, req);

    return res.status(201).json({ success: true, message: 'Detective Case created successfully.', case: newCase });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/cases/:id', adminAuth, async (req, res) => {
  try {
    const updated = await updateAdminCase(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Case not found.' });

    await logAdminAudit(req.user, 'UPDATE_DETECTIVE_CASE', 'DetectiveCase', req.params.id, updated.title, null, updated, req);

    return res.status(200).json({ success: true, message: 'Detective Case updated.', case: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/cases/:id/publish', adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'PUBLISHED' or 'UNPUBLISHED'
    const updated = await togglePublishAdminCase(req.params.id, status || 'PUBLISHED');
    if (!updated) return res.status(404).json({ success: false, message: 'Case not found.' });

    await logAdminAudit(req.user, 'TOGGLE_DETECTIVE_CASE_PUBLISH', 'DetectiveCase', req.params.id, updated.title, null, { status: updated.status }, req);

    return res.status(200).json({ success: true, message: `Detective Case is now ${updated.status}.`, case: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/cases/:id', adminAuth, async (req, res) => {
  try {
    await deleteAdminCase(req.params.id);
    await logAdminAudit(req.user, 'DELETE_DETECTIVE_CASE', 'DetectiveCase', req.params.id, 'Detective Case', null, null, req);
    return res.status(200).json({ success: true, message: 'Detective Case deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Clue Management
router.get('/admin/cases/:id/clues', adminAuth, async (req, res) => {
  try {
    const clues = await getAdminClues(req.params.id);
    return res.status(200).json({ success: true, clues });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/cases/:id/clues', adminAuth, async (req, res) => {
  try {
    const { order, title, description, evidence, evidenceType, classification } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Clue title is required.' });

    const newClue = await createAdminClue({
      caseId: req.params.id,
      order: parseInt(order) || 1,
      title: title.trim(),
      description: (description || '').trim(),
      evidence: (evidence || '').trim(),
      evidenceType: evidenceType || 'text',
      classification: classification || 'supporting',
    });

    return res.status(201).json({ success: true, message: 'Clue added.', clue: newClue });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/clues/:id', adminAuth, async (req, res) => {
  try {
    const updated = await updateAdminClue(req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'Clue updated.', clue: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/clues/:id', adminAuth, async (req, res) => {
  try {
    await deleteAdminClue(req.params.id);
    return res.status(200).json({ success: true, message: 'Clue deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Question Management
router.get('/admin/cases/:id/questions', adminAuth, async (req, res) => {
  try {
    const questions = await getAdminQuestions(req.params.id);
    return res.status(200).json({ success: true, questions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/cases/:id/questions', adminAuth, async (req, res) => {
  try {
    const { order, question, options, correctAnswerIndex, points, clueId } = req.body;
    if (!question || !options || options.length < 2 || correctAnswerIndex === undefined) {
      return res.status(400).json({ success: false, message: 'Question, at least 2 options, and correct answer index are required.' });
    }

    const newQ = await createAdminQuestion({
      caseId: req.params.id,
      clueId: clueId || null,
      order: parseInt(order) || 1,
      question: question.trim(),
      options: Array.isArray(options) ? options.map((o) => String(o).trim()) : [],
      correctAnswerIndex: parseInt(correctAnswerIndex) || 0,
      points: parseInt(points) || 100,
    });

    return res.status(201).json({ success: true, message: 'Question added.', question: newQ });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/questions/:id', adminAuth, async (req, res) => {
  try {
    const updated = await updateAdminQuestion(req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'Question updated.', question: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/questions/:id', adminAuth, async (req, res) => {
  try {
    await deleteAdminQuestion(req.params.id);
    return res.status(200).json({ success: true, message: 'Question deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Hint Management
router.get('/admin/cases/:id/hints', adminAuth, async (req, res) => {
  try {
    const hints = await getAdminHints(req.params.id);
    return res.status(200).json({ success: true, hints });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/cases/:id/hints', adminAuth, async (req, res) => {
  try {
    const { questionId, order, hintText, penalty, enabled } = req.body;
    if (!hintText) return res.status(400).json({ success: false, message: 'Hint text is required.' });

    const newHint = await createAdminHint({
      caseId: req.params.id,
      questionId: questionId || null,
      order: parseInt(order) || 1,
      hintText: hintText.trim(),
      penalty: parseInt(penalty) || 20,
      enabled: enabled !== false,
    });

    return res.status(201).json({ success: true, message: 'Hint added.', hint: newHint });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/hints/:id', adminAuth, async (req, res) => {
  try {
    const updated = await updateAdminHint(req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'Hint updated.', hint: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/hints/:id', adminAuth, async (req, res) => {
  try {
    await deleteAdminHint(req.params.id);
    return res.status(200).json({ success: true, message: 'Hint deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Participant Attempts & Results
router.get('/admin/attempts', adminAuth, async (req, res) => {
  try {
    const attempts = await getAdminAttempts();
    return res.status(200).json({ success: true, attempts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
