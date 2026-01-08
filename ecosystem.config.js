module.exports = {
  apps: [
    {
      name: 'supervisor-backend',
      script: './backend/app.js',
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000 ,
        STORAGE_TYPE: 'mysql',
        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: 3306,
        MYSQL_USER: 'root',
        MYSQL_PASSWORD: 'yang1340984855',
        MYSQL_DATABASE: 'supervisor'
      }
    },
    {
      name: 'supervisor-frontend',
      script: './node_modules/.bin/serve',
      args: ['-s', 'dist', '-l', '6001'],
      cwd: './client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};