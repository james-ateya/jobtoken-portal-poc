import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignupPage } from "./pages/Signup";
import { DashboardPage } from "./pages/Dashboard";
import { EmployerDashboard } from "./pages/EmployerDashboard";
import { EmployerApplicationsPage } from "./pages/EmployerApplications";
import { EmployerPromptSeriesListPage } from "./pages/EmployerPromptSeriesListPage";
import { EmployerPromptSeriesEditorPage } from "./pages/EmployerPromptSeriesEditorPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminPromptGradingPage } from "./pages/AdminPromptGradingPage";
import { AdminWithdrawalsPage } from "./pages/AdminWithdrawalsPage";
import { SeekerProfilePage } from "./pages/SeekerProfile";
import { EmployerProfilePage } from "./pages/EmployerProfile";
import { SeekerApplicationsPage } from "./pages/SeekerApplications";
import { SeekerEarningsPage } from "./pages/SeekerEarningsPage";
import { PromptSeriesBrowsePage } from "./pages/PromptSeriesBrowsePage";
import { PromptSeriesDetailPage } from "./pages/PromptSeriesDetailPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeMenu } from "./components/ThemeMenu";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, UserPlus, LogOut, Briefcase, X, CheckCircle, AlertCircle, LayoutDashboard, Users, Shield, UserCircle, ClipboardList, Building2, Banknote, PenLine } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .single();

      if (!error && data) {
        if (data.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setUserRole(null);
          setToast({
            message:
              "Your account has been deactivated. Contact support if you need access restored.",
            type: "error",
          });
          setTimeout(() => setToast(null), 6000);
          return;
        }
        setUserRole(data.role);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-100 dark:bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-zinc-200 text-zinc-900 dark:bg-[#0a0a0a] dark:text-white font-sans selection:bg-emerald-500/30 transition-colors">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className={`fixed top-6 left-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
                toast.type === 'success' ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-red-500 text-white border-red-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl dark:border-white/5 dark:bg-black/50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-2xl tracking-tighter text-zinc-900 dark:text-white"
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black">
                <Briefcase className="w-5 h-5" />
              </div>
              <span>
                Job<span className="text-emerald-600 dark:text-emerald-500">Token</span>
              </span>
            </Link>

            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeMenu />
              {user ? (
                <div className="flex items-center gap-6">
                  <Link
                    to={
                      userRole === "employer"
                        ? "/dashboard/employer"
                        : userRole === "admin"
                          ? "/admin"
                          : "/dashboard"
                    }
                    className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {userRole === 'employer' ? "Employer Portal" : userRole === 'admin' ? "Admin Portal" : "Dashboard"}
                  </Link>
                  {userRole === "seeker" && (
                    <>
                      <Link
                        to="/dashboard/applications"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4" />
                        My applications
                      </Link>
                      <Link
                        to="/dashboard/prompts"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <PenLine className="w-4 h-4" />
                        Prompt tasks
                      </Link>
                      <Link
                        to="/dashboard/earnings"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <Banknote className="w-4 h-4" />
                        Earnings
                      </Link>
                      <Link
                        to="/dashboard/profile"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <UserCircle className="w-4 h-4" />
                        My profile
                      </Link>
                    </>
                  )}
                  {userRole === "employer" && (
                    <>
                      <Link
                        to="/dashboard/employer/profile"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <Building2 className="w-4 h-4" />
                        Company profile
                      </Link>
                      <Link
                        to="/dashboard/employer/applications"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Applications
                      </Link>
                      <Link
                        to="/dashboard/employer/prompts"
                        className="text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <PenLine className="w-4 h-4" />
                        Prompt series
                      </Link>
                    </>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-sm font-medium text-zinc-800 dark:text-white">
                        {user.email}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                        {userRole === 'employer' ? 'Employer' : userRole === 'admin' ? 'Administrator' : 'Job Seeker'}
                      </span>
                    </div>
                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="p-2 rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-white/5 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-white dark:text-black dark:hover:bg-emerald-400 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="dark:mx-0 dark:mb-0 dark:rounded-none dark:border-transparent dark:shadow-none mx-3 sm:mx-6 mb-6 mt-0 min-h-[calc(100vh-5rem)] rounded-2xl border border-zinc-300/70 bg-[#0a0a0a] text-white shadow-lg dark:shadow-none overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage user={user} showToast={showToast} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "seeker" ? (
                  <SeekerProfilePage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <UserCircle className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Seeker profile only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      This page is for job seekers to add education and experience. Use your main
                      dashboard if you are an employer or admin.
                    </p>
                    <Link
                      to="/"
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Back to jobs
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/earnings"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "seeker" ? (
                  <SeekerEarningsPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <Banknote className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Seekers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Earnings and withdrawals are for job seeker accounts.
                    </p>
                    <Link
                      to={userRole === "employer" ? "/dashboard/employer" : "/admin"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to portal
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/prompts"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "seeker" ? (
                  <PromptSeriesBrowsePage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <PenLine className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Seekers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Prompt tasks are for job seeker accounts.
                    </p>
                    <Link
                      to={userRole === "employer" ? "/dashboard/employer" : "/admin"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to portal
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/prompts/:seriesId"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "seeker" ? (
                  <PromptSeriesDetailPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <PenLine className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Seekers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Prompt tasks are for job seeker accounts.
                    </p>
                    <Link
                      to={userRole === "employer" ? "/dashboard/employer" : "/admin"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to portal
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "seeker" ? (
                  <SeekerApplicationsPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <ClipboardList className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Seekers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Application history is for job seekers. Open your employer portal to review
                      candidates.
                    </p>
                    <Link
                      to={userRole === "employer" ? "/dashboard/employer" : "/dashboard"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to dashboard
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === 'admin' ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                    <Shield className="w-16 h-16 text-emerald-500 mb-4 opacity-20" />
                    <h1 className="text-2xl font-bold">Admin Access</h1>
                    <p className="text-zinc-500 mt-2">Administrators use the Admin Portal for platform management.</p>
                    <Link to="/admin" className="mt-6 px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all">
                      Go to Admin Portal
                    </Link>
                  </div>
                ) : (
                  <DashboardPage user={user} showToast={showToast} />
                )}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/employer" 
            element={
              <ProtectedRoute user={user} loading={loading}>
                <EmployerDashboard user={user} showToast={showToast} />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/dashboard/employer/applications"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <EmployerApplicationsPage user={user} showToast={showToast} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/employer/prompts"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "employer" ? (
                  <EmployerPromptSeriesListPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <PenLine className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Employers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Managing prompt series is limited to employer accounts.
                    </p>
                    <Link
                      to={userRole === "seeker" ? "/dashboard" : "/admin"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to portal
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/employer/prompts/:seriesId"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "employer" ? (
                  <EmployerPromptSeriesEditorPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <PenLine className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Employers only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Managing prompt series is limited to employer accounts.
                    </p>
                    <Link
                      to={userRole === "seeker" ? "/dashboard" : "/admin"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      Go to portal
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/employer/profile"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "employer" ? (
                  <EmployerProfilePage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
                    <Building2 className="w-14 h-14 text-zinc-600 mb-4" />
                    <h1 className="text-xl font-bold">Employer profile only</h1>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Company details are for employer accounts. Sign in as an employer or open your
                      job seeker dashboard.
                    </p>
                    <Link
                      to={userRole === "seeker" ? "/dashboard" : "/"}
                      className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                    >
                      {userRole === "seeker" ? "Seeker dashboard" : "Home"}
                    </Link>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === 'admin' ? (
                  <AdminDashboard user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                    <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                    <h1 className="text-2xl font-bold">Access Denied</h1>
                    <p className="text-zinc-500 mt-2">You do not have administrative privileges to view this page.</p>
                  </div>
                )}
              </ProtectedRoute>
            } 
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "admin" ? (
                  <AdminUsersPage showToast={showToast} />
                ) : (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                    <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                    <h1 className="text-2xl font-bold">Access Denied</h1>
                    <p className="text-zinc-500 mt-2">You do not have administrative privileges to view this page.</p>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/prompt-grading"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "admin" ? (
                  <AdminPromptGradingPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                    <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                    <h1 className="text-2xl font-bold">Access Denied</h1>
                    <p className="text-zinc-500 mt-2">You do not have administrative privileges to view this page.</p>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/withdrawals"
            element={
              <ProtectedRoute user={user} loading={loading}>
                {userRole === "admin" ? (
                  <AdminWithdrawalsPage user={user} showToast={showToast} />
                ) : (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                    <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                    <h1 className="text-2xl font-bold">Access Denied</h1>
                    <p className="text-zinc-500 mt-2">You do not have administrative privileges to view this page.</p>
                  </div>
                )}
              </ProtectedRoute>
            }
          />
        </Routes>
        </div>
      </div>
    </Router>
  );
}
