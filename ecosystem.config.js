module.exports = {
  apps: [
    {
      name: "pathlearnerz",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      cwd: "C:\\inetpub\\wwwroot\\pathlearnerz.com",
      interpreter: "node",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
