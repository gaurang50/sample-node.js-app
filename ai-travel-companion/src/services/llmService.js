const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

class LLMService {
  constructor() {
    // Validate API Key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API Key is missing. Please set OPENAI_API_KEY in your .env file.');
    }

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 seconds timeout
    });

    // Model configuration with fallback
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.fallbackModel = 'gpt-3.5-turbo';
    
    // Token configuration
    this.culturalInsightsTokens = parseInt(process.env.CULTURAL_INSIGHTS_TOKENS || '1000', 10);
    this.itineraryTokens = parseInt(process.env.ITINERARY_TOKENS || '1500', 10);
    this.translationTokens = parseInt(process.env.TRANSLATION_TOKENS || '500', 10);

    // Conversation memory and cache
    this.conversationMemory = new Map();
    this.responseCache = new Map();
    this.cacheTTL = 3600000; // 1 hour cache TTL

    // Performance tracking
    this.performanceMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
    };
  }

  // Enhanced error handling with model fallback
  async handleOpenAIError(error, context, prompt, options = {}) {
    // Log detailed error information
    console.error(`${context} Error:`, {
      message: error.message,
      type: error.type,
      code: error.code,
      model: options.model || this.model,
      stack: error.stack,
    });

    this.performanceMetrics.failedCalls++;

    // If rate limited or model-specific error, try with fallback model
    if ((error.response?.status === 429 || error.code === 'model_not_found') && 
        options.model !== this.fallbackModel) {
      console.log(`Retrying with fallback model: ${this.fallbackModel}`);
      return this.generateWithRetry(prompt, {
        ...options,
        model: this.fallbackModel,
        retries: options.retries !== undefined ? options.retries - 1 : 2
      });
    }

    // Provide more informative error messages
    if (error.response) {
      switch (error.response.status) {
        case 401:
          throw new Error('Invalid OpenAI API Key. Please check your credentials.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later or use a smaller model.');
        case 500:
          throw new Error('OpenAI service is experiencing issues. Please try again later.');
        default:
          throw new Error(`OpenAI API Error: ${error.message}`);
      }
    } else {
      throw new Error(`Failed to process request: ${error.message}`);
    }
  }

  // Core generation method with retry, caching, and fallback
  async generateWithRetry(prompt, options = {}, retries = 3) {
    const startTime = Date.now();
    const cacheKey = options.cacheKey || this.generateCacheKey(prompt, options);
    
    // Check cache first
    if (options.useCache !== false && this.responseCache.has(cacheKey)) {
      const cached = this.responseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.response;
      }
    }

    try {
      const generationOptions = {
        model: options.model || this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: options.tokens || this.itineraryTokens,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        response_format: options.response_format,
      };

      const response = await this.openai.chat.completions.create(generationOptions);
      const content = response.choices[0].message.content.trim();

      // Update performance metrics
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics(true, duration);

      // Cache the response
      if (options.useCache !== false) {
        this.responseCache.set(cacheKey, {
          response: content,
          timestamp: Date.now(),
        });
      }

      return content;
    } catch (error) {
      this.updatePerformanceMetrics(false);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries))); // Exponential backoff
        return this.generateWithRetry(prompt, options, retries - 1);
      }
      throw error;
    }
  }

  // Session-based conversation memory
  async generateWithMemory(sessionId, prompt, options = {}) {
    if (!sessionId) sessionId = uuidv4();
    
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, []);
    }

    const conversation = this.conversationMemory.get(sessionId);
    conversation.push({ role: "user", content: prompt });

    try {
      const response = await this.generateWithRetry('', {
        ...options,
        messages: conversation,
        useCache: false, // Don't cache ongoing conversations
      });

      const assistantMessage = { role: "assistant", content: response };
      conversation.push(assistantMessage);

      // Prune old conversations to prevent memory leaks
      if (conversation.length > 10) {
        conversation.splice(0, conversation.length - 10);
      }

      return {
        sessionId,
        response,
        conversationLength: conversation.length,
      };
    } catch (error) {
      this.handleOpenAIError(error, 'Conversation Memory Generation', prompt, options);
    }
  }

  // Main service methods
  async provideCulturalInsights(destination, options = {}) {
    try {
      if (!destination) {
        throw new Error('Destination is required for cultural insights');
      }

      const prompt = this.createCulturalInsightsPrompt(destination);
      const insights = await this.generateWithRetry(prompt, {
        model: options.model || this.model,
        tokens: options.tokens || this.culturalInsightsTokens,
        response_format: { type: "json_object" },
      });

      return this.processInsights(insights);
    } catch (error) {
      this.handleOpenAIError(error, 'Cultural Insights Generation');
    }
  }

  async generateTravelItinerary(destination, travelerProfile, options = {}) {
    try {
      if (!destination) {
        throw new Error('Destination is required for itinerary generation');
      }
      if (!travelerProfile) {
        throw new Error('Traveler profile is required for personalized itinerary');
      }

      const prompt = this.createItineraryPrompt(destination, travelerProfile);
      const itinerary = await this.generateWithRetry(prompt, {
        model: options.model || this.model,
        tokens: options.tokens || this.itineraryTokens,
        temperature: options.temperature || 0.5, // More deterministic for itineraries
      });

      return this.processItinerary(itinerary);
    } catch (error) {
      this.handleOpenAIError(error, 'Itinerary Generation');
    }
  }

  async translateText(text, sourceLang, targetLang, options = {}) {
    try {
      if (!text) throw new Error('Text is required for translation');
      if (!sourceLang || !targetLang) {
        throw new Error('Source and target languages are required');
      }

      const prompt = this.createTranslationPrompt(text, sourceLang, targetLang);
      return await this.generateWithRetry(prompt, {
        model: options.model || this.model,
        tokens: options.tokens || this.translationTokens,
        temperature: options.temperature || 0.3, // Very deterministic for translations
        cacheKey: `translation:${sourceLang}:${targetLang}:${text.substring(0, 50)}`, // Partial cache key
      });
    } catch (error) {
      this.handleOpenAIError(error, 'Translation');
    }
  }

  // Enhanced prompt engineering
  createCulturalInsightsPrompt(destination) {
    return `As a senior cultural anthropologist with 20+ years experience in ${destination}, provide:
    
    ## Comprehensive Cultural Analysis
    - **Historical Context**: Key historical events shaping current culture
    - **Social Structures**: Family, community, and societal organization
    - **Value Systems**: Core cultural values and belief systems
    
    ## Practical Interaction Guide
    - **Communication Styles**: Verbal and non-verbal patterns
    - **Social Etiquette**: Do's and don'ts in various contexts
    - **Business Protocol**: Meeting, negotiation, and workplace norms
    
    ## Deep Cultural Insights
    - **Subcultural Variations**: Differences across regions/age groups
    - **Cultural Paradoxes**: Seeming contradictions in cultural norms
    - **Emerging Trends**: How culture is evolving
    
    Format as structured JSON with these top-level keys:
    - historical_context
    - social_structures
    - value_systems
    - communication_styles
    - social_etiquette
    - business_protocol
    - subcultural_variations
    - cultural_paradoxes
    - emerging_trends
    
    Include specific examples for each section.`;
  }

  createItineraryPrompt(destination, travelerProfile) {
    return `You are a world-class travel designer creating a 100% personalized itinerary for:
    
    Destination: ${destination}
    
    Traveler Profile:
    ${JSON.stringify(travelerProfile, null, 2)}
    
    Create a day-by-day itinerary with:
    1. **Morning**: 2-3 activity options with rationale
    2. **Afternoon**: Cultural immersion experiences
    3. **Evening**: Dining and nightlife recommendations
    4. **Logistics**: Transportation tips, timing estimates
    5. **Local Secrets**: Hidden gems most tourists miss
    6. **Budget Tips**: How to save without sacrificing quality
    7. **Contingencies**: Backup plans for bad weather/etc.
    
    Format as markdown with clear sections. Include:
    - Estimated costs
    - Time allocations
    - Cultural notes for each activity
    - Accessibility considerations`;
  }

  createTranslationPrompt(text, sourceLang, targetLang) {
    return `As a professional translator native in both ${sourceLang} and ${targetLang}, translate:
    
    Source Text (${sourceLang}):
    ${text}
    
    Requirements:
    - Preserve original tone (formal, casual, etc.)
    - Adapt cultural references appropriately
    - Maintain domain-specific terminology
    - Ensure natural flow in ${targetLang}
    
    Provide:
    1. The translation
    2. Brief notes on key translation challenges
    3. Cultural adaptation explanations
    
    Format as:
    {
      "translation": "...",
      "translation_notes": "...",
      "cultural_adaptations": "..."
    }`;
  }

  // Response processing
  processInsights(insights) {
    try {
      if (typeof insights === 'object') return insights;
      
      const jsonMatch = insights.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      const possibleJson = insights.trim().replace(/^json\s*/, '');
      try {
        return JSON.parse(possibleJson);
      } catch {
        return {
          raw_insights: insights,
          sections: insights.split('\n\n').filter(s => s.trim())
        };
      }
    } catch (e) {
      console.error('Insights processing error:', e);
      return { error: 'Failed to process insights', raw: insights };
    }
  }

  processItinerary(itinerary) {
    try {
      // Try to parse as JSON if possible
      if (itinerary.trim().startsWith('{') || itinerary.trim().startsWith('[')) {
        return JSON.parse(itinerary);
      }
      
      // Otherwise process as markdown
      const days = itinerary.split(/\n## Day \d+/).filter(day => day.trim());
      return days.map(day => {
        const sections = day.split('\n### ').map(s => s.trim());
        const dayInfo = { title: sections[0] };
        
        sections.slice(1).forEach(section => {
          const [heading, ...content] = section.split('\n');
          dayInfo[heading.toLowerCase()] = content.join('\n').trim();
        });
        
        return dayInfo;
      });
    } catch (e) {
      console.error('Itinerary processing error:', e);
      return { error: 'Failed to process itinerary', raw: itinerary };
    }
  }

  // Utility methods
  generateCacheKey(prompt, options) {
    const prefix = options.model || this.model;
    const length = Math.min(prompt.length, 100);
    const hash = require('crypto').createHash('md5').update(prompt).digest('hex');
    return `${prefix}:${hash}:${length}`;
  }

  updatePerformanceMetrics(success, duration = 0) {
    this.performanceMetrics.totalCalls++;
    if (success) {
      this.performanceMetrics.successfulCalls++;
      this.performanceMetrics.averageResponseTime = 
        (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.successfulCalls - 1) + duration) / 
        this.performanceMetrics.successfulCalls;
    } else {
      this.performanceMetrics.failedCalls++;
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalCalls > 0 
        ? (this.performanceMetrics.successfulCalls / this.performanceMetrics.totalCalls) * 100 
        : 0,
    };
  }

  clearCache() {
    this.responseCache.clear();
  }

  clearConversation(sessionId) {
    this.conversationMemory.delete(sessionId);
  }
}

module.exports = new LLMService();