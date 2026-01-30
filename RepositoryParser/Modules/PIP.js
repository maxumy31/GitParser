
function NewPipModule() {
    const SupportedLanguage = "python"
    const BuildSystem = "pip"

    async function ParseItem(TakeTree, ReadFile,BFS) {
        const file = await BFS("requirements.txt")
        if(!file) {return null}

        const content = await ReadFile(file.path)

        return ParseRequirementsTxt(content)
    }

    return {
        ProcessRepository:ParseItem,
        SupportedLanguage:SupportedLanguage,
        BuildSystem:BuildSystem
    }
}


function ParseRequirementsTxt(content) {
    const dependencies = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
            continue;
        }
        
        if (trimmed.startsWith('git+') || trimmed.startsWith('-r') || trimmed.startsWith('--')) {
            continue;
        }
        
        const match = trimmed.match(/^([a-zA-Z0-9][a-zA-Z0-9._-]*)/);
        if (match) {
            const pkgName = match[1].toLowerCase();
            
            if (pkgName && pkgName.length > 1 && !pkgName.startsWith('.')) {
                dependencies.push(pkgName);
            }
        }
    }
    
    return dependencies;
}


export default NewPipModule