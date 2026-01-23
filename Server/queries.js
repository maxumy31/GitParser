import executeQuery from "./db.js";

const GetSupportedLanguages = async () => {
    const rows = await executeQuery(`
        SELECT l.name AS language_name, COUNT(r.id) AS repo_count
        FROM languages l
        LEFT JOIN repositories r ON l.id = r.language_id
        GROUP BY l.id, l.name
        ORDER BY repo_count DESC;
    `, []);
    return rows.map(row => row.language_name)
};

const GetPopularTags = async () => {
    const rows = await executeQuery(`
        SELECT e.name AS topic_name, COUNT(re.repo_id) AS usage_count
        FROM entities e
        JOIN repo_entities re ON e.id = re.entity_id
        WHERE e.is_topic = TRUE
        GROUP BY e.id, e.name
        ORDER BY usage_count DESC
        LIMIT 20;
    `, []);
    return rows.map(row => row.topic_name)
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

export default { GetPopularTags, GetSupportedLanguages, GetProcessedRepositoriesCount, GetSupportedSources};