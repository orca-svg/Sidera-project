# Sidera API Specification Table

| **Domain** | **Name** | **Method** | **Endpoint** | **Comment** |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | Google Login Trigger | `GET` | `/api/auth/google` | Google OAuth 로그인 시작 |
|  | Google Login Callback | `GET` | `/api/auth/google/callback` | Google 인증 콜백 및 JWT 발급 |
|  | Verify Token | `GET` | `/api/auth/me` | 현재 토큰 유효성 검증 및 유저 정보 반환 |
| **Chat & AI** | Chat Message | `POST` | `/api/chat` | AI와 대화 및 노드 생성 (RAG, 중요도, 좌표 계산 포함) |
|  | Get Context | `GET` | `/api/chat/context/:nodeId` | 특정 노드의 대화 맥락(이전 대화 체인) 조회 |
| **Projects** | List Projects | `GET` | `/api/projects` | 내 프로젝트 목록 조회 |
|  | Create Project | `POST` | `/api/projects` | 새 프로젝트 생성 |
|  | Get Project Detail | `GET` | `/api/projects/:id` | 프로젝트 상세 정보 및 노드/엣지 전체 조회 |
|  | Update Project | `PUT` | `/api/projects/:id` | 프로젝트 메타데이터(이름, 공개여부 등) 수정 |
|  | Delete Project | `DELETE` | `/api/projects/:id` | 프로젝트 및 관련 데이터 전체 삭제 |
|  | Get Completed List | `GET` | `/api/projects/completed-images` | 완료된 프로젝트의 별자리 이미지 목록 조회 |
|  | Complete Project | `POST` | `/api/projects/:id/complete` | 프로젝트 완료 처리 및 별자리 신화 이미지 생성 |
|  | Auto Rename | `PATCH` | `/api/projects/:id/auto-rename` | AI가 대화 내용을 분석하여 프로젝트 이름 자동 변경 |
|  | Regenerate Image | `POST` | `/api/projects/:id/regenerate-image` | 별자리 이미지 수동 재생성 |
|  | Refresh Edges | `POST` | `/api/projects/:id/refresh-edges` | (Refactor) 모든 엣지를 최신 로직으로 재계산 |
|  | Update View State | `POST` | `/api/projects/:id/view-state` | 마지막 카메라 위치 및 줌 상태 저장 |
|  | Toggle Share | `PATCH` | `/api/projects/:id/share` | 프로젝트 공개/비공개 상태 토글 |
|  | Get Summary | `GET` | `/api/projects/:id/summary` | 프로젝트 전체 대화 요약본 조회 |
| **Nodes** | List Nodes | `GET` | `/api/nodes/:projectId` | 특정 프로젝트의 모든 노드 조회 |
|  | Search Nodes | `GET` | `/api/nodes/search` | 노드 검색 (키워드/내용) |
|  | Create Node | `POST` | `/api/nodes` | 노드 수동 생성 (드문 경우) |
|  | Update Node | `PUT` | `/api/nodes/:id` | 노드 내용 또는 위치 수정 |
|  | Delete Node | `DELETE` | `/api/nodes/:id` | 노드 삭제 |
|  | Toggle Bookmark | `PATCH` | `/api/nodes/:id/bookmark` | 노드 북마크 설정/해제 |
| **Edges** | List Edges | `GET` | `/api/edges/:projectId` | 특정 프로젝트의 모든 엣지 조회 |
|  | Create Edge | `POST` | `/api/edges` | 엣지 수동 생성 |
|  | Delete Edge | `DELETE` | `/api/edges/:id` | 엣지 삭제 |
