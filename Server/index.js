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
        return reply.view('pages/skeleton.ejs', { indexData: {tags:tags,languages:languages,processedCount:processedCount} });
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});


fastify.get('/search-page', async (req, reply) => {
    try {
        console.log(req.query,"/search-page")
        const tags = await queries.GetPopularTags()
        const languages = await queries.GetSupportedLanguages()
        const sources = await queries.GetSupportedSources()
        const isHtmx = req.headers['hx-request'];
        if(isHtmx) {
            return reply.view('pages/search_page/index.ejs', { searchPageData: {popularTags:tags,languages:languages, sources:sources} });
        } else {
            return reply.view('pages/search_page/index_full.ejs', { searchPageData: {popularTags:tags,languages:languages, sources:sources} });
        }
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});


fastify.get('/search-page/active_stack_block/standard', async (req, reply) => {
    const standardValues = {activeStack: [] }
    try {
        return reply.view('pages/search_page/sidebar/active_stack_block.ejs', standardValues);
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});

fastify.get('/search-page/active_stack_block/add', async (req, reply) => {
    console.log(req.query,"/search-page/active_stack_block/add")
    let selectedStack = [].concat(req.query.activeStack || []);
    const stackToInclude = req.query.toInclude
    if(selectedStack.indexOf(stackToInclude) == -1) {
        selectedStack.push(stackToInclude)
    }
    try {
        reply.header("HX-Trigger-After-Swap","updateSearchResult")
        return reply.view('pages/search_page/sidebar/active_stack_block.ejs', {activeStack: selectedStack});
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});

fastify.get('/search-page/active_stack_block/remove', async (req, reply) => {
    console.log(req.query,"/search-page/active_tags_block/remove")
    const selectedStack = [].concat(req.query.activeStack || []);
    const stackToDisable = req.query.toDelete
    const newSelectedStack = selectedStack.filter(item => item != stackToDisable)
    try {
        reply.header("HX-Trigger-After-Swap","updateSearchResult")
        return reply.view('pages/search_page/sidebar/active_stack_block.ejs', {activeStack: newSelectedStack});
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
});


fastify.get("/search_page/stack_list", async (req, reply) => {
    console.log(req.query,"/search_page/stack_list")
    try {
        reply.header("HX-Trigger-After-Swap","updateSearchResult")
        const selectedStack = [].concat(req.query.activeStack || []);
        const toInclude = req.query.toInclude
        if(selectedStack.indexOf(toInclude) != -1) {return reply.code(204).send("")}
        selectedStack.push(toInclude)
        return reply.view('pages/search_page/sidebar/active_data/stack_list.ejs', {activeStack:[selectedStack]});
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
})




fastify.get("/search_page/tags_list_modal", async (req, reply) => {
    try {
        console.log(req.query,"/search_page/tags_list_modal")
        reply.header("HX-Trigger-After-Swap","updateSearchResult")
        const hints = (await queries.GetTagHint(req.query.tag_name,[])).map(h => h.name)
        return reply.view('pages/search_page/tags_list_modal.ejs', {tags:hints});
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
})

fastify.get("/search_page/tags_list", async (req, reply) => {
    console.log(req.query,"/search_page/tags_list")
    try {
        reply.header("HX-Trigger-After-Swap","updateSearchResult")
        const selectedTags = [].concat(req.query.activeTags || []);
        if(selectedTags.indexOf(req.query.tag) != -1) {return reply.code(204).send("")}
        return reply.view('pages/search_page/sidebar/active_data/tags_list.ejs', {activeTags:[req.query.tag]});
    } catch (err) {
        fastify.log.error(err);
        return "<html>ERROR</html>"
    }
})

fastify.get('/search_page/search_trigger', async (req, reply) => {
    try {
        reply.header("HX-Trigger-After-Swap", "updateSearchResult");
        return reply.code(200).send("");
        
    } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send("ERROR");
    }
});


fastify.get('/search-page/search_results_list', async (req, reply) => {
    try {
        console.log(req.query, "/search-page/search_results_list")

        const selectedSources = [].concat(req.query.sources || [])
        const selectedLanguage = req.query.language;
        const selectedTags = [].concat(req.query.activeTags || [])
        const selectedDeps = [].concat(req.query.activeStack || [])
        const search = req.query.userSearch
        const page = req.query.page || 1
        

        if (!selectedLanguage || selectedSources.length === 0) {
            return reply.view('pages/search_page/search_results_list.ejs', { 
            searchResult: {
                count: 0,
                names: []
            }, 
            page:1,
            pagesCount:0
            });
        }

        const limit = 8;
        const offset = 0 + limit * (page-1);

        const res = await queries.GetFullRecommendations(selectedLanguage, selectedDeps, selectedTags, selectedSources, limit, offset,search);

        return reply.view('pages/search_page/search_results_list.ejs', { 
            searchResult: {
                count: res.total, 
                names: res.data.map(r => r.name) 
            }, 
            page:page,
            pagesCount:Math.ceil(res.total/limit)
        });

    } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send("Ошибка при загрузке результатов");
    }
});


fastify.get('/library_page', async (req, reply) => {
    console.log(req.query, "/library_page")
    const isHtmx = req.headers['hx-request'];
    const libName = req.query.library || ''
    const language = req.query.language || ''
    const page = req.query.page || 1
    const limit = 9
    const offset = limit*(page-1)
    const relatedLimit = 8

    if (libName === "") {return reply.code(204).send("")}
    if (language === "") {return reply.code(204).send("")}
    const libMetadata = await queries.GetLibraryMetadata(libName,language,['github'],relatedLimit)
    const repos = await queries.GetRepositoriesByLib(libName,language,['github'],limit,offset)
    console.log(repos)
    const data = { data : {
            library:libName,
            language:language,
            index_count:libMetadata.total,
            total_pages:11,
            total:100,
            active_page:page,
            repositories:repos.map(r => r.full_name),
            tags:libMetadata.related_topics,
            libs:libMetadata.related_libraries
        }}
    try {
        if(isHtmx) {
            return reply.view('pages/library_page/index.ejs', data);
        } else {
            return reply.view('pages/library_page/index_full.ejs', data);
        }
    } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send("ERROR");
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