import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { authApi, isAuthError, settingsApi } from "./lib/api";
import { useTeacherReplyNotify } from "./lib/useChatNotify";
import { useAuth } from "./store/auth";
import { PageLoader } from "./components/ui/Spinner";
import { UserLayout } from "./layouts/UserLayout";
import { AdminLayout } from "./layouts/AdminLayout";
// Boshlang'ich bundle (tez kerak): landing, auth, dashboard + yengil sahifalar.
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { HomePage } from "./pages/user/HomePage";
import { LessonListPage } from "./pages/user/LessonListPage";
import { TicketsListPage } from "./pages/user/TicketsListPage";
import { ExamPage } from "./pages/user/ExamPage";
import { MistakesPage } from "./pages/user/MistakesPage";
import { AccountPage } from "./pages/user/AccountPage";
import { PaymentPage } from "./pages/user/PaymentPage";
import { ReferralPage } from "./pages/user/ReferralPage";
import { ProfilePage } from "./pages/user/ProfilePage";

// Lazy (alohida chunk — kerak bo'lganda yuklanadi): og'ir sahifalar + butun admin bo'limi.
// Oddiy foydalanuvchilar admin kodini umuman yuklamaydi → tezroq dastlabki yuklanish.
const named = <K extends string>(p: Promise<Record<K, unknown>>, k: K) =>
  p.then((m) => ({ default: m[k] as ComponentType }));
const RealExamPage = lazy(() => named(import("./pages/user/RealExamPage"), "RealExamPage"));
const SmartTestPage = lazy(() => named(import("./pages/user/SmartTestPage"), "SmartTestPage"));
const LessonTestPage = lazy(() => named(import("./pages/user/LessonTestPage"), "LessonTestPage"));
const RoadSignsPage = lazy(() => named(import("./pages/user/RoadSignsPage"), "RoadSignsPage"));
const AdminDashboard = lazy(() => named(import("./pages/admin/AdminDashboard"), "AdminDashboard"));
const AdminQuestions = lazy(() => named(import("./pages/admin/AdminQuestions"), "AdminQuestions"));
const AdminTopics = lazy(() => named(import("./pages/admin/AdminTopics"), "AdminTopics"));
const AdminTariffs = lazy(() => named(import("./pages/admin/AdminTariffs"), "AdminTariffs"));
const AdminPayments = lazy(() => named(import("./pages/admin/AdminPayments"), "AdminPayments"));
const AdminUsers = lazy(() => named(import("./pages/admin/AdminUsers"), "AdminUsers"));
const AdminReferral = lazy(() => named(import("./pages/admin/AdminReferral"), "AdminReferral"));
const AdminSettings = lazy(() => named(import("./pages/admin/AdminSettings"), "AdminSettings"));
// Ustoz tizimi — user bo'limi, ustoz paneli, admin bo'limi (hammasi lazy)
const TeachersPage = lazy(() => named(import("./pages/user/TeachersPage"), "TeachersPage"));
const TeacherChatPage = lazy(() => named(import("./pages/user/TeacherChatPage"), "TeacherChatPage"));
const TeacherLayout = lazy(() => named(import("./layouts/TeacherLayout"), "TeacherLayout"));
const TeacherEmpty = lazy(() => named(import("./layouts/TeacherLayout"), "TeacherEmpty"));
const TeacherChatThread = lazy(() => named(import("./pages/teacher/TeacherChatThread"), "TeacherChatThread"));
const TeacherTests = lazy(() => named(import("./pages/teacher/TeacherTests"), "TeacherTests"));
const TeacherSettings = lazy(() => named(import("./pages/teacher/TeacherSettings"), "TeacherSettings"));
const AdminTeachers = lazy(() => named(import("./pages/admin/AdminTeachers"), "AdminTeachers"));

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <PageLoader />
    </div>
  );
}

/** Tarmoq/server (offline, 5xx) xatosida — chiqarmaymiz, qayta-urinish ko'rsatamiz. */
function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold text-ink">Ulanishda xatolik</p>
      <p className="max-w-sm text-sm text-muted">
        Server bilan bog'lanib bo'lmadi. Internet aloqangizni tekshiring va qayta urinib ko'ring.
      </p>
      <button
        onClick={onRetry}
        className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition hover:bg-accent-dark"
      >
        Qayta urinish
      </button>
    </div>
  );
}

function RequireUser() {
  const token = useAuth((s) => s.token);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logoutUser);
  const location = useLocation();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    // FAQAT haqiqiy auth xatosida (401/403) chiqaramiz — offline/5xx da tokenni saqlaymiz.
    if (isError && isAuthError(error)) logout();
  }, [isError, error, logout]);

  // Ustoz javob berganda qisqa signal (ovoz + toast) — barcha user sahifalarida ishlaydi
  // (RequireUser hech qachon qayta o'rnatilmaydi, shuning uchun navigatsiyada uzilmaydi).
  useTeacherReplyNotify(!!token && !!data && data.role !== "teacher");

  if (!token) return <Navigate to="/login" replace />;
  if (isLoading) return <FullPageLoader />;
  if (isError) {
    if (isAuthError(error)) return <Navigate to="/login" replace />;
    return <ConnectionError onRetry={() => refetch()} />;
  }
  // Ustoz o'z paneliga yo'naltiriladi (testlar /lesson orqali ochiq qoladi)
  if (data?.role === "teacher" && !location.pathname.startsWith("/lesson")) {
    return <Navigate to="/teacher" replace />;
  }
  return <Outlet />;
}

function RequireTeacher() {
  const token = useAuth((s) => s.token);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logoutUser);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    if (isError && isAuthError(error)) logout();
  }, [isError, error, logout]);

  if (!token) return <Navigate to="/login" replace />;
  if (isLoading) return <FullPageLoader />;
  if (isError) {
    if (isAuthError(error)) return <Navigate to="/login" replace />;
    return <ConnectionError onRetry={() => refetch()} />;
  }
  if (data && data.role !== "teacher") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const adminToken = useAuth((s) => s.adminToken);
  const logoutAdmin = useAuth((s) => s.logoutAdmin);
  const { isLoading, isError, error, refetch } = useQuery({
    queryKey: ["adminCheck"],
    queryFn: settingsApi.get,
    enabled: !!adminToken,
    retry: false,
  });

  useEffect(() => {
    if (isError && isAuthError(error)) logoutAdmin();
  }, [isError, error, logoutAdmin]);

  // Bitta umumiy login: alohida /admin/login sahifasi yo'q — token bo'lmasa
  // yoki muddati o'tsa ham asosiy /login sahifasiga yo'naltiramiz.
  if (!adminToken) return <Navigate to="/login" replace />;
  if (isLoading) return <FullPageLoader />;
  if (isError) {
    if (isAuthError(error)) return <Navigate to="/login" replace />;
    return <ConnectionError onRetry={() => refetch()} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<RequireUser />}>
        <Route path="/real-exam" element={<RealExamPage />} />
        <Route path="/smart-test" element={<SmartTestPage />} />
        <Route path="/lesson/:id" element={<LessonTestPage />} />
        <Route path="/teachers/:id/chat" element={<TeacherChatPage />} />
        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/tickets" element={<TicketsListPage />} />
          <Route path="/road-signs" element={<RoadSignsPage />} />
          <Route path="/lesson" element={<LessonListPage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/teachers" element={<TeachersPage />} />
        </Route>
      </Route>

      {/* Ustoz paneli — faqat role=teacher */}
      <Route element={<RequireTeacher />}>
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherEmpty />} />
          <Route path="chat/:threadId" element={<TeacherChatThread />} />
          <Route path="tests" element={<TeacherTests />} />
          <Route path="settings" element={<TeacherSettings />} />
        </Route>
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="topics" element={<AdminTopics />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="tariffs" element={<AdminTariffs />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="referral" element={<AdminReferral />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
