const axios = require('axios');

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 测试登录函数
async function testLogin() {
  try {
    console.log('测试admin用户登录...');
    const response = await api.post('/login', {
      username: 'admin',
      password: 'oplgmpnb91b9akbd'
    });
    console.log('登录响应:', response.data);
    
    if (response.data.success) {
      console.log('✓ 登录成功！');
      
      // 测试获取用户信息
      console.log('\n测试获取用户信息...');
      const userInfoResponse = await api.get('/user');
      console.log('用户信息:', userInfoResponse.data);
      
      // 测试获取用户列表
      console.log('\n测试获取用户列表...');
      const usersResponse = await api.get('/users');
      console.log('用户列表数量:', usersResponse.data.length);
      console.log('前3个用户:', usersResponse.data.slice(0, 3));
    } else {
      console.log('✗ 登录失败:', response.data.error);
    }
  } catch (error) {
    console.error('✗ 测试过程中发生错误:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

testLogin();