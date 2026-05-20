# 08. Checklist

- 상태: v0.3 locked
- 작성일: 2026-05-20

## Phase 0. Definition Lock

- [x] 초기 문제 정의 수집
- [x] 8개 definition document v0 생성
- [x] MVP 화면 범위 확정: user chat + advertiser console
- [x] 광고 배치 정책 확정: 답변 전 Interactive Sponsored Interstitial
- [x] privacy boundary 확정: platform-private vault + advertiser aggregate metrics only
- [x] settlement mode 확정: testnet smart contract escrow
- [x] target policy authoring 확정: English natural language
- [x] AI provider 확정: OpenRouter
- [x] context retention 확정: embedding/RAG + LLM adjudication
- [x] settlement score 확정: campaign별 dynamic policy
- [x] service language 확정: English
- [x] demo vertical 확정: 최소 3개 ad theme

## Phase 1. Core Data Model And Boundaries

- [x] campaign schema 정의
- [x] natural-language target policy schema 정의
- [x] compiled target policy schema 정의
- [x] ad pool item schema 정의
- [x] personal intelligence snapshot schema 정의
- [x] eligibility token schema 정의
- [x] sponsored interstitial schema 정의
- [x] sponsored interstitial interaction schema 정의
- [x] context retention evidence schema 정의
- [x] attention event schema 정의
- [x] dynamic settlement policy schema 정의
- [x] settlement event schema 정의
- [x] settlement proof schema 정의
- [x] contract transaction schema 정의
- [x] advertiser API에서 personal data 차단 테스트 작성
- [x] answer agent 입력에서 campaign data 차단 테스트 작성
- [x] ad interaction이 answer agent 입력을 오염시키지 않는 테스트 작성
- [x] natural-language target policy sensitive targeting 테스트 작성

## Phase 2. Ad Matching And Generation

- [ ] natural-language target policy compiler 구현
- [ ] sensitive targeting detector 구현
- [ ] embedding query generator 구현
- [ ] target policy matcher 구현
- [ ] ad opportunity selector 구현
- [ ] frequency cap 구현
- [ ] interactive ad agent 구현
- [ ] HTML/CSS/React scripted graphic renderer 구현
- [ ] micro-interaction template 구현
- [ ] policy guard 구현
- [ ] sponsored interstitial renderer 구현
- [ ] approved claim set validation 구현
- [ ] no eligible campaign 상태 구현
- [ ] 3개 이상 demo ad theme fixture 구현

## Phase 3. Attention And Testnet Settlement

- [ ] dwell tracker 구현
- [ ] realtime interaction tracker 구현
- [ ] embedding/RAG context retention retriever 구현
- [ ] LLM context retention adjudicator 구현
- [ ] deep-link verifier 구현
- [ ] dynamic attention score calculator 구현
- [ ] dynamic settlement policy validator 구현
- [ ] settlement trigger 구현
- [ ] testnet escrow smart contract 구현
- [ ] settlement transaction submitter 구현
- [ ] contract event indexer 구현
- [ ] duplicate settlement 방지 구현
- [ ] settlement dashboard event 표시
- [ ] transaction hash/status 표시

## Phase 4. Demo UX

- [ ] user chat 화면 구현
- [ ] advertiser console 구현
- [ ] natural-language target policy editor 구현
- [ ] compiled policy preview 구현
- [ ] platform review console 구현
- [ ] settlement dashboard 구현
- [ ] privacy disclosure drawer 구현
- [ ] pre-answer interactive sponsored interstitial 구현
- [ ] opt-out/dismiss interaction 구현
- [ ] 3개 이상 demo seed campaign 작성
- [ ] 영어 demo script 작성

## Phase 5. Hardening

- [ ] audit log viewer 구현
- [ ] abuse fixture 작성
- [ ] UI responsive check
- [ ] accessibility pass
- [ ] README 작성
- [ ] contract edge case tests
- [ ] testnet deployment notes
- [ ] 최종 E&C/L&C 정리

## When To Done Mapping

- 사용자 플로우 4개 통과: Phase 4 완료
- 광고/답변 경계 분리: Phase 1, Phase 2 완료
- 개인정보 보호 조건: Phase 1 완료
- 자연어 target policy 안전성: Phase 1, Phase 2 완료
- attention signal 정산: Phase 3 완료
- 영어 서비스 UI: Phase 4 완료
- 3개 이상 광고 테마: Phase 4 완료
- 신규 사용자 5초 내 구분: Phase 4 UI 검증
