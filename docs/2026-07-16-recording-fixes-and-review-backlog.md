# 2026-07-16 · 녹음 안정화 반영 내역 & 코드 리뷰 백로그

녹음(듣고녹음하기/단어녹음) 관련 오류 대응 중, 코드 전반을 스윕하며 발견한 항목 정리.
"이미 반영됨"은 이번에 수정 완료. "나중에 고칠 항목"은 미착수 — 착수 시 이 문서 참고.

---

## ✅ 이미 반영됨 (녹음 안정화)

정상 녹음/제출 경로는 변경 없음. 실패·엣지 경로에서만 동작하도록 추가함. 파일 생성 로직 미변경(iOS Safari mp4 위험 없음). `tsc --noEmit` 통과.

- **에러 감지 3종** — `src/hooks/useAudioRecorder.ts`, `src/app/student/assignments/[assignmentId]/VocabularyRecordingHomework.tsx`
  - `recorder.onerror` 핸들러
  - 마이크 트랙 `onended` 감지 → 녹음기 정상 종료(버퍼된 데이터 살림)
  - `onstop` 빈 파일(`blob.size === 0`) 차단 → 빈 녹음 제출 방지 (강사 피드백 "녹음 파일 불러오지 못했습니다" 오류의 상류 차단)
- **onerror + onstop 이중 발동 시 상태 꼬임 방지** — 성공적으로 파일을 만들면 에러 정리 후 성공 확정
- **에러 알림을 모달로 통일** — `RlRecordingHomework.tsx`가 인라인 텍스트 → 기존 `SubmissionAlertModal`로 (훅에 `dismissError` 추가)
- **미지원 브라우저 안내** — 단어 녹음에도 `typeof MediaRecorder === "undefined"` 가드 추가
- **재녹음 실패 시 이전 녹음 잔존 제거** — 단어 녹음 `fail()`이 이전 blob/url 정리
- **언마운트 정리** — 녹음 중 페이지 이탈 시 recorder 핸들러 해제 + 정지 (orphan 상태 갱신/미완료 파일 방지)
- **강사 피드백 오디오 서명 URL 만료 1시간 → 24시간** — `src/server/teacher/submissionDetail.ts` (`createSignedUrl(path, 60*60*24)`)

### 미해결(설계 필요) — 40초 끊김 근본 원인
위 수정은 "실패를 깔끔히 처리"할 뿐, 인터럽트 자체를 없애지 못함. 실제로 길게 녹음되게 하려면:
- 원인 확인(학생 기기/브라우저, iOS Safari 의심)
- `recorder.start(1000)` timeslice + 부분저장, 또는 IndexedDB 지속화(뒤로가기/새로고침 유실 대응)
- ⚠️ timeslice는 iOS Safari(audio/mp4) concat 위험 있어 실기기 테스트 필수

---

## 🗂 나중에 고칠 항목 (코드 리뷰 백로그)

> 아래는 모두 **이번 녹음 이슈와 무관**하게 스윕 중 발견된 별개 항목.
> 심각도는 재검증 후 보정한 값(데이터 손실/보안/크래시 급은 없음).

### [High] 학생 제출현황 집계가 화면마다 모순
- **위치**: `src/features/student-management/components/StudentManagementView.tsx:358-359, 715`
- **증상**: "마감 지났는데 미제출"인 과제를 학생관리 화면에서 **제출 완료로 집계**. 학생 상세 페이지는 미제출로 집계 → 같은 학생인데 두 화면 숫자가 다름.
- **⚠️ 함정 — `late`의 두 가지 뜻**:
  - **뜻 A** `assignment_targets.status = 'late'` (DB): 제출 라우트가 마감 후 제출 시 기록 = **"늦게 제출함"**. `status in ('submitted','late')` 집계(대시보드/반현황/과제목록 등)는 **정상 → 절대 건드리지 말 것**.
  - **뜻 B** 이력 쿼리 `submit_status = 'late'` (`history/route.ts:162`, `teacher/students/[studentId]/page.tsx:145`): `sub.id is null AND 마감 지남` = **"미제출 연체"**. #2 대상 필드.
- **수정 방법** (반드시 세트로):
  1. `:358` `submittedCount`에서 `late` 제거
  2. `:359` `missingCount`에 `late` 추가
  3. `:715` 라벨 `"지각 제출"` → `"미제출(마감 지남)"` (카운트만 고치고 라벨 두면 화면 내 새 모순 발생)
- **레퍼런스(정답 구현)**: `src/app/teacher/students/[studentId]/page.tsx:229, 268` — 이 페이지와 동일하게 맞추면 됨.
- **파장 범위**: 뜻 B 필드 소비처는 위 두 컴포넌트뿐. 수정은 `StudentManagementView.tsx` 3줄에 국한.

### [Medium] AudioPlayer 로드 실패 처리 부재
- **위치**: `src/components/ui/AudioPlayer.tsx:13`
- **증상**: 폴백은 `src`가 빈 경우만 표시. URL은 있는데 로드 실패(만료 signed URL/네트워크)하면 깨진 컨트롤만 남음. 듣기 과제는 `onEnded` 게이팅이 안 풀려 학생이 제출 단계로 못 넘어감.
- **수정 방향**: `onError` 핸들러로 실패 상태 표시(또는 재발급 유도). `ListeningHomework.tsx:99`/`RlRecordingHomework.tsx:169`의 진행 게이팅과 연계 검토.

### [Medium] 멀티파트 저장/제출 재진입 가드 없음
- **위치**: `src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx:208-237`
- **증상**: `saving/submitting`을 자식 버튼 `disabled`로 안 내려서, 저장 네트워크 대기 중 버튼이 계속 눌림. 더블클릭 시 `setCurrentIndex(v=>v+1)` 두 번 → 파트 건너뜀(저장 안 된 채 최종 제출), 마지막 파트에선 `submitAssignmentDraft` 이중 호출.
- **수정 방향**: `useRef` 재진입 가드(`if (inFlightRef.current) return`). state 가드로는 동일 렌더 내 연속 클릭을 못 막음.

### [Low] 사진 과제 canSubmit 조건 + 썸네일 revoke
- **위치**: `src/app/student/assignments/[assignmentId]/PhotoSubmissionHomework.tsx:90, 92-96`
- **증상 1**: `canSubmit`에 `existingImages.length > 0`이 있어, 재제출 화면에서 기존 사진을 전부 지워도 버튼 활성(서버가 대개 400으로 막지만 `min_photo_count=0`이면 빈 제출 가능). → 조건에서 `existingImages.length > 0` 제거, `visibleExistingImages` 기준만 사용.
- **증상 2**: cleanup effect가 `[selectedFiles]` 변경 시 이전 배열의 모든 ObjectURL을 revoke → 여러 장 중 하나 삭제 시 남은 썸네일이 깨짐(제출은 정상, 미리보기만). → revoke 대상을 실제 제거된 url로 한정.

### [폐기] formatDue 마감 표시 타임존
- **위치**: `src/lib/format.ts:14`
- **결론**: 학생 dueAt은 `studentAssignmentRepository.ts:383`에서 `.toISOString()`(전체 ISO)로 옴 → date-only 정규식에 안 걸려 버그 분기 미발동. **정상 경로에선 안 터짐. 조치 불필요.**

---

## 🟡 미검증 (보고만 됨 — 진짜인지 손으로 확인 필요)

서브에이전트가 보고했으나 아직 직접 코드 검증 안 함. 착수 전 확인 요망.

- **학생 로그인 전역 조회 vs 교사별 유니크** (`auth/*login`) — 서로 다른 교사가 같은 `student_login_id` 생성 시 나중 학생 로그인 불가 가능. `students` 테이블 DDL이 레포에 없어 제약조건 확인 필요.
- **AI 첨삭 엔드포인트: 과제 소유권 검증 없음 + 레이트리밋 프로세스 로컬** (`writing-feedback`, `vocabulary-feedback`) — 서버리스 다중 인스턴스에서 횟수제한 우회/비용 남용 가능.
- **학생 세션 토큰에 만료(exp) 없음** (`src/server/auth/studentSession.ts`) — 서버측 폐기/만료 불가. 교사 세션(DB `expires_at`)과 대비.
- **대시보드 주 계산 로컬/UTC 혼용** (`src/app/teacher/dashboard/page.tsx:57`) — "이번 주"가 하루 밀릴 수 있음.
- **과제 수정 시 legacy 파트가 녹음 min/max를 제출횟수 필드로 매핑** (`src/app/teacher/assignments/new/page.tsx:354`) — 옛 과제 열면 제출 수가 3/120 등 엉뚱한 값.
- **롤백 시 스토리지 고아 파일** (`api/student/submissions/photo/route.ts`, `api/teacher/assignments/route.ts`) — DB 실패해도 업로드 파일 미삭제. `draft/route.ts`는 올바르게 정리(정답 패턴). Low, 스토리지 누수.
