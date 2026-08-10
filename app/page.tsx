"use client";

import { ChangeEvent, FormEvent, SyntheticEvent, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, signOut } from "firebase/auth";
import { IoAddCircleOutline, IoBookmark, IoBookmarkOutline, IoChatbubbleOutline, IoCheckmark, IoClose, IoEllipsisHorizontal, IoGridOutline, IoHeart, IoHeartOutline, IoHomeOutline, IoImagesOutline, IoNotificationsOutline, IoPersonCircleOutline, IoSearchOutline, IoSettingsOutline } from "react-icons/io5";
import { FcGoogle } from "react-icons/fc";
import { auth } from "./firebase";

type Comment = { id: number; user: string; text: string; createdAt: string };
type Post = { id: number; author: string; name: string; avatar: string; image: string; caption: string; tags: string[]; likes: number; comments: Comment[]; location: string; createdAt: string };
type Notice = { id: number; text: string; createdAt: string; read: boolean; image?: string };
type User = { name: string; username: string; bio: string; avatar: string; privateAccount: boolean };
type AppData = { user: User; posts: Post[]; liked: number[]; saved: number[]; following: string[]; blocked: string[]; notInterested: number[]; notifications: Notice[]; reports: number[] };
type FeedPost = Post & { feedReason?: string };

const timestamp = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const AVATAR_FALLBACK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
function formatTimestamp(value: string) { const time = new Date(value); return Number.isNaN(time.valueOf()) ? value : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time); }
function normalizeTimestamp(value: string) { if (!Number.isNaN(new Date(value).valueOf())) return value; const offsets: Record<string, number> = { "2시간 전": 120, "5시간 전": 300, "어제": 1440, "방금 전": 0 }; return timestamp(offsets[value] ?? 0); }
function fallbackAvatar(event: SyntheticEvent<HTMLImageElement>) { event.currentTarget.onerror = null; event.currentTarget.src = AVATAR_FALLBACK; }

const STORAGE_KEY = "dawn-local-social-v3";
const people = [
  { name: "민서", username: "minseokim", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" },
  { name: "도윤", username: "doyun.notes", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80" },
  { name: "하늘", username: "haneul.day", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" },
];
const seedPosts: Post[] = [
  { id: 101, author: "minseokim", name: "민서", avatar: people[0].avatar, location: "성수동, 서울", image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=85", caption: "햇빛이 닿는 공간에서 보낸 느긋한 오후.", tags: ["#성수", "#주말기록"], likes: 248, comments: [{ id: 1, user: "jiyoon", text: "빛이 정말 예뻐요!", createdAt: timestamp(120) }], createdAt: timestamp(120) },
  { id: 102, author: "doyun.notes", name: "도윤", avatar: people[1].avatar, location: "을지로", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85", caption: "좋은 커피와 복잡한 생각들. 오늘의 한 잔 기록.", tags: ["#커피", "#을지로카페"], likes: 186, comments: [{ id: 2, user: "haneul", text: "분위기 최고네요", createdAt: timestamp(300) }], createdAt: timestamp(300) },
  { id: 103, author: "haneul.day", name: "하늘", avatar: people[2].avatar, location: "강릉", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85", caption: "파도 소리만 들리는 곳. 마음까지 맑아지는 중.", tags: ["#강릉", "#바다"], likes: 432, comments: [{ id: 3, user: "minseokim", text: "다음엔 같이 가요!", createdAt: timestamp(1440) }], createdAt: timestamp(1440) },
];

function makeDefault(): AppData {
  return {
    user: { name: "서연", username: "seoyeon.daily", bio: "일상의 빛나는 순간을 기록합니다. ✷\nSeoul, Korea", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80", privateAccount: false },
    posts: seedPosts, liked: [], saved: [], following: [], blocked: [], notInterested: [], reports: [],
    notifications: [{ id: 10, text: "하늘님이 회원님의 게시물을 좋아합니다.", createdAt: timestamp(120), read: false, image: seedPosts[2].image }, { id: 11, text: "지우님이 회원님을 팔로우하기 시작했습니다.", createdAt: timestamp(1440), read: false }],
  };
}

const navItems = [{ id: "home", label: "홈", Icon: IoHomeOutline }, { id: "explore", label: "탐색", Icon: IoSearchOutline }, { id: "create", label: "만들기", Icon: IoAddCircleOutline }, { id: "activity", label: "활동", Icon: IoHeartOutline }, { id: "saved", label: "저장됨", Icon: IoBookmarkOutline }, { id: "profile", label: "프로필", Icon: IoPersonCircleOutline }, { id: "settings", label: "설정", Icon: IoSettingsOutline }] as const;

function rankFeed(data: AppData, mode: "recommended" | "following"): FeedPost[] {
  const engaged = new Set([...data.liked, ...data.saved]);
  const tagWeights = new Map<string, number>();
  data.posts.forEach((post) => { if (engaged.has(post.id) || post.comments.some((comment) => comment.user === data.user.username)) post.tags.forEach((tag) => tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + (engaged.has(post.id) ? 8 : 5))); });
  const candidates = data.posts.filter((post) => post.author !== data.user.username && !data.blocked.includes(post.author) && !data.notInterested.includes(post.id));
  if (mode === "following") return candidates.filter((post) => data.following.includes(post.author)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((post) => ({ ...post, feedReason: "팔로우한 계정의 최신 게시물" }));
  return candidates.map((post) => {
    const ageHours = Math.max(0, (Date.now() - Date.parse(post.createdAt)) / 3_600_000);
    const matchingTags = post.tags.reduce((score, tag) => score + (tagWeights.get(tag) ?? 0), 0);
    const followScore = data.following.includes(post.author) ? 32 : 0;
    const popularity = Math.min(18, Math.log2(post.likes + post.comments.length * 3 + 1) * 2);
    const freshness = Math.max(0, 24 - ageHours) * 1.4;
    const score = followScore + matchingTags + popularity + freshness;
    const feedReason = followScore ? "팔로우한 계정이 최근에 공유했어요" : matchingTags ? `${post.tags.find((tag) => tagWeights.has(tag))} 관련 게시물에 반응했어요` : popularity > 12 ? "많은 사람이 저장하고 있어요" : "최근에 공유된 게시물이에요";
    return { ...post, feedReason, score };
  }).sort((a, b) => b.score - a.score);
}

export default function Home() {
  const [data, setData] = useState<AppData>(makeDefault);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState("home");
  const [feedMode, setFeedMode] = useState<"recommended" | "following">("recommended");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [composer, setComposer] = useState(false);
  const [profileEditor, setProfileEditor] = useState(false);
  const [story, setStory] = useState<{ name: string; image: string } | null>(null);
  const [postMenu, setPostMenu] = useState<number | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [draftImage, setDraftImage] = useState("");

  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { const restored = JSON.parse(saved) as AppData; restored.notInterested ??= []; if (restored.following?.length === 1 && restored.following[0] === "minseokim") restored.following = []; restored.posts = restored.posts.map((post) => ({ ...post, createdAt: normalizeTimestamp(post.createdAt), comments: post.comments.map((comment) => ({ ...comment, createdAt: normalizeTimestamp(comment.createdAt) })) })); restored.notifications = restored.notifications.map((notice) => ({ ...notice, createdAt: normalizeTimestamp(notice.createdAt) })); setData(restored); } } catch { localStorage.removeItem(STORAGE_KEY); } setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, ready]);
  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    setSignedIn(Boolean(firebaseUser));
    if (firebaseUser?.displayName) setData((current) => ({ ...current, user: { ...current.user, name: firebaseUser.displayName ?? current.user.name, username: current.user.username || firebaseUser.email?.split("@")[0] || "dawn.user" } }));
    setAuthReady(true);
  }), []);

  const visiblePosts = useMemo(() => {
    const allowed = data.posts.filter((post) => !data.blocked.includes(post.author));
    if (tab !== "explore" || !query.trim()) return allowed;
    const term = query.toLowerCase();
    return allowed.filter((post) => [post.name, post.author, post.location, post.caption, ...post.tags].join(" ").toLowerCase().includes(term));
  }, [data.blocked, data.posts, query, tab]);
  const ownPosts = data.posts.filter((post) => post.author === data.user.username);
  const savedPosts = data.posts.filter((post) => data.saved.includes(post.id));
  const rankedPosts = useMemo(() => rankFeed(data, feedMode), [data, feedMode]);
  const homePeople = useMemo(() => people.filter((person) => data.following.includes(person.username)), [data.following]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function selectTab(next: string) { if (next === "create") setComposer(true); else setTab(next); }
  function update(mutator: (current: AppData) => AppData) { setData((current) => mutator(current)); }
  function addNotice(current: AppData, text: string, image?: string): AppData { return { ...current, notifications: [{ id: Date.now(), text, image, read: false, createdAt: timestamp() }, ...current.notifications] }; }
  async function googleLogin() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (error) { setAuthMessage(firebaseErrorMessage((error as { code?: string }).code)); setAuthBusy(false); }
  }

  function toggleLike(id: number) {
    update((current) => {
      const active = current.liked.includes(id); const post = current.posts.find((item) => item.id === id);
      const next = { ...current, liked: active ? current.liked.filter((item) => item !== id) : [...current.liked, id], posts: current.posts.map((item) => item.id === id ? { ...item, likes: Math.max(0, item.likes + (active ? -1 : 1)) } : item) };
      return post ? addNotice(next, active ? `${post.name}님의 게시물 좋아요를 취소했습니다.` : `${post.name}님의 게시물에 좋아요를 남겼습니다.`, post.image) : next;
    });
  }
  function toggleSave(id: number) { update((current) => { const active = current.saved.includes(id); const post = current.posts.find((item) => item.id === id); const next = { ...current, saved: active ? current.saved.filter((item) => item !== id) : [...current.saved, id] }; return post ? addNotice(next, active ? `${post.name}님의 게시물 저장을 취소했습니다.` : `${post.name}님의 게시물을 저장했습니다.`, post.image) : next; }); notify(data.saved.includes(id) ? "저장을 취소했어요" : "게시물을 저장했어요"); }
  function addComment(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const text = String(form.get("comment") || "").trim(); if (!text) return;
    update((current) => { const post = current.posts.find((item) => item.id === id); const next = { ...current, posts: current.posts.map((item) => item.id === id ? { ...item, comments: [...item.comments, { id: Date.now(), user: current.user.username, text, createdAt: timestamp() }] } : item) }; return post ? addNotice(next, `${post?.name}님의 게시물에 댓글을 남겼습니다.`, post.image) : next; }); event.currentTarget.reset();
  }
  function deleteComment(postId: number, commentId: number) { update((current) => { const post = current.posts.find((item) => item.id === postId); const next = { ...current, posts: current.posts.map((item) => item.id === postId ? { ...item, comments: item.comments.filter((comment) => comment.id !== commentId) } : item) }; return post ? addNotice(next, `${post.name}님의 게시물에서 댓글을 삭제했습니다.`, post.image) : next; }); notify("댓글을 삭제했어요"); }
  function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draftCaption.trim() && !draftImage) return notify("사진 또는 설명을 입력해 주세요");
    update((current) => ({ ...current, posts: [{ id: Date.now(), author: current.user.username, name: current.user.name, avatar: current.user.avatar, location: "서울", image: draftImage || "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=85", caption: draftCaption || "오늘의 순간을 기록했어요.", tags: draftCaption.match(/#[^\s#]+/g) ?? [], likes: 0, comments: [], createdAt: timestamp() }, ...current.posts] }));
    setDraftCaption(""); setDraftImage(""); setComposer(false); setTab("profile"); notify("새 게시물을 공유했어요");
  }
  function chooseImage(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDraftImage(String(reader.result)); reader.readAsDataURL(file); }
  function toggleFollow(username: string) { update((current) => { const following = current.following.includes(username); const name = people.find((person) => person.username === username)?.name ?? username; const next = { ...current, following: following ? current.following.filter((item) => item !== username) : [...current.following, username] }; return addNotice(next, following ? `${name}님을 팔로우 취소했습니다.` : `${name}님을 팔로우했습니다.`); }); }
  function reportPost(id: number) { update((current) => ({ ...current, reports: current.reports.includes(id) ? current.reports : [...current.reports, id] })); setPostMenu(null); notify("신고가 접수되어 관리자 검토함으로 전달됐어요"); }
  function markNotInterested(id: number) { update((current) => ({ ...current, notInterested: current.notInterested.includes(id) ? current.notInterested : [...current.notInterested, id] })); setPostMenu(null); notify("이 게시물과 비슷한 추천을 줄일게요"); }
  function blockAuthor(post: Post) { update((current) => ({ ...current, blocked: current.blocked.includes(post.author) ? current.blocked : [...current.blocked, post.author] })); setPostMenu(null); notify(`${post.name}님의 게시물을 더 이상 표시하지 않아요`); }
  function deletePost(id: number) { update((current) => ({ ...current, posts: current.posts.filter((item) => item.id !== id), liked: current.liked.filter((item) => item !== id), saved: current.saved.filter((item) => item !== id) })); setPostMenu(null); notify("게시물을 삭제했어요"); }
  function markAllRead() { update((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) })); notify("모든 알림을 읽음으로 표시했어요"); }
  function updateProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); update((current) => { const user = { ...current.user, name: String(form.get("name") || "서연"), username: String(form.get("username") || "seoyeon.daily").replace(/^@/, ""), bio: String(form.get("bio") || "") }; return { ...current, user, posts: current.posts.map((post) => post.author === current.user.username ? { ...post, author: user.username, name: user.name } : post) }; }); setProfileEditor(false); notify("프로필을 저장했어요"); }
  function resetLocalData() { if (!window.confirm("이 브라우저의 모든 데모 데이터를 초기화할까요?")) return; localStorage.removeItem(STORAGE_KEY); setData(makeDefault()); notify("데모 데이터를 초기화했어요"); }

  if (!ready || !authReady) return <main className="loading-screen"><strong>dawn<span>.</span></strong><p>계정을 확인하는 중입니다</p></main>;
  if (!signedIn) return <AuthScreen message={authMessage} busy={authBusy} onGoogleLogin={() => { void googleLogin(); }} />;

  return <main className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => selectTab("home")}>dawn<span>.</span></button><nav>{navItems.map(({ id, label, Icon }) => <button key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => selectTab(id)} aria-label={label}><Icon className="nav-icon" />{label}{id === "activity" && data.notifications.some((item) => !item.read) ? <i className="unread-dot" /> : null}</button>)}</nav><a href="/admin" className="admin-entry"><IoGridOutline className="nav-icon" />관리자 확인</a><div className="sidebar-bottom"><button className="account-mini" onClick={() => selectTab("profile")}><img className="avatar-safe" src={data.user.avatar} onError={fallbackAvatar} alt="내 프로필" /><span><strong>{data.user.name}</strong><small>@{data.user.username}</small></span></button></div></aside>
    <section className="content"><header className="mobile-header"><button className="brand" onClick={() => selectTab("home")}>dawn<span>.</span></button><button onClick={() => selectTab("activity")} aria-label="알림"><IoNotificationsOutline /></button></header>
      {tab === "home" && <><section className="stories">{[{ name: "내 스토리", image: data.user.avatar }, ...homePeople].map((person, index) => <button className="story" key={person.name} onClick={() => setStory({ name: person.name, image: person.avatar || person.image })}><span className={index === 0 ? "story-ring own" : "story-ring"}><img className="avatar-safe" src={person.avatar || person.image} onError={fallbackAvatar} alt="" /></span><small>{person.name}</small></button>)}</section><div className="feed-mode" role="tablist"><button className={feedMode === "recommended" ? "active" : ""} onClick={() => setFeedMode("recommended")}>추천</button><button className={feedMode === "following" ? "active" : ""} onClick={() => setFeedMode("following")}>팔로잉</button><span>{feedMode === "recommended" ? "반응과 관심사를 반영한 순서" : "팔로우한 계정의 최신순"}</span></div><PostFeed posts={rankedPosts} data={data} onLike={toggleLike} onSave={toggleSave} onComment={addComment} onDeleteComment={deleteComment} onMenu={setPostMenu} /></>}
      {tab === "explore" && <Explore query={query} setQuery={setQuery} posts={visiblePosts} data={data} onFollow={toggleFollow} onLike={toggleLike} onSave={toggleSave} onComment={addComment} onDeleteComment={deleteComment} onMenu={setPostMenu} />}
      {tab === "activity" && <Activity data={data} onMarkAll={markAllRead} />}
      {tab === "saved" && <Collection title="저장한 게시물" subtitle="나중에 다시 보고 싶은 순간들이에요." posts={savedPosts} data={data} onLike={toggleLike} onSave={toggleSave} onComment={addComment} onDeleteComment={deleteComment} onMenu={setPostMenu} />}
      {tab === "profile" && <Profile data={data} ownPosts={ownPosts} onEdit={() => setProfileEditor(true)} onDelete={deletePost} onCreate={() => setComposer(true)} />}
      {tab === "settings" && <Settings data={data} setData={setData} onReset={resetLocalData} onLogout={async () => { await signOut(auth); notify("로그아웃했어요"); }} notify={notify} />}
    </section>
    {postMenu !== null && <PostMenu post={data.posts.find((item) => item.id === postMenu)!} isOwn={data.posts.find((item) => item.id === postMenu)?.author === data.user.username} onClose={() => setPostMenu(null)} onReport={reportPost} onNotInterested={markNotInterested} onBlock={blockAuthor} onDelete={deletePost} />}
    {composer && <Composer caption={draftCaption} setCaption={setDraftCaption} image={draftImage} onImage={chooseImage} onClose={() => setComposer(false)} onSubmit={createPost} />}
    {profileEditor && <ProfileEditor user={data.user} onClose={() => setProfileEditor(false)} onSubmit={updateProfile} />}
    {story && <div className="modal-backdrop" onMouseDown={() => setStory(null)}><section className="story-viewer" onMouseDown={(event) => event.stopPropagation()}><img className="avatar-safe" src={story.image} onError={fallbackAvatar} alt="스토리" /><div><strong>{story.name}</strong><button onClick={() => setStory(null)} aria-label="스토리 닫기"><IoClose /></button></div><p>오늘의 새로운 순간입니다.</p></section></div>}
    <nav className="mobile-nav">{navItems.slice(0, 5).map(({ id, label, Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => selectTab(id)} aria-label={label}><Icon /></button>)}</nav>{toast && <div className="toast"><IoCheckmark /> {toast}</div>}
  </main>;
}

function firebaseErrorMessage(code?: string) {
  const messages: Record<string, string> = { "auth/operation-not-allowed": "Firebase 콘솔에서 Google 로그인을 사용 설정해 주세요.", "auth/unauthorized-domain": "이 주소는 Google 로그인에 아직 허용되지 않았습니다.", "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  return messages[code ?? ""] ?? "로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.";
}

function AuthScreen({ message, busy, onGoogleLogin }: { message: string; busy: boolean; onGoogleLogin: () => void }) {
  return <main className="local-login"><section><button className="brand" type="button">dawn<span>.</span></button><p>나만의 순간을 기록하고 연결하세요</p><h1>다시 만나서 반가워요.</h1><button className="google-login" type="button" onClick={onGoogleLogin} disabled={busy}><FcGoogle />{busy ? "Google 로그인으로 이동 중…" : "Google로 계속하기"}</button>{message && <p className="auth-message" role="alert">{message}</p>}<small>Google 계정으로 안전하게 로그인합니다.</small></section></main>;
}

function PostFeed(props: { posts: FeedPost[]; data: AppData; onLike: (id: number) => void; onSave: (id: number) => void; onComment: (event: FormEvent<HTMLFormElement>, id: number) => void; onDeleteComment: (postId: number, commentId: number) => void; onMenu: (id: number) => void }) { return <div className="feed">{props.posts.map((post) => <PostCard key={post.id} post={post} {...props} />)}{!props.posts.length && <Empty text="표시할 게시물이 없어요." />}</div>; }
function PostCard({ post, data, onLike, onSave, onComment, onDeleteComment, onMenu }: { post: FeedPost; data: AppData; onLike: (id: number) => void; onSave: (id: number) => void; onComment: (event: FormEvent<HTMLFormElement>, id: number) => void; onDeleteComment: (postId: number, commentId: number) => void; onMenu: (id: number) => void }) { const liked = data.liked.includes(post.id); const saved = data.saved.includes(post.id); return <article className="post-card"><header className="post-head"><img className="avatar-safe" src={post.avatar} onError={fallbackAvatar} alt="" /><div><strong>{post.name}</strong><small>{post.location}</small></div><button onClick={() => onMenu(post.id)} aria-label="게시물 메뉴"><IoEllipsisHorizontal /></button></header><img className="post-image" src={post.image} alt={`${post.name}의 게시물`} /><div className="post-body"><div className="actions"><div><button className={liked ? "liked" : ""} onClick={() => onLike(post.id)} aria-label="좋아요">{liked ? <IoHeart /> : <IoHeartOutline />}</button><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} aria-label="댓글"><IoChatbubbleOutline /></button></div><button className={saved ? "saved" : ""} onClick={() => onSave(post.id)} aria-label="저장">{saved ? <IoBookmark /> : <IoBookmarkOutline />}</button></div><strong className="likes">좋아요 {post.likes.toLocaleString()}개</strong>{post.feedReason && <p className="feed-reason">✦ {post.feedReason}</p>}<p className="caption"><strong>@{post.author}</strong> {post.caption} <span>{post.tags.join(" ")}</span></p>{post.comments.slice(-2).map((comment) => <p className={`comment ${comment.user === data.user.username ? "own-comment" : ""}`} key={comment.id}><strong>@{comment.user}</strong> {comment.text} <small>{formatTimestamp(comment.createdAt)}</small>{comment.user === data.user.username && <button className="comment-delete" onClick={() => onDeleteComment(post.id, comment.id)} aria-label="댓글 삭제">삭제</button>}</p>)}<small className="time">{formatTimestamp(post.createdAt)}</small></div><form className="comment-form" onSubmit={(event) => onComment(event, post.id)}><input id={`comment-${post.id}`} name="comment" placeholder="댓글을 남겨 보세요..." aria-label="댓글 입력" /><button>게시</button></form></article>; }
function Explore({ query, setQuery, posts, data, onFollow, onLike, onSave, onComment, onDeleteComment, onMenu }: { query: string; setQuery: (value: string) => void; posts: Post[]; data: AppData; onFollow: (value: string) => void; onLike: (id: number) => void; onSave: (id: number) => void; onComment: (event: FormEvent<HTMLFormElement>, id: number) => void; onDeleteComment: (postId: number, commentId: number) => void; onMenu: (id: number) => void }) { return <><section className="page-heading"><p>새로운 순간을 발견해 보세요</p><h1>탐색</h1><label className="search"><IoSearchOutline /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사람, 태그 또는 장소 검색" /></label></section><section className="people-list">{people.map((person) => <div key={person.username}><img className="avatar-safe" src={person.avatar} onError={fallbackAvatar} alt="" /><span><strong>{person.name}</strong><small>@{person.username}</small></span><button className={data.following.includes(person.username) ? "outline" : "primary"} onClick={() => onFollow(person.username)}>{data.following.includes(person.username) ? "팔로잉" : "팔로우"}</button></div>)}</section><div className="explore-label">검색 결과 · 최신순</div><PostFeed posts={posts} data={data} onLike={onLike} onSave={onSave} onComment={onComment} onDeleteComment={onDeleteComment} onMenu={onMenu} /></>; }
function Activity({ data, onMarkAll }: { data: AppData; onMarkAll: () => void }) { return <section className="activity-page"><div className="page-heading inline-heading"><div><p>당신을 향한 새로운 반응</p><h1>활동</h1></div><button className="outline" onClick={onMarkAll}>모두 읽음</button></div><div className="activity-list">{data.notifications.map((notice) => <div className={!notice.read ? "new" : ""} key={notice.id}><span className="activity-avatar">✦</span><p>{notice.text}<small>{formatTimestamp(notice.createdAt)}</small></p>{notice.image ? <img src={notice.image} alt="" className="activity-thumb" /> : null}</div>)}{!data.notifications.length && <Empty text="새로운 알림이 없습니다." />}</div></section>; }
function Collection({ title, subtitle, posts, data, onLike, onSave, onComment, onDeleteComment, onMenu }: { title: string; subtitle: string; posts: Post[]; data: AppData; onLike: (id: number) => void; onSave: (id: number) => void; onComment: (event: FormEvent<HTMLFormElement>, id: number) => void; onDeleteComment: (postId: number, commentId: number) => void; onMenu: (id: number) => void }) { return <section><div className="page-heading"><p>{subtitle}</p><h1>{title}</h1></div><PostFeed posts={posts} data={data} onLike={onLike} onSave={onSave} onComment={onComment} onDeleteComment={onDeleteComment} onMenu={onMenu} /></section>; }
function Profile({ data, ownPosts, onEdit, onDelete, onCreate }: { data: AppData; ownPosts: Post[]; onEdit: () => void; onDelete: (id: number) => void; onCreate: () => void }) { return <section className="profile-page"><div className="profile-hero"><img className="avatar-safe" src={data.user.avatar} onError={fallbackAvatar} alt="내 프로필" /><div><div className="profile-name"><h1>{data.user.name}</h1><button className="outline" onClick={onEdit}>프로필 수정</button></div><p className="handle">@{data.user.username} {data.user.privateAccount ? "· 비공개" : "· 공개"}</p><div className="stats"><span><strong>{ownPosts.length}</strong> 게시물</span><span><strong>{data.following.length * 132 + 1020}</strong> 팔로워</span><span><strong>{data.following.length}</strong> 팔로잉</span></div><p>{data.user.bio}</p></div></div><div className="profile-grid-title"><IoGridOutline /> 게시물 <button onClick={onCreate}>새 게시물</button></div>{ownPosts.length ? <div className="profile-grid">{ownPosts.map((post) => <button key={post.id} className="profile-tile" onClick={() => onDelete(post.id)} title="클릭하여 삭제"><img src={post.image} alt="내 게시물" /><span>삭제</span></button>)}</div> : <Empty text="첫 게시물을 공유해 보세요." />}</section>; }
function Settings({ data, setData, onReset, onLogout, notify }: { data: AppData; setData: (fn: (data: AppData) => AppData) => void; onReset: () => void; onLogout: () => void; notify: (message: string) => void }) { return <section className="settings-page"><div className="page-heading"><p>내 기기에서만 적용됩니다</p><h1>설정</h1></div><div className="setting-card"><div><strong>비공개 계정</strong><p>새 팔로워의 요청을 직접 관리합니다.</p></div><button className={`switch ${data.user.privateAccount ? "on" : ""}`} onClick={() => { setData((current) => ({ ...current, user: { ...current.user, privateAccount: !current.user.privateAccount } })); notify("계정 공개 범위를 변경했어요"); }} aria-label="비공개 계정 전환"><span /></button></div><div className="setting-card"><div><strong>차단한 계정</strong><p>{data.blocked.length ? `${data.blocked.map((item) => `@${item}`).join(", ")} 계정이 차단되어 있습니다.` : "차단한 계정이 없습니다."}</p></div><button className="outline" onClick={() => { setData((current) => ({ ...current, blocked: [] })); notify("차단 목록을 비웠어요"); }}>차단 해제</button></div><div className="setting-card"><div><strong>로컬 데이터 초기화</strong><p>이 브라우저의 게시물, 댓글, 활동 기록을 초기 상태로 되돌립니다.</p></div><button className="danger" onClick={onReset}>초기화</button></div><div className="setting-card"><div><strong>계정 로그아웃</strong><p>현재 Firebase 계정에서 로그아웃합니다. 로컬 게시물과 설정은 이 기기에 남습니다.</p></div><button className="outline" onClick={onLogout}>로그아웃</button></div></section>; }
function Composer({ caption, setCaption, image, onImage, onClose, onSubmit }: { caption: string; setCaption: (value: string) => void; image: string; onImage: (event: ChangeEvent<HTMLInputElement>) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="composer" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><h2>새 게시물</h2><button onClick={onClose} aria-label="게시물 작성 닫기"><IoClose /></button></div><form onSubmit={onSubmit}><label className={`upload-area ${image ? "has-image" : ""}`}>{image ? <img src={image} alt="업로드 미리보기" /> : <><IoImagesOutline /><strong>사진을 선택해 주세요</strong><small>이 기기에 저장됩니다</small></>}<input type="file" accept="image/*" onChange={onImage} /></label><textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="어떤 순간을 공유하고 싶나요? #해시태그" maxLength={500} /><div className="composer-foot"><span>{caption.length}/500</span><button className="primary">공유하기</button></div></form></section></div>; }
function ProfileEditor({ user, onClose, onSubmit }: { user: User; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="composer profile-editor" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><h2>프로필 수정</h2><button onClick={onClose} aria-label="프로필 수정 닫기"><IoClose /></button></div><form onSubmit={onSubmit}><label>이름<input name="name" defaultValue={user.name} required /></label><label>사용자 이름<input name="username" defaultValue={user.username} required pattern="[a-zA-Z0-9._-]+" /></label><label>소개<textarea name="bio" defaultValue={user.bio} maxLength={160} /></label><div className="composer-foot"><span>로컬 프로필</span><button className="primary">저장</button></div></form></section></div>; }
function PostMenu({ post, isOwn, onClose, onReport, onNotInterested, onBlock, onDelete }: { post: Post; isOwn: boolean; onClose: () => void; onReport: (id: number) => void; onNotInterested: (id: number) => void; onBlock: (post: Post) => void; onDelete: (id: number) => void }) { return <div className="menu-backdrop" onMouseDown={onClose}><section className="post-menu" onMouseDown={(event) => event.stopPropagation()}>{isOwn ? <button className="danger" onClick={() => onDelete(post.id)}>게시물 삭제</button> : <><button onClick={() => onNotInterested(post.id)}>관심 없음</button><button className="danger" onClick={() => onReport(post.id)}>게시물 신고</button><button onClick={() => onBlock(post)}>@{post.author} 차단</button></>}<button onClick={onClose}>취소</button></section></div>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
