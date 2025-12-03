import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/submit', async (req, res) => {
    try {
        const { form_type, form_data, signature } = req.body;

        const result = await query(
            `INSERT INTO form_submissions (form_type, form_data, signature, submitted_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [form_type, JSON.stringify(form_data), signature, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        let sql = `
      SELECT fs.*, u.name as submitted_by_name 
      FROM form_submissions fs
      JOIN users u ON fs.submitted_by = u.id
    `;
        const params = [];

        if (type) {
            sql += ' WHERE fs.form_type = $1';
            params.push(type);
        }

        sql += ' ORDER BY fs.created_at DESC';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
