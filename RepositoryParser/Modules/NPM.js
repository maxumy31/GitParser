function NewNPMModule() {
    const SupportedLanguage = "javascript"
    const BuildSystem = "NPM"

async function ParseItem(TakeTree, ReadFile,BFS) {
    const dependencies = new Set();
    const file = await BFS("package.json")
    if(!file) {return null}
    const content = await ReadFile(file.path)
    const jsonContent = JSON.parse(content)
    const depTypes = ["dependencies","peerDependencies","devDependencies"]
    const found = jsonContent
    
    for (const depType of depTypes) {
        if (found[depType] && typeof found[depType] === 'object') {
            Object.keys(found[depType]).forEach(dep => {
                dependencies.add(dep);
            });
        }
    }
    return Array.from(dependencies);
}

    return {
        ProcessRepository:ParseItem,
        SupportedLanguage:SupportedLanguage,
        BuildSystem:BuildSystem
    }
}


export default NewNPMModule