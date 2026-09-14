import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, Typography, Alert, Space, Result } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { register, getRegistrationStatus } from '../utils/api';

const { Text } = Typography;

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [allowed, setAllowed] = useState(null); // null=加载中 false=未开放 true=开放
  const navigate = useNavigate();

  useEffect(() => {
    getRegistrationStatus()
      .then((data) => setAllowed(!!data.enabled))
      .catch(() => setAllowed(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username)) {
      setError('用户名需为3-50位字母、数字、下划线或连字符');
      return;
    }
    if (password.length < 6 || password.length > 72) {
      setError('密码长度需在 6-72 位之间');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(username, password);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || '注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  if (allowed === false) {
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
        <Result
          status="warning"
          title="注册功能未开放"
          extra={
            <Button type="primary" onClick={() => navigate('/login')}>
              返回登录
            </Button>
          }
        />
      </div>
    );
  }

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
            <Text style={{ color: '#64748b', fontSize: 13 }}>注册账号（需管理员审核）</Text>
          </div>
        </div>

        {submitted ? (
          <Result
            status="info"
            title="注册申请已提交"
            subTitle="请等待管理员审核通过后即可登录使用。"
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            }
          />
        ) : (
          <>
            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 999 }} />}

            <form onSubmit={handleSubmit}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Input
                  size="large"
                  prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="用户名（3-50位字母、数字、下划线或连字符）"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="login-capsule-input"
                  style={{ height: 44 }}
                />
                <Input.Password
                  size="large"
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="密码（至少6位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-capsule-input"
                  style={{ height: 44 }}
                />
                <Input.Password
                  size="large"
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="确认密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  style={{ width: 160, display: 'block', margin: '4px auto 0' }}
                >
                  注册
                </Button>
                <div style={{ textAlign: 'center' }}>
                  <Link to="/login" style={{ color: '#64748b', fontSize: 13 }}>
                    已有账号？返回登录
                  </Link>
                </div>
              </Space>
            </form>
          </>
        )}
      </Card>
    </div>
  );
};

export default RegisterPage;
