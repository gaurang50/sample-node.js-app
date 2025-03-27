// src/controllers/travelController.js
const LLMService = require('../services/llmService');

class TravelController {
  static async generateItinerary(req, res) {
    try {
      const { destination, travelerProfile } = req.body;
      
      if (!destination) {
        return res.status(400).json({ 
          error: 'Destination is required',
          details: 'Please provide a valid destination for itinerary generation'
        });
      }

      const defaultProfile = {
        interests: ['general'],
        budget: 'moderate',
        travelStyle: 'balanced'
      };

      const finalProfile = {
        ...defaultProfile,
        ...travelerProfile
      };

      const itinerary = await LLMService.generateTravelItinerary(
        destination, 
        finalProfile
      );

      // Handle both string and object responses
      const formattedItinerary = typeof itinerary === 'string' 
        ? itinerary.split('\n') 
        : itinerary;

      res.status(200).json({ 
        destination,
        itinerary: formattedItinerary,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Itinerary Generation Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate itinerary',
        message: error.message 
      });
    }
  }

  static async getCulturalInsights(req, res) {
    try {
      const { destination } = req.params;
      
      if (!destination) {
        return res.status(400).json({ 
          error: 'Destination is required',
          details: 'Please provide a valid destination for cultural insights'
        });
      }

      const insights = await LLMService.provideCulturalInsights(destination);

      // Handle both string and object responses
      const formattedInsights = typeof insights === 'string' 
        ? insights.split('\n') 
        : insights;

      res.status(200).json({ 
        destination,
        insights: formattedInsights,
        retrievedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Cultural Insights Error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve cultural insights',
        message: error.message 
      });
    }
  }

  static async translateLanguage(req, res) {
    try {
      const { text, sourceLang, targetLang } = req.body;

      if (!text || !sourceLang || !targetLang) {
        return res.status(400).json({
          error: 'Incomplete translation request',
          details: 'Provide text, source language, and target language'
        });
      }

      const translatedText = await LLMService.translateText(
        text, 
        sourceLang, 
        targetLang
      );

      // Handle both string and object responses
      const formattedTranslation = typeof translatedText === 'string'
        ? translatedText
        : translatedText.translation;

      res.status(200).json({
        originalText: text,
        translatedText: formattedTranslation,
        sourceLang,
        targetLang,
        translatedAt: new Date().toISOString(),
        ...(typeof translatedText === 'object' ? {
          translationNotes: translatedText.translation_notes,
          culturalAdaptations: translatedText.cultural_adaptations
        } : {})
      });
    } catch (error) {
      console.error('Translation Error:', error);
      res.status(500).json({
        error: 'Translation failed',
        message: error.message
      });
    }
  }
}

module.exports = TravelController;