import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import ejs from 'ejs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from "./db.js"
import table_constats from "./table_state.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({ logger: true });
const isDev = true

fastify.register(fastifyFormbody);
fastify.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, 'views'),
});


const getAnalytics = async (searchTag = 'Frontend', minStars = 0) => {
    const query = `
        SELECT 
            e_dep.name as name,
            em.value as stars,
            e_topic.name as tag
        FROM entity_metrics em
        JOIN entities e_topic ON em.entity_a_id = e_topic.id
        JOIN entities e_dep ON em.entity_b_id = e_dep.id
        JOIN metric_types mt ON em.metric_type_id = mt.id
        WHERE mt.name = 'stars'
          AND e_topic.type = 'topic'
          AND e_topic.name ILIKE $1
          AND em.value >= $2
        ORDER BY em.value DESC
        LIMIT 20;
    `;
    
    const { rows } = await pool.query(query, [`%${searchTag}%`, minStars]);
    return rows;
};

// --- РОУТЫ ---

// Главная страница
fastify.get('/', async (req, reply) => {
    try {
        //const data = await getAnalytics('Frontend', 0);
        return reply.view('index.ejs', { initialData: {} });
    } catch (err) {
        fastify.log.error(err);
        return reply.view('index.ejs', { initialData: [] });
    }
});

fastify.get('/suggestions', async (req, reply) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return ''; // Пустой ответ, если введено меньше 2 символов
    }

    try {
        const { rows } = await pool.query(`
            SELECT name, type 
            FROM entities 
            WHERE name ILIKE $1 
            AND type = 'topic'
            LIMIT 6
        `, [`%${q}%`]);

        return reply.view('partials/suggestions.ejs', { rows });
    } catch (err) {
        return ''; // В случае ошибки подсказок просто ничего не показываем
    }
});

// HTMX Поиск и фильтрация
fastify.post('/search', async (req, reply) => {
    const { q, minStars } = req.body;
    
    const searchTag = q || 'Frontend';
    const starsLimit = parseInt(minStars) || 0;
    const cols = table_constats.columns

    try {
        const libraries = await getAnalytics(searchTag, starsLimit);
        return reply.view('partials/table.ejs', { 
            tag: searchTag, 
            libraries: libraries,
            columns: cols
        });
    } catch (err) {
        fastify.log.error(err);
        return reply.view('partials/table.ejs', { 
            query: "Нужно улучшить архитектуру браток", 
            errorMessage: err, 
        });
    }
});



const start = async () => {
    try {
        await fastify.listen({ port: 4000, host: '0.0.0.0' });
        console.log('Сервер запущен на http://localhost:4000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();