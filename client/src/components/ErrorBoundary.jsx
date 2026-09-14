import React from 'react';
import { Button, Result } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出现错误"
          subTitle={this.state.error?.message || '未知错误'}
          extra={[
            <Button type="primary" key="reload" onClick={() => window.location.reload()}>
              刷新页面
            </Button>,
            <Button key="home" onClick={() => window.location.href = '/login'}>
              返回登录
            </Button>
          ]}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
