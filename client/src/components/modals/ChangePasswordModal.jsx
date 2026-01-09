import React from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { changeOwnPassword } from '../../utils/api';

const ChangePasswordModal = ({ open, onClose }) => {
  const [passwordForm] = Form.useForm();

  // 修改密码mutation
  const changePasswordMutation = useMutation({
    mutationFn: ({ oldPassword, newPassword }) => changeOwnPassword(oldPassword, newPassword),
    onSuccess: () => {
      message.success('密码修改成功');
      onClose();
      passwordForm.resetFields();
    },
    onError: (error) => {
      message.error('修改密码失败: ' + (error.response?.data?.error || error.message));
    },
  });

  // 处理密码修改提交
  const handleChangePassword = (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    
    const hide = message.loading('正在修改密码...', 0);
    changePasswordMutation.mutate(
      { oldPassword: values.oldPassword, newPassword: values.newPassword },
      { onSettled: () => hide() }
    );
  };

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Form form={passwordForm} onFinish={handleChangePassword} layout="vertical">
        <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}>
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true }]}>
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true }]}>
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit">确认修改</Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;