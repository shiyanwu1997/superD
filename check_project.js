const mysql = require('mysql2/promise');
const { STORAGE_CONFIG } = require('./backend/config');

async function checkProjectData() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: STORAGE_CONFIG.MYSQL.HOST,
      port: STORAGE_CONFIG.MYSQL.PORT,
      user: STORAGE_CONFIG.MYSQL.USER,
      password: STORAGE_CONFIG.MYSQL.PASSWORD,
      database: STORAGE_CONFIG.MYSQL.DATABASE
    });

    console.log('成功连接到数据库');

    // 查询projects表的结构
    const [tableInfo] = await connection.execute('DESCRIBE projects');
    console.log('\nProjects表结构:');
    tableInfo.forEach(field => {
      console.log(`${field.Field} - ${field.Type}`);
    });

    // 查询所有项目数据
    const [projects] = await connection.execute('SELECT * FROM projects');
    console.log('\n所有项目数据:');
    projects.forEach(project => {
      console.log(`\n项目ID: ${project.id}`);
      console.log(`项目名称: ${project.name}`);
      console.log(`supervisorConfig类型: ${typeof project.supervisorConfig}`);
      console.log(`supervisorConfig值: ${project.supervisorConfig}`);
      
      // 尝试解析JSON
      try {
        if (typeof project.supervisorConfig === 'string') {
          const parsedConfig = JSON.parse(project.supervisorConfig);
          console.log('解析后的配置:', parsedConfig);
        }
      } catch (error) {
        console.log('解析失败:', error.message);
      }
    });

    await connection.end();
    console.log('\n数据库连接已关闭');
  } catch (error) {
    console.error('查询失败:', error);
  }
}

checkProjectData();
