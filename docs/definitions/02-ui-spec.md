# 02. UI Spec

- 상태: v0.3 locked
- 작성일: 2026-05-20

## UI 원칙

- 서비스 언어는 영어다. 모든 사용자-facing UI copy, ad copy, demo conversation, disclosure는 영어로 제공한다.
- 답변 영역과 광고 영역은 시각적으로 명확히 분리한다.
- 광고는 `Sponsored` 또는 동등한 라벨을 항상 표시한다.
- 광고가 사용자의 질문에 반응해 제작되었음을 숨기지 않는다.
- 사용자는 광고 정보 사용 범위를 확인하고 제어할 수 있어야 한다.
- 광고주는 개인을 보는 것이 아니라 campaign outcome을 본다.
- MVP 광고 배치는 답변 전 전면광고다.
- 전면광고는 정적 배너가 아니라 LLM 실시간성을 보여주는 짧은 interactive ad experience다.

## MVP 화면

### 1. User Chat

목적: 사용자가 AI 서비스 답변 전에 분리된 agentic ad를 경험하고, 이후 서비스 답변을 받는다.

주요 영역:

- conversation panel
- pre-answer sponsored interstitial
- service answer bubble
- ad disclosure drawer
- consent/privacy control
- follow-up input

Interactive Sponsored Interstitial 구성:

- `Sponsored` label
- advertiser name
- generated headline
- generated scripted graphic area
- real-time micro-interaction area
- 2-3개 must-include attribute
- CTA
- why-this-ad disclosure
- dismiss / not relevant control

확정 배치:

- 사용자가 영어로 질문을 제출한다.
- 시스템은 답변 전에 전면 Sponsored Interstitial을 표시한다.
- 광고는 최대 1개의 짧은 micro-interaction을 포함한다.
- 광고 완료, CTA, dismiss, timeout 중 하나가 발생하면 서비스 답변을 표시한다.
- 답변 본문 중간에는 광고를 삽입하지 않는다.

Micro-interaction 예시:

- Budget slider를 움직이면 광고 graphic과 headline이 즉시 바뀐다.
- Trip style을 하나 고르면 패키지 카드가 재생성된다.
- “Compare by time saved” 같은 버튼을 누르면 광고 CTA가 해당 기준에 맞게 바뀐다.
- 한 줄 입력을 받되, 입력 내용은 광고 state 갱신에만 쓰고 Answer Agent에는 전달하지 않는다.

### 2. Advertiser Console

목적: 광고주가 영어 자연어 target policy, ad pool, 필수 노출 특징, dynamic settlement policy, escrow budget을 등록한다.

주요 영역:

- campaign list
- create campaign
- natural-language target policy editor
- compiled policy preview
- ad pool upload
- creative constraints
- dynamic settlement policy controls
- testnet escrow deposit settings
- review status
- aggregate performance dashboard
- transaction status

광고주에게 보여주지 않는 것:

- 사용자별 transcript
- 사용자별 profile vector
- 사용자의 직접 식별자
- 특정 사용자의 attention history

### 3. Platform Review Console

목적: 플랫폼이 자연어 target policy, 광고 claim, settlement policy를 검수한다.

주요 영역:

- pending campaign review
- natural-language target policy source
- compiled policy AST/summary preview
- sensitive targeting warning
- claim set editor
- prohibited claim list
- preview generated interstitial
- policy violation log
- approval/rejection action

### 4. Settlement Dashboard

목적: attention signal 기반 정산 상태를 확인한다.

주요 영역:

- escrow balance
- dynamic settlement policy summary
- attention events
- context retention evidence summary
- pending proofs
- settled events
- rejected events
- payout rule preview
- testnet transaction hash
- contract event status

## Demo Ad Themes

MVP는 최소 3개 광고 테마를 제공한다.

- Travel and local experiences
- Productivity or SaaS tools
- Online learning or professional upskilling

각 테마는 영어 광고 copy, 자연어 target policy 예시, interstitial micro-interaction, settlement policy fixture를 가진다.

## 핵심 인터랙션

### Ad Disclosure

사용자가 sponsored label 또는 info icon을 누르면 영어로 다음을 표시한다.

- This is a sponsored interactive ad.
- Advertiser name
- Why this ad was shown
- What data boundary applies
- Advertiser does not receive your raw conversation or profile
- Category opt-out
- Hide this ad

### Real-Time Ad Interaction

전면광고 안에서 사용자가 선택, slider, 짧은 텍스트 입력 중 하나를 수행하면 광고 Agent가 즉시 광고 상태를 갱신한다.

- interaction은 광고 영역 안에서만 처리한다.
- interaction 결과는 attention event로 기록될 수 있다.
- interaction 결과는 Answer Agent의 service answer 입력으로 들어가지 않는다.

### Deep-link CTA

CTA 예시:

- Build an itinerary with my budget
- Compare options for me
- Find available plans
- Continue with this offer

CTA는 외부 랜딩 페이지로 즉시 보내기보다, 우선 에이전트 내부 후속 태스크로 연결한다. 이 이벤트가 가장 강한 attention signal이다.

## UI 상태

- no ad available
- ad loading
- sponsored interstitial rendered
- realtime ad interaction pending
- realtime ad interaction completed
- target policy compiling
- target policy review required
- ad dismissed
- attention pending
- context retention evaluating
- attention verified
- settlement pending
- testnet transaction pending
- settlement complete
- policy blocked

## Locked Decisions

- MVP는 User Chat과 Advertiser Console을 모두 포함한다.
- 광고 배치는 pre-answer full-screen interstitial이다.
- 광고주는 target policy를 영어 자연어로 작성한다.
- 생성형 graphic ad는 HTML/CSS/React scripted component로 구현한다.
- 서비스 언어는 영어다.

## Open Decisions

- 없음.
