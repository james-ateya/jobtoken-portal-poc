import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { SignupPage } from "./pages/Signup";
import { DashboardPage } from "./pages/Dashboard";
import { EmployerDashboard } from "./pages/EmployerDashboard";
import { EmployerApplicationsPage } from "./pages/EmployerApplications";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, UserPlus, LogOut, Briefcase, X, CheckCircle, AlertCircle, LayoutDashboard, Users, Shield } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
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

        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black">
                <Briefcase className="w-5 h-5" />
              </div>
              <span>Job<span className="text-emerald-500">Token</span></span>
            </Link>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-6">
                  <Link 
                    to={userRole === 'employer' ? "/dashboard/employer" : userRole === 'admin' ? "/admin" : "/dashboard"} 
                    className="text-sm font-medium text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {userRole === 'employer' ? "Employer Portal" : userRole === 'admin' ? "Admin Portal" : "Dashboard"}
                  </Link>
                  {userRole === 'employer' && (
                    <Link 
                      to="/dashboard/employer/applications" 
                      className="text-sm font-medium text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Applications
                    </Link>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-sm font-medium text-white">{user.email}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                        {userRole === 'employer' ? 'Employer' : userRole === 'admin' ? 'Administrator' : 'Job Seeker'}
                      </span>
                    </div>
                    <button 
                      onClick={() => supabase.auth.signOut()}
                      className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link 
                    to="/login"
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Link>
                  <Link 
                    to="/signup"
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white text-black hover:bg-emerald-400 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage user={user} showToast={showToast} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
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
        </Routes>
      </div>
    </Router>
  );
}
