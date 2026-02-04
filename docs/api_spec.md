# Sidera Backend API Specification

Base URL: `/api`
Authentication: Bearer Token (JWT) required for most endpoints.

## Authentication (`/auth`)
Usually handled via passport-google-oauth20.

### Initiate Google Login
- **URL**: `GET /api/auth/google`
- **Description**: Redirects user to Google OAuth consent screen.
- **Auth**: Public

### Google Callback
- **URL**: `GET /api/auth/google/callback`
- **Description**: Google redirects here after login. Handles JWT generation.
- **Response**: Redirects to Frontend (`/auth/success?token=...`)

### Get Current User
- **URL**: `GET /api/auth/me`
- **Auth**: Bearer Token
- **Response**:
  ```json
  {
    "user": {
      "id": "mongo_id",
      "email": "user@email.com",
      "name": "User Name"
    }
  }
  ```

---

## Projects (`/projects`)

### Get All Projects
- **URL**: `GET /api/projects`
- **Auth**: Bearer Token
- **Description**: Returns all projects belonging to the authenticated user.
- **Response**: `[ { "id": "...", "name": "...", "updatedAt": "..." }, ... ]`

### Create Project
- **URL**: `POST /api/projects`
- **Auth**: Bearer Token
- **Body**:
  ```json
  {
    "name": "Project Name" // Optional, default: "New Constellation"
  }
  ```
- **Response**: `{ "_id": "...", "name": "...", "userId": "..." }`

### Get Single Project
- **URL**: `GET /api/projects/:id`
- **Auth**: Bearer Token
- **Description**: Fetches project metadata + all nodes + all edges.
- **Response**:
  ```json
  {
    "project": { ... },
    "nodes": [ ... ],
    "edges": [ ... ]
  }
  ```

### Complete Project (Finish Constellation)
- **URL**: `POST /api/projects/:id/complete`
- **Auth**: Bearer Token
- **Description**: Marks a project as completed, generates AI constellation image, and saves the constellation name.
- **Body**:
  ```json
  {
    "constellationName": "라디오",
    "constellationImageSkeleton": "data:image/jpeg;base64,..." // Optional: Canvas capture
  }
  ```
- **AI Pipeline**:
  1. Gemini translates Korean name to English
  2. SDXL generates object illustration
  3. BRIA RMBG removes background → transparent PNG
- **Response**:
  ```json
  {
    "project": {
      "_id": "...",
      "status": "completed",
      "constellationName": "라디오",
      "constellationImageUrl": "data:image/png;base64,...",
      "completedAt": "2025-02-05T..."
    }
  }
  ```

---

## Chat (`/chat`)

### Send Message / Generate Node
- **URL**: `POST /api/chat`
- **Auth**: Bearer Token (Optional if `isGuest: true`)
- **Description**: The core interaction endpoint. Handles AI generation, RAG retrieval, Node creation, Edge formation, and 3D positioning.
- **Body**:
  ```json
  {
    "message": "User question",
    "projectId": "target_project_id", // Required for saved chats
    "settings": { ... }, // Optional AI settings request
    "isGuest": false, // Set true for ephemeral (no-save) mode
    "history": [] // Required only for Guest mode context (array of existing nodes)
  }
  ```
- **Response**:
  ```json
  {
    "node": {
        "_id": "...",
        "question": "...",
        "answer": "...",
        "summary": "...",
        "position": { "x": 0, "y": 0, "z": 0 },
        "importance": 1-5 // 1: Dust, 5: Supernova
        // ... timestamps
    },
    "edges": [
        { "source": "...", "target": "...", "type": "temporal" }, // Previous -> Current
        { "source": "...", "target": "...", "type": "explicit" }, // Strong semantic link
        { "source": "...", "target": "...", "type": "implicit" }  // Weak semantic link
    ],
    "projectTitle": "New Title" // Present if the project was auto-renamed
  }
  ```

---

## Nodes (`/nodes`)

### Get Project Nodes
- **URL**: `GET /api/nodes/:projectId`
- **Auth**: Public/Open (Currently)
- **Response**: Array of nodes for the project.

### Create Node (Manual)
- **URL**: `POST /api/nodes`
- **Auth**: Public/Open
- **Body**:
  ```json
  {
    "projectId": "...",
    "content": "...", // Raw content if needed
    "type": "note", // default: 'chat'
    "position": { "x": 0, "y": 0, "z": 0 }
  }
  ```

### Update Node
- **URL**: `PUT /api/nodes/:id`
- **Body**: (Partial updates allowed)
  ```json
  {
    "position": { "x": 1, "y": 2, "z": 3 },
    "content": "Updated text"
  }
  ```

---

## Edges (`/edges`)

### Get Project Edges
- **URL**: `GET /api/edges/:projectId`
- **Auth**: Public/Open
- **Response**: Array of edge objects.

### Create Edge (Manual)
- **URL**: `POST /api/edges`
- **Body**:
  ```json
  {
    "projectId": "...",
    "source": "node_id_1",
    "target": "node_id_2",
    "type": "solid" // or 'dashed', 'temporal', 'explicit', 'implicit'
  }
  ```
