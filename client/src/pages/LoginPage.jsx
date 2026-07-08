import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Typography, Alert, Space } from 'antd';
import { ClusterOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc',
    }}>
      <Card style={{
        width: 400, borderRadius: 12, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)'
      }} bodyStyle={{ padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClusterOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a', fontSize: 22 }}>
            Supervisor
          </Title>
          <Text style={{ color: '#64748b', fontSize: 14 }}>进程管理平台</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 8 }} />}

        <form onSubmit={handleSubmit}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input size="large" prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="用户名" value={username}
              onChange={e => setUsername(e.target.value)} required
              style={{ height: 44 }} />
            <Input.Password size="large" prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="密码" value={password}
              onChange={e => setPassword(e.target.value)} required
              style={{ height: 44 }} />
            <Button type="primary" htmlType="submit" size="large" block loading={loading}
              style={{ height: 44, fontWeight: 600, fontSize: 15, marginTop: 4 }}>
              登录
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
