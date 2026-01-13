const { callRpc } = require('./services/supervisorService');

async function testLogFetching() {
  try {
    // 测试获取标准输出日志
    console.log('测试获取标准输出日志...');
    const stdout = await callRpc(1, 'supervisor.tailProcessStdoutLog', ['fake_web_server', 0, 500]);
    console.log('标准输出日志:', stdout);
    console.log('标准输出日志类型:', typeof stdout);
    console.log('标准输出日志长度:', stdout.length);
    console.log('\n');

    // 测试获取标准错误日志
    console.log('测试获取标准错误日志...');
    const stderr = await callRpc(1, 'supervisor.tailProcessStderrLog', ['fake_web_server', 0, 500]);
    console.log('标准错误日志:', stderr);
    console.log('标准错误日志类型:', typeof stderr);
    console.log('标准错误日志长度:', stderr.length);
    console.log('\n');

    // 测试其他Supervisor API，看看是否能正常工作
    console.log('测试获取所有程序信息...');
    const processes = await callRpc(1, 'supervisor.getAllProcessInfo', []);
    console.log('所有程序信息:', processes);
    console.log('\n');

    // 测试获取特定程序信息
    console.log('测试获取特定程序信息...');
    const processInfo = await callRpc(1, 'supervisor.getProcessInfo', ['fake_web_server']);
    console.log('程序信息:', processInfo);
  } catch (error) {
    console.error('测试失败:', error);
    console.error('错误类型:', typeof error);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testLogFetching();