import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT, 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Универсальная функция для исполнения SQL запросов
 * @param {string} text - SQL запрос (с плейсхолдерами $1, $2...)
 * @param {array} params - Массив значений для подстановки (защита от SQL-инъекций)
 */
async function executeQuery(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Логируем выполнение в консоль (полезно при разработке)
    console.log(`[SQL] Executed in ${duration}ms | Rows: ${res.rowCount}`);

    //console.log(`Result = ${res.rows.map(r => JSON.stringify(r))}`)
    
    return res.rows;
  } catch (err) {
    console.error('[SQL Error]:', err.message);
    throw err;
  }
}

export default executeQuery