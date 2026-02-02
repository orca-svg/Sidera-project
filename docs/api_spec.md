# Sidera Backend API Specification

Base URL: `/api`
Authentication: Bearer Token (JWT) required for most endpoints.

## Authentication
*(Note: Auth routes are currently being integrated)*
- `GET /auth/google`: Initiates Google OAuth flow.
- `GET /auth/google/callback`: Callback handling.

## Projects (`/projects`)

### Get All Projects
- **URL**: `GET /`
- **Auth**: Required
- **Response**: Array of project objects (summary).

### Create Project
- **URL**: `POST /`
- **Auth**: Required
- **Body**:
  ```json
  {
    "name": "Project Name" // Optional, default: "New Constellation"
  }
  ```
- **Response**: Created project object.

### Get Single Project
- **URL**: `GET /:id`
- **Auth**: Required
- **Response**:
  ```json
  {
    "project": { ... },
    "nodes": [ ... ],
    "edges": [ ... ]
  }
  ```

## Chat (`/chat`)

### Send Message / Generate Node
- **URL**: `POST /`
- **Auth**: Required (unless `isGuest: true`)
- **Body**:
  ```json
  {
    "message": "User question",
    "projectId": "target_project_id", // Required for saved chats
    "settings": { ... }, // Optional AI settings
    "isGuest": false, // Set true for ephemeral mode
    "history": [] // Required only for Guest mode context
  }
  ```
- **Response**:
  ```json
  {
    "node": { ... }, // The newly created node
    "edges": [ ... ], // Generated semantic/temporal connections
    "projectTitle": "New Title" // If auto-renamed
  }
  ```

## Nodes (`/nodes`)

### Get Project Nodes
- **URL**: `GET /:projectId`
- **Auth**: Public/Open (Currently)
- **Response**: Array of nodes for the project.

### Create Node (Manual)
- **URL**: `POST /`
- **Body**:
  ```json
  {
    "projectId": "...",
    "content": "...",
    "type": "...",
    "position": { "x": 0, "y": 0, "z": 0 }
  }
  ```

### Update Node
- **URL**: `PUT /:id`
- **Body**: (Partial updates allowed)
  ```json
  {
    "position": { ... },
    "content": "..."
  }
  ```
