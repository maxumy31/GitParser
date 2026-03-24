import Knex from "knex";

const knex = Knex({
  client: "pg"
});

export default function createRepositoryAPI(executeQuery) {

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

    return rows.map(row => row.name);
  };


  const GetPopularTags = async () => {
    const rows = await executeQuery(`
        SELECT t.name, COUNT(rt.repo_id) as usage_count
        FROM topics t
        JOIN repo_topics rt ON t.id = rt.topic_id
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC
        LIMIT 25;
    `, []);

    return rows.map(row => row.name);
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

    return rows.map(row => row.name);
  };


  const GetFullRecommendations = async (
    lang,
    libs = [],
    topics = [],
    sources = [],
    limit = 10,
    offset = 0,
    search = ""
  ) => {

    if (!lang) throw new Error("Language is required");
    if (!sources || sources.length === 0) return [];

    const langLower = lang.toLowerCase();
    const libsLower = libs.map(l => l.toLowerCase());
    const topicsLower = topics.map(t => t.toLowerCase());
    const sourcesLower = sources.map(s => s.toLowerCase());

    let targetReposQuery = knex("repositories as r")
      .select("r.id")
      .join("languages as lang", "r.language_id", "lang.id")
      .join("data_sources as ds", "r.source_id", "ds.id")
      .where("lang.name", langLower)
      .whereIn("ds.name", sourcesLower);

    if (libsLower.length > 0) {
      targetReposQuery = targetReposQuery.whereIn("r.id", function () {
        this.select("rl.repo_id")
          .from("repo_libraries as rl")
          .join("libraries as l", "rl.library_id", "l.id")
          .whereIn("l.name", libsLower)
          .groupBy("rl.repo_id")
          .havingRaw("COUNT(DISTINCT l.id) >= ?", [Math.floor(libsLower.length / 2)]);
      });
    }

    if (topicsLower.length > 0) {
      targetReposQuery = targetReposQuery.whereIn("r.id", function () {
        this.select("rt.repo_id")
          .from("repo_topics as rt")
          .join("topics as t", "rt.topic_id", "t.id")
          .whereIn("t.name", topicsLower)
          .groupBy("rt.repo_id")
          .havingRaw("COUNT(DISTINCT t.id) >= ?", [Math.floor(topicsLower.length / 2)]);
      });
    }

    const query = knex("repo_libraries as rl")
      .select(
        "l.name",
        "ls.final_score as trust_score",
        knex.raw("COUNT(*) OVER() AS total_count")
      )
      .count("rl.repo_id as co_occurrence_count")
      .join("libraries as l", "rl.library_id", "l.id")
      .join("target_repos", "rl.repo_id", "target_repos.id")
      .leftJoin("library_scores as ls", "l.id", "ls.library_id")
      .where("l.language_id", function () {
        this.select("id").from("languages").where("name", langLower).limit(1);
      })
      .whereNotIn("l.name", libsLower);

    if (search && search.trim() !== "") {
      query.where("l.name", "ILIKE", `%${search.trim().toLowerCase()}%`);
    }

    query
      .groupBy("l.id", "l.name", "ls.final_score")
      .orderBy([
        { column: "co_occurrence_count", order: "desc" },
        { column: "ls.final_score", order: "desc" }
      ])
      .limit(limit)
      .offset(offset);

    const finalKnexQuery = knex
      .with("target_repos", targetReposQuery)
      .select("*")
      .from(query);

    const { sql, bindings } = finalKnexQuery.toSQL().toNative();

    const result = await executeQuery(sql, bindings);

    return {
      data: result.map(row => ({
        name: row.name
      })),
      total: result.length > 0 ? parseInt(result[0].total_count) : 0
    };
  };


  const GetTagHint = async (partial, selectedTags = []) => {
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
          AND t.name != ALL($3)
        GROUP BY t.id, t.name
        ORDER BY 
            (t.name ILIKE $2) DESC,
            usage_count DESC
        LIMIT $4;
    `;

    return await executeQuery(sql, params);
  };


  const GetRepositoriesByLib = async (
    library,
    language,
    sources,
    limit,
    offset
  ) => {

    if (!language) throw new Error("Language is required");
    if (!library) throw new Error("Library is required");
    if (!limit) throw new Error("Limit is required");
    if (offset === undefined || offset === null) offset = 0;
    if (!sources) throw new Error("Sources are required");
    if (sources.length === 0) return [];

    const params = [
      library,
      language,
      sources,
      limit,
      offset
    ];

    const sql = `
        SELECT 
            r.full_name,
            r.stargazers_count,
            r.calculated_weight as contribution_weight,
            r.updated_at as insert_date,
            COUNT(*) OVER()::int as total_count
        FROM libraries l
        JOIN repo_libraries rl ON l.id = rl.library_id
        JOIN repositories r ON rl.repo_id = r.id
        JOIN data_sources ds ON r.source_id = ds.id
        WHERE l.name = $1
        AND l.language_id = (SELECT id FROM languages WHERE name = $2 LIMIT 1)
        AND ds.name = ANY ($3)
        ORDER BY r.calculated_weight DESC
        LIMIT $4 OFFSET $5;
    `;

    return await executeQuery(sql, params);
  };


  const GetLibraryMetadata = async (
    library,
    language,
    sources,
    relatedLimit = 5
  ) => {

    if (!language) throw new Error("Language is required");
    if (!library) throw new Error("Library is required");
    if (!sources) throw new Error("Sources are required");
    if (sources.length === 0) return null;

    const params = [
      library.toLowerCase(),
      language.toLowerCase(),
      sources.map(s => s.toLowerCase()),
      relatedLimit
    ];

    const sql = `
        WITH target_lib AS (
            SELECT id FROM libraries 
            WHERE name = $1 
              AND language_id = (SELECT id FROM languages WHERE name = $2 LIMIT 1)
            LIMIT 1
        ),
        filtered_repos AS (
            SELECT r.id, r.pushed_at
            FROM repo_libraries rl
            JOIN repositories r ON rl.repo_id = r.id
            JOIN data_sources ds ON r.source_id = ds.id
            WHERE rl.library_id = (SELECT id FROM target_lib)
              AND ds.name = ANY($3)
        )
        SELECT 
            COUNT(fr.id)::int as total,

            COALESCE((
                SELECT ARRAY_AGG(alt_l.name) FROM (
                    SELECT l_other.name, COUNT(*) as cnt
                    FROM repo_libraries rl_other
                    JOIN libraries l_other ON rl_other.library_id = l_other.id
                    WHERE rl_other.repo_id IN (SELECT id FROM filtered_repos)
                      AND l_other.id != (SELECT id FROM target_lib)
                    GROUP BY l_other.name
                    ORDER BY cnt DESC
                    LIMIT $4
                ) alt_l
            ), '{}') as related_libraries,

            COALESCE((
                SELECT ARRAY_AGG(alt_t.name) FROM (
                    SELECT t_other.name, COUNT(*) as cnt
                    FROM repo_topics rt_other
                    JOIN topics t_other ON rt_other.topic_id = t_other.id
                    WHERE rt_other.repo_id IN (SELECT id FROM filtered_repos)
                    GROUP BY t_other.name
                    ORDER BY cnt DESC
                    LIMIT $4
                ) alt_t
            ), '{}') as related_topics

        FROM filtered_repos fr
        LEFT JOIN repo_topics rt ON fr.id = rt.repo_id
        LEFT JOIN topics t ON rt.topic_id = t.id;
    `;

    const result = await executeQuery(sql, params);

    if (!result[0] || result[0].total === 0) {
      return null;
    }

    return result[0];
  };


  return {
    GetPopularTags,
    GetSupportedLanguages,
    GetProcessedRepositoriesCount,
    GetSupportedSources,
    GetFullRecommendations,
    GetTagHint,
    GetRepositoriesByLib,
    GetLibraryMetadata
  };
}