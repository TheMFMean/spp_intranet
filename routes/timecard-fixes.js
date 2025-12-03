import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT tf.*, u.name as employee_name
      FROM timecard_fixes tf
      JOIN users u ON tf.employee_id = u.id
      ORDER BY tf.created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { employee_id, date, original_hours, corrected_hours, reason } = req.body;

        const result = await query(
            `INSERT INTO timecard_fixes 
       (employee_id, date, original_hours, corrected_hours, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') 
       RETURNING *`,
            [employee_id, date, original_hours, corrected_hours, reason]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/approve', authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE timecard_fixes 
       SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2 
       RETURNING *`,
            [req.user.id, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
