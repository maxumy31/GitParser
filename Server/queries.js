import executeQuery from "./db.js";
import Knex from 'knex';

const knex = Knex({
  client: 'pg'
});

const GetSupportedLanguages = async () => {
    const rows = await executeQuery(`
        SELECT l.name, r_counts.population
        FROM (
            SELECT language_id, COUNT(*) as population
            FROM repositories
            GROUP BY language_id
        ) r_counts
        JOIN languages l ON l.id = r_counts.language_id
        ORDER BY population DESC;
    `, []);
    return rows.map(row => row.name)
};

const GetPopularTags = async () => {
    const rows = await executeQuery(`
        SELECT t.name, COUNT(rt.repo_id) as usage_count
        FROM topics t
        JOIN repo_topics rt ON t.id = rt.topic_id
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC
        LIMIT 40;
    `, []);
    return rows.map(row => row.name)
};

const GetProcessedRepositoriesCount = async () => {
    const rows = await executeQuery(`
        SELECT COUNT(*) AS total FROM repositories;
    `, []);
    return parseInt(rows[0].total, 10);
};

const GetSupportedSources = async () => {
    const rows = await executeQuery(`
        SELECT name FROM data_sources;
    `, []);
    return rows.map(row => row.name)
};



const GetFullRecommendations = async (lang, libs = [], topics = [], sources = [], limit = 10, offset = 0, search = "") => {
    if (!lang) throw new Error("Language is required");
    if (!sources || sources.length === 0) return []

    const langLower = lang.toLowerCase();
    const libsLower = libs.map(l => l.toLowerCase());
    const topicsLower = topics.map(t => t.toLowerCase());
    const sourcesLower = sources.map(s => s.toLowerCase());

    let targetReposQuery = knex('repositories as r')
        .select('r.id')
        .join('languages as lang', 'r.language_id', 'lang.id')
        .join('data_sources as ds', 'r.source_id', 'ds.id')
        .where('lang.name', langLower)
        .whereIn('ds.name', sourcesLower);

    if (libsLower.length > 0) {
        targetReposQuery = targetReposQuery.whereIn('r.id', function() {
            this.select('rl.repo_id')
                .from('repo_libraries as rl')
                .join('libraries as l', 'rl.library_id', 'l.id')
                .whereIn('l.name', libsLower)
                .groupBy('rl.repo_id')
                .havingRaw('COUNT(DISTINCT l.id) >= ?', [Math.floor(libsLower.length / 2.0)]);
        });
    }

    if (topicsLower.length > 0) {
        targetReposQuery = targetReposQuery.whereIn('r.id', function() {
            this.select('rt.repo_id')
                .from('repo_topics as rt')
                .join('topics as t', 'rt.topic_id', 't.id')
                .whereIn('t.name', topicsLower)
                .groupBy('rt.repo_id')
                .havingRaw('COUNT(DISTINCT t.id) >= ?', [Math.floor(topicsLower.length / 2.0)])
        });
    }

    const query = knex('repo_libraries as rl')
        .select(
            'l.name',
            'ls.final_score as trust_score',
            knex.raw('COUNT(*) OVER() AS total_count') 
        )
        .count('rl.repo_id as co_occurrence_count')
        .join('libraries as l', 'rl.library_id', 'l.id')
        .join('target_repos', 'rl.repo_id', 'target_repos.id')
        .leftJoin('library_scores as ls', 'l.id', 'ls.library_id')
        .where('l.language_id', function() {
            this.select('id').from('languages').where('name', langLower).limit(1);
        })
        .whereNotIn('l.name', libsLower);

    if (search && search.trim() !== "") {
        query.where('l.name', 'ILIKE', `%${search.trim().toLowerCase()}%`);
    }

    query
        .groupBy('l.id', 'l.name', 'ls.final_score')
        .orderBy([
            { column: 'co_occurrence_count', order: 'desc' },
            { column: 'ls.final_score', order: 'desc' }
        ])
        .limit(limit)
        .offset(offset);

    const finalKnexQuery = knex
        .with('target_repos', targetReposQuery)
        .select('*')
        .from(query);


    const { sql, bindings } = finalKnexQuery.toSQL().toNative();

    const result = await executeQuery(sql, bindings);

    return {
        data: result.map(row => ({
            name: row.name,
        })),
        total: result.length > 0 ? parseInt(result[0].total_count) : 0
    };
};

async function GetTagHint(partial, selectedTags = []) {
    if (!partial) return [];
    const params = [
        `%${partial.toLowerCase()}%`, 
        `${partial.toLowerCase()}%`, 
        selectedTags, 
        6
    ];

    const sql = `
        SELECT t.name, COUNT(rt.repo_id) as usage_count
        FROM topics t
        LEFT JOIN repo_topics rt ON t.id = rt.topic_id
        WHERE t.name ILIKE $1
          AND t.name != ALL($3)  -- Исключаем уже выбранные теги
        GROUP BY t.id, t.name
        ORDER BY 
            (t.name ILIKE $2) DESC,
            usage_count DESC
        LIMIT $4;
    `;

    return await executeQuery(sql, params);
};

export default { GetPopularTags, GetSupportedLanguages, GetProcessedRepositoriesCount, 
    GetSupportedSources, GetFullRecommendations, GetTagHint };