/**
 * PM2 Ecosystem Configuration
 *
 * Optimierte Einstellungen für automatische Restarts und Stabilität
 *
 * Verwendung:
 * - pm2 start ecosystem.config.js
 * - pm2 reload ecosystem.config.js
 * - pm2 stop dojosoftware-backend
 */
module.exports = {
  apps: [{
    name: 'dojosoftware-backend',
    script: 'server.js',
    cwd: '/var/www/dojosoftware/backend',

    // Prozess-Einstellungen
    instances: 1,
    exec_mode: 'fork',
    watch: false,

    // Automatischer Restart bei Absturz
    autorestart: true,
    max_restarts: 50,        // Max Restarts innerhalb von restart_delay
    min_uptime: '10s',       // Mindestlaufzeit bevor als stabil gilt
    restart_delay: 5000,     // 5 Sekunden zwischen Restarts

    // Exponentielles Backoff bei wiederholten Crashes
    exp_backoff_restart_delay: 1000,  // Startet bei 1s, verdoppelt sich

    // Memory-Limit (Neustart bei 500MB)
    max_memory_restart: '500M',

    // Logs
    error_file: '/var/log/pm2/dojosoftware-error.log',
    out_file: '/var/log/pm2/dojosoftware-out.log',
    log_date_format: 'DD.MM.YYYY HH:mm:ss',
    merge_logs: true,

    // Umgebungsvariablen
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },

    // Graceful Shutdown
    kill_timeout: 10000,     // 10 Sekunden zum sauberen Beenden
    wait_ready: true,
    listen_timeout: 10000,

    // Health Check Hooks (PM2 Pro Feature, aber gut zu dokumentieren)
    // health_check: {
    //   url: 'http://localhost:5001/api/test',
    //   interval: 30000
    // }
  }]
};
