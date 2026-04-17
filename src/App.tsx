import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LeadBrowser from "@/pages/LeadBrowser";
import ImportManager from "@/pages/ImportManager";
import CallLogs from "@/pages/CallLogs";
import AgentMonitor from "@/pages/AgentMonitor";
import UserManagement from "@/pages/UserManagement";
import ExportCenter from "@/pages/ExportCenter";
import DeleteLeads from "@/pages/DeleteLeads";
import AgentCallQueue from "@/pages/AgentCallQueue";
import AgentHistory from "@/pages/AgentHistory";
import FollowUpDiary from "@/pages/FollowUpDiary";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import FieldSettings from "@/pages/FieldSettings";
import LeadDetail from "@/pages/LeadDetail";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Redirect to appropriate default page based on role
  const defaultPath = role === 'admin' ? '/dashboard' : '/agent';

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={defaultPath} replace />} />
        {/* Admin routes */}
        {role === 'admin' && (
          <>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<LeadBrowser />} />
            <Route path="import" element={<ImportManager />} />
            <Route path="call-logs" element={<CallLogs />} />
            <Route path="agents" element={<AgentMonitor />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="export" element={<ExportCenter />} />
            <Route path="delete-leads" element={<DeleteLeads />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="follow-ups" element={<FollowUpDiary />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="settings/fields" element={<FieldSettings />} />
          </>
        )}
        {/* Agent routes */}
        {(role === 'agent' || role === 'admin') && (
          <>
            <Route path="agent" element={<AgentCallQueue />} />
            <Route path="agent/history" element={<AgentHistory />} />
            <Route path="agent/follow-ups" element={<FollowUpDiary />} />
            <Route path="leads/:id" element={<LeadDetail />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

function LoginGuard() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={role === 'admin' ? '/dashboard' : '/agent'} replace />;
  return <Login />;
}

export default App;
