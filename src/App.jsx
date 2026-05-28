import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import DailyTasks from './pages/DailyTasks';
import Habits from './pages/Habits';
import HabitDetail from './pages/HabitDetail';
import FutureTasks from './pages/FutureTasks';
import Profile from './pages/Profile';
import Namaz from './pages/Namaz';
import BottomNav from './components/BottomNav';
import FirstVisitAnimation from './components/FirstVisitAnimation';
import ThemeToggle from './components/ThemeToggle';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <FirstVisitAnimation />
        <ThemeToggle />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Navigate to="/daily-tasks" replace />} />
          <Route path="/daily-tasks" element={
            <ProtectedRoute>
              <DailyTasks />
              <BottomNav />
            </ProtectedRoute>
          } />
          <Route path="/habits" element={
            <ProtectedRoute>
              <Habits />
              <BottomNav />
            </ProtectedRoute>
          } />
          <Route path="/namaz" element={
            <ProtectedRoute>
              <Namaz />
              <BottomNav />
            </ProtectedRoute>
          } />
          <Route path="/habits/:habitId" element={
            <ProtectedRoute>
              <HabitDetail />
            </ProtectedRoute>
          } />
          <Route path="/future-tasks" element={
            <ProtectedRoute>
              <FutureTasks />
              <BottomNav />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
              <BottomNav />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
