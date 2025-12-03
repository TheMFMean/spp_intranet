import cron from 'node-cron';
import { query } from '../config/db.js';
import { sendStaffNotification } from './notificationService.js';

// Daily check for orders approaching 6-month grace period
// Runs every day at 9:00 AM
const scheduleGracePeriodAlerts = () => {
    cron.schedule('0 9 * * *', async () => {
        console.log('Running grace period check...');

        try {
            // Get orders approaching grace period (within 30 days) or already expired
            const result = await query(
                `SELECT 
                    so.id,
                    so.customer_name,
                    so.customer_phone,
                    so.customer_email,
                    so.received_date,
                    so.status,
                    so.deposit_amount,
                    so.remaining_balance,
                    (so.received_date + INTERVAL '6 months') as expiration_date,
                    EXTRACT(DAY FROM (so.received_date + INTERVAL '6 months') - CURRENT_DATE) as days_until_expiration
                FROM special_orders so
                WHERE so.received_date IS NOT NULL
                    AND so.status IN ('received', 'contacted')
                    AND (so.received_date + INTERVAL '6 months') <= (CURRENT_DATE + INTERVAL '30 days')
                ORDER BY (so.received_date + INTERVAL '6 months') ASC`
            );

            const orders = result.rows;

            if (orders.length === 0) {
                console.log('No orders approaching grace period expiration');
                return;
            }

            // Separate expired vs expiring soon
            const expiredOrders = orders.filter(o => o.days_until_expiration < 0);
            const expiringSoonOrders = orders.filter(o => o.days_until_expiration >= 0);

            console.log(`Grace Period Alert Summary:
  - Total orders flagged: ${orders.length}
  - Already expired: ${expiredOrders.length}
  - Expiring within 30 days: ${expiringSoonOrders.length}`);

            // Log details for each expired order
            if (expiredOrders.length > 0) {
                console.log('\n⚠️  EXPIRED ORDERS (past 6-month grace period):');
                expiredOrders.forEach(order => {
                    const daysOverdue = Math.abs(Math.floor(order.days_until_expiration));
                    console.log(`  - Order #${order.id}: ${order.customer_name} (${daysOverdue} days overdue)`);
                });
            }

            // Log details for orders expiring soon
            if (expiringSoonOrders.length > 0) {
                console.log('\n⏰ EXPIRING SOON (within 30 days):');
                expiringSoonOrders.forEach(order => {
                    const daysRemaining = Math.floor(order.days_until_expiration);
                    console.log(`  - Order #${order.id}: ${order.customer_name} (${daysRemaining} days remaining)`);
                });
            }

            // Send internal staff notification
            const notificationResult = await sendStaffNotification({
                expiredOrders,
                expiringSoonOrders,
                totalCount: orders.length
            });

            if (notificationResult.success) {
                console.log('✉️  Staff notification sent successfully');
            } else {
                console.warn('⚠️  Failed to send staff notification:', notificationResult.error);
            }

            // Flag orders in database for dashboard display
            if (orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                await query(
                    `UPDATE special_orders 
                    SET updated_at = NOW() 
                    WHERE id = ANY($1)`,
                    [orderIds]
                );
            }

            console.log('\n✅ Grace period check complete\n');

        } catch (error) {
            console.error('Error running grace period check:', error);
        }
    });

    console.log('Grace period scheduler initialized (runs daily at 9:00 AM)');
};

// Manual trigger function for testing
export const runGracePeriodCheck = async () => {
    console.log('Manually triggering grace period check...');

    try {
        const result = await query(
            `SELECT 
                so.id,
                so.customer_name,
                so.customer_phone,
                so.customer_email,
                so.received_date,
                so.status,
                so.deposit_amount,
                so.remaining_balance,
                (so.received_date + INTERVAL '6 months') as expiration_date,
                EXTRACT(DAY FROM (so.received_date + INTERVAL '6 months') - CURRENT_DATE) as days_until_expiration
            FROM special_orders so
            WHERE so.received_date IS NOT NULL
                AND so.status IN ('received', 'contacted')
                AND (so.received_date + INTERVAL '6 months') <= (CURRENT_DATE + INTERVAL '30 days')
            ORDER BY (so.received_date + INTERVAL '6 months') ASC`
        );

        const orders = result.rows;
        const expiredOrders = orders.filter(o => o.days_until_expiration < 0);
        const expiringSoonOrders = orders.filter(o => o.days_until_expiration >= 0);

        return {
            success: true,
            summary: {
                total: orders.length,
                expired: expiredOrders.length,
                expiring_soon: expiringSoonOrders.length
            },
            orders: orders.map(o => ({
                id: o.id,
                customer_name: o.customer_name,
                status: o.status,
                received_date: o.received_date,
                expiration_date: o.expiration_date,
                days_until_expiration: Math.floor(o.days_until_expiration),
                is_expired: o.days_until_expiration < 0,
                deposit_amount: o.deposit_amount,
                remaining_balance: o.remaining_balance
            }))
        };
    } catch (error) {
        console.error('Error running manual grace period check:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export default scheduleGracePeriodAlerts;
