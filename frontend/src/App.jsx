import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import ScrollToTop from "./components/ScrollToTop";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import UserManagementPage from "./pages/UserManagementPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import MyProfilePage from "./pages/MyProfilePage";
import AccountSetupRoute from "./components/AccountSetupRoute";
import ChangeOwnPasswordPage from "./pages/ChangeOwnPasswordPage";
import NewCasePage from "./pages/NewCasePage";
import ConsentFormPage from "./components/ConsentFormModal";
import MyCasesPage from "./pages/MyCasesPage";
import StudentRecordsPage from "./pages/StudentRecordsPage";
import ProgressNotesPage from "./pages/ProgressNotesPage";
import InterventionPlansPage from "./pages/InterventionPlansPage";
import CaseDetailsPage from "./pages/CaseDetailsPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import LLMRecommendationsPage from "./pages/LLMRecommendationsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReportsPage from "./pages/ReportsPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import SettingsPage from "./pages/SettingsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import PreCounselingFormPage from "./pages/PreCounselingFormPage";

function LandingRoute() {
  const navigate = useNavigate();

  return <LandingPage onLogin={() => navigate("/login")} />;
}

function RequiredActionPage({ title, description }) {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8F6F4] px-5">
      <section className="w-full max-w-lg rounded-2xl border border-[#E4DEDA] bg-white p-8 text-center shadow-[0_20px_60px_rgba(45,30,25,0.08)]">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mt-8 grid h-12 w-12 place-items-center rounded-xl bg-[#F5EAEA] text-[#8C1518]">
          <Icon name="shield" className="h-6 w-6" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[#262220]">{title}</h1>

        <p className="mt-4 text-sm leading-7 text-[#746D69]">{description}</p>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-7 rounded-xl bg-[#8C1518] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#701013]"
        >
          Continue temporarily
        </button>
      </section>
    </main>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8F6F4] px-5">
      <div className="text-center">
        <p className="text-6xl font-semibold text-[#8C1518]">404</p>

        <h1 className="mt-4 text-2xl font-semibold text-[#262220]">Page not found</h1>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 rounded-xl bg-[#8C1518] px-5 py-3 text-sm font-semibold text-white"
        >
          Return home
        </button>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      {" "}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingRoute />} />

        <Route path="/login" element={<LoginPage />} />

        <Route path="/pre-counseling/:token" element={<PreCounselingFormPage />} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/complete-profile"
          element={
            <ProtectedRoute>
              <CompleteProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Counselor-Admin", "Counselor-User"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["Counselor-Admin"]}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me"
          element={
            <ProtectedRoute allowedRoles={["Counselor-Admin", "Counselor-User"]}>
              <AccountSetupRoute>
                <MyProfilePage />
              </AccountSetupRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/change-password"
          element={
            <ProtectedRoute allowedRoles={["Counselor-Admin", "Counselor-User"]}>
              <AccountSetupRoute>
                <ChangeOwnPasswordPage />
              </AccountSetupRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/cases/new" element={<NewCasePage />} />
        <Route path="/consent-form" element={<ConsentFormPage />} />
        <Route path="/cases" element={<MyCasesPage />} />
        <Route path="/students" element={<StudentRecordsPage />} />
        <Route path="/progress-notes" element={<ProgressNotesPage />} />
        <Route path="/intervention-plans" element={<InterventionPlansPage />} />
        <Route path="/cases/:id" element={<CaseDetailsPage />} />
        <Route path="/follow-ups" element={<FollowUpsPage />} />
        <Route path="/llm-recommendations" element={<LLMRecommendationsPage />} />
        <Route
          path="/knowledge-base"
          element={
            <ProtectedRoute allowedRoles={["Counselor-Admin", "Counselor-User"]}>
              <KnowledgeBasePage />
            </ProtectedRoute>
          }
        />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/activity-logs" element={<ActivityLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  );
}
