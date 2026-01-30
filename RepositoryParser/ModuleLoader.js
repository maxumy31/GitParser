import NewGithubParser from "./Modules/GithubParser.js"
import NewNPMModule from "./Modules/NPM.js"
import NewMavenModule from "./Modules/Maven.js"
import NewGradleModule from "./Modules/Gradle.js"
import NewPipModule from "./Modules/PIP.js"
import NewCargoModule from "./Modules/Cargo.js"

function LoadRepositoryModule(moduleName) {
    const modules = {
        "github": NewGithubParser
    }

    if(moduleName in modules) {
        return modules[moduleName]()
    }
    throw `No repositoty module found for name ${moduleName}`
    return null;
}

function LoadLanguageModule() {
    const modules = [
        NewNPMModule(),
        NewMavenModule(),
        NewGradleModule(),
        NewPipModule(),
        NewCargoModule(),
    ];

    // Language : [BuildSystem]
    let supported = new Map();
    
    for (const mod of modules) {
        const language = mod.SupportedLanguage
        
        if (supported.has(language)) {
            const existingSystems = supported.get(language);
            if (!existingSystems.includes(mod)) {
                existingSystems.push(mod);
            }
        } else {
            supported.set(language, [mod]);
        }
    }

    console.log('  Поддерживаемые языки:');
    console.log('-------------------------');
    
    for (const [language, buildSystems] of supported) { 
        console.log(`   ${language.toUpperCase()}:`);
        for(const build of buildSystems) {
            console.log(`   └── ${build.BuildSystem}`);
        }
    }

    function GetSupportedLanguages() {
        let supportedLanguages = new Set()
        for(const [lang, system] of supported) {
            supportedLanguages.add(lang.toLowerCase())
        }
        return [...supportedLanguages]
    }

    async function FindDependencies(language,repositoryModule,owner,name) {
        const TakeTree = async (path = "/") => await repositoryModule.GetRepositoryTree(owner,name,path)
        const TakeFile = async (path) => await repositoryModule.GetFileContent(owner,name,path)
        async function RecursiveBFSearch(name,depth=1,path = "") {
            const root = await TakeTree(path)
            const hits = root.filter(r => r.name == name)
            if(hits && hits.length >= 1) {return hits[0]}
            if(depth <= 0) {return null}
            else{
                const dirs = root.filter(r => r.type == "dir")
                for(const d of dirs) {
                    const result = await RecursiveBFSearch(name,depth-1, d.path)
                    if(result != null) {return result}
                }
            }
            return null
        }
        language = language.toLowerCase()
        if(!supported.has(language)) throw "language not implemented"
        for(const system of supported.get(language)) {
            const result = await system.ProcessRepository(TakeTree,TakeFile,RecursiveBFSearch)
            if(result) return result
        }
    }
    
    return {
        modules: modules,
        GetSupportedLanguages:GetSupportedLanguages,
        FindDependencies:FindDependencies,

    }
}

export default {LoadRepositoryModule, LoadLanguageModule};