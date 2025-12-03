import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { sendNotification } from '../services/notificationService.js';

const router = express.Router();

router.use(authenticate);

// Validation middleware
const validatePhoneNumber = (phone) => {
    const phoneRegex = /^(\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4})$/;
    return phoneRegex.test(phone);
};

// Status transition validation middleware
const VALID_STATUSES = ['pending', 'ordered', 'received', 'contacted', 'completed', 'cancelled', 'abandoned'];

const ALLOWED_TRANSITIONS = {
    'pending': ['ordered', 'cancelled'],
    'ordered': ['received', 'cancelled'],
    'received': ['contacted', 'abandoned'],
    'contacted': ['completed', 'abandoned'],
    'completed': [],
    'cancelled': [],
    'abandoned': []
};

const validateStatusTransition = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status: newStatus } = req.body;

        // Validate new status is valid
        if (!VALID_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
                code: 'INVALID_STATUS'
            });
        }

        // Get current order
        const orderResult = await query(
            'SELECT * FROM special_orders WHERE id = $1',
            [id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        const order = orderResult.rows[0];
        const currentStatus = order.status;

        // Check if transition is allowed
        if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
            return res.status(400).json({
                error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${ALLOWED_TRANSITIONS[currentStatus].join(', ') || 'none'}`,
                code: 'INVALID_TRANSITION',
                details: {
                    currentStatus,
                    requestedStatus: newStatus,
                    allowedTransitions: ALLOWED_TRANSITIONS[currentStatus]
                }
            });
        }

        // Prevent completion if remaining balance > 0
        if (newStatus === 'completed' && order.remaining_balance > 0) {
            return res.status(400).json({
                error: 'Cannot complete order with outstanding balance',
                code: 'BALANCE_DUE',
                details: {
                    remainingBalance: order.remaining_balance
                }
            });
        }

        // Store order in request for use in route handler
        req.order = order;
        next();
    } catch (error) {
        console.error('Error validating status transition:', error);
        res.status(500).json({
            error: 'Failed to validate status transition',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
};

// POST /api/special-orders - Create new special order
router.post('/', [
    body('customer_name').trim().notEmpty().withMessage('Customer name is required'),
    body('customer_phone').trim().notEmpty().withMessage('Customer phone is required')
        .custom(validatePhoneNumber).withMessage('Invalid phone number format'),
    body('customer_email').optional().isEmail().withMessage('Invalid email format'),
    body('items').isArray({ min: 1 }).withMessage('At least one order item is required'),
    body('items.*.company_vendor').trim().notEmpty().withMessage('Company/vendor is required for each item'),
    body('items.*.item_name').trim().notEmpty().withMessage('Item name is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('total_amount').isFloat({ min: 0 }).withMessage('Total amount must be greater than or equal to zero'),
    body('deposit_amount').isFloat({ min: 0 }).withMessage('Deposit amount must be greater than or equal to zero'),
    body('deposit_amount').custom((value, { req }) => {
        if (parseFloat(value) > parseFloat(req.body.total_amount)) {
            throw new Error('Deposit cannot exceed total amount');
        }
        return true;
    }),
    body('terms_agreed').equals('true').withMessage('Terms must be agreed to'),
    body('signature_data').notEmpty().withMessage('Signature is required')
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
            customer_name,
            customer_phone,
            customer_email,
            shipping_address,
            items,
            total_amount,
            deposit_amount,
            deposit_payment_method,
            signature_data,
            signature_date,
            notes
        } = req.body;

        // Start transaction
        const client = await query('BEGIN');

        try {
            // Insert order
            const orderResult = await query(
                `INSERT INTO special_orders 
                (customer_name, customer_phone, customer_email, shipping_address,
                 order_taken_date, order_taken_by, total_amount, deposit_amount,
                 deposit_payment_method, terms_agreed, signature_data, signature_date,
                 notes, status, created_by)
                VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, true, $9, $10, $11, 'pending', $5)
                RETURNING *`,
                [customer_name, customer_phone, customer_email, shipping_address,
                    req.user.id, total_amount, deposit_amount, deposit_payment_method,
                    signature_data, signature_date || new Date().toISOString().split('T')[0], notes]
            );

            const orderId = orderResult.rows[0].id;

            // Insert order items
            const itemPromises = items.map(item => {
                return query(
                    `INSERT INTO special_order_items
                    (special_order_id, company_vendor, item_name, quantity, description,
                     spec_piece, spec_material, spec_gauge, spec_length, spec_diameter,
                     spec_gem, spec_threaded_threadless, spec_sf_di, spec_ring_orientation,
                     spec_jump_ring_size, spec_details, unit_price)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    RETURNING *`,
                    [orderId, item.company_vendor, item.item_name, item.quantity, item.description || null,
                        item.spec_piece || false, item.spec_material || false, item.spec_gauge || false,
                        item.spec_length || false, item.spec_diameter || false, item.spec_gem || false,
                        item.spec_threaded_threadless || false, item.spec_sf_di || false,
                        item.spec_ring_orientation || false, item.spec_jump_ring_size || false,
                        item.spec_details ? JSON.stringify(item.spec_details) : null,
                        item.unit_price || null]
                );
            });

            const itemResults = await Promise.all(itemPromises);

            await query('COMMIT');

            // Return created order with items
            const createdOrder = {
                ...orderResult.rows[0],
                items: itemResults.map(r => r.rows[0])
            };

            res.status(201).json(createdOrder);
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating special order:', error);
        res.status(500).json({
            error: 'Failed to create special order',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders - List all orders with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            vendor,
            search,
            date_from,
            date_to
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Filter by status
        if (status) {
            whereConditions.push(`so.status = $${paramIndex}`);
            queryParams.push(status);
            paramIndex++;
        }

        // Filter by vendor
        if (vendor) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM special_order_items soi 
                WHERE soi.special_order_id = so.id 
                AND soi.company_vendor ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${vendor}%`);
            paramIndex++;
        }

        // Search by customer name or phone
        if (search) {
            whereConditions.push(`(
                so.customer_name ILIKE $${paramIndex} OR 
                so.customer_phone ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        // Filter by date range
        if (date_from) {
            whereConditions.push(`so.order_taken_date >= $${paramIndex}`);
            queryParams.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            whereConditions.push(`so.order_taken_date <= $${paramIndex}`);
            queryParams.push(date_to);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM special_orders so ${whereClause}`,
            queryParams
        );
        const totalCount = parseInt(countResult.rows[0].count);

        // Get orders with staff member names
        queryParams.push(parseInt(limit), offset);
        const ordersResult = await query(
            `SELECT 
                so.*,
                u_taken.name as order_taken_by_name,
                u_ordered.name as jewelry_ordered_by_name,
                u_received.name as received_by_name,
                u_contacted.name as contacted_by_name
            FROM special_orders so
            LEFT JOIN users u_taken ON so.order_taken_by = u_taken.id
            LEFT JOIN users u_ordered ON so.jewelry_ordered_by = u_ordered.id
            LEFT JOIN users u_received ON so.received_by = u_received.id
            LEFT JOIN users u_contacted ON so.contacted_by = u_contacted.id
            ${whereClause}
            ORDER BY so.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            queryParams
        );

        // Get items for each order
        const orderIds = ordersResult.rows.map(o => o.id);
        let itemsResult = { rows: [] };

        if (orderIds.length > 0) {
            itemsResult = await query(
                `SELECT * FROM special_order_items 
                WHERE special_order_id = ANY($1)
                ORDER BY id`,
                [orderIds]
            );
        }

        // Group items by order
        const itemsByOrder = {};
        itemsResult.rows.forEach(item => {
            if (!itemsByOrder[item.special_order_id]) {
                itemsByOrder[item.special_order_id] = [];
            }
            itemsByOrder[item.special_order_id].push(item);
        });

        // Attach items to orders
        const ordersWithItems = ordersResult.rows.map(order => ({
            ...order,
            items: itemsByOrder[order.id] || []
        }));

        res.json({
            orders: ordersWithItems,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching special orders:', error);
        res.status(500).json({
            error: 'Failed to fetch special orders',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders/:id - Get single order with all details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get order with staff member details
        const orderResult = await query(
            `SELECT 
                so.*,
                u_taken.id as order_taken_by_id,
                u_taken.name as order_taken_by_name,
                u_taken.email as order_taken_by_email,
                u_ordered.id as jewelry_ordered_by_id,
                u_ordered.name as jewelry_ordered_by_name,
                u_ordered.email as jewelry_ordered_by_email,
                u_received.id as received_by_id,
                u_received.name as received_by_name,
                u_received.email as received_by_email,
                u_contacted.id as contacted_by_id,
                u_contacted.name as contacted_by_name,
                u_contacted.email as contacted_by_email
            FROM special_orders so
            LEFT JOIN users u_taken ON so.order_taken_by = u_taken.id
            LEFT JOIN users u_ordered ON so.jewelry_ordered_by = u_ordered.id
            LEFT JOIN users u_received ON so.received_by = u_received.id
            LEFT JOIN users u_contacted ON so.contacted_by = u_contacted.id
            WHERE so.id = $1`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        // Get order items
        const itemsResult = await query(
            `SELECT * FROM special_order_items 
            WHERE special_order_id = $1
            ORDER BY id`,
            [id]
        );

        const order = {
            ...orderResult.rows[0],
            items: itemsResult.rows
        };

        res.json(order);
    } catch (error) {
        console.error('Error fetching special order:', error);
        res.status(500).json({
            error: 'Failed to fetch special order',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// PUT /api/special-orders/:id - Update order
router.put('/:id', [
    body('customer_name').optional().trim().notEmpty().withMessage('Customer name cannot be empty'),
    body('customer_phone').optional().trim().notEmpty().withMessage('Customer phone cannot be empty')
        .custom(validatePhoneNumber).withMessage('Invalid phone number format'),
    body('customer_email').optional().isEmail().withMessage('Invalid email format'),
    body('deposit_amount').optional().custom((value, { req }) => {
        if (req.body.total_amount && parseFloat(value) > parseFloat(req.body.total_amount)) {
            throw new Error('Deposit cannot exceed total amount');
        }
        return true;
    })
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
            customer_name,
            customer_phone,
            customer_email,
            shipping_address,
            total_amount,
            deposit_amount,
            deposit_payment_method,
            final_payment_method,
            notes
        } = req.body;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (customer_name !== undefined) {
            updates.push(`customer_name = $${paramIndex}`);
            values.push(customer_name);
            paramIndex++;
        }
        if (customer_phone !== undefined) {
            updates.push(`customer_phone = $${paramIndex}`);
            values.push(customer_phone);
            paramIndex++;
        }
        if (customer_email !== undefined) {
            updates.push(`customer_email = $${paramIndex}`);
            values.push(customer_email);
            paramIndex++;
        }
        if (shipping_address !== undefined) {
            updates.push(`shipping_address = $${paramIndex}`);
            values.push(shipping_address);
            paramIndex++;
        }
        if (total_amount !== undefined) {
            updates.push(`total_amount = $${paramIndex}`);
            values.push(total_amount);
            paramIndex++;
        }
        if (deposit_amount !== undefined) {
            updates.push(`deposit_amount = $${paramIndex}`);
            values.push(deposit_amount);
            paramIndex++;
        }
        if (deposit_payment_method !== undefined) {
            updates.push(`deposit_payment_method = $${paramIndex}`);
            values.push(deposit_payment_method);
            paramIndex++;
        }
        if (final_payment_method !== undefined) {
            updates.push(`final_payment_method = $${paramIndex}`);
            values.push(final_payment_method);
            paramIndex++;
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex}`);
            values.push(notes);
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
            `UPDATE special_orders 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating special order:', error);
        res.status(500).json({
            error: 'Failed to update special order',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// PATCH /api/special-orders/:id/status - Update order status
router.patch('/:id/status', [
    body('status').trim().notEmpty().withMessage('Status is required')
], validateStatusTransition, async (req, res) => {
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
        const { status: newStatus } = req.body;
        const order = req.order; // Set by validateStatusTransition middleware

        // Build update query based on status
        const updates = ['status = $1', 'updated_at = NOW()'];
        const values = [newStatus];
        let paramIndex = 2;

        // Auto-set date fields and staff based on status
        switch (newStatus) {
            case 'ordered':
                updates.push('jewelry_ordered_date = CURRENT_DATE');
                updates.push(`jewelry_ordered_by = $${paramIndex}`);
                values.push(req.user.id);
                paramIndex++;
                break;

            case 'received':
                updates.push('received_date = CURRENT_DATE');
                updates.push(`received_by = $${paramIndex}`);
                values.push(req.user.id);
                paramIndex++;
                updates.push(`grace_period_expires_date = CURRENT_DATE + INTERVAL '6 months'`);
                break;

            case 'contacted':
                updates.push('contacted_date = CURRENT_DATE');
                updates.push(`contacted_by = $${paramIndex}`);
                values.push(req.user.id);
                paramIndex++;
                break;

            case 'completed':
                updates.push('completed_date = CURRENT_DATE');
                break;
        }

        values.push(id);
        const result = await query(
            `UPDATE special_orders
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        const updatedOrder = result.rows[0];

        // If status is 'received', automatically notify customer
        if (newStatus === 'received') {
            // Load items for the notification template
            const itemsResult = await query(
                `SELECT * FROM special_order_items WHERE special_order_id = $1`,
                [id]
            );
            updatedOrder.items = itemsResult.rows;

            // If no contact info, don't error the status change – just report it
            if (!updatedOrder.customer_email && !updatedOrder.customer_phone) {
                return res.json({
                    message: 'Order marked as received, but no contact info available for notification',
                    order: updatedOrder,
                    notification: {
                        sent: false,
                        reason: 'NO_CONTACT_INFO'
                    }
                });
            }

            const notificationResult = await sendNotification(updatedOrder);

            if (notificationResult.success) {
                const notificationMethod = notificationResult.methods.join(', ');

                await query(
                    `UPDATE special_orders
                     SET notification_sent = true,
                         notification_sent_date = NOW(),
                         notification_method = $1,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [notificationMethod, id]
                );

                return res.json({
                    message: 'Order status updated to received and customer notified successfully',
                    order: updatedOrder,
                    notification: {
                        sent: true,
                        methods: notificationResult.methods,
                        details: {
                            email: notificationResult.email,
                            sms: notificationResult.sms
                        }
                    }
                });
            } else {
                const errors = [];
                if (notificationResult.email && !notificationResult.email.success) {
                    errors.push({ method: 'email', error: notificationResult.email.error });
                }
                if (notificationResult.sms && !notificationResult.sms.success) {
                    errors.push({ method: 'sms', error: notificationResult.sms.error });
                }

                return res.json({
                    message: 'Order marked as received, but notification failed',
                    order: updatedOrder,
                    notification: {
                        sent: false,
                        errors
                    }
                });
            }
        }

        // Default response for other statuses
        res.json({
            message: 'Order status updated successfully',
            order: updatedOrder
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            error: 'Failed to update order status',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// POST /api/special-orders/:id/items - Add item to order
router.post('/:id/items', [
    body('company_vendor').trim().notEmpty().withMessage('Company/vendor is required'),
    body('item_name').trim().notEmpty().withMessage('Item name is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
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
            company_vendor,
            item_name,
            quantity,
            description,
            spec_piece,
            spec_material,
            spec_gauge,
            spec_length,
            spec_diameter,
            spec_gem,
            spec_threaded_threadless,
            spec_sf_di,
            spec_ring_orientation,
            spec_jump_ring_size,
            spec_details,
            unit_price
        } = req.body;

        // Verify order exists
        const orderCheck = await query(
            'SELECT id FROM special_orders WHERE id = $1',
            [id]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Insert new item
            const itemResult = await query(
                `INSERT INTO special_order_items
                (special_order_id, company_vendor, item_name, quantity, description,
                 spec_piece, spec_material, spec_gauge, spec_length, spec_diameter,
                 spec_gem, spec_threaded_threadless, spec_sf_di, spec_ring_orientation,
                 spec_jump_ring_size, spec_details, unit_price)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *`,
                [
                    id,
                    company_vendor,
                    item_name,
                    quantity,
                    description || null,
                    spec_piece || false,
                    spec_material || false,
                    spec_gauge || false,
                    spec_length || false,
                    spec_diameter || false,
                    spec_gem || false,
                    spec_threaded_threadless || false,
                    spec_sf_di || false,
                    spec_ring_orientation || false,
                    spec_jump_ring_size || false,
                    spec_details ? JSON.stringify(spec_details) : null,
                    unit_price || null
                ]
            );

            // Recalculate order total_amount
            const totalResult = await query(
                `SELECT COALESCE(SUM(line_total), 0) as new_total
                FROM special_order_items
                WHERE special_order_id = $1`,
                [id]
            );

            const newTotal = totalResult.rows[0].new_total;

            // Update order total_amount
            await query(
                `UPDATE special_orders
                SET total_amount = $1, updated_at = NOW()
                WHERE id = $2`,
                [newTotal, id]
            );

            await query('COMMIT');

            res.status(201).json({
                message: 'Item added successfully',
                item: itemResult.rows[0],
                order_total: newTotal
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error adding item to order:', error);
        res.status(500).json({
            error: 'Failed to add item to order',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// PUT /api/special-orders/:id/items/:itemId - Update order item
router.put('/:id/items/:itemId', [
    body('company_vendor').optional().trim().notEmpty().withMessage('Company/vendor cannot be empty'),
    body('item_name').optional().trim().notEmpty().withMessage('Item name cannot be empty'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
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

        const { id, itemId } = req.params;
        const {
            company_vendor,
            item_name,
            quantity,
            description,
            spec_piece,
            spec_material,
            spec_gauge,
            spec_length,
            spec_diameter,
            spec_gem,
            spec_threaded_threadless,
            spec_sf_di,
            spec_ring_orientation,
            spec_jump_ring_size,
            spec_details,
            unit_price
        } = req.body;

        // Verify item exists and belongs to order
        const itemCheck = await query(
            'SELECT id FROM special_order_items WHERE id = $1 AND special_order_id = $2',
            [itemId, id]
        );

        if (itemCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Item not found',
                code: 'NOT_FOUND'
            });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (company_vendor !== undefined) {
            updates.push(`company_vendor = $${paramIndex}`);
            values.push(company_vendor);
            paramIndex++;
        }
        if (item_name !== undefined) {
            updates.push(`item_name = $${paramIndex}`);
            values.push(item_name);
            paramIndex++;
        }
        if (quantity !== undefined) {
            updates.push(`quantity = $${paramIndex}`);
            values.push(quantity);
            paramIndex++;
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex}`);
            values.push(description);
            paramIndex++;
        }
        if (spec_piece !== undefined) {
            updates.push(`spec_piece = $${paramIndex}`);
            values.push(spec_piece);
            paramIndex++;
        }
        if (spec_material !== undefined) {
            updates.push(`spec_material = $${paramIndex}`);
            values.push(spec_material);
            paramIndex++;
        }
        if (spec_gauge !== undefined) {
            updates.push(`spec_gauge = $${paramIndex}`);
            values.push(spec_gauge);
            paramIndex++;
        }
        if (spec_length !== undefined) {
            updates.push(`spec_length = $${paramIndex}`);
            values.push(spec_length);
            paramIndex++;
        }
        if (spec_diameter !== undefined) {
            updates.push(`spec_diameter = $${paramIndex}`);
            values.push(spec_diameter);
            paramIndex++;
        }
        if (spec_gem !== undefined) {
            updates.push(`spec_gem = $${paramIndex}`);
            values.push(spec_gem);
            paramIndex++;
        }
        if (spec_threaded_threadless !== undefined) {
            updates.push(`spec_threaded_threadless = $${paramIndex}`);
            values.push(spec_threaded_threadless);
            paramIndex++;
        }
        if (spec_sf_di !== undefined) {
            updates.push(`spec_sf_di = $${paramIndex}`);
            values.push(spec_sf_di);
            paramIndex++;
        }
        if (spec_ring_orientation !== undefined) {
            updates.push(`spec_ring_orientation = $${paramIndex}`);
            values.push(spec_ring_orientation);
            paramIndex++;
        }
        if (spec_jump_ring_size !== undefined) {
            updates.push(`spec_jump_ring_size = $${paramIndex}`);
            values.push(spec_jump_ring_size);
            paramIndex++;
        }
        if (spec_details !== undefined) {
            updates.push(`spec_details = $${paramIndex}`);
            values.push(spec_details ? JSON.stringify(spec_details) : null);
            paramIndex++;
        }
        if (unit_price !== undefined) {
            updates.push(`unit_price = $${paramIndex}`);
            values.push(unit_price);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No fields to update',
                code: 'VALIDATION_ERROR'
            });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Update item (line_total will be recalculated automatically by generated column)
            values.push(itemId);
            const itemResult = await query(
                `UPDATE special_order_items
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *`,
                values
            );

            // Recalculate order total_amount
            const totalResult = await query(
                `SELECT COALESCE(SUM(line_total), 0) as new_total
                FROM special_order_items
                WHERE special_order_id = $1`,
                [id]
            );

            const newTotal = totalResult.rows[0].new_total;

            // Update order total_amount
            await query(
                `UPDATE special_orders
                SET total_amount = $1, updated_at = NOW()
                WHERE id = $2`,
                [newTotal, id]
            );

            await query('COMMIT');

            res.json({
                message: 'Item updated successfully',
                item: itemResult.rows[0],
                order_total: newTotal
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({
            error: 'Failed to update item',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// DELETE /api/special-orders/:id/items/:itemId - Remove item from order
router.delete('/:id/items/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;

        // Verify item exists and belongs to order
        const itemCheck = await query(
            'SELECT id FROM special_order_items WHERE id = $1 AND special_order_id = $2',
            [itemId, id]
        );

        if (itemCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Item not found',
                code: 'NOT_FOUND'
            });
        }

        // Check if this is the only item
        const itemCountResult = await query(
            'SELECT COUNT(*) as count FROM special_order_items WHERE special_order_id = $1',
            [id]
        );

        const itemCount = parseInt(itemCountResult.rows[0].count);

        if (itemCount <= 1) {
            return res.status(400).json({
                error: 'Cannot delete the only item in the order',
                code: 'VALIDATION_ERROR',
                details: 'Order must have at least one item'
            });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Delete item
            await query(
                'DELETE FROM special_order_items WHERE id = $1',
                [itemId]
            );

            // Recalculate order total_amount
            const totalResult = await query(
                `SELECT COALESCE(SUM(line_total), 0) as new_total
                FROM special_order_items
                WHERE special_order_id = $1`,
                [id]
            );

            const newTotal = totalResult.rows[0].new_total;

            // Update order total_amount
            await query(
                `UPDATE special_orders
                SET total_amount = $1, updated_at = NOW()
                WHERE id = $2`,
                [newTotal, id]
            );

            await query('COMMIT');

            res.json({
                message: 'Item deleted successfully',
                order_total: newTotal
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({
            error: 'Failed to delete item',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// POST /api/special-orders/:id/notify - Send customer notification
router.post('/:id/notify', async (req, res) => {
    try {
        const { id } = req.params;

        // Get order with items
        const orderResult = await query(
            `SELECT * FROM special_orders WHERE id = $1`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        const order = orderResult.rows[0];

        // Get order items
        const itemsResult = await query(
            `SELECT * FROM special_order_items WHERE special_order_id = $1`,
            [id]
        );

        // Attach items to order for notification template
        order.items = itemsResult.rows;

        // Check if customer has email or phone
        if (!order.customer_email && !order.customer_phone) {
            return res.status(400).json({
                error: 'No contact information available',
                code: 'NO_CONTACT_INFO',
                details: 'Customer must have either email or phone number to send notification'
            });
        }

        // Send notification
        const notificationResult = await sendNotification(order);

        // Record notification in database if at least one method succeeded
        if (notificationResult.success) {
            const notificationMethod = notificationResult.methods.join(', ');

            await query(
                `UPDATE special_orders
                SET notification_sent = true,
                    notification_sent_date = NOW(),
                    notification_method = $1,
                    updated_at = NOW()
                WHERE id = $2`,
                [notificationMethod, id]
            );

            res.json({
                message: 'Notification sent successfully',
                methods: notificationResult.methods,
                details: {
                    email: notificationResult.email,
                    sms: notificationResult.sms
                }
            });
        } else {
            // Handle case where all notification methods failed
            const errors = [];
            if (notificationResult.email && !notificationResult.email.success) {
                errors.push({ method: 'email', error: notificationResult.email.error });
            }
            if (notificationResult.sms && !notificationResult.sms.success) {
                errors.push({ method: 'sms', error: notificationResult.sms.error });
            }

            res.status(500).json({
                error: 'Failed to send notification',
                code: 'NOTIFICATION_FAILED',
                details: errors
            });
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({
            error: 'Failed to send notification',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders/grace-period/expiring - Get orders approaching or past grace period
router.get('/grace-period/expiring', async (req, res) => {
    try {
        // Get orders where received_date + 6 months is within 30 days (or already past)
        // This includes orders that are approaching expiration and those already expired
        const ordersResult = await query(
            `SELECT 
                so.*,
                u_taken.name as order_taken_by_name,
                u_received.name as received_by_name,
                u_contacted.name as contacted_by_name,
                (so.received_date + INTERVAL '6 months') as expiration_date,
                EXTRACT(DAY FROM (so.received_date + INTERVAL '6 months') - CURRENT_DATE) as days_until_expiration
            FROM special_orders so
            LEFT JOIN users u_taken ON so.order_taken_by = u_taken.id
            LEFT JOIN users u_received ON so.received_by = u_received.id
            LEFT JOIN users u_contacted ON so.contacted_by = u_contacted.id
            WHERE so.received_date IS NOT NULL
                AND so.status IN ('received', 'contacted')
                AND (so.received_date + INTERVAL '6 months') <= (CURRENT_DATE + INTERVAL '30 days')
            ORDER BY (so.received_date + INTERVAL '6 months') ASC`
        );

        // Get items for each order
        const orderIds = ordersResult.rows.map(o => o.id);
        let itemsResult = { rows: [] };

        if (orderIds.length > 0) {
            itemsResult = await query(
                `SELECT * FROM special_order_items 
                WHERE special_order_id = ANY($1)
                ORDER BY special_order_id, id`,
                [orderIds]
            );
        }

        // Group items by order
        const itemsByOrder = {};
        itemsResult.rows.forEach(item => {
            if (!itemsByOrder[item.special_order_id]) {
                itemsByOrder[item.special_order_id] = [];
            }
            itemsByOrder[item.special_order_id].push(item);
        });

        // Attach items to orders and format response
        const ordersWithItems = ordersResult.rows.map(order => ({
            ...order,
            items: itemsByOrder[order.id] || [],
            days_until_expiration: Math.floor(order.days_until_expiration),
            is_expired: order.days_until_expiration < 0
        }));

        res.json({
            orders: ordersWithItems,
            summary: {
                total: ordersWithItems.length,
                expired: ordersWithItems.filter(o => o.is_expired).length,
                expiring_soon: ordersWithItems.filter(o => !o.is_expired).length
            }
        });
    } catch (error) {
        console.error('Error fetching grace period expiring orders:', error);
        res.status(500).json({
            error: 'Failed to fetch grace period expiring orders',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// PATCH /api/special-orders/:id/abandon - Mark order as abandoned (manager only)
router.patch('/:id/abandon', authorize('manager', 'admin'), [
    body('return_items_to_inventory').optional().isBoolean().withMessage('return_items_to_inventory must be a boolean'),
    body('notes').optional().isString().withMessage('notes must be a string')
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
        const { return_items_to_inventory = false, notes } = req.body;

        // Get current order
        const orderResult = await query(
            'SELECT * FROM special_orders WHERE id = $1',
            [id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Order not found',
                code: 'NOT_FOUND'
            });
        }

        const order = orderResult.rows[0];

        // Verify order is in a state that can be abandoned
        if (!['received', 'contacted'].includes(order.status)) {
            return res.status(400).json({
                error: 'Only orders in "received" or "contacted" status can be abandoned',
                code: 'INVALID_STATUS',
                details: {
                    currentStatus: order.status,
                    allowedStatuses: ['received', 'contacted']
                }
            });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Update order status to abandoned
            const updateNotes = notes || `Order abandoned after grace period. Deposit of $${order.deposit_amount} available for future credit.`;

            const updatedOrderResult = await query(
                `UPDATE special_orders
                SET status = 'abandoned',
                    notes = CASE 
                        WHEN notes IS NULL OR notes = '' THEN $1
                        ELSE notes || E'\n\n' || $1
                    END,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *`,
                [updateNotes, id]
            );

            // Get order items
            const itemsResult = await query(
                `SELECT * FROM special_order_items WHERE special_order_id = $1`,
                [id]
            );

            // If return_items_to_inventory is true, items would be flagged for inventory return
            // This is a placeholder for future inventory integration
            const itemsForInventory = return_items_to_inventory ? itemsResult.rows : [];

            await query('COMMIT');

            res.json({
                message: 'Order marked as abandoned successfully',
                order: updatedOrderResult.rows[0],
                deposit_available_for_credit: order.deposit_amount,
                items_flagged_for_inventory: itemsForInventory.length,
                items: itemsResult.rows
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error abandoning order:', error);
        res.status(500).json({
            error: 'Failed to abandon order',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

import { runGracePeriodCheck } from '../services/gracePeriodScheduler.js';
// (If not already imported)

router.post('/grace-period/check', authorize('manager', 'admin'), async (req, res) => {
    try {
        const result = await runGracePeriodCheck();
        res.json({
            message: 'Grace period check completed',
            ...result
        });
    } catch (error) {
        console.error('Error running grace period check:', error);
        res.status(500).json({
            error: 'Failed to run grace period check',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders/reports/dashboard - Dashboard metrics
router.get('/reports/dashboard', async (req, res) => {
    try {
        // Count orders by status
        const statusCountsResult = await query(
            `SELECT status, COUNT(*) as count
            FROM special_orders
            GROUP BY status
            ORDER BY status`
        );

        const ordersByStatus = {};
        statusCountsResult.rows.forEach(row => {
            ordersByStatus[row.status] = parseInt(row.count);
        });

        // Sum total deposits collected
        const depositsResult = await query(
            `SELECT COALESCE(SUM(deposit_amount), 0) as total_deposits
            FROM special_orders
            WHERE status NOT IN ('cancelled')`
        );
        const totalDeposits = parseFloat(depositsResult.rows[0].total_deposits);

        // Sum outstanding balances
        const balancesResult = await query(
            `SELECT COALESCE(SUM(remaining_balance), 0) as total_outstanding
            FROM special_orders
            WHERE status NOT IN ('completed', 'cancelled', 'abandoned')
            AND remaining_balance > 0`
        );
        const totalOutstanding = parseFloat(balancesResult.rows[0].total_outstanding);

        // Count grace period expiring orders (within 30 days or already expired)
        const gracePeriodResult = await query(
            `SELECT COUNT(*) as count
            FROM special_orders
            WHERE received_date IS NOT NULL
                AND status IN ('received', 'contacted')
                AND (received_date + INTERVAL '6 months') <= (CURRENT_DATE + INTERVAL '30 days')`
        );
        const gracePeriodExpiring = parseInt(gracePeriodResult.rows[0].count);

        res.json({
            ordersByStatus,
            totalDeposits,
            totalOutstanding,
            gracePeriodExpiring
        });
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard metrics',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders/reports/vendor-performance - Vendor performance metrics
router.get('/reports/vendor-performance', async (req, res) => {
    try {
        // Get vendor performance metrics
        const vendorPerformanceResult = await query(
            `SELECT 
                soi.company_vendor as vendor_name,
                COUNT(DISTINCT so.id) as order_count,
                AVG(
                    CASE 
                        WHEN so.jewelry_ordered_date IS NOT NULL AND so.received_date IS NOT NULL
                        THEN EXTRACT(DAY FROM (so.received_date - so.jewelry_ordered_date))
                        ELSE NULL
                    END
                ) as avg_fulfillment_days,
                COUNT(
                    CASE 
                        WHEN so.jewelry_ordered_date IS NOT NULL AND so.received_date IS NOT NULL
                        THEN 1
                        ELSE NULL
                    END
                ) as fulfilled_orders,
                COUNT(
                    CASE 
                        WHEN so.jewelry_ordered_date IS NOT NULL 
                        AND so.received_date IS NOT NULL
                        AND EXTRACT(DAY FROM (so.received_date - so.jewelry_ordered_date)) <= 30
                        THEN 1
                        ELSE NULL
                    END
                ) as on_time_orders
            FROM special_order_items soi
            JOIN special_orders so ON soi.special_order_id = so.id
            WHERE so.status NOT IN ('cancelled')
            GROUP BY soi.company_vendor
            ORDER BY order_count DESC, vendor_name ASC`
        );

        // Calculate on-time delivery percentage for each vendor
        const vendorPerformance = vendorPerformanceResult.rows.map(vendor => {
            const onTimePercentage = vendor.fulfilled_orders > 0
                ? (parseInt(vendor.on_time_orders) / parseInt(vendor.fulfilled_orders)) * 100
                : 0;

            return {
                vendor_name: vendor.vendor_name,
                order_count: parseInt(vendor.order_count),
                avg_fulfillment_days: vendor.avg_fulfillment_days
                    ? parseFloat(vendor.avg_fulfillment_days).toFixed(1)
                    : null,
                fulfilled_orders: parseInt(vendor.fulfilled_orders),
                on_time_orders: parseInt(vendor.on_time_orders),
                on_time_percentage: parseFloat(onTimePercentage.toFixed(1))
            };
        });

        res.json({
            vendors: vendorPerformance,
            summary: {
                total_vendors: vendorPerformance.length,
                total_orders: vendorPerformance.reduce((sum, v) => sum + v.order_count, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching vendor performance:', error);
        res.status(500).json({
            error: 'Failed to fetch vendor performance',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

// GET /api/special-orders/vendors - Get all vendors with search/filter
router.get('/vendors', async (req, res) => {
    try {
        const { search, active } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Filter by active status (default to true if not specified)
        if (active !== undefined) {
            whereConditions.push(`active = $${paramIndex}`);
            queryParams.push(active === 'true' || active === true);
            paramIndex++;
        } else {
            // Default to active vendors only
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

        // Get vendors sorted alphabetically
        const vendorsResult = await query(
            `SELECT * FROM vendors
            ${whereClause}
            ORDER BY name ASC`,
            queryParams
        );

        res.json({
            vendors: vendorsResult.rows,
            count: vendorsResult.rows.length
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({
            error: 'Failed to fetch vendors',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
});

export default router;

