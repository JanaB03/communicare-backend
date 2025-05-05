// server.js
require('dotenv').config(); // Load environment variables
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// Import routes (we'll create these files next)
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const locationRoutes = require('./src/routes/locations');
const chatRoutes = require('./src/routes/chats');

const app = express();
const port = process.env.PORT || 5000; // Using 5000 instead of 3000 to avoid conflicts with React

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/communicare')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/chats', chatRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("CommuniCare API is running");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});