# Sidera API Specification (Notion Ready)

This document contains the complete API specification for the Sidera backend. It is formatted to be easily copied and pasted into Notion.

---

## 🔐 Auth (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/google` | Initiates Google OAuth login flow. | No |
| **GET** | `/google/callback` | Callback URL for Google OAuth. Returns JWT token. | No |
| **GET** | `/me` | Verifies current JWT token and returns user info. | Yes |

### `/api/auth/me` Response
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

## 💬 Chat & AI (`/api/chat`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/` | Sends a message to Sidera AI and creates a new node. | Yes (Optional for Guest) |
| **GET** | `/context/:nodeId` | Retrieves the chronological conversation context for a node. | Yes |

### `POST /api/chat` Request
```json
{
  "message": "What is a black hole?",
  "projectId": "project_id",
  "isGuest": false,
  "settings": {
    "temperature": 0.7
  }
}
```

### `POST /api/chat` Response
```json
{
  "node": {
    "id": "node_id",
    "question": "What is a black hole?",
    "answer": "A black hole is...",
    "importance": 5,
    "position": { "x": 10, "y": 5, "z": -2 }
  },
  "projectTitle": "Black Holes" // Optional
}
```

---

## 📂 Projects (`/api/projects`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | Lists all projects for the current user. | Yes |
| **POST** | `/` | Creates a new project. | Yes |
| **GET** | `/:id` | Gets details, nodes, and edges for a project. | Yes |
| **PUT** | `/:id` | Updates project metadata (name, viewState). | Yes |
| **DELETE** | `/:id` | Deletes a project and all its data. | Yes |
| **GET** | `/completed-images` | Lists completed projects with generated constellation images. | Yes |
| **POST** | `/:id/complete` | Finalizes a project and generates a mythical image. | Yes |
| **PATCH** | `/:id/auto-rename` | Auto-renames a project based on context using AI. | Yes |
| **POST** | `/:id/regenerate-image` | Manually regenerates a mythical constellation image. | Yes |
| **POST** | `/:id/refresh-edges` | Smart Refactor: Re-calculates all edges using updated logic. | Yes |
| **POST** | `/:id/view-state` | Updates the camera view state. | Yes |
| **PATCH** | `/:id/share` | Toggles public/private status. | Yes |
| **GET** | `/:id/summary` | Generates a textual summary of the project. | Yes |

### `POST /api/projects/:id/complete` Request
```json
{
  "constellationName": "The Great Bear"
}
```

---

## 🌟 Nodes (`/api/nodes`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/:projectId` | Lists all nodes in a specific project. | No (Check implementation) |
| **POST** | `/` | Creates a manual node (rarely used, AI uses Chat API). | No |
| **PUT** | `/:id` | Updates node content or position. | No |
| **DELETE** | `/:id` | Deletes a node. | No |
| **GET** | `/search` | Searches nodes by query and projectId. | No |
| **PATCH** | `/:id/bookmark` | Toggles the bookmark status of a node. | No |

---

## 🔗 Edges (`/api/edges`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/:projectId` | Lists all edges in a specific project. | No |
| **POST** | `/` | Creates a manual edge. | No |
| **DELETE** | `/:id` | Deletes an edge. | No |

---
*Note: Authorization headers must include `Bearer <token>` for endpoints requiring Auth.*
