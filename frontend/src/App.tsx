import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Feed from './pages/Feed';
import CreatePost from './pages/CreatePost';
import ApiUrlDisplay from './components/ApiUrlDisplay';
import './App.css';

/**
 * ProtectedRoute wrapper component that guards authenticated routes.
 * Redirects unauthenticated users to the login page while showing a loading
 * state during authentication verification.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  // Show loading state while checking authentication status
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Redirect to login if user is not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

/**
 * Layout component that provides consistent navigation and header structure
 * for all authenticated pages. Includes app header with navigation links,
 * user info display, and logout functionality.
 */
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <header className="app-header">
        <h1><Link to="/">Micro Blogging</Link></h1>
        <nav>
          <ul>
            <li><Link to="/">Feed</Link></li>
            <li><Link to="/create">New Post</Link></li>
            <li><Link to={`/profile/${user?.id}`}>Profile</Link></li>
          </ul>
        </nav>
        <div className="user-info">
          <span>Welcome, {user?.displayName} {user?.followersCount !== undefined && `(${user.followersCount} followers)`}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      <main className="content">
        {children}
      </main>
    </div>
  );
};

/**
 * Main App component that sets up routing and authentication context.
 * Wraps the entire application with AuthProvider for global auth state
 * and defines all application routes with appropriate protection.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            {/* Public authentication routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected route: Main feed */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Feed />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Protected route: Create new post */}
            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreatePost />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Protected route: User profile with dynamic userId parameter */}
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          <ApiUrlDisplay />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;