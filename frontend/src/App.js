import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import SetupFamily from "./pages/auth/SetupFamily";
import Today from "./pages/dashboard/Today";
import WeeklyPlanner from "./pages/planner/WeeklyPlanner";
import Curriculum from "./pages/curriculum/Curriculum";
import Lessons from "./pages/lessons/Lessons";
import LessonDetail from "./pages/lessons/LessonDetail";
import Children from "./pages/children/Children";
import Chores from "./pages/chores/Chores";
import Messaging from "./pages/messaging/Messaging";
import Allowance from "./pages/allowance/Allowance";
import Reports from "./pages/reports/Reports";
import Settings from "./pages/settings/Settings";
import Notifications from "./pages/notifications/Notifications";
import AdminDashboard from "./pages/admin/AdminDashboard";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function FamilyRequired({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.family_id) return <Navigate to="/setup-family" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && user.family_id) return <Navigate to="/today" replace />;
  if (user && !user.family_id) return <Navigate to="/setup-family" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

      {/* Setup */}
      <Route path="/setup-family" element={<ProtectedRoute><SetupFamily /></ProtectedRoute>} />

      {/* App routes */}
      <Route element={<FamilyRequired><AppLayout /></FamilyRequired>}>
        <Route path="/today" element={<Today />} />
        <Route path="/planner" element={<WeeklyPlanner />} />
        <Route path="/curriculum" element={<Curriculum />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/lessons/:lessonId" element={<LessonDetail />} />
        <Route path="/children" element={<Children />} />
        <Route path="/chores" element={<Chores />} />
        <Route path="/messages" element={<Messaging />} />
        <Route path="/allowance" element={<Allowance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid rgba(232, 213, 181, 0.5)',
              borderRadius: '1rem',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: '600',
              color: '#2A2A2A',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
