# Who That!? - AI-Powered Memory App

## Overview

"Who That!?" is an AI-powered memory application that helps users remember people they've met. The app allows users to record encounters with individuals (capturing name, location, datetime, and contextual notes) and later search for these encounters using natural language queries. The application uses OpenAI's embedding technology for semantic search, enabling users to ask conversational questions like "Who did I meet at the coffee shop last week?" and receive relevant results with AI-generated natural language responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates (October 2025)

### Voice Input & Output Features
- **Voice Input**: Users can speak their queries or encounter details instead of typing
- **Voice Output**: AI responses are automatically spoken back for voice queries
- **Smart Parsing**: AI extracts name, location, and context from spoken encounter descriptions

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript running on Vite

**UI Component Library**: shadcn/ui with Radix UI primitives
- Provides a comprehensive set of accessible, customizable components
- Uses Tailwind CSS for styling with a custom design system
- Implements Material Design 3-inspired aesthetics focused on clarity and professionalism

**Design System**:
- Light and dark mode support with system preference detection
- Custom color palette with primary (professional blue) and secondary (accent purple) colors
- Typography using Inter font family for readability
- Responsive design with mobile-first approach

**State Management**:
- TanStack Query (React Query) for server state management
- Provides caching, background refetching, and optimistic updates
- Custom query client configuration with specific retry and stale time settings

**Routing**: Wouter for lightweight client-side routing
- Three main routes: Home (/), Record (/record), Search (/search)
- 404 Not Found page for invalid routes

**Voice Interaction Components**:
- VoiceRecorder: Reusable component using MediaRecorder API
  - Visual feedback with pulsing red indicator during recording
  - Automatic transcription via OpenAI Whisper
  - Error handling for microphone permissions
- Audio Playback: Browser Audio API
  - Auto-plays AI responses for voice queries
  - Stop/Replay controls for user convenience

**Form Handling**: React Hook Form with Zod validation
- Type-safe form validation using shared schemas
- Integration with shadcn/ui form components

### Backend Architecture

**Runtime**: Node.js with Express.js framework

**API Design**: RESTful API with the following endpoints:
- `GET /api/encounters` - Fetch all encounters
- `GET /api/encounters/:id` - Fetch single encounter by ID
- `POST /api/encounters` - Create new encounter
- `POST /api/search` - Search encounters using natural language
- `POST /api/transcribe` - Convert audio to text using Whisper
- `POST /api/text-to-speech` - Convert text to speech using OpenAI TTS or ElevenLabs
- `POST /api/parse-encounter` - Parse spoken encounter description into structured fields

**Data Validation**: Zod schemas shared between client and server
- Ensures type safety and validation consistency across the stack
- Schemas defined in `shared/schema.ts` for code reuse

**Storage Strategy**: 
- Currently using in-memory storage (`MemStorage` class) with sample data for prototyping
- Prepared for PostgreSQL migration with Drizzle ORM schema defined
- Database schema includes encounters table with embedding vector storage

**Development Tools**:
- TypeScript for type safety
- ESBuild for production builds
- TSX for development server with hot reload
- Vite integration for serving frontend in development

### Data Storage Solutions

**Current Implementation**: In-memory storage with sample data
- `MemStorage` class implements `IStorage` interface
- Pre-populated with 5+ sample encounters for demonstration
- Generates embeddings for sample data on initialization

**Production-Ready Schema** (Drizzle ORM with PostgreSQL):
- `encounters` table with columns:
  - `id` (UUID primary key)
  - `name` (text, required)
  - `location` (text, required)
  - `datetime` (timestamp with timezone)
  - `context` (text, optional)
  - `embedding` (text, stores vector as JSON)
  - `createdAt` (timestamp with timezone)

**Rationale**: The in-memory approach allows for rapid prototyping and testing without database dependencies. The production schema is prepared for easy migration to PostgreSQL using Drizzle ORM, which provides type-safe database queries and automatic migration generation.

### External Dependencies

**OpenAI API Integration**:
- **Model for Embeddings**: `text-embedding-ada-002`
  - Generates 1536-dimensional vectors for semantic search
  - Applied to both encounter data and search queries
- **Model for Natural Language Responses**: GPT-4o
  - Generates human-readable search result summaries
  - Provides contextual responses to user queries
  - Mentions person names when confidence is above 50%
- **Model for Speech-to-Text**: Whisper-1
  - Transcribes voice input from users
  - Handles various audio formats (WebM with Opus codec)
  - Max recording duration: 60 seconds
- **Model for Text-to-Speech**: TTS-1 (with ElevenLabs fallback)
  - Converts AI responses to natural speech
  - Only activates for voice queries (not text queries)
  - Uses "alloy" voice for OpenAI, "Rachel" for ElevenLabs
- **Error Handling**: Implements retry logic (2 retries) with exponential backoff
- **API Keys**: Configured via `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` (optional) environment variables

**Enhanced Search Algorithm** (Updated October 2025):
- **Semantic Similarity**: Cosine similarity of AI embeddings for overall meaning
- **Enhanced Keyword Matching**: 
  - Prioritizes exact word matches (weight 1.0) over partial matches (weight 0.3)
  - Separately scores location (40%), context (40%), and name (20%)
  - Requires minimum 3 characters for partial matching to prevent false positives
  - Uses Unicode-aware punctuation stripping to handle queries like "starbucks?"
- **Date Similarity**: 
  - Returns 1.0 for month-only matches (e.g., "February" matches any February encounter)
  - Returns 0 if more specific date components (year/day) are specified but don't match
- **Location Matching**: 
  - Extracts location terms by filtering out date words, question words, and punctuation
  - Scores based on term matches in location field (80% weight) and context field (20% weight)
- **Adaptive Scoring Weights**:
  - **Date + Location query**: 15% semantic + 15% keyword + 35% date + 35% location
  - **Date only**: 30% semantic + 20% keyword + 50% date
  - **Location only**: 30% semantic + 20% keyword + 50% location
  - **General query**: 50% semantic + 50% keyword
- **Synergy Boost**: When date score ≥0.8 and location score ≥0.7, adds (date × location × 0.2) bonus to reward strong date+location matches, capped at 1.0
- **Result**: Single-match queries like "February at farmers market" now score 93-95% (was 40-54%)

**Neon Database** (prepared for production):
- Serverless PostgreSQL provider
- Connection configured via `DATABASE_URL` environment variable
- Drizzle Kit configured for schema migrations

**UI Dependencies**:
- Radix UI primitives for accessible components
- Tailwind CSS for utility-first styling
- Lucide React for icon library
- date-fns for date formatting

**Development Dependencies**:
- Replit-specific plugins for runtime error overlay and development banner
- Vite plugins for enhanced development experience

### Authentication and Authorization

**Current State**: No authentication implemented
- All API endpoints are publicly accessible
- Suitable for single-user prototype or demo environment

**Future Considerations**: Authentication will be needed for multi-user deployment to ensure users can only access their own encounters.

### Architectural Decisions

**Monorepo Structure**:
- Single repository with client, server, and shared code
- Shared TypeScript types and Zod schemas between frontend and backend
- Reduces code duplication and ensures type consistency

**Embedding Storage as Text**:
- Stores embedding vectors as JSON-serialized text in PostgreSQL
- Alternative considered: PostgreSQL pgvector extension for native vector operations
- Pros: Simpler setup, portable across databases
- Cons: Less efficient for large-scale vector similarity searches

**In-Memory Prototype Storage**:
- Allows rapid development without database setup
- Sample data demonstrates app functionality immediately
- Easy transition to persistent storage via `IStorage` interface abstraction

**Client-Side Routing with Wouter**:
- Lightweight alternative to React Router
- Reduces bundle size while maintaining full routing functionality
- Suitable for small to medium-sized applications

**Form Validation Strategy**:
- Zod schemas shared between client and server
- Client-side validation provides immediate feedback
- Server-side validation ensures data integrity
- Prevents validation logic duplication