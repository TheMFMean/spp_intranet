import express from 'express';
import vendorsRouter from './routes/vendors.js';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import ordersRoutes from './routes/orders.js';
import formsRoutes from './routes/forms.js';
import specialOrdersRoutes from './routes/special-orders.js';
import quotesRoutes from './routes/quotes.js';
import repairsRoutes from './routes/repairs.js';
import timecardFixesRoutes from './routes/timecard-fixes.js';
import usersRoutes from './routes/users.js';
import scheduleGracePeriodAlerts from './services/gracePeriodScheduler.js';
import incomingInventoryExport from "./routes/incomingInventoryExport.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/special-orders', specialOrdersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/repairs', repairsRoutes);
app.use('/api/timecard-fixes', timecardFixesRoutes);
app.use('/api/users', usersRoutes);
app.use("/", incomingInventoryExport);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize grace period scheduler
scheduleGracePeriodAlerts();

app.use('/api', vendorsRouter);
app.listen(PORT, () => {
    console.log(`Piercely.io backend running on port ${PORT}`);
});

