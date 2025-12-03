import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/generate', async (req, res) => {
    try {
        const { client_name, client_email, items, notes } = req.body;

        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const result = await query(
            `INSERT INTO quotes 
       (client_name, client_email, items, total_amount, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6) 
       RETURNING *`,
            [client_name, client_email, JSON.stringify(items), total, notes, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT q.*, u.name as created_by_name
      FROM quotes q
      JOIN users u ON q.created_by = u.id
      ORDER BY q.created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/send', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE quotes 
       SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 
       RETURNING *`,
            [id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
