module.exports = {
  apps: [
    {
      name: 'mccb-manager',
      script: 'server.js',
      cwd: '/home/pi/mccb-manager',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      autorestart: true,
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
