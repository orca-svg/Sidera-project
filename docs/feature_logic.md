# Sidera 기능 로직 문서 (Feature Logic Documentation)

이 문서는 Sidera 애플리케이션의 핵심 로직과 구현 사항을 설명합니다. 특히 AI 통합, 데이터 저장, 시각화 규칙에 초점을 맞춥니다.

## 1. 프로젝트 제목 동기화 (Project Title Synchronization)

### 문제 배경
- 프론트엔드는 `title` 속성을 사용하여 제목을 표시했습니다.
- 백엔드(Mongoose 스키마)는 `name` 속성을 사용했습니다.
- 채팅 API를 통해 `title`을 업데이트하면 메모리 상에서는 반영되었으나, DB 스키마와 불일치하여 저장되지 않았고, 새로고침 시 기본값("New Project")으로 되돌아가는 문제가 있었습니다.

### 구현 로직
- **필드 정규화**: 백엔드(`chat.js`)는 이제 `Project` 컬렉션을 업데이트할 때 명시적으로 `name` 필드를 사용합니다.
- **기본 제목 감지**: 현재 제목이 다음 기본값 중 하나일 때만 AI가 생성한 제목으로 자동 변경합니다:
  - `New Project`
  - `New Conversation`
  - `새 프로젝트`
- **프론트엔드 동기화**: `chat` API 응답에 업데이트된 `projectTitle`을 포함시켜, 페이지 새로고침 없이도 왼쪽 패널의 프로젝트 목록이 즉시 업데이트되도록 했습니다.

---

## 2. 주제 요약 및 표시 (Topic Summary & Display)

### AI 생성
- 매 대화 턴마다 `aiService.js`를 통해 간결한 `topicSummary`를 생성합니다.
- **제약 사항**: 최대 5단어 이하의 명사구 형태를 선호합니다.
- **데이터 정제**: 정규식 기반의 JSON 파싱을 적용하여, AI가 생성한 텍스트에서 불필요한 인용부호나 설명 등을 제거합니다.

### UI 적용
- **오른쪽 패널 (Topic Flow)**: `node.topicSummary`를 표시하여 사용자가 대화 흐름을 쉽게 파악하게 합니다.
- **별자리 뷰 (Constellation View)**: 긴 질문 대신 요약된 `topicSummary`를 핀 라벨로 사용하여 가독성을 높였습니다.
- **왼쪽 패널 (Project List)**: 프로젝트의 `name`을 표시합니다. (첫 대화의 `shortTitle` 또는 `topicSummary`를 기반으로 생성됨)

---

## 3. 연결선 생성 로직 (Edge Generation Logic) - 의미론적 연결

"Connect" 단계에서는 3D 우주에서 노드들이 어떻게 연결될지를 결정합니다.

### A. 시간적 연결 (Temporal Edges - Backbone)
- **유형**: `temporal`
- **시각화**: **회색 점선** (Opacity 0.2)
- **로직**: 현재 노드($n$)와 직전 노드($n-1$)를 항상 연결합니다. 이는 대화의 시간적 흐름(Chronological Flow)을 나타냅니다.

### B. 명시적 연결 (Explicit Edges - Strong Semantic Link)
- **유형**: `explicit`
- **시각화**: **형광 주황/청록 실선** (Cyan #00FFFF, Opacity 0.8, Glow 효과)
- **로직**:
  - `text-embedding-004` 모델에 `taskType: "SEMANTIC_SIMILARITY"` 설정을 적용하여 임베딩을 생성합니다.
  - 새로운 노드의 요약 임베딩과 과거 노드들의 임베딩 간 코사인 유사도(Cosine Similarity)를 계산합니다.
  - **임계값**: **유사도 0.75 이상** (확실한 주제 연관성).
  - *예시*: "사과" ↔ "사과 파이" (높은 유사도) → **실선**.

### C. 암시적 연결 (Implicit Edges - Contextual Link)
- **유형**: `implicit`
- **시각화**: **연한 파란색 점선** (Pale Blue #88AAFF, Opacity 0.3)
- **로직**:
  - **임계값**: **0.4 ≤ 유사도 < 0.75**.
  - 직접적인 주제 일치는 아니지만, 문맥적으로 관련된 연결을 나타냅니다.
  - *예시*: "사과" ↔ "농업" (중간 유사도) → **점선**.

### D. 오탐지 방지 (False Positive Prevention)
- **이슈**: 기존에는 전혀 다른 주제(예: "음식" vs "우주")의 유사도가 0.99로 측정되는 문제가 있었습니다.
- **해결**: 임베딩 생성 시 `taskType`을 명시하여, 단순 텍스트 패턴이 아닌 '의미적 차이'를 구분하도록 모델을 보정했습니다. 이에 따라 관련 없는 주제 간 점수가 0.70 이하로 하락하여 오탐지가 방지되었습니다.

---

## 4. 중요도 평가 (Importance: Sidera-Intent)

AI는 사용자의 **질문 의도(Inquiry Intent)**를 분석하여 중요도를 평가하고, 이를 별의 크기(Star Size)로 시각화합니다.

### 평가 기준 (Question Type)

| 등급 | 별점 (Star) | 질문 유형 | 설명 | 예시 |
|:---:|:---:|:---|:---|:---|
| **Critical** | ⭐⭐⭐⭐⭐ | **Conceptual Inquiry** | 본질적 개념, 정의, 원리를 묻는 질문 | "양자역학이란?", "슈뢰딩거 방정식이 뭐야?" |
| **High** | ⭐⭐⭐⭐ | **Strategic / Deep Dive** | 구체적 방법론, 전략, 비교 분석 | "React 최적화 방법", "A vs B 비교" |
| **Normal** | ⭐⭐⭐ | **Contextual** | 단순 사실 확인, 코드 요청, 현상태 점검 | "날씨 어때?", "이 코드 보여줘" |
| **Low** | ⭐⭐ | **Phatic** | 단순 인사, 짧은 리액션 | "안녕", "알겠어", "ㅇㅇ" |

### 점수 산출 (Heuristics)

1. **인사말 감점 (Phatic Penalty)**: `안녕`, `하이`, `ㅋㅋ`, `ㅇㅇ` 등으로 시작하면 즉시 **0.15점** 반환
2. **개념 질문 패턴**: `정의`, `무엇`, `뭐야`, `뭔가`, `방정식`, `이론`, `개념` 등 → **0.85점**
3. **전략 질문 패턴**: `방법`, `어떻게`, `비교`, `최적화` 등 → **0.7점**
4. **학술 용어 보너스**: `슈뢰딩거`, `양자`, `알고리즘`, `데이터베이스` 등 감지 시 **+0.15점**
5. **가중치 배분**: Intent(70%) + Info Density(20%) + Structure(10%)


---

## 5. 뷰 이동 로직 (View Navigation Logic)

### 모드에 따른 상호작용

| 상호작용 | 채팅 모드 (`viewMode: 'chat'`) | 별자리 모드 (`viewMode: 'constellation'`) |
|----------|---------------------------------|-------------------------------------------|
| **토픽 클릭** | **채팅 스크롤 이동** | **카메라 비행 (Flight)** |
| **로직** | `setActiveNode(id)` 호출 (상태 업데이트만 수행) | `flyToNode(id)` 호출 (카메라 이동 + 모드 전환) |

### 의도
- **채팅 모드**: 사용자가 특정 대화 내용을 찾고 싶을 때, 불필요한 화면 전환 없이 해당 위치로 부드럽게 스크롤합니다.
- **별자리 모드**: 그래프를 탐색하는 몰입감을 유지하기 위해, 카메라가 해당 별(노드)로 날아가는 연출을 제공합니다.

---

## 6. 검색 기능 (Stellar Search)

### 설계 철학
현대적인 "소셜 검색(Social Search)" 패턴을 적용하여, 사용자가 입력하는 즉시 관련 결과를 보여주는 실시간 검색 경험을 제공합니다.

### 핵심 기능

#### A. 실시간 검색 (Live Search)
- **디바운싱**: 300ms 지연을 적용하여 타이핑 중 불필요한 API 호출을 방지합니다.
- **자동 트리거**: Enter 키 없이 타이핑만으로 결과가 나타납니다.
- **로딩 표시**: 검색 중 스피너 애니메이션으로 피드백을 제공합니다.

#### B. 이중 범위 검색 (Dual-Scope Search)
검색 결과가 두 개의 카테고리로 분류되어 표시됩니다:

| 카테고리 | 아이콘 | 검색 대상 |
|----------|--------|-----------|
| **Projects** | 🌌 | 프로젝트 제목 (로컬 필터링) |
| **Topics** | ⭐ | 노드의 질문, 답변, 키워드, 토픽 요약 (백엔드 검색) |

#### C. 매칭 필드 표시 (Match Type Detection)
검색 결과가 어디에서 일치했는지 시각적으로 표시합니다:

| 배지 | 색상 | 의미 |
|------|------|------|
| **Q** | 파란색 | 질문(Question)에서 일치 |
| **A** | 초록색 | 답변(Answer)에서 일치 |
| **#** | 노란색 | 키워드(Keyword)에서 일치 |
| **★** | 청록색 | 토픽 요약(Topic)에서 일치 |

- 답변에서 일치한 경우, 일치 위치 주변의 컨텍스트 스니펫을 표시합니다.
- 질문/답변 매칭 시 해당 토픽명을 브레드크럼(📍)으로 함께 표시합니다.

#### D. 키보드 탐색 (Keyboard Navigation)
| 키 | 동작 |
|----|------|
| ↑↓ | 결과 목록 탐색 |
| Enter | 선택한 항목으로 이동 |
| Esc | 검색 닫기 |

### 백엔드 검색 필드
`/nodes/search` 엔드포인트는 다음 필드들을 대소문자 구분 없이 검색합니다:
- `shortTitle`
- `topicSummary`
- `starLabel`
- `question`
- `answer`
- `keywords`
- `summary`

### 관련 파일
- `Frontend/src/hooks/useDebounce.js`: 디바운스 훅
- `Frontend/src/components/layout/MainLayout.jsx`: 검색 UI 및 로직
- `Frontend/src/store/useStore.js`: `searchNodes` 함수
- `Backend/routes/nodes.js`: 검색 API 엔드포인트

---

## 7. 별자리 완성 (Constellation Completion)

대화를 "완성"하여 읽기 전용으로 보존하고, AI 생성 이미지로 영구 기념하는 기능입니다.

### 완성 플로우

```
[사용자: "이 별자리를 완성하기" 클릭]
         ↓
[모달: 2D 미리보기 + 이름 입력]
         ↓
[Imagen 3.0 API: 성운 이미지 생성]
         ↓
[프로젝트 잠금 (status: 'completed')]
         ↓
[배경에 이미지 표시 (다른 대화에서)]
```

### A. 프로젝트 잠금 (Read-Only Lock)

| 상태 | 동작 |
|------|------|
| **채팅 입력** | 비활성화 + "이 별자리는 완성되었습니다" 메시지 |
| **백엔드** | `POST /chat` 요청 시 403 + `PROJECT_COMPLETED` 코드 반환 |
| **사이드바** | MessageSquare 아이콘 → ✦ 아이콘으로 변경 |
| **이름 변경** | Edit 버튼 숨김 (삭제만 가능) |

### B. Imagen 3.0 이미지 생성

- **엔드포인트**: `POST /api/projects/:id/complete`
- **프롬프트**: 
  ```
  A breathtaking cosmic nebula scene representing "${constellationName}", 
  dark deep space, vibrant nebula in purple blue gold, 
  connected bright stars, ethereal glow, dreamy cinematic, 
  no text no watermarks
  ```
- **Graceful Degradation**: 이미지 생성 실패 시에도 프로젝트는 정상 완료됨 (이름만 저장)

### C. 완성 모달 (EndConversationModal)

**3단계 플로우:**

| 단계 | 내용 |
|------|------|
| **input** | 2D Canvas 별자리 미리보기 + 이름 입력 |
| **generating** | 스피너 + "별자리를 완성하고 있습니다..." |
| **success** | 생성된 이미지 (또는 실패 안내) + 확인 버튼 |

**2D 미리보기 시각화:**
- 노드 색상: 중요도별 (5★=#FFD700, 4★=#00FFFF, 3★=#88AAFF, 2★=#FFF, 1★=#888)
- 엣지: 연한 파란색 선으로 연결

### D. 완료된 별자리 배경 렌더링 (3D Rendering)

기존의 정적 이미지 방식에서 벗어나, 실제 3D 데이터(노드/엣지)를 기반으로 배경 별자리를 렌더링하여 깊이감과 통일성을 제공합니다.

| 속성 | 상세 내용 |
|------|-----------|
| **렌더링 방식** | **Real-time 3D Structure** (Not Image) |
| **구성 요소** | **Stars** (MeshDistortMaterial), **Edges** (Lines), **Orbital Particles** |
| **위치 분산** | **X: ±80, Y: ±40, Z: -60 ~ -120** (광활한 우주 배경) |
| **스케일링** | 원근감(Perspective)을 위해 거리에 따라 자동 축소 |
| **표시 조건** | `viewMode === 'constellation'`일 때만 표시 (채팅 모드에서는 숨김) |
| **예외 처리** | 현재 보고 있는 프로젝트(Self)는 배경에서 제외 |

**시각적 디테일 (Visual Polish):**
- **Stars**: 중요도(1-5)에 따른 크기 및 색상 차별화 (Gold/Cyan Emissive Glow).
- **Distortion**: `MeshDistortMaterial`을 사용하여 별이 은은하게 일렁이는 효과 적용.
- **Orbital Particles**: 1등성/2등성 별 주위를 공전하는 미세한 파티클 추가 (속도/밝기 최적화로 눈부심 방지).

### E. Backend 스키마 (Project)

```javascript
status: { type: String, enum: ['active', 'completed'], default: 'active' }
completedAt: { type: Date, default: null }
constellationName: { type: String, default: null }
constellationImageUrl: { type: String, default: null }  // base64 data URI (Legacy support or fallback)
```

### F. Frontend Store 상태

```javascript
completedImages: []
// 구조:
// [{
//    projectId,
//    constellationName,
//    nodes: [{ id, position, importance, ... }],  // 3D 렌더링용 실제 데이터
//    edges: [{ source, target, type }]
// }]

// 액션
completeProject(projectId, constellationName)  // POST /projects/:id/complete
fetchCompletedImages()                          // GET /projects/completed-images (노드/엣지 데이터 포함)
```

### 관련 파일
- `Backend/models/Project.js`: 완료 관련 스키마 필드
- `Backend/services/aiService.js`: `generateConstellationImage` 함수
- `Backend/routes/projects.js`: `/completed-images`, `/:id/complete` 엔드포인트
- `Backend/routes/chat.js`: 완료된 프로젝트 잠금 체크
- `Frontend/src/store/useStore.js`: `completeProject`, `fetchCompletedImages` 액션
- `Frontend/src/components/layout/EndConversationModal.jsx`: 완성 모달 컴포넌트
- `Frontend/src/components/layout/MainLayout.jsx`: 완성 버튼, 잠금 UI
- `Frontend/src/components/canvas/Universe.jsx`: 배경 이미지 렌더링 (BackgroundConstellations)

---

## 8. 천문대 모드 (Observatory Mode)

완료된 별자리들을 한눈에 감상하고 탐색할 수 있는 갤러리 모드입니다.

### A. 동적 카메라 피팅 (Dynamic Camera Fitting)
- **문제**: 별자리들의 개수나 분포가 다양해 고정된 카메라 거리로는 너무 멀거나 가깝게 보였습니다.
- **해결**: 모든 별자리의 위치(Bounding Box)를 계산하여 최대 범위를 구한 후, 카메라 거리를 동적으로 설정합니다.
- **공식**: `targetZ = Math.max(80, maxExtent * 1.5)`
    - *1.5 Multiplier*: 별자리가 화면에 꽉 차 보이도록 타이트하게("Tighter Fit") 조정했습니다.

### B. 스마트 이름표 (Smart Labels)
별자리 이름표가 별을 가리거나 시야를 방해하지 않도록 정교한 로직이 적용되었습니다.

| 기능 | 설명 |
|------|------|
| **근접 감지 (Proximity)** | 카메라가 특정 별자리에 가까워지면(거리 150 미만) 자동으로 이름표가 나타납니다. |
| **하단 앵커링 (Bottom Anchor)** | 이름표는 항상 별자리의 **가장 아래쪽 별(minY)**보다 밑에 위치하여, 별자리를 절대 가리지 않습니다. |
| **동적 오프셋 (Inverted Offset)** | - **가까울 때 (Zoom In)**: 별의 시각적 크기가 커지므로, 오프셋을 **80px**로 늘려 겹침을 방지합니다.<br>- **멀 때 (Zoom Out)**: 연결성을 위해 오프셋을 **30px**로 줄입니다. |

---

## 9. 별 핀/라벨 (Star Pins/Labels)

개별 노드(별)에 표시되는 텍스트 라벨의 동작 방식입니다.

### 표시 조건
- **기존**: 중요도 5점 이상은 항상 표시.
- **변경**: **Hover** 또는 **Select** 상태일 때만 표시하여, 평상시에는 우주의 고요함을 유지하고 정보 과부하를 방지합니다.

### 동적 스케일링 (Dynamic Scaling)
카메라 거리에 따라 핀의 크기가 부드럽게 조절됩니다.
- 멀리 있을 때 너무 작아지지 않도록 최소 크기(0.7)를 보장합니다.
- 공식: `scale = Math.max(0.7, Math.min(1.2, 30 / distance))`

---

## 10. 사진 공유 (Photo Share)

별자리 화면을 캡처하고 공유하는 기능입니다.

### 캡처 흐름
```
[카메라 버튼 클릭]
      ↓
[Canvas → Base64 PNG]
      ↓
[ShareModal 표시]
      ↓
[저장 / 공유 / 복사]
```

### 공유 옵션

| 플랫폼 | 방법 | 설명 |
|--------|------|------|
| **모바일** | Web Share API | 기기 공유 시트 표시 (카카오톡, 인스타그램, 메시지 등) |
| **데스크탑** | Clipboard API | 이미지 클립보드 복사 |
| **공통** | Download | PNG 파일 다운로드 |

### 기술 상세
- **Web Share API**: `navigator.share({ files: [File] })`를 사용하여 이미지 파일 직접 공유
- **Clipboard API**: `navigator.clipboard.write([ClipboardItem])` 사용
- **지원 감지**: `navigator.canShare()` 메서드로 파일 공유 지원 여부 확인

### 관련 파일
- `Frontend/src/components/layout/ShareModal.jsx`: 공유 모달 컴포넌트
- `Frontend/src/components/layout/MainLayout.jsx`: `handleCapture` 함수, 모달 상태 관리

---

## 11. 게스트 모드 (Guest Mode)

로그인 없이 Sidera를 체험할 수 있는 모드입니다. 대화 내용은 **브라우저 메모리에만** 저장되며, 새로고침 시 사라집니다.

### 작동 방식
| 구분 | 일반 모드 | 게스트 모드 |
|------|-----------|-------------|
| 데이터 저장 | MongoDB | 클라이언트 메모리 |
| 노드 ID | MongoDB `_id` | `guest-{timestamp}` |
| 프로젝트 | 선택/생성 필요 | 자동 (`guest-session`) |
| 지속성 | 영구 보존 | 세션 종료 시 삭제 |

### API 호출 차이
```json
// Request Body
{
  "message": "사용자 질문",
  "isGuest": true,
  "history": [ /* 기존 노드 배열 (클라이언트 관리) */ ]
}
```

### 관련 파일
- `Backend/routes/chat.js`: `isGuest` 분기 처리 (Line 144-267)
- `Frontend/src/components/layout/MainLayout.jsx`: `isGuestMode` 상태

---

## 12. 관측소 뷰 (Observatory View)

완료된 모든 별자리를 한눈에 볼 수 있는 갤러리 모드입니다.

### 진입 조건
- 최소 1개 이상의 **완료된 프로젝트**가 있어야 접근 가능
- 헤더의 **🔭 관측소** 버튼 클릭

### 레이아웃 (Spiral)
```javascript
// 나선형 배치 공식
angle = index * 0.5 (radians)
radius = 15 + index * 5
position = { x: radius * cos(angle), y: radius * sin(angle), z: -20 }
```

### 시각적 특징
| 요소 | 설명 |
|------|------|
| **별자리** | 축소된 3D 미니 별자리 (클릭 시 해당 프로젝트로 이동) |
| **이름표** | 각 별자리 아래 `constellationName` 표시 |
| **배경** | `Stars` 컴포넌트로 은하수 효과 |

### 관련 파일
- `Frontend/src/components/canvas/Universe.jsx`: `ObservatoryView` 컴포넌트

---

## 13. 설정 및 데이터 내보내기 (Settings Modal)

### 데이터 내보내기 (Export)

| 포맷 | 설명 |
|------|------|
| **JSON** | 노드 배열을 그대로 다운로드 (개발자/백업용) |
| **Markdown** | 대화 형식으로 포맷팅된 `.md` 파일 (문서 공유용) |

### Markdown 포맷 예시
```markdown
# [프로젝트 이름]

## 💬 Conversation

**You**: 사용자 질문 내용
**Sidera**: AI 답변 내용
```

### 관련 파일
- `Frontend/src/components/layout/SettingsModal.jsx`

---

## 14. AI 별자리 이미지 생성 (Constellation Image Generation)

별자리 완성 시, AI가 사용자가 지은 이름에 기반하여 오브젝트 이미지를 생성하고 별자리 배경에 표시합니다.

### 생성 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 사용자 입력: "라디오"                                         │
│                    ↓                                            │
│ 2. Gemini 번역: "라디오" → "Radio"                              │
│                    ↓                                            │
│ 3. SDXL 생성: Text-to-Image (Stable Diffusion XL)               │
│    Prompt: "A simple elegant illustration of Radio..."          │
│                    ↓                                            │
│ 4. BRIA RMBG-2.0: 배경 제거 → 투명 PNG                          │
│                    ↓                                            │
│ 5. DB 저장: project.constellationImageUrl (Base64 Data URL)     │
└─────────────────────────────────────────────────────────────────┘
```

### 주요 구성 요소

| 구성 요소 | 역할 | 엔드포인트/모델 |
|-----------|------|-----------------|
| **Gemini** | 한국어→영어 번역 | `gemini-2.0-flash` |
| **SDXL** | 이미지 생성 | `stabilityai/stable-diffusion-xl-base-1.0` |
| **BRIA RMBG** | 배경 제거 | `briaai/RMBG-2.0` |

### 프롬프트 엔지니어링

```javascript
// Positive Prompt
`A simple elegant illustration of ${englishTopic}, clean minimalist design, 
 soft glowing outline, ethereal translucent style, isolated object on pure 
 black background, delicate line art, subtle glow effect`

// Negative Prompt
`text, watermark, stars, particles, sparkles, busy background, 
 realistic photo, cartoon, anime, ugly, distorted`
```

### 이미지 표시

| 뷰 모드 | 표시 방식 | 컴포넌트 |
|---------|-----------|----------|
| **Constellation Mode** | 별자리 중심에 위치, 별 크기에 맞춤 (opacity 18%) | `MythicalBackgroundLayer` |
| **Observatory Mode** | 각 별자리 배경에 개별 표시 (opacity 25%) | `InteractiveConstellation` |

### 환경 변수

```env
IMAGE_HUGGING_FACE_API=hf_xxxxx  # HuggingFace API Token
```

### 관련 파일
- `Backend/services/aiService.js` - `generateMythicalImage()`
- `Backend/routes/projects.js` - `POST /:id/complete`
- `Frontend/src/components/canvas/Universe.jsx` - `MythicalBackgroundLayer`
- `Frontend/src/components/canvas/InteractiveConstellation.jsx`

