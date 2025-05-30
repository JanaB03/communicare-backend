const Location = require('../models/location.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// @desc    Get all active locations
// @route   GET /api/locations
// @access  Private/Staff
exports.getAllLocations = async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true })
      .populate('user', 'name role avatar')
      .sort({ updatedAt: -1 });

    // Format response data
    const formattedLocations = locations.map(location => ({
      id: location._id,
      userId: location.user._id,
      userName: location.user.name,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.updatedAt,
      address: location.address || undefined
    }));

    res.status(200).json(formattedLocations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Share or update user location
// @route   POST /api/locations
// @access  Private
exports.shareLocation = async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const userId = req.user._id;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // Check for existing location
    const existingLocation = await Location.findOne({ user: userId });

    if (existingLocation) {
      // Update existing location
      existingLocation.latitude = latitude;
      existingLocation.longitude = longitude;
      existingLocation.address = address;
      existingLocation.isActive = true;
      await existingLocation.save();

      res.status(200).json({
        message: 'Location updated successfully',
        location: {
          id: existingLocation._id,
          userId,
          userName: req.user.name,
          latitude,
          longitude,
          timestamp: existingLocation.updatedAt,
          address: address || undefined
        }
      });
    } else {
      // Create new location
      const newLocation = await Location.create({
        user: userId,
        latitude,
        longitude,
        address
      });

      res.status(201).json({
        message: 'Location shared successfully',
        location: {
          id: newLocation._id,
          userId,
          userName: req.user.name,
          latitude,
          longitude,
          timestamp: newLocation.createdAt,
          address: address || undefined
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete user location
// @route   DELETE /api/locations
// @access  Private
exports.deleteLocation = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the location
    const location = await Location.findOne({ user: userId });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Soft delete (mark as inactive)
    location.isActive = false;
    await location.save();

    res.status(200).json({ message: 'Location removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user location
// @route   GET /api/locations/user/:userId
// @access  Private/Staff
exports.getUserLocation = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find location
    const location = await Location.findOne({ 
      user: userId, 
      isActive: true 
    });

    if (!location) {
      return res.status(404).json({ message: 'No active location found for this user' });
    }

    res.status(200).json({
      id: location._id,
      userId,
      userName: user.name,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.updatedAt,
      address: location.address || undefined
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
