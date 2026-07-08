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
      max_size: '10M',
      retain: 5,
      env: {
        NODE_ENV: 'production',
        PORT: 6002
      }
    }
  ]
};
