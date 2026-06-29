module.exports = {
  apps: [
    {
      name: 'mccb-manager',
      script: 'server.js',
      cwd: process.env.MCCB_APP_DIR || '/home/pi/mccb-manager',
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
