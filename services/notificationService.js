import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// SMS configuration (Twilio)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
}

/**
 * Render email template for order arrival notification
 */
const renderEmailTemplate = (order) => {
    const itemsList = order.items
        .map(item => `- ${item.quantity}x ${item.item_name} from ${item.company_vendor}`)
        .join('\n');

    return {
        subject: 'Your Special Order Has Arrived - Soda Pop Piercing',
        text: `
Hello ${order.customer_name},

Great news! Your special order has arrived at Soda Pop Piercing.

Order Details:
${itemsList}

Order Total: $${parseFloat(order.total_amount).toFixed(2)}
Deposit Paid: $${parseFloat(order.deposit_amount).toFixed(2)}
Balance Due: $${parseFloat(order.remaining_balance).toFixed(2)}

Please come by the shop at your earliest convenience to pick up your order and complete payment.

Important: Orders are held for 6 months from arrival. After that time, unclaimed items will be returned to stock and your deposit can be applied to future orders.

Thank you for your business!

Soda Pop Piercing
        `.trim(),
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .order-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4a90e2; }
        .item { margin: 5px 0; }
        .financial { margin: 15px 0; }
        .financial-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .balance-due { font-weight: bold; font-size: 1.1em; color: #e74c3c; }
        .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Special Order Has Arrived!</h1>
        </div>
        <div class="content">
            <p>Hello ${order.customer_name},</p>
            <p>Great news! Your special order has arrived at Soda Pop Piercing.</p>
            
            <div class="order-details">
                <h3>Order Details:</h3>
                ${order.items.map(item => `
                    <div class="item">• ${item.quantity}x ${item.item_name} from ${item.company_vendor}</div>
                `).join('')}
            </div>
            
            <div class="financial">
                <div class="financial-row">
                    <span>Order Total:</span>
                    <span>$${parseFloat(order.total_amount).toFixed(2)}</span>
                </div>
                <div class="financial-row">
                    <span>Deposit Paid:</span>
                    <span>$${parseFloat(order.deposit_amount).toFixed(2)}</span>
                </div>
                <div class="financial-row balance-due">
                    <span>Balance Due:</span>
                    <span>$${parseFloat(order.remaining_balance).toFixed(2)}</span>
                </div>
            </div>
            
            <p>Please come by the shop at your earliest convenience to pick up your order and complete payment.</p>
            
            <div class="warning">
                <strong>Important:</strong> Orders are held for 6 months from arrival. After that time, unclaimed items will be returned to stock and your deposit can be applied to future orders.
            </div>
        </div>
        <div class="footer">
            <p>Thank you for your business!</p>
            <p><strong>Soda Pop Piercing</strong></p>
        </div>
    </div>
</body>
</html>
        `.trim()
    };
};

/**
 * Render SMS template for order arrival notification
 */
const renderSMSTemplate = (order) => {
    const balance = parseFloat(order.remaining_balance).toFixed(2);
    return `Soda Pop Piercing: Your special order has arrived! Balance due: $${balance}. Please come by to pick up. Orders held for 6 months.`;
};

/**
 * Send email notification
 */
export const sendEmailNotification = async (order) => {
    try {
        if (!order.customer_email) {
            throw new Error('No email address provided');
        }

        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('Email service not configured. Skipping email notification.');
            return {
                success: false,
                method: 'email',
                error: 'Email service not configured'
            };
        }

        const template = renderEmailTemplate(order);

        const mailOptions = {
            from: `"Soda Pop Piercing" <${process.env.SMTP_USER}>`,
            to: order.customer_email,
            subject: template.subject,
            text: template.text,
            html: template.html
        };

        const info = await emailTransporter.sendMail(mailOptions);

        console.log('Email sent successfully:', info.messageId);

        return {
            success: true,
            method: 'email',
            messageId: info.messageId,
            recipient: order.customer_email
        };
    } catch (error) {
        console.error('Error sending email:', error);
        return {
            success: false,
            method: 'email',
            error: error.message
        };
    }
};

/**
 * Send SMS notification
 */
export const sendSMSNotification = async (order) => {
    try {
        if (!order.customer_phone) {
            throw new Error('No phone number provided');
        }

        if (!twilioClient) {
            console.warn('SMS service not configured. Skipping SMS notification.');
            return {
                success: false,
                method: 'sms',
                error: 'SMS service not configured'
            };
        }

        const message = renderSMSTemplate(order);

        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: order.customer_phone
        });

        console.log('SMS sent successfully:', result.sid);

        return {
            success: true,
            method: 'sms',
            messageId: result.sid,
            recipient: order.customer_phone
        };
    } catch (error) {
        console.error('Error sending SMS:', error);
        return {
            success: false,
            method: 'sms',
            error: error.message
        };
    }
};

/**
 * Send notification via all available channels
 */
export const sendNotification = async (order) => {
    const results = {
        email: null,
        sms: null,
        success: false,
        methods: []
    };

    // Send email if email is provided
    if (order.customer_email) {
        results.email = await sendEmailNotification(order);
        if (results.email.success) {
            results.methods.push('email');
        }
    }

    // Send SMS if phone is provided
    if (order.customer_phone) {
        results.sms = await sendSMSNotification(order);
        if (results.sms.success) {
            results.methods.push('sms');
        }
    }

    // Consider overall success if at least one method succeeded
    results.success = results.methods.length > 0;

    return results;
};

/**
 * Send internal staff notification for grace period alerts
 */
export const sendStaffNotification = async ({ expiredOrders, expiringSoonOrders, totalCount }) => {
    try {
        if (!process.env.STAFF_NOTIFICATION_EMAIL) {
            console.warn('STAFF_NOTIFICATION_EMAIL not configured. Skipping staff notification.');
            return {
                success: false,
                error: 'Staff notification email not configured'
            };
        }

        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('Email service not configured. Skipping staff notification.');
            return {
                success: false,
                error: 'Email service not configured'
            };
        }

        // Build email content
        const subject = `Grace Period Alert: ${totalCount} Special Order${totalCount !== 1 ? 's' : ''} Require Attention`;

        let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
        .header.warning { background-color: #f39c12; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .section { margin: 20px 0; }
        .section-title { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; color: #2c3e50; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; background-color: white; }
        th { background-color: #34495e; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
        .expired { color: #e74c3c; font-weight: bold; }
        .expiring { color: #f39c12; font-weight: bold; }
        .summary { background-color: #ecf0f1; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
        .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
        .action-button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header ${expiredOrders.length > 0 ? '' : 'warning'}">
            <h1>⚠️ Grace Period Alert</h1>
            <p>${totalCount} Special Order${totalCount !== 1 ? 's' : ''} Require${totalCount === 1 ? 's' : ''} Attention</p>
        </div>
        <div class="content">
            <div class="summary">
                <strong>Summary:</strong><br>
                • Total orders flagged: ${totalCount}<br>
                • Already expired: ${expiredOrders.length}<br>
                • Expiring within 30 days: ${expiringSoonOrders.length}
            </div>`;

        // Add expired orders section
        if (expiredOrders.length > 0) {
            htmlContent += `
            <div class="section">
                <div class="section-title expired">🚨 EXPIRED ORDERS (Past 6-Month Grace Period)</div>
                <table>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Received Date</th>
                            <th>Days Overdue</th>
                            <th>Deposit</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>`;

            expiredOrders.forEach(order => {
                const daysOverdue = Math.abs(Math.floor(order.days_until_expiration));
                htmlContent += `
                        <tr>
                            <td>${order.id}</td>
                            <td>${order.customer_name}</td>
                            <td>${order.customer_phone}</td>
                            <td>${new Date(order.received_date).toLocaleDateString()}</td>
                            <td class="expired">${daysOverdue} days</td>
                            <td>$${parseFloat(order.deposit_amount).toFixed(2)}</td>
                            <td>$${parseFloat(order.remaining_balance).toFixed(2)}</td>
                        </tr>`;
            });

            htmlContent += `
                    </tbody>
                </table>
                <p><strong>Action Required:</strong> Contact customers immediately or mark orders as abandoned to return items to stock.</p>
            </div>`;
        }

        // Add expiring soon section
        if (expiringSoonOrders.length > 0) {
            htmlContent += `
            <div class="section">
                <div class="section-title expiring">⏰ EXPIRING SOON (Within 30 Days)</div>
                <table>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Received Date</th>
                            <th>Days Remaining</th>
                            <th>Deposit</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>`;

            expiringSoonOrders.forEach(order => {
                const daysRemaining = Math.floor(order.days_until_expiration);
                htmlContent += `
                        <tr>
                            <td>${order.id}</td>
                            <td>${order.customer_name}</td>
                            <td>${order.customer_phone}</td>
                            <td>${new Date(order.received_date).toLocaleDateString()}</td>
                            <td class="expiring">${daysRemaining} days</td>
                            <td>$${parseFloat(order.deposit_amount).toFixed(2)}</td>
                            <td>$${parseFloat(order.remaining_balance).toFixed(2)}</td>
                        </tr>`;
            });

            htmlContent += `
                    </tbody>
                </table>
                <p><strong>Recommended Action:</strong> Follow up with customers to schedule pickup.</p>
            </div>`;
        }

        htmlContent += `
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/special-orders?filter=grace-period" class="action-button">
                    View All Grace Period Orders
                </a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated alert from the Special Orders Management System.</p>
            <p><strong>Soda Pop Piercing</strong></p>
        </div>
    </div>
</body>
</html>`;

        // Build plain text version
        let textContent = `GRACE PERIOD ALERT - ${totalCount} Special Order${totalCount !== 1 ? 's' : ''} Require Attention\n\n`;
        textContent += `Summary:\n`;
        textContent += `- Total orders flagged: ${totalCount}\n`;
        textContent += `- Already expired: ${expiredOrders.length}\n`;
        textContent += `- Expiring within 30 days: ${expiringSoonOrders.length}\n\n`;

        if (expiredOrders.length > 0) {
            textContent += `EXPIRED ORDERS (Past 6-Month Grace Period):\n`;
            textContent += `${'='.repeat(80)}\n`;
            expiredOrders.forEach(order => {
                const daysOverdue = Math.abs(Math.floor(order.days_until_expiration));
                textContent += `Order #${order.id}: ${order.customer_name} (${order.customer_phone})\n`;
                textContent += `  Received: ${new Date(order.received_date).toLocaleDateString()}\n`;
                textContent += `  Days Overdue: ${daysOverdue}\n`;
                textContent += `  Deposit: $${parseFloat(order.deposit_amount).toFixed(2)} | Balance: $${parseFloat(order.remaining_balance).toFixed(2)}\n\n`;
            });
            textContent += `Action Required: Contact customers immediately or mark orders as abandoned.\n\n`;
        }

        if (expiringSoonOrders.length > 0) {
            textContent += `EXPIRING SOON (Within 30 Days):\n`;
            textContent += `${'='.repeat(80)}\n`;
            expiringSoonOrders.forEach(order => {
                const daysRemaining = Math.floor(order.days_until_expiration);
                textContent += `Order #${order.id}: ${order.customer_name} (${order.customer_phone})\n`;
                textContent += `  Received: ${new Date(order.received_date).toLocaleDateString()}\n`;
                textContent += `  Days Remaining: ${daysRemaining}\n`;
                textContent += `  Deposit: $${parseFloat(order.deposit_amount).toFixed(2)} | Balance: $${parseFloat(order.remaining_balance).toFixed(2)}\n\n`;
            });
            textContent += `Recommended Action: Follow up with customers to schedule pickup.\n\n`;
        }

        textContent += `View all grace period orders: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/special-orders?filter=grace-period\n\n`;
        textContent += `---\nThis is an automated alert from the Special Orders Management System.\nSoda Pop Piercing`;

        // Send email
        const mailOptions = {
            from: `"Special Orders System" <${process.env.SMTP_USER}>`,
            to: process.env.STAFF_NOTIFICATION_EMAIL,
            subject: subject,
            text: textContent,
            html: htmlContent
        };

        const info = await emailTransporter.sendMail(mailOptions);

        console.log('Staff notification email sent:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            recipient: process.env.STAFF_NOTIFICATION_EMAIL
        };
    } catch (error) {
        console.error('Error sending staff notification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export default {
    sendEmailNotification,
    sendSMSNotification,
    sendNotification,
    sendStaffNotification
};
