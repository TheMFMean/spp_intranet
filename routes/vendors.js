import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = Router();

// Apply authentication to all vendor routes
router.use(authenticate);

// GET /api/vendors - Return all active vendors with search/filter support
router.get('/vendors', async (req, res) => {
  try {
    const { search, active } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Filter by active status (default to true if not specified)
    if (active !== undefined) {
      whereConditions.push(`active = $${paramIndex}`);
      queryParams.push(active === 'true');
      paramIndex++;
    } else {
      // Default: only show active vendors
      whereConditions.push(`active = $${paramIndex}`);
      queryParams.push(true);
      paramIndex++;
    }

    // Search by vendor name
    if (search) {
      whereConditions.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const result = await query(
      `SELECT id, name, contact_name, email, phone, website, notes, active, created_at
       FROM vendors
       ${whereClause}
       ORDER BY name ASC`,
      queryParams
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      error: 'Failed to fetch vendors',
      code: 'SERVER_ERROR',
      details: error.message
    });
  }
});

// POST /api/vendors - Create new vendor
router.post('/vendors', [
  body('name').trim().notEmpty().withMessage('Vendor name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const {
      name,
      contact_name,
      email,
      phone,
      website,
      notes,
      active = true
    } = req.body;

    // Check if vendor name already exists
    const existingVendor = await query(
      'SELECT id FROM vendors WHERE name = $1',
      [name]
    );

    if (existingVendor.rows.length > 0) {
      return res.status(409).json({
        error: 'Vendor with this name already exists',
        code: 'DUPLICATE_VENDOR',
        field: 'name'
      });
    }

    // Insert new vendor
    const result = await query(
      `INSERT INTO vendors (name, contact_name, email, phone, website, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, contact_name || null, email || null, phone || null, website || null, notes || null, active]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      error: 'Failed to create vendor',
      code: 'SERVER_ERROR',
      details: error.message
    });
  }
});

// PUT /api/vendors/:id - Update vendor information
router.put('/vendors/:id', [
  body('name').optional().trim().notEmpty().withMessage('Vendor name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const {
      name,
      contact_name,
      email,
      phone,
      website,
      notes,
      active
    } = req.body;

    // Check if vendor exists
    const vendorCheck = await query(
      'SELECT id FROM vendors WHERE id = $1',
      [id]
    );

    if (vendorCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Vendor not found',
        code: 'NOT_FOUND'
      });
    }

    // If updating name, check for duplicates
    if (name !== undefined) {
      const duplicateCheck = await query(
        'SELECT id FROM vendors WHERE name = $1 AND id != $2',
        [name, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Vendor with this name already exists',
          code: 'DUPLICATE_VENDOR',
          field: 'name'
        });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (contact_name !== undefined) {
      updates.push(`contact_name = $${paramIndex}`);
      values.push(contact_name);
      paramIndex++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }
    if (website !== undefined) {
      updates.push(`website = $${paramIndex}`);
      values.push(website);
      paramIndex++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      values.push(active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
        code: 'VALIDATION_ERROR'
      });
    }

    values.push(id);
    const result = await query(
      `UPDATE vendors
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({
      error: 'Failed to update vendor',
      code: 'SERVER_ERROR',
      details: error.message
    });
  }
});

export default router;
