const { Client } = require('pg');

async function loadEnvVariablesFromDB() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb',
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const res = await client.query('SELECT name, value FROM env');
    res.rows.forEach(row => {
      process.env[row.name] = row.value;
    });
    console.log('Environment variables loaded from database.');
    console.log('Loaded rows:', res.rows);
    
  } catch (err) {
    console.error('Error loading environment variables from database:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function testDBConnection() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb',
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to the database successfully.');
    const res = await client.query('SELECT name, value FROM env');
    console.log('Database rows:', res.rows);
  } catch (err) {
    console.error('Error connecting to the database:', err);
  } finally {
    await client.end();
  }
}

testDBConnection();

module.exports = loadEnvVariablesFromDB;
