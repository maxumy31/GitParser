import { Octokit } from 'octokit';


const octokit = new Octokit({auth:process.env.TOKEN})


async function GetReposFromTime(time) {
    async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    }

    const query = `language:javascript fork:false created:${time} `;
    const response = await octokit.rest.search.repos({
      q: query,
      per_page: 10,
      page:100,
      sort: "stars",
      order: "desc"
    })
    return response 
 
}

async function FetchRepos(time,page,per_page,starThreshold) {
    async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    }

    const query = `language:javascript fork:false created:${time} stars:>=${starThreshold}`;
    const response = await octokit.rest.search.repos({
      q: query,
      per_page: per_page,
      page:page,
      sort: "stars",
      order: "desc"
    })
    return response 
 
}

async function ParseProjectFiles(owner, repo) {
  function parseDependencies(content, fileName) {
      switch (fileName) {
          case 'package.json':
              const packageJson = JSON.parse(content);
              return Object.keys(packageJson.dependencies || []);

          default:
              return [];
            }
    }
    const dependencies = [];

    try {
        const { data: contents } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: ''
        });

        const dependencyFiles = contents.filter(item => 
            item.type === 'file' && 
            [
                'package.json',
            ].includes(item.name)
        );

        for (const file of dependencyFiles) {
            const { data: fileContent } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: file.path
            });

            const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
            const parsedDeps = parseDependencies(content, file.name);
            dependencies.push(...parsedDeps);
        }

        return dependencies;
    } catch (error) {
        console.error(`Ошибка при парсинге репозитория ${owner}/${repo}:`, error.message);
        return [];
    }
}

export default {GetReposFromTime, FetchRepos, ParseProjectFiles}