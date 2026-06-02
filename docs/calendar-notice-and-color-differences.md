# 학생/강사 캘린더 공지 및 색상 차이 정리

## 핵심 요약

학생 캘린더와 강사 반 상세 캘린더는 같은 캘린더 컴포넌트를 공유하지 않는다.

- 학생 화면: `src/app/student/home/StudentCalendarClient.tsx`
- 강사 반 상세 화면: `src/app/teacher/classes/[classId]/page.tsx`

그래서 일정 종류별 색상과 표시 방식이 일부 다르다.

## "공지"는 두 종류가 있다

### 1. 반 공지사항

강사 반 상세의 공지사항 탭에서 작성하는 공지다.

- 화면 코드: `src/app/teacher/classes/[classId]/page.tsx`의 `NoticesTab`
- 관련 데이터: `notices`, `notice_targets`
- 학생 화면 표시 위치: 학생 홈의 공지 카드/캐러셀
- 용도: 반 학생에게 보여주는 일반 공지사항

이 공지는 캘린더 이벤트 색상 차이의 직접 원인이 아니다.

### 2. 캘린더 이벤트의 공지

강사 반 상세의 수업 일정/캘린더 탭에서 "일정 추가"를 할 때 선택하는 `공지` 유형이다.

- 화면 코드: `src/app/teacher/classes/[classId]/page.tsx`의 `ScheduleModal`
- 관련 데이터: `class_calendar_events.event_type = 'notice'`
- 학생 화면 표시 위치: 학생 캘린더
- 용도: 특정 날짜에 표시되는 캘린더 일정

색상 통일 대상은 이쪽이다. 즉, 반 공지사항 기능이 아니라 `class_calendar_events.event_type` 표시 규칙을 맞춰야 한다.

## 현재 색상 차이

### 학생 캘린더

파일: `src/app/student/home/StudentCalendarClient.tsx`

- 숙제/숙제 마감: 파란색
- 시험: 노란색
- 휴강: 빨간색
- 보강: 초록색
- 정규수업: 회색
- 공지: 회색
- 기타: 회색

월 달력 안에서는 작은 점으로 표시한다.

### 강사 반 상세 캘린더

파일: `src/app/teacher/classes/[classId]/page.tsx`

- 정규수업: 파란색
- 시험: 노란색
- 휴강: 빨간색
- 보강: 초록색
- 기타: 회색
- 공지: 전용 색상 매핑 없음
- 숙제 마감: 보라색

월 달력 안에서는 작은 라벨 칩으로 표시한다.

## 가장 큰 불일치

### 숙제 마감 색상

- 학생 캘린더: 파란색
- 강사 반 상세 캘린더: 보라색

### 캘린더 공지 색상

- 학생 캘린더: 회색
- 강사 반 상세 캘린더: `notice` 전용 색상 매핑 없음

## 정리

통일해야 할 대상은 다음이다.

1. `assignment_due` 색상
2. `class_calendar_events.event_type = 'notice'` 색상
3. 가능하면 학생/강사 캘린더가 같은 종류-색상 매핑을 공유하도록 분리

반 공지사항 탭의 공지(`notices`, `notice_targets`)와 캘린더 이벤트 공지(`class_calendar_events.event_type = 'notice'`)는 다른 기능이므로 섞어서 보면 안 된다.
