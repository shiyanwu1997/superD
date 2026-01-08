// 批量加密数据库中已存在的projects表的password字段
const bcrypt = require('bcrypt');
const db = require('../models/db.mysql');

// 批量加密项目密码的函数
async function batchEncryptProjectPasswords() {
  try {
    console.log('开始批量加密项目密码...\n');
    
    // 获取所有项目
    const projects = await db.getAllProjects();
    console.log(`共找到 ${projects.length} 个项目\n`);
    
    // 加密每个项目的密码
    for (const project of projects) {
      try {
        // 解析supervisorConfig
        let supervisorConfig = project.supervisorConfig;
        
        // 检查是否已经是加密的密码（bcrypt哈希长度通常为60）
        if (supervisorConfig.password && supervisorConfig.password.length !== 60) {
          console.log(`正在加密项目 ${project.name} 的密码...`);
          
          // 加密密码
          const hashedPassword = await bcrypt.hash(supervisorConfig.password, 10);
          supervisorConfig.password = hashedPassword;
          
          // 更新项目
          await db.updateProject(project.id, { supervisorConfig: JSON.stringify(supervisorConfig) });
          
          console.log(`项目 ${project.name} 的密码加密完成\n`);
        } else {
          console.log(`项目 ${project.name} 的密码已经是加密状态，跳过\n`);
        }
      } catch (error) {
        console.error(`加密项目 ${project.name} 的密码失败:`, error + '\n');
      }
    }
    
    console.log('所有项目密码加密完成\n');
  } catch (error) {
    console.error('批量加密项目密码失败:', error + '\n');
  } finally {
    console.log('数据库操作已完成\n');
  }
}

// 执行批量加密
batchEncryptProjectPasswords();