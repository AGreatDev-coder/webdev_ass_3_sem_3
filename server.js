require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Body parser middleware (accepts JSON and raw text JSON)
app.use(express.json({ type: '*/*' }));

// API routes
app.use('/api/products', productRoutes);

// Root health route
app.get('/', (req, res) => {
  res.json({ message: 'Inventory and Data Management API is running' });
});

// Centralized error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;

