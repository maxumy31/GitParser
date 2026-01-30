import { Octokit } from 'octokit'; 

function NewGithubParser() {
    const octokit = new Octokit({auth:process.env.TOKEN})

    async function FetchRepos(time,page=1,per_page=20,starThreshold,languages = ["JavaScript"]) {
        const query = `${languages.map((old) => "language:" + old).join("+")} 
            fork:false created:${time} stars:>=${starThreshold}`;
        const response = await octokit.rest.search.repos({
        q: query,
        per_page: per_page,
        page:page,
        sort: "stars",
        order: "desc"
        })
        return response.data.items
    }

    async function GetRepositoryTree(owner, repo, path = '') {
        try {
            const { data: contents } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: path
            });
            
            return contents;
        } catch (error) {
            console.error(`Ошибка при получении дерева файлов ${owner}/${repo}${path}:`, error.message);
            return [];
        }
    }

    async function GetFileContent(owner, repo, filePath) {
        try {
            const { data: fileContent } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath
            });
            
            const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
            return content;
        } catch (error) {
            console.error(`Ошибка при чтении файла ${owner}/${repo}/${filePath}:`, error.message);
            return null;
        }
    }

    return {
        FetchRepos:FetchRepos,
        GetRepositoryTree:GetRepositoryTree,
        GetFileContent:GetFileContent,
    }
}




export default NewGithubParser