# 10. Minimal Chat UI Final Plan

- 상태: v1.0 locked
- 작성일: 2026-05-20
- 프로젝트: Adrail
- 결정: User Chat을 ChatGPT식 미니멀 대화 UI로 단순화하고, 답변 전에 sponsored ad message가 먼저 뜨는 구조로 고정한다.

## 목적

현재 User Chat은 pre-answer ad, answer, settlement proof, policy/status rail을 한 화면에서 많이 보여준다. 기능 증명에는 유리하지만 실제 사용자 채팅 UI로는 복잡하고, 사용자가 "대화 중 광고가 먼저 뜬다"는 핵심 컨셉을 보기 전에 운영 콘솔을 해석해야 한다.

이 계획은 도메인/정산/광고 매칭 경계를 바꾸지 않고, User Chat의 표현 방식을 미니멀 채팅 경험으로 고정한다.

## 관련 기존 기록

- E&C: 해당 UI 단순화 자체의 오류 기록은 없음.
- L&C: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-computer-use-ux-review.md`
- L&C: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-nielsen-ux-redesign.md`
- L&C: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-lock-interactive-front-ad-testnet.md`

## 최종 선택

선택: ChatGPT식 단일 conversation thread.

User Chat은 "한 화면 안의 데모 워크벤치"가 아니라 "사용자가 실제로 대화하는 제품 화면"으로 보이게 한다. 광고는 별도 dashboard card가 아니라 assistant 응답 흐름 안의 첫 sponsored message로 나타난다.

제외한 선택지:

- 기존 rich workbench 유지: 증거는 많이 보이나 제품 컨셉이 늦게 보인다.
- full-screen blocking modal 광고: 전면광고성은 강하지만 ChatGPT식 대화 경험과 충돌하고 dismiss/answer 전환이 무겁다.
- side panel proof 상시 노출: 해커톤 설명에는 좋지만 사용자 채팅 UI를 계속 복잡하게 만든다.

## 고정 UX 구조

### 1. 화면 골격

- 상단: 작은 product mark와 현재 preset selector만 둔다.
- 중앙: max-width conversation thread.
- 하단: sticky composer.
- hidden/secondary: ad disclosure, proof, settlement detail은 drawer 또는 compact popover로 이동한다.
- User Chat 첫 viewport에는 advertiser console, platform review console, settlement dashboard full panel을 표시하지 않는다.

### 2. 대화 흐름

1. 사용자가 composer에 영어 질문을 입력한다.
2. user bubble이 thread에 추가된다.
3. service answer가 바로 나오지 않고, `Sponsored` label이 있는 ad message가 먼저 나온다.
4. ad message는 advertiser name, 짧은 headline, 1-2줄 value copy, 최대 1개의 micro-interaction, CTA, dismiss/not relevant, why-this-ad를 포함한다.
5. CTA, dismiss, not relevant, 또는 timeout 후 service answer bubble이 ad 아래에 이어지고, live mode에서는 answer text만 streaming으로 점진 표시한다.
6. answer 아래에는 필요 시 `Ad proof`, `Why this ad`, `Settlement` 같은 compact chip만 남긴다.

### 3. Sponsored Message 규칙

- `Sponsored` label은 message 상단 첫 줄에서 보인다.
- advertiser name은 label 옆 또는 바로 아래에 보인다.
- headline은 1줄 또는 2줄을 넘기지 않는다.
- micro-interaction은 하나만 둔다.
- must-include attributes는 카드 3개가 아니라 짧은 bullet 또는 inline chips로 줄인다.
- CTA는 하나의 primary action만 둔다.
- dismiss와 not relevant는 secondary action으로 둔다.
- 광고 interaction은 Answer Agent 입력으로 전달하지 않는다.

### 4. Proof와 Disclosure

- `Why this ad`는 광고 안에 남기되 drawer로 연다.
- testnet tx hash, proof hash, policy hash는 첫 viewport에서 숨긴다.
- 답변 이후 compact proof chip을 통해 settlement detail을 열 수 있다.
- 광고주에게 raw transcript/profile/direct user id가 전달되지 않는다는 copy는 drawer 안에서 영어로 표시한다.

### 5. Advertiser Console과의 분리

- `/advertiser-console`은 계속 별도 route로 유지한다.
- User Chat에서 광고주 정책 editor, review action, full settlement dashboard를 보여주지 않는다.
- 데모 설명이 필요하면 상단 route switch 또는 작은 "Advertiser console" link만 제공한다.

## 구현 순서

### Step 1. Render Boundary

- `Phase4DemoApp`의 `user-chat` mode를 minimal thread layout으로 분리한다.
- 기존 advertiser/review/settlement panels는 `advertiser-console` mode에 남긴다.
- scenario builder와 domain functions는 변경하지 않는다.

### Step 2. Sponsored Bubble

- 기존 sponsored interstitial data를 compact sponsored message view model로 변환한다.
- label, advertiser, headline, copy, one interaction, CTA, dismiss/not relevant, why-this-ad만 우선 노출한다.
- graphic/card-heavy preview는 접거나 한 줄 visual accent로 줄인다.

### Step 3. Answer Reveal

- initial state는 `ad-first`.
- CTA/dismiss/not relevant/timeout 후 `answer-visible`로 전환한다.
- sponsored ad는 완성된 message로 한 번에 렌더링하고, service answer는 `Answer streaming` 상태에서 시작해 stream 완료 후 proof chip을 표시한다.
- dismiss/not relevant는 settlement claim 상태와 분리된 outcome copy를 유지한다.

### Step 4. Secondary Detail Drawer

- disclosure, privacy boundary, proof hash, policy hash, transaction hash, settlement status를 drawer 안에 모은다.
- drawer는 focus 이동, Escape close, background inert/focus trap까지 Phase 5 accessibility 기준으로 검증한다.

### Step 5. Visual Simplification

- Chat thread max-width, message bubble, composer, subtle separators 중심으로 CSS를 재구성한다.
- dashboard-style bordered panels, status rail, multi-card stepper, oversized proof widgets는 User Chat 첫 viewport에서 제거한다.
- desktop/mobile 모두 같은 대화 구조를 유지한다.

### Step 6. Verification

- `npm run typecheck`
- `npm test`
- Browser desktop QA: `/user-chat` fresh load, submit/fixture flow, ad-first answer reveal.
- Browser mobile QA: 390x844에서 user question, `Sponsored`, advertiser/headline, CTA, dismiss/not relevant, composer가 과도하게 밀리지 않는지 확인.
- `/advertiser-console` regression QA: policy compile, preset builder, review/settlement dashboard 유지.

## 완료 조건

- User Chat은 첫 화면에서 단일 채팅 서비스처럼 보인다.
- 답변 전에 광고가 먼저 뜨는 컨셉이 별도 설명 없이 보인다.
- User Chat 첫 viewport에 advertiser console, review console, settlement dashboard full panel이 없다.
- sponsored ad와 service answer는 같은 thread 안에 있지만 다른 message block으로 분리된다.
- 광고 block에는 `Sponsored` label, advertiser, why-this-ad, dismiss/not relevant가 있다.
- service answer는 광고 이후에만 나타난다.
- ad interaction 결과는 Answer Agent 입력을 오염시키지 않는 기존 테스트를 계속 통과한다.
- `/advertiser-console`의 광고주/정산/검수 기능은 제거하지 않는다.

## 보류 항목

- 새로운 backend schema
- 새로운 settlement contract
- 광고주 Console 재설계
- 실제 ChatGPT 브랜드/상표 모방
- 답변 본문 내부 광고 삽입

## Risk Notes

- 너무 미니멀하게 줄이면 testnet settlement proof가 사라진 것처럼 보일 수 있다. 따라서 proof는 숨기되 compact chip/drawer로 즉시 열 수 있어야 한다.
- full-screen modal 광고로 돌아가면 사용자는 채팅 흐름이 끊긴다고 느낄 수 있다. 이번 고정안에서는 광고를 "assistant thread 안의 sponsored pre-answer message"로 표현한다.
- ChatGPT식 UI는 친숙하지만 광고 시스템의 투명성 요구가 약해질 수 있다. `Sponsored`, `Why this ad`, dismiss/not relevant는 절대 제거하지 않는다.
