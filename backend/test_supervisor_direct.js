const xmlrpc = require('xmlrpc');

// 创建Supervisor XML-RPC客户端
const client = xmlrpc.createClient({
  host: 'localhost',
  port: 9001,
  path: '/RPC2',
  basic_auth: {
    user: 'user',
    pass: '123'
  }
});

// 测试函数
function testSupervisorRpc() {
  // 测试获取所有程序信息
  console.log('1. 测试获取所有程序信息:');
  client.methodCall('supervisor.getAllProcessInfo', [], function(error, result) {
    if (error) {
      console.error('获取程序信息失败:', error);
    } else {
      console.log('成功获取程序信息:', result);
      console.log('程序数量:', result.length);
    }
    console.log('\n');

    // 测试获取fake_web_server程序信息
    console.log('2. 测试获取fake_web_server程序信息:');
    client.methodCall('supervisor.getProcessInfo', ['fake_web_server'], function(error, result) {
      if (error) {
        console.error('获取程序信息失败:', error);
      } else {
        console.log('成功获取程序信息:', result);
      }
      console.log('\n');

      // 测试获取标准输出日志
      console.log('3. 测试获取标准输出日志:');
      client.methodCall('supervisor.tailProcessStdoutLog', ['fake_web_server', 0, 500], function(error, result) {
        if (error) {
          console.error('获取日志失败:', error);
        } else {
          console.log('成功获取日志:', result);
          console.log('日志类型:', typeof result);
          console.log('日志长度:', result.length);
          console.log('日志前100个字符:', result.substring(0, 100));
        }
        console.log('\n');

        // 测试获取标准错误日志
        console.log('4. 测试获取标准错误日志:');
        client.methodCall('supervisor.tailProcessStderrLog', ['fake_web_server', 0, 500], function(error, result) {
          if (error) {
            console.error('获取日志失败:', error);
          } else {
            console.log('成功获取日志:', result);
            console.log('日志类型:', typeof result);
            console.log('日志长度:', result.length);
          }
        });
      });
    });
  });
}

// 执行测试
testSupervisorRpc();