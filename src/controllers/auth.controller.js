const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client'
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, accessCode } = req.body;

    let user;

    // Handle staff login with email/password
    if (email && password) {
      user = await User.findOne({ email }).select('+password');
      
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    // Handle client login with access code
    else if (accessCode) {
      user = await User.findOne({ accessCode });
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid access code' });
      }
    }
    else {
      return res.status(400).json({ message: 'Please provide email/password or access code' });
    }

    // Update last active timestamp
    user.lastActive = Date.now();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate client access code
// @route   POST /api/auth/generate-code
// @access  Private/Staff
exports.generateAccessCode = async (req, res) => {
  try {
    const { clientId, name } = req.body;

    // Generate a random 6-digit code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

    let user;

    // If client ID is provided, update existing client
    if (clientId) {
      user = await User.findById(clientId);
      
      if (!user) {
        return res.status(404).json({ message: 'Client not found' });
      }
      
      user.accessCode = accessCode;
      await user.save();
    } 
    // Otherwise create new client
    else if (name) {
      user = await User.create({
        name,
        role: 'client',
        accessCode
      });
    } else {
      return res.status(400).json({ message: 'Client name is required' });
    }

    res.status(200).json({ 
      message: 'Access code generated successfully',
      accessCode,
      client: {
        id: user._id,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
