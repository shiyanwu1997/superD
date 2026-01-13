import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
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

// 主应用组件
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AuthProvider>
          {/* 使用AuthWrapper组件来确保在AuthContext内部使用useAuth */}
          <AuthWrapper />
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

// 在AuthContext内部定义的组件，用于包装路由
const AuthWrapper = () => {
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
  
  return (
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
      
      {/* 用户管理页面 - 已改为模态窗口，不再使用单独路由 */}
      {/* <Route path="/users" element={
        <ProtectedRoute>
          <UsersPage />
        </ProtectedRoute>
      } /> */}
      
      {/* 404页面 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;