# 2026-06-12 Review Status and Class Overview Fixes

## Purpose

This document records the review-status work done around teacher-facing student detail, submission detail, and class management pages.

The main user-visible issues were:

- A submission could show as approved in the student detail page, but still show as pending review in the submission detail page.
- Class management pages could still show approved or returned work as "needs review".
- Some personal or historically misclassified assignments for students in `alpha B` were missing from the class management review list.
- The submission approval/rejection flow needed a second success confirmation modal.

The goal was to make all teacher-facing surfaces use the same practical review-status interpretation.

## Affected Files

- `src/app/teacher/students/[studentId]/page.tsx`
- `src/app/api/teacher/students/[studentId]/history/route.ts`
- `src/features/student-management/types/studentManagement.ts`
- `src/features/student-management/components/StudentManagementView.tsx`
- `src/app/teacher/submissions/[submissionId]/SubmissionReviewPanel.tsx`
- `src/server/teacher/submissionDetail.ts`
- `src/app/api/teacher/classes/[classId]/assignments/route.ts`
- `src/app/api/teacher/classes/overview/route.ts`

## Review Status Model

The app has multiple data fields that can imply review completion:

- `submissions.status`
  - `submitted` or `late`: submitted, still review-pending unless another completion signal exists.
  - `reviewed`: approved.
  - `returned`: returned/rejected.
- `assignment_targets.reviewed`
  - Historical or target-level completion flag.
  - If true, the target should not be shown as review-pending.
- `teacher_feedback`
  - Feedback row for a submission.
  - If present, this is also treated as a completed review signal for legacy/inconsistent data.

The practical normalized state used by the teacher UI is:

- `pending`: submitted but no review completion signal.
- `approved`: `submissions.status = 'reviewed'`, or `assignment_targets.reviewed = true`, or `teacher_feedback` exists.
- `returned`: `submissions.status = 'returned'`.
- `none`: no submission/feedback.
- `reviewed`: kept in the TypeScript union only for backward compatibility with older callers/data.

Important precedence:

1. `returned` wins if `submissions.status = 'returned'`.
2. Otherwise, any completion signal maps to approved.
3. Otherwise, submitted rows are pending.

## Student Detail Page Changes

File: `src/app/teacher/students/[studentId]/page.tsx`

Previously, the student detail page only had these top summary cards:

- 전체 과제
- 제출 완료
- 미제출
- 검토 필요

It now also shows:

- 승인
- 반려

The review status query was changed from:

```sql
case
  when sub.status = 'reviewed' or at.reviewed = true or tf.id is not null then 'reviewed'
  when sub.id is not null then 'pending'
  else 'none'
end as review_status
```

to:

```sql
case
  when sub.status = 'returned' then 'returned'
  when sub.status = 'reviewed' or at.reviewed = true or tf.id is not null then 'approved'
  when sub.id is not null then 'pending'
  else 'none'
end as review_status
```

The row badge label was changed:

- `pending` -> `검토 필요`
- `approved` or legacy `reviewed` -> `승인`
- `returned` -> `반려`
- `none` -> `피드백 없음`

The tone was changed:

- pending: yellow
- approved/reviewed: green
- returned: red
- none: gray

## Student History API Changes

File: `src/app/api/teacher/students/[studentId]/history/route.ts`

This API backs the client-side student management view. It now uses the same status normalization as the server-rendered student detail page.

The `HistoryRow.review_status` type was expanded from:

```ts
"pending" | "reviewed" | "none"
```

to:

```ts
"pending" | "approved" | "returned" | "reviewed" | "none"
```

The SQL case expression now returns `approved` and `returned` explicitly.

## Shared Type Changes

File: `src/features/student-management/types/studentManagement.ts`

The `StudentLearningHistory.reviewStatus` union was updated to include:

- `approved`
- `returned`

It still includes legacy `reviewed` so old or already-consumed values do not break TypeScript usage.

## Student Management View Changes

File: `src/features/student-management/components/StudentManagementView.tsx`

This is the client-side student management screen, separate from `src/app/teacher/students/[studentId]/page.tsx`.

The status overview now also counts:

- 승인
- 반려

The review label now mirrors student detail:

- `pending` -> `검토 필요`
- `approved` or `reviewed` -> `승인`
- `returned` -> `반려`
- fallback -> `-`

This keeps the management view consistent with the dedicated student detail page.

## Submission Detail Page Status Mismatch

Files:

- `src/server/teacher/submissionDetail.ts`
- `src/app/teacher/submissions/[submissionId]/SubmissionReviewPanel.tsx`

### Root Cause

The student detail page was using multiple review completion signals:

- `submissions.status`
- `assignment_targets.reviewed`
- `teacher_feedback`

But the submission detail page was only using:

- `submissions.status`

That meant a row could show as approved outside the detail page because `assignment_targets.reviewed = true` or `teacher_feedback` existed, while the detail page itself still showed `검토 대기` because `submissions.status` was still `submitted` or `late`.

This was observed in the Diana / `Alphabet Lesson 1-9` case.

### Fix

`getTeacherSubmissionDetail` now selects:

- `at.reviewed as target_reviewed`
- `tf.id as feedback_id`

and derives a normalized detail status:

```ts
const detailStatus = first.status === "returned"
  ? "returned"
  : first.status === "reviewed" || first.target_reviewed || first.feedback_id
    ? "reviewed"
    : first.status;
```

The detail panel still receives `reviewed` for approved because its existing button/status logic expects `reviewed` as the approved state.

## Submission Approval / Return Flow

File: `src/app/teacher/submissions/[submissionId]/SubmissionReviewPanel.tsx`

### Success Modal

The user requested a second success notification after the existing confirmation modal and save.

Added:

```ts
const [resultStatus, setResultStatus] = useState<ReviewStatus | null>(null);
```

After successful PATCH:

```ts
setResultStatus(nextStatus);
```

The result modal displays:

- `승인되었습니다.`
- `반려되었습니다.`

The spelling was corrected from `반려 되었습니다.` to `반려되었습니다.`

### Approved Button Color

Previously, when `status === "reviewed"`, the approve button changed to `secondary`, which made it lose the green/primary fill.

Changed the approve button to always use:

```tsx
variant="primary"
```

So `승인됨` remains a green primary button.

The return button still uses danger styling when `status === "returned"`.

## Class Management Review Count Issues

Files:

- `src/app/api/teacher/classes/[classId]/assignments/route.ts`
- `src/app/api/teacher/classes/overview/route.ts`

There were two related issues.

### Issue 1: Approved/Returned Rows Still Counted as Needs Review

The class APIs had a narrower condition for `needsReviewCount`.

Before, the class assignment API effectively counted:

```sql
at.status = 'submitted' and at.reviewed = false
```

That missed:

- `late` submissions that still need review.
- `submissions.status = 'reviewed'` or `returned`.
- `teacher_feedback` as a completion signal.

The condition now counts only rows where:

- `at.status in ('submitted', 'late')`
- `at.reviewed = false`
- `sub.status` is not `reviewed`
- `sub.status` is not `returned`
- no `teacher_feedback` exists

This keeps class review counts aligned with student detail and submission detail.

### Issue 2: Personal / Misclassified Assignments Missing from Class Management

The user reported:

- In `alpha B`, Nicole and Jin should each show 2 review-needed items.
- Only 1 was shown.
- The suspected missing item was a personal assignment.

An inspection query was run against the live DB using a temporary script. The temporary script was created at `scripts/tmp-inspect-alpha-b.mjs`, executed, and then deleted.

Relevant observed data:

#### Jin

`Phonics Worksheet 1-1`:

- student: Jin
- current class membership: `alpha B`
- target status: `late`
- submission status: `submitted`
- reviewed: `false`
- feedback: `null`
- target class id: `class-alpha-376831`
- current `alpha B` class id: `class-alpha-b-d608ca`

This means the assignment should be review-needed for Jin in `alpha B` from the teacher workflow perspective, because Jin is currently in `alpha B`, but the target row still points at another class id.

#### Nicole

`Phonics Worksheet 1-3`:

- student: Nicole
- current class membership: `alpha B`
- target status: `submitted`
- submission status: `submitted`
- reviewed: `false`
- feedback: `null`
- target class id: `class-alpha-376831`
- current `alpha B` class id: `class-alpha-b-d608ca`

This is the same pattern: current class membership says `alpha B`, but target row points elsewhere.

### Why It Was Missing

The class management API originally scoped assignments by:

```sql
assignment_targets.class_id = current_class_id
```

Then it was broadened to include `at.class_id is null` personal/class-neutral assignments.

But the DB showed a third case:

- `assignment_targets.class_id` is not null,
- but it points to a different class,
- while the student is currently a member of the viewed class.

That case still did not appear.

### Current Fix

`src/app/api/teacher/classes/[classId]/assignments/route.ts`

The class assignment query now includes:

- targets directly assigned to the class, or
- targets for students who are members of the viewed class, when the assignment itself is class-neutral or belongs to the viewed class.

The relevant condition is:

```sql
and (
  at.class_id = $1
  or (
    (a.class_id is null or a.class_id = $1)
    and exists (
      select 1
      from class_memberships cm
      where cm.class_id = $1
        and cm.student_id = at.student_id
    )
  )
)
```

`src/app/api/teacher/classes/overview/route.ts`

The overview route now joins assignment targets by student first, then allows the assignment if:

```sql
at.class_id = c.id
or (
  a.class_id is null
  or a.class_id = c.id
)
```

Because the route is already iterating students through `class_memberships`, this makes class overview reflect the student's current class membership.

## Important Data Caveat

The database currently contains assignment target rows where:

- the student is a member of `alpha B`,
- but `assignment_targets.class_id` points to a different class.

The UI fixes above make class management behave according to current class membership. They do not rewrite the underlying target rows.

If this mismatch should never happen, a future data cleanup or migration may be needed. A possible cleanup would be to update `assignment_targets.class_id` based on the student's current active class membership for affected historical rows, but that should be planned carefully because students can move between classes and historical class context may matter.

## Verification Performed

Build was run after the changes:

```bash
npm run build
```

The build passed.

The live DB was inspected for `alpha B`, `Nicole`, and `Jin` using a temporary Node script with `pg`. The temporary script was deleted after inspection.

## Follow-up Risks / Things to Watch

- The review status logic is currently duplicated across several SQL queries and one server normalization function. If future review states are added, these locations must be updated together.
- `teacher_feedback` is treated as approval/completion unless `submissions.status = 'returned'`. This was intentional to support existing legacy/inconsistent rows.
- Class management now treats current class membership as authoritative for class overview. If historical class ownership should be preserved, this behavior may need a product decision.
- For assignment target rows with `target_class_id` pointing to another class, subject filtering can still be affected because `class_subject_id` may also point to the old class's subject row. The displayed subject may come from the old subject unless additional subject remapping is implemented.
