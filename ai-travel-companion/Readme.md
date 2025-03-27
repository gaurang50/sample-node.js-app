# AI Travel Companion

A smart travel assistant powered by OpenAI's LLM that generates personalized itineraries, provides cultural insights, and offers translation services.

## Features

- **Personalized Itinerary Generation**: Create detailed travel plans based on destination and traveler profile
- **Cultural Insights**: Get in-depth cultural information about destinations
- **Translation Service**: Professional translation with cultural adaptation notes
- **Performance Optimized**: Caching, retry logic, and model fallback
- **Monitoring**: Built-in performance metrics tracking

## Tech Stack

- Node.js
- Express.js
- OpenAI API
- UUID (for session management)

## Prerequisites

- Node.js v16+
- OpenAI API key
- npm or yarn

## Installation

1. Clone the repository:
   cd ai-travel-companion

Install dependencies:

npm install

Create a .env file in the root directory:

OPENAI_API_KEY=your_openai_api_key_here
PORT=3000

# Optional configurations:

# OPENAI_MODEL=gpt-4

# CULTURAL_INSIGHTS_TOKENS=1000

# ITINERARY_TOKENS=1500

# TRANSLATION_TOKENS=500

Running the Application
Start the development server:

npm run dev

The server will start on http://localhost:3000.

API Endpoints
Base URL: http://localhost:3000/api/travel

1. Generate Travel Itinerary
   POST /itinerary

Request Body:
{
"destination": "Paris, France",
"travelerProfile": {
"interests": ["art", "history"],
"budget": "moderate",
"travelStyle": "cultural"
}
}

Sample powershell command -
$uri = "http://localhost:3000/api/travel/itinerary"
$headers = @{
"Content-Type" = "application/json"
}
$body = @{
"destination" = "Paris, France"
"travelerProfile" = @{
"interests" = @("art", "history", "architecture")
"budget" = "moderate"
"travelStyle" = "cultural"
"tripDuration" = "5 days"
"specialRequirements" = @("wheelchair accessible", "vegetarian dining options")
}
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10

2. Get Cultural Insights
   GET /cultural-insights/:destination

Example:

GET /api/travel/cultural-insights/Tokyo

3. Translation Service
   POST /translate

Request Body:


{
"text": "Hello, where is the nearest museum?",
"sourceLang": "en",
"targetLang": "fr"
}



How It Works
Request Flow:

Client makes request → Route → Controller → LLM Service

LLM Service processes request using OpenAI API

Response is formatted and returned to client
