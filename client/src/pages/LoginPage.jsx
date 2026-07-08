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
    } catch (err) {
      setError('登录失败: ' + (err.message || '网络错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{
        width: 420, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
        border: 'none', padding: '32px 24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClusterOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>SuperD</Title>
          <Text type="secondary">Supervisor 进程管理平台</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}

        <form onSubmit={handleSubmit}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input size="large" prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="用户名" value={username}
              onChange={e => setUsername(e.target.value)} required />
            <Input.Password size="large" prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="密码" value={password}
              onChange={e => setPassword(e.target.value)} required />
            <Button type="primary" htmlType="submit" size="large" block loading={loading}
              style={{
                height: 44, fontWeight: 600, fontSize: 16, marginTop: 8,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none'
              }}>
              登录
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
