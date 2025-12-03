import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT * FROM inventory 
      ORDER BY category, name
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/low-stock', async (req, res) => {
    try {
        const result = await query(`
      SELECT * FROM inventory 
      WHERE quantity <= reorder_level
      ORDER BY quantity ASC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { barcode, name, category, quantity, reorder_level, unit_cost, vendor } = req.body;

        const result = await query(
            `INSERT INTO inventory (barcode, name, category, quantity, reorder_level, unit_cost, vendor)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [barcode, name, category, quantity, reorder_level, unit_cost, vendor]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, reorder_level, unit_cost } = req.body;

        const result = await query(
            `UPDATE inventory SET quantity = $1, reorder_level = $2, unit_cost = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
            [quantity, reorder_level, unit_cost, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
