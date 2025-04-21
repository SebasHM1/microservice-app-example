const loadEnvVariablesFromDB = require('./config/load-env');

(async () => {
  try {
    await loadEnvVariablesFromDB();
    require('./build/dev-server');
  } catch (err) {
    console.error('Failed to start the server:', err);
    process.exit(1);
  }
})();