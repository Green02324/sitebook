import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ViewAsProvider } from "./context/ViewContext";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ProjectsList } from "./pages/ProjectsList";
import { ProjectDetail } from "./pages/ProjectDetail";
import { EstimateTab } from "./pages/tabs/EstimateTab";
import { ActualsTab } from "./pages/tabs/ActualsTab";
import { ComparisonTab } from "./pages/tabs/ComparisonTab";
import { ReportPage } from "./pages/ReportPage";
import { Profile } from "./pages/Profile";
import { AdminUsers } from "./pages/AdminUsers";
import { OverheadPage } from "./pages/OverheadPage";
import { AnnualReportPage } from "./pages/AnnualReportPage";
import { api } from "./api";
import type { User } from "./types";

// Wraps the admin's read-only drill-in routes so every nested page reads
// the target user's data via ViewContext instead of the admin's own.
function ViewAsUser({ children }: { children: ReactNode }) {
  const { userId } = useParams<{ userId: string }>();
  const [targetUser, setTargetUser] = useState<User | null>(null);

  useEffect(() => {
    if (userId) api.get<User>(`/users/${userId}`).then(setTargetUser).catch(() => {});
  }, [userId]);

  if (!userId) return <Navigate to="/admin" replace />;

  return (
    <ViewAsProvider userId={userId} userName={targetUser?.name}>
      {children}
    </ViewAsProvider>
  );
}

const projectTabRoutes = (
  <>
    <Route index element={<Navigate to="estimate" replace />} />
    <Route path="estimate" element={<EstimateTab />} />
    <Route path="actuals" element={<ActualsTab />} />
    <Route path="comparison" element={<ComparisonTab />} />
  </>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:projectId" element={<ProjectDetail />}>
              {projectTabRoutes}
            </Route>
            <Route path="/projects/:projectId/report" element={<ReportPage />} />
            <Route path="/overhead" element={<OverheadPage />} />
            <Route path="/annual-report" element={<AnnualReportPage />} />
            <Route path="/profile" element={<Profile />} />

            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminUsers />
                </RequireAdmin>
              }
            />
          </Route>

          {/* Admin read-only drill-in: ViewAsUser must wrap Layout itself (not just the
              leaf page) so the Sidebar and read-only banner — rendered inside Layout,
              alongside the page via Outlet — also see the read-only view context. */}
          <Route
            path="/admin/users/:userId"
            element={
              <RequireAdmin>
                <ViewAsUser>
                  <Layout />
                </ViewAsUser>
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/:projectId" element={<ProjectDetail />}>
              {projectTabRoutes}
            </Route>
            <Route path="projects/:projectId/report" element={<ReportPage />} />
            <Route path="overhead" element={<OverheadPage />} />
            <Route path="annual-report" element={<AnnualReportPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
