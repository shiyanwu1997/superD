import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.success) setError(result.error || '用户名或密码错误');
    } catch {
      setError('登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        }}
        bodyStyle={{ padding: '40px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            data-testid="logo-capsule"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '8px 24px 8px 10px',
              borderRadius: 999,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" stroke="#111" strokeWidth="2" fill="#111" />
              <text
                x="20"
                y="27"
                textAnchor="middle"
                fill="#fff"
                fontSize="22"
                fontWeight="700"
                fontFamily="Inter, sans-serif"
              >
                S
              </text>
            </svg>
            <span style={{ color: '#111', fontWeight: 700, fontSize: 20, letterSpacing: '-.3px' }}>Supervisor</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text style={{ color: '#64748b', fontSize: 13 }}>进程管理平台</Text>
          </div>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 999 }} />}

        <form onSubmit={handleSubmit}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input
              size="large"
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="login-capsule-input"
              style={{ height: 44 }}
            />
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-capsule-input"
              style={{ height: 44 }}
            />
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              className="ant-btn-login-capsule"
              style={{ marginTop: 4, width: 160, display: 'block', margin: '4px auto 0' }}
            >
              登录
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
