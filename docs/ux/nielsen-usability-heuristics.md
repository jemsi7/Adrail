# Nielsen Usability Heuristics

- 상태: v0.1
- 작성일: 2026-05-20
- 적용 범위: User Chat, Sponsored Interstitial, Advertiser Console, Platform Review Console, Settlement Dashboard, Privacy Disclosure

## 목적

본 문서는 Jakob Nielsen의 10가지 사용성 평가 기준을 프로젝트의 UI/UX 설계, 구현, Computer Use QA, 최종 하드닝 단계에서 반복 확인하기 위한 기준이다.

이 기준은 서비스 중인 화면의 평가뿐 아니라, 새 화면이나 상호작용을 설계하기 전에도 사용한다. 특히 본 프로젝트는 광고, privacy boundary, attention settlement처럼 사용자가 오해하기 쉬운 개념이 많으므로, 기능 구현 여부보다 "사용자가 현재 상태와 다음 행동을 즉시 이해하는가"를 우선해서 점검한다.

## 사용 방법

- 새 UI를 설계하기 전: 각 원칙에서 해당 화면에 필요한 피드백, 용어, 사용자 제어, 오류 방지 장치를 먼저 정의한다.
- 구현 중: 버튼, 상태, 오류, empty state, loading state가 원칙에 맞는지 확인한다.
- Computer Use QA 중: 실제 브라우저에서 원칙별 위반 사례를 캡처하고 `aiden/L&C/SEABW-Hackathon2026/`에 기록한다.
- 오류가 발생하면: 사용성 문제가 아니라 실제 오류라면 `aiden/E&C/SEABW-Hackathon2026/`에 별도 기록한다.

## 1. 시스템 상태의 시각화

Visibility of system status

사용자가 시스템과 상호작용했을 때, 합리적인 시간 안에 즉각적이고 명확한 피드백을 제공한다.

점검 질문:

- 사용자가 버튼, 탭, 입력, slider, CTA를 조작했을 때 즉시 반응이 보이는가?
- loading, compiling, submitted, approved, rejected, settled, failed 상태가 구분되는가?
- 진행 중인 작업과 완료된 작업이 시각적으로 다르게 보이는가?
- transaction, policy compile, live LLM fallback처럼 시간이 걸릴 수 있는 작업에 상태 문구가 있는가?

본 프로젝트 적용:

- `Compile policy`는 `Compiling`, `Preview ready`, `Preview stale`, `Compile failed`를 구분해야 한다.
- Sponsored interstitial micro-interaction은 headline, visual, CTA, proof preview 중 최소 하나를 즉시 갱신해야 한다.
- Settlement dashboard는 score, threshold, pass/fail, transaction status를 한눈에 보여줘야 한다.

## 2. 시스템과 현실 세계 일치

Match between system and the real world

사용자에게 친숙한 용어, 순서, 개념을 사용하고 내부 시스템 용어를 그대로 노출하지 않는다.

점검 질문:

- 사용자가 실제 업무나 일상에서 쓰는 말로 설명되어 있는가?
- 내부 enum, hash, protocol 용어가 필요한 맥락 없이 노출되지 않는가?
- 화면 흐름이 사용자의 기대 순서와 일치하는가?
- 광고주, 사용자, 플랫폼 reviewer 각각에게 맞는 언어를 쓰는가?

본 프로젝트 적용:

- `platform_private_matching` 같은 내부값은 "Matched privately by the platform"처럼 문장형으로 보여준다.
- `approved`, `settled`, `rejected`는 상태 badge뿐 아니라 사용자가 이해할 수 있는 설명을 붙인다.
- testnet transaction은 chain/network, explorer, copy affordance와 함께 보여준다.

## 3. 사용자 제어와 자유

User control and freedom

사용자가 실수하거나 원치 않는 흐름에 들어갔을 때 빠져나오고 되돌릴 수 있는 장치를 제공한다.

점검 질문:

- 사용자가 광고를 dismiss, not relevant, category opt-out 할 수 있는가?
- 선택 후 상태를 되돌리거나 다시 확인할 수 있는가?
- drawer, modal, interstitial을 명확히 닫을 수 있는가?
- destructive 또는 irreversible action은 확인/복구 장치가 있는가?

본 프로젝트 적용:

- `Dismiss`, `Not relevant`, `Category opt-out`은 settlement 결과와 재노출 상태에 실제 차이를 만들어야 한다.
- Ad disclosure drawer는 Close, Escape, scrim click 모두로 닫혀야 한다.
- Review `Reject` 후에는 이미 serving/settlement된 상태와의 관계를 설명해야 한다.

## 4. 일관성과 표준

Consistency and standards

같은 의미의 액션과 상태는 같은 용어, 색, 위치, 동작을 유지하고 플랫폼/업계 관습을 따른다.

점검 질문:

- 같은 종류의 상태 badge가 같은 색과 문법을 사용하는가?
- tab, button, link, CTA의 역할이 시각적으로 구분되는가?
- active, hover, focus, disabled 상태가 일관적인가?
- 같은 화면 전환이 여러 위치에서 중복될 때 의미가 충돌하지 않는가?

본 프로젝트 적용:

- Theme tabs와 advertiser seed list가 둘 다 scenario 전환이라면 역할을 통합하거나 명확히 분리한다.
- `Sponsored`, `Ad info`, `Why this ad`, `Disclosure` 같은 광고 설명 용어를 하나의 체계로 정리한다.
- Review/Settlement status badge는 동일한 severity scale을 사용한다.

## 5. 오류 방지

Error prevention

사용자가 오류를 낼 수 있는 상황을 미리 제거하고, 위험한 조작은 발생 전에 막는다.

점검 질문:

- invalid policy, missing key, impossible settlement, unsafe claim이 submit 전에 차단되는가?
- 사용자가 자신에게 불리하거나 불가능한 선택지를 보지 않도록 되어 있는가?
- disabled state와 입력 validation이 명확한가?
- 오류가 자주 나는 조합은 UI 구조상 예방되는가?

본 프로젝트 적용:

- `.env`의 OpenRouter key가 없으면 live compile 버튼은 fixture fallback 상태를 분명히 보여준다.
- Review가 `rejected`인 campaign은 ad serving 또는 settlement CTA가 불가능해야 한다.
- Policy text 수정 후 compile preview가 stale이면 review/approval을 진행하지 못하게 한다.

## 6. 기억보다 직관

Recognition rather than recall

사용자가 정보를 기억해서 입력하게 만들지 않고, 가능한 선택지와 현재 맥락을 화면에 보여준다.

점검 질문:

- 사용자가 이전 화면의 값이나 hash를 기억하지 않아도 다음 작업을 할 수 있는가?
- 선택 가능한 option, recent choice, current theme, current campaign이 보이는가?
- 복잡한 정책/정산 구조를 요약과 시각적 단서로 인식할 수 있는가?
- 필요한 도움말이 액션 근처에 있는가?

본 프로젝트 적용:

- Settlement dashboard에는 policy hash, proof hash, transaction hash 관계를 한 화면에서 연결한다.
- Ad disclosure는 why shown, data boundary, advertiser identity를 사용자가 다시 볼 수 있어야 한다.
- Demo script는 현재 theme/campaign에 맞춰 자동 갱신되어야 한다.

## 7. 사용의 유연성과 효율성

Flexibility and efficiency of use

초보자와 숙련자 모두가 효율적으로 사용할 수 있도록 기본 경로와 빠른 경로를 함께 제공한다.

점검 질문:

- 처음 보는 사용자가 안내 없이 happy path를 완료할 수 있는가?
- 숙련 사용자가 반복 작업을 빠르게 처리할 수 있는가?
- 자주 쓰는 action이 가까이 있고, 고급 option은 필요할 때 열 수 있는가?
- demo mode와 operator mode가 서로 방해하지 않는가?

본 프로젝트 적용:

- 해커톤 심사용 one-minute path는 script tab 없이도 화면 흐름만으로 따라갈 수 있어야 한다.
- 광고주 console은 seed campaign 선택, custom preset 생성, compile, review를 빠르게 반복할 수 있어야 한다.
- OpenRouter key 자체는 화면에 입력하지 않는다.

## 8. 미학적이고 간결한 디자인

Aesthetic and minimalist design

중요한 콘텐츠와 기능을 우선 배치하고, 현재 작업에 필요 없는 정보를 줄인다.

점검 질문:

- 첫 viewport에서 가장 중요한 메시지가 보이는가?
- 사용자가 동시에 처리해야 하는 정보량이 과하지 않은가?
- 반복되는 navigation이나 중복 카드가 없는가?
- 시각적 강조가 실제 우선순위와 일치하는가?

본 프로젝트 적용:

- User Chat 화면 첫 5초 안에 `Sponsored`, advertiser, headline, dismiss/not relevant가 보여야 한다.
- Advertiser Console은 policy compile, safety, spend, threshold를 우선하고 내부 debug 정보는 접는다.
- Dev tools bubble, 불필요한 page scrollbar, 중복 theme switcher는 최종 데모에서 제거하거나 줄인다.

## 9. 오류 인식, 진단, 복구 지원

Help users recognize, diagnose, and recover from errors

오류가 발생하면 사용자가 이해할 수 있는 언어로 문제를 설명하고 해결 방법을 제안한다.

점검 질문:

- 오류 메시지가 사람이 이해할 수 있는 언어인가?
- 무엇이 잘못됐는지, 왜 막혔는지, 다음에 무엇을 해야 하는지 알려주는가?
- 기술 오류와 사용자 입력 오류를 구분하는가?
- fallback이 발생했을 때 사용자가 그 사실을 아는가?

본 프로젝트 적용:

- OpenRouter key 관련 개발 UI 오류는 사용자 화면에 노출되면 안 된다.
- live LLM 실패 시 "Using deterministic fixture because live provider failed"처럼 fallback 이유를 알려준다.
- policy compile 실패는 sensitive targeting, schema validation, provider failure를 구분해 표시한다.

## 10. 도움말 및 설명 문서

Help and documentation

추가 설명이 필요 없도록 설계하는 것이 우선이지만, 복잡한 작업에는 찾기 쉽고 실행 가능한 도움말을 제공한다.

점검 질문:

- 사용자가 막히는 지점 근처에 짧은 설명이 있는가?
- 도움말이 작업 순서에 맞게 정리되어 있는가?
- 긴 문서 대신 현재 action에 필요한 최소 정보가 제공되는가?
- demo judge, advertiser, platform reviewer 관점의 설명이 분리되어 있는가?

본 프로젝트 적용:

- Ad disclosure는 사용자가 보는 광고의 이유와 data boundary를 즉시 설명한다.
- Demo Script는 심사자가 1분 안에 proof path를 따라가도록 돕는다.
- README와 docs는 local run, fixture mode, OpenRouter mode, settlement proof 확인 방법을 분리해 설명한다.

## UI/UX Review Template

Computer Use QA 후 아래 형식으로 `aiden/L&C/SEABW-Hackathon2026/`에 기록한다.

```md
# {화면/흐름} Nielsen Heuristic Review

- 일자:
- 대상 화면:
- viewport:
- 테스트 경로:

## 요약

- 가장 큰 사용성 리스크:
- 가장 먼저 고칠 항목:

## 원칙별 발견 사항

1. 시스템 상태의 시각화:
2. 시스템과 현실 세계 일치:
3. 사용자 제어와 자유:
4. 일관성과 표준:
5. 오류 방지:
6. 기억보다 직관:
7. 사용의 유연성과 효율성:
8. 미학적이고 간결한 디자인:
9. 오류 인식, 진단, 복구 지원:
10. 도움말 및 설명 문서:

## 수정 후보

- P0:
- P1:
- P2:

## 검증 방법

- Unit/typecheck:
- Browser/Computer Use:
- Screenshot evidence:
```
