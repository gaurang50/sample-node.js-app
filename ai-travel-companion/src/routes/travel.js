// src/routes/travel.js
const express = require('express');
const TravelController = require('../controllers/travelController');

const router = express.Router();

// Existing routes
router.post('/itinerary', TravelController.generateItinerary);
router.get('/cultural-insights/:destination', TravelController.getCulturalInsights);

// New route for translation (future expansion)
router.post('/translate', TravelController.translateLanguage);

module.exports = router;