const express = require('express');
const router = express.Router();

// Public route for testing
router.get('/', (req, res) => {
  res.json({ message: 'Users route working!' });
});

module.exports = router;