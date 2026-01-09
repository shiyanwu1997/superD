// 批量加密JSON存储中已存在的projects表的password字段
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// 项目数据文件路径
const PROJECTS_FILE_PATH = path.join(__dirname, '../data/projects.json');

// 批量加密项目密码的函数
async function batchEncryptProjectPasswords() {
  try {
    console.log('开始批量加密项目密码...\n');
    
    // 读取项目数据
    const projectsData = fs.readFileSync(PROJECTS_FILE_PATH, 'utf8');
    const projects = JSON.parse(projectsData);
    
    console.log(`共找到 ${projects.length} 个项目\n`);
    
    // 加密每个项目的密码
    for (const project of projects) {
      try {
        // 加密supervisorConfig中的密码
        if (project.supervisorConfig && project.supervisorConfig.password) {
          // 检查是否已经是加密的密码（bcrypt哈希长度通常为60）
          if (project.supervisorConfig.password.length !== 60) {
            console.log(`正在加密项目 ${project.name} 的supervisorConfig密码...`);
            
            // 加密密码
            const hashedPassword = await bcrypt.hash(project.supervisorConfig.password, 10);
            project.supervisorConfig.password = hashedPassword;
            
            console.log(`项目 ${project.name} 的supervisorConfig密码加密完成\n`);
          } else {
            console.log(`项目 ${project.name} 的supervisorConfig密码已经是加密状态，跳过\n`);
          }
        }
        
        // 加密根级别的密码（如果存在）
        if (project.password) {
          // 检查是否已经是加密的密码
          if (project.password.length !== 60) {
            console.log(`正在加密项目 ${project.name} 的根级别密码...`);
            
            // 加密密码
            const hashedPassword = await bcrypt.hash(project.password, 10);
            project.password = hashedPassword;
            
            console.log(`项目 ${project.name} 的根级别密码加密完成\n`);
          } else {
            console.log(`项目 ${project.name} 的根级别密码已经是加密状态，跳过\n`);
          }
        }
      } catch (error) {
        console.error(`加密项目 ${project.name} 的密码失败:`, error + '\n');
      }
    }
    
    // 保存加密后的项目数据
    fs.writeFileSync(PROJECTS_FILE_PATH, JSON.stringify(projects, null, 2), 'utf8');
    
    console.log('所有项目密码加密完成并已保存到文件\n');
  } catch (error) {
    console.error('批量加密项目密码失败:', error + '\n');
  } finally {
    console.log('密码加密操作已完成\n');
  }
}

// 执行批量加密
batchEncryptProjectPasswords();
