import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, getUserInfo } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 登录函数
  const login = async (username, password) => {
    try {
      console.log('AuthContext login called with:', username);
      const loginResponse = await apiLogin(username, password);
      console.log('apiLogin response:', loginResponse);
      
      // 登录失败时确保清除现有用户信息
      if (!loginResponse.success) {
        console.log('Login failed:', loginResponse.error);
        setUser(null); // 清除任何现有用户信息
        return { success: false, error: loginResponse.error };
      }
      
      // 登录成功后获取用户信息
      localStorage.setItem('token', loginResponse.token); // 保存令牌到localStorage
      const userInfo = await getUserInfo();
      console.log('getUserInfo successful:', userInfo);
      setUser(userInfo);
      // 确保导航到主页面
      console.log('Navigating to /programs/1');
      // 使用setTimeout确保状态更新后再跳转
      setTimeout(() => {
        navigate('/programs/1', { replace: true }); // 默认选择第一个项目，replace: true避免返回登录页
      }, 0);
      return { success: true };
    } catch (error) {
      console.error('AuthContext login error:', error);
      setUser(null); // 发生错误时也清除用户信息
      return { success: false, error: error.message };
    }
  };

  // 退出登录
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token'); // 清除令牌
    navigate('/login');
  };

  // 检查用户登录状态
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      } catch (error) {
        console.error('checkLoginStatus error:', error);
        // 用户未登录或会话已过期，清除令牌
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义钩子，方便组件使用认证上下文
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};