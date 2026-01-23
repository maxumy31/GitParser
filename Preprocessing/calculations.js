// calculations.js

function TransformInput(doc) {
    const repo = doc.data;
    
    const stats = {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        open_issues: repo.open_issues_count,
        last_push: repo.pushed_at, 
        created_at: repo.created_at,
    };

    const topics = repo.topics;
    const deps = doc.dependencies;

    if (topics.length === 0 || deps.length === 0) return null;

    return {
        topics: topics.map(d => d.toLowerCase().trim()),
        deps: deps.map(d => d.toLowerCase().trim()),
        stats: stats,
        repo_full_name: repo.full_name,
        language: repo.language.toLowerCase(),
        processed: false
    };
}

export default {TransformInput}