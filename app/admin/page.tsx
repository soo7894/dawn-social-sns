"use client";

import { useEffect, useMemo, useState } from "react";

type ReviewItem = {
  id: number;
  type: "게시물" | "댓글" | "사용자";
  target: string;
  reason: string;
  time: string;
  state: "검토 대기" | "숨김 처리" | "문제 없음";
};

const initialReviews: ReviewItem[] = [
  { id: 1, type: "게시물", target: "@studio.moon의 게시물", reason: "스팸 또는 반복성 콘텐츠", time: "10분 전", state: "검토 대기" },
  { id: 2, type: "댓글", target: "@doyun.notes의 댓글", reason: "부적절한 표현", time: "42분 전", state: "검토 대기" },
  { id: 3, type: "사용자", target: "@daily_cut", reason: "사칭 계정 의심", time: "어제", state: "검토 대기" },
];
const ADMIN_STORAGE_KEY = "dawn-local-admin-reviews-v1";
const SOCIAL_STORAGE_KEY = "dawn-local-social-v3";

export default function AdminPage() {
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<"전체" | ReviewItem["state"]>("전체");
  const [notice, setNotice] = useState("관리자 검토 모드가 활성화되어 있습니다");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedReviews = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "null");
      const baseReviews = Array.isArray(savedReviews) ? savedReviews : initialReviews;
      const social = JSON.parse(localStorage.getItem(SOCIAL_STORAGE_KEY) || "null");
      const reportedPosts = Array.isArray(social?.posts) && Array.isArray(social?.reports)
        ? social.posts.filter((post: { id: number }) => social.reports.includes(post.id)).map((post: { id: number; author: string }) => ({ id: post.id, type: "게시물" as const, target: `@${post.author}의 게시물`, reason: "사용자가 신고한 콘텐츠", time: "방금 전", state: "검토 대기" as const }))
        : [];
      setReviews([...reportedPosts.map((item: ReviewItem) => baseReviews.find((review: ReviewItem) => review.id === item.id) || item), ...baseReviews.filter((review: ReviewItem) => !reportedPosts.some((item: ReviewItem) => item.id === review.id))]);
    } catch { setReviews(initialReviews); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(reviews)); }, [ready, reviews]);

  const visibleReviews = useMemo(
    () => filter === "전체" ? reviews : reviews.filter((item) => item.state === filter),
    [filter, reviews],
  );

  function updateReview(id: number, state: ReviewItem["state"]) {
    setReviews((items) => items.map((item) => item.id === id ? { ...item, state } : item));
    setNotice(state === "숨김 처리" ? "콘텐츠를 숨김 처리했습니다" : "신고 항목을 문제 없음으로 처리했습니다");
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="brand" href="?">dawn<span>.</span></a>
        <div className="admin-badge"><span>●</span> 관리자 검토 모드</div>
        <a className="back-link" href="?">SNS로 돌아가기 →</a>
      </header>

      <section className="admin-intro">
        <div>
          <p>운영 현황</p>
          <h1>오늘의 커뮤니티, <em>안전하게</em><br />운영 중입니다.</h1>
          <span className="admin-status">● {notice}</span>
        </div>
        <div className="admin-date">2026. 08. 10<br /><small>일요일 · 서울</small></div>
      </section>

      <section className="metrics" aria-label="운영 핵심 지표">
        <Metric value="1,284" label="전체 회원" trend="이번 주 +8.4%" color="coral" />
        <Metric value="387" label="오늘의 게시물" trend="어제 대비 +12개" color="lavender" />
        <Metric value={String(reviews.filter((item) => item.state === "검토 대기").length)} label="검토 대기 신고" trend="지금 확인 필요" color="yellow" />
        <Metric value="98.7%" label="정상 운영 비율" trend="최근 7일 기준" color="mint" />
      </section>

      <section className="admin-grid">
        <article className="admin-card activity-summary">
          <div className="card-title"><div><p>커뮤니티 흐름</p><h2>최근 7일 활동</h2></div><span className="chart-key">● 게시물&nbsp;&nbsp; <i>●</i> 가입</span></div>
          <div className="chart" aria-label="최근 7일 활동 차트">
            {[44, 62, 53, 79, 69, 91, 76].map((height, index) => <div className="bar-group" key={index}><div className="bar post" style={{ height: `${height}%` }} /><div className="bar join" style={{ height: `${Math.max(24, height - 28)}%` }} /></div>)}
          </div>
          <div className="chart-days"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>
        </article>

        <article className="admin-card checklist-card">
          <div className="card-title"><div><p>오늘의 점검</p><h2>운영 체크리스트</h2></div><span className="score">4 / 5</span></div>
          {["신고 대기 항목 확인", "신규 가입 계정 모니터링", "커뮤니티 가이드 공지", "저장 공간 사용량 확인", "주간 활동 보고서"].map((label, index) => <label className="check-row" key={label}><input type="checkbox" defaultChecked={index < 4} /><span>{label}</span><small>{index < 4 ? "완료" : "예정"}</small></label>)}
        </article>
      </section>

      <section className="admin-card reviews-card">
        <div className="card-title review-title"><div><p>콘텐츠 관리</p><h2>신고 검토함</h2></div><div className="filters">{(["전체", "검토 대기", "숨김 처리", "문제 없음"] as const).map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
        <div className="review-table" role="table">
          <div className="review-head" role="row"><span>대상</span><span>신고 사유</span><span>접수 시각</span><span>상태</span><span>처리</span></div>
          {visibleReviews.length ? visibleReviews.map((item) => <div className="review-row" role="row" key={item.id}><span><b className={`type-dot ${item.type}`}>{item.type.slice(0, 1)}</b>{item.target}</span><span>{item.reason}</span><span>{item.time}</span><span><b className={`state ${item.state.replace(" ", "-")}`}>{item.state}</b></span><span>{item.state === "검토 대기" ? <div className="review-actions"><button onClick={() => updateReview(item.id, "문제 없음")}>유지</button><button className="hide" onClick={() => updateReview(item.id, "숨김 처리")}>숨김</button></div> : <button className="done" onClick={() => setNotice("처리 내역을 다시 확인했습니다")}>완료</button>}</span></div>) : <div className="no-reviews">선택한 상태의 신고 항목이 없습니다.</div>}
        </div>
      </section>

      <footer className="admin-footer">dawn. admin · 비공개 운영 화면 · 데이터는 데모용으로 표시됩니다</footer>
    </main>
  );
}

function Metric({ value, label, trend, color }: { value: string; label: string; trend: string; color: string }) {
  return <article className={`metric ${color}`}><span className="metric-mark" /><strong>{value}</strong><p>{label}</p><small>{trend}</small></article>;
}
