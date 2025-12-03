import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        let sql = 'SELECT * FROM orders';
        const params = [];

        if (type) {
            sql += ' WHERE order_type = $1';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { order_type, client_name, items, total_amount, notes, assigned_to } = req.body;

        const result = await query(
            `INSERT INTO orders (order_type, client_name, items, total_amount, notes, assigned_to, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
            [order_type, client_name, JSON.stringify(items), total_amount, notes, assigned_to, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
