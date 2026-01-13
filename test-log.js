const { getProcessStdoutLog } = require('./backend/services/supervisorService');

async function testLogRetrieval() {
  try {
    console.log('测试获取fake_web_server程序的标准输出日志...');
    
    // 从之前的错误日志可以看出，projectId=1对应localhost项目
    const projectId = 1;
    const programName = 'fake_web_server';
    
    // 获取最新的日志（从文件末尾开始读取）
    const result = await getProcessStdoutLog(projectId, programName, -1, 10000);
    
    console.log('\n=== 日志获取结果 ===');
    console.log('偏移量:', result.offset);
    console.log('日志内容长度:', result.logs.length);
    console.log('\n=== 日志内容 ===');
    console.log(result.logs);
    
    // 检查日志格式
    console.log('\n=== 日志格式分析 ===');
    const logLines = result.logs.split('\n').filter(line => line.trim() !== '');
    console.log('日志行数:', logLines.length);
    
    // 检查是否有重复内容
    const uniqueLines = [...new Set(logLines)];
    console.log('唯一行数:', uniqueLines.length);
    if (logLines.length > uniqueLines.length) {
      console.log('警告: 存在重复的日志行');
    }
    
    // 检查是否有前导空白字符
    const linesWithLeadingSpace = logLines.filter(line => /^\s+/.test(line));
    if (linesWithLeadingSpace.length > 0) {
      console.log('警告: 存在行首有空白字符的日志行');
      console.log('示例:', linesWithLeadingSpace.slice(0, 5));
    }
    
  } catch (error) {
    console.error('获取日志失败:', error);
  }
}

testLogRetrieval();
