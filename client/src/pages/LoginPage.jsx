import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    console.log('Form submitted, preventing default and propagation');
    
    try {
      console.log('Attempting login with username:', username);
      const result = await login(username, password);
      console.log('Login result:', result);
      if (!result.success) {
        setError(result.error || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('登录过程中发生错误: ' + error.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Supervisor</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">登录</button>
        </form>

      </div>
    </div>
  );
};

export default LoginPage;