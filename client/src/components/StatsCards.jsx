import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { AppstoreOutlined, CheckCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const items = [
  { title: '总程序数', key: 'total', icon: AppstoreOutlined, color: '#111', bg: '#f4f4f5' },
  { title: '运行中', key: 'running', icon: CheckCircleOutlined, color: '#10b981', bg: '#ecfdf5' },
  { title: '已停止', key: 'stopped', icon: PauseCircleOutlined, color: '#64748b', bg: '#f8fafc' },
  { title: '异常', key: 'error', icon: ExclamationCircleOutlined, color: '#ef4444', bg: '#fef2f2' },
];

const StatsCards = ({ stats }) => (
  <Row gutter={16} style={{ marginBottom: 20 }}>
    {items.map((c) => (
      <Col span={6} key={c.key}>
        <Card bodyStyle={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic
              title={c.title}
              value={stats[c.key] || 0}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}
            />
            <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon style={{ fontSize: 18, color: c.color }} />
            </div>
          </div>
        </Card>
      </Col>
    ))}
  </Row>
);

export default StatsCards;
