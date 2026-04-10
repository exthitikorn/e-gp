/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");

module.exports = {
  apps: [
    {
      name: "rpp-e-gp",
      script: path.join(__dirname, "node_modules", "next", "dist", "bin", "next"),
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      min_uptime: "10s",
      max_restarts: 10,
      autorestart: true,
      watch: false,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
