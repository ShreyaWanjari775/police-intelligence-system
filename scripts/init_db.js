require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log('Connecting to MySQL at', process.env.DB_HOST, 'port', process.env.DB_PORT || 3306, 'as', process.env.DB_USER);
    
    // Connect to server
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    console.log('Connected to MySQL server successfully.');

    // 1. Ensure database exists
    const dbName = process.env.DB_NAME || 'police_intelligence_system';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`Using database: ${dbName}`);

    // 2. Check if base tables exist; if not, run Backend.sql table definitions
    const [tables] = await connection.query('SHOW TABLES;');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`Found ${tableNames.length} existing tables.`);

    if (!tableNames.includes('police_case') || !tableNames.includes('incident')) {
        console.log('Base tables missing. Executing Backend.sql...');
        const backendSqlPath = path.join(__dirname, '..', 'Backend.sql');
        if (fs.existsSync(backendSqlPath)) {
            const backendSql = fs.readFileSync(backendSqlPath, 'utf8');
            await connection.query(backendSql);
            console.log('Backend.sql executed successfully.');
        }
    }

    // 3. Run schema extension
    const schemaExtPath = path.join(__dirname, '..', 'sql', 'schema_extension.sql');
    if (fs.existsSync(schemaExtPath)) {
        console.log('Executing schema_extension.sql...');
        const schemaExtSql = fs.readFileSync(schemaExtPath, 'utf8');
        await connection.query(schemaExtSql);
        console.log('Schema extensions applied.');
    }

    // 4. Run seed data
    const seedPath = path.join(__dirname, '..', 'sql', 'seed_data.sql');
    if (fs.existsSync(seedPath)) {
        console.log('Executing seed_data.sql...');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await connection.query(seedSql);
        console.log('Seed data successfully loaded.');
    }

    // Verify row counts
    const [cases] = await connection.query('SELECT COUNT(*) AS c FROM police_case;');
    const [incidents] = await connection.query('SELECT COUNT(*) AS c FROM incident;');
    const [officers] = await connection.query('SELECT COUNT(*) AS c FROM officer;');
    const [evidence] = await connection.query('SELECT COUNT(*) AS c FROM evidence;');
    const [users] = await connection.query('SELECT COUNT(*) AS c FROM system_user;');

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log('Cases in DB:', cases[0].c);
    console.log('Incidents in DB:', incidents[0].c);
    console.log('Officers in DB:', officers[0].c);
    console.log('Evidence records:', evidence[0].c);
    console.log('System Users:', users[0].c);
    console.log('Database initialization COMPLETE!\n');

    await connection.end();
}

run().catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});
