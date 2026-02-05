# Sidera AI API Specification

This document outlines the AI-driven endpoints and services within the Sidera ecosystem.

## 1. Chat & Node Generation

### POST `/api/chat`
The primary interface for interacting with Sidera AI.

**Request Body:**
- `message` (String): The user's input/question.
- `projectId` (String): The ID of the current project.
- `settings` (Object, optional):
  - `temperature` (Float): Controls randomness (default: 0.7).
  - `maxTokens` (Int): Maximum response length (default: 1000).
- `isGuest` (Boolean): If true, data is not persisted to the DB.
- `history` (Array, optional): Previous nodes (used in Guest mode).

**Implicit Logic:**
1. **RAG (Retrieval-Augmented Generation)**: Searches for similar past nodes to provide context.
2. **Importance Scoring**: Calculates a score (0.0 - 1.0) and star rating (1-5) based on conceptual depth.
3. **Deterministic Positioning**: Calculates 3D coordinates (x, y, z) based on semantic similarity to existing nodes.
4. **Background Connect**: Asynchronously generates temporal, explicit, and implicit edges.

**Response:**
- `node` (Object): The newly created node (with `answer`, `summary`, `importance`, `position`).
- `edges` (Array): Immediate edges (usually empty in persistent mode as they process in background).
- `projectTitle` (String, optional): A newly generated project title if this was the first interaction.

---

### GET `/api/chat/context/:nodeId`
Retrieves the chronological conversation thread leading to a specific node.

**Response:**
- `context` (Array): Array of node objects forming the parent-child chain.

---

## 2. Project & Constellation Management

### POST `/api/projects/:id/complete`
Finalizes a project and generates its permanent mythical representation.

**Request Body:**
- `constellationName` (String): The user-defined name for the resulting constellation.

**AI Logic:**
- Analyzes the 3D shape of all stars (nodes).
- Generates a mythical description using LLM.
- Creates a celestial image via HuggingFace (FLUX.1 + RMBG).

---

### PATCH `/api/projects/:id/auto-rename`
Generates a fitting title for a project based on its initial context.

**Logic:**
- Analyzes the first 5 nodes found in the project.
- Generates a concise (3-5 word) Korean title.

---

### POST `/api/projects/:id/regenerate-image`
Manually re-triggers the AI image generation process for a completed project.

---

## 3. GPU Acceleration (Internal)

### POST `http://localhost:8000/generate-constellation`
*Note: This is an internal endpoint on the Python AI server.*

**Request Body:**
- `projectId`, `constellationName`, `nodes`, `edges`, `prompt`.

**Function:** Renders high-quality ethereal nebula art based on specific 3D node/edge topologies.

---

## 4. Importance Scoring Tiers (Sidera-IS)

The AI classifies user intent into four primary tiers:
- **Conceptual (5★)**: Definitions, origins, core principles.
- **Strategic (4★)**: Methods, comparisons, complex how-tos.
- **Contextual (3★)**: Fact-checking, snippets, status checks.
- **Phatic (1-2★)**: Greetings, short reactions, simple acknowledgments.
