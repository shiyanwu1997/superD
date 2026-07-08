import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from 'antd';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import ProgramsPage from './pages/ProgramsPage';
import UsersPage from './pages/UsersPage';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <AuthProvider>
          <AuthWrapper />
        </AuthProvider>
      </ConfigProvider>
    </ErrorBoundary>
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
      {/* ProgramDetailPage 通过 ProgramsPage 弹窗打开，不需要独立路由 */}

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