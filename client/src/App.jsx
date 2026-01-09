import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import UsersPage from './pages/UsersPage';
import './App.css';

// 创建QueryClient实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// 主应用组件
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<LoginPage />} />
          

          <Route path="/programs" element={
            <ProtectedRoute>
              <ProgramsPage />
            </ProtectedRoute>
          } />
          <Route path="/programs/:projectId" element={
            <ProtectedRoute>
              <ProgramsPage />
            </ProtectedRoute>
          } />
          <Route path="/programs/:projectId/:programId" element={
            <ProtectedRoute>
              <ProgramDetailPage />
            </ProtectedRoute>
          } />
          
          {/* 用户管理页面 */}
          <Route path="/users" element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          } />
          
          {/* 根路径重定向到登录页 */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* 404页面 */}
          <Route path="*" element={<div className="not-found">404 - 页面不存在</div>} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
