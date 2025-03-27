require('dotenv').config();
const express = require('express');
const travelRoutes = require('./routes/travel');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/api/travel', travelRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Travel Companion running on port ${PORT}`);
});

module.exports = app;