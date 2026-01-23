import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import queries from './queries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({ logger: true });
const isDev = true

fastify.register(fastifyFormbody);
fastify.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, 'views'),
});



fastify.get('/', async (req, reply) => {
    try {
        const tags = await queries.GetPopularTags()
        const languages = await queries.GetSupportedLanguages()
        const processedCount = await queries.GetProcessedRepositoriesCount()
        return reply.view('pages/index_page/index.ejs', { indexData: {tags:tags,languages:languages,processedCount:processedCount} });
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});


fastify.get('/search-page', async (req, reply) => {
    try {
        const tags = await queries.GetPopularTags()
        const languages = await queries.GetSupportedLanguages()
        const sources = await queries.GetSupportedSources()
        return reply.view('pages/search_page/search.ejs', { searchPageData: {popularTags:tags,languages:languages, sources:sources} });
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
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