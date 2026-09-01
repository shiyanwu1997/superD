module.exports = {
  apps: [
    {
      name: 'supervisor-backend',
      script: '/opt/superD/backend/app.js',
      cwd: '/opt/superD/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/superD/logs/backend-error.log',
      out_file: '/opt/superD/logs/backend-out.log',
      merge_logs: true,
      // 以下两项依赖 pm2-logrotate 模块（pm2 install pm2-logrotate），核心 pm2 不识别
      max_size: '10M',
      retain: 5,
      env: {
        NODE_ENV: 'production',
        PORT: 6002
      }
    }
  ]
};
