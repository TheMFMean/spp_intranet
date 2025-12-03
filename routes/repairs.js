import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT r.*, u.name as created_by_name
      FROM repairs r
      JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            client_name, client_phone, item_type,
            issue_description, estimated_cost, notes, signature
        } = req.body;

        const result = await query(
            `INSERT INTO repairs 
       (client_name, client_phone, item_type, issue_description, 
        estimated_cost, notes, signature, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) 
       RETURNING *`,
            [client_name, client_phone, item_type, issue_description,
                estimated_cost, notes, signature, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const result = await query(
            `UPDATE repairs 
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
            [status, notes, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
