import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { AppstoreOutlined, CheckCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const cards = [
  { title: '总程序数', key: 'total', icon: AppstoreOutlined, color: '#6366f1', bg: '#eef2ff' },
  { title: '运行中', key: 'running', icon: CheckCircleOutlined, color: '#10b981', bg: '#ecfdf5' },
  { title: '已停止', key: 'stopped', icon: PauseCircleOutlined, color: '#64748b', bg: '#f8fafc' },
  { title: '异常', key: 'error', icon: ExclamationCircleOutlined, color: '#ef4444', bg: '#fef2f2' },
];

const StatsCards = ({ stats }) => (
  <Row gutter={20} style={{ marginBottom: 20 }}>
    {cards.map((c) => (
      <Col span={6} key={c.key}>
        <Card style={{ borderLeft: `3px solid ${c.color}`, background: '#fff' }} bodyStyle={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title={c.title} value={stats[c.key] || 0} valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }} />
            <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon style={{ fontSize: 20, color: c.color }} />
            </div>
          </div>
        </Card>
      </Col>
    ))}
  </Row>
);

export default StatsCards;
