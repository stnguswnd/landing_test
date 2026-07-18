// 실행 중인 개발 서버의 이전 모듈 그래프와 호환하기 위한 래퍼입니다.
// 실제 뒤로가기 갱신 처리는 TeacherLayout의 공통 가드가 담당합니다.
export { TeacherReviewRefreshGuard as RefreshOnHistoryRestore } from "@/components/layout/TeacherReviewRefreshGuard";
