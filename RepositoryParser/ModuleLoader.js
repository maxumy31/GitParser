import NewGithubParser from "./Modules/GithubParser.js"
import NewNPMModule from "./Modules/NPM.js"

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
        NewNPMModule()
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
            console.log(`   └── ${build.BuildSystem}\n`);
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
        language = language.toLowerCase()
        if(!supported.has(language)) throw "language not implemented"
        for(const system of supported.get(language)) {
            const result = await system.ProcessRepository(TakeTree,TakeFile)
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