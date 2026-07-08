import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { AppstoreOutlined, CheckCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const cardStyle = {
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  transition: 'all 0.3s ease',
  border: '1px solid #f0f0f0'
};

const valueStyle = { fontSize: '32px', fontWeight: '700', color: '#2d3748' };
const titleStyle = { fontSize: '14px', color: '#718096', marginBottom: '8px' };

const StatsCards = ({ stats }) => {
  const items = [
    { title: '总程序数', value: stats.total, icon: <AppstoreOutlined style={{ color: '#1890ff' }} /> },
    { title: '运行中', value: stats.running, icon: <CheckCircleOutlined style={{ color: '#38a169' }} /> },
    { title: '已停止', value: stats.stopped, icon: <PauseCircleOutlined style={{ color: '#e53e3e' }} /> },
    { title: '异常', value: stats.error, icon: <ExclamationCircleOutlined style={{ color: '#e53e3e' }} /> },
  ];

  return (
    <Row gutter={24} style={{ marginBottom: 24 }}>
      {items.map((item, idx) => (
        <Col span={6} key={idx}>
          <Card bordered={false} hoverable style={cardStyle}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)'}
          >
            <Statistic title={item.title} value={item.value} prefix={item.icon}
              valueStyle={valueStyle} titleStyle={titleStyle} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default StatsCards;
