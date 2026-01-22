function NewNPMModule() {
    const SupportedLanguage = "javascript"
    const BuildSystem = "NPM"

async function ParseItem(TakeTree, ReadFile) {
    const dependencies = new Set();
    const root = await TakeTree()
    const configFiles = [
        "package.json",
    ]

    const files = root.filter(file => configFiles.includes(file.name))
    if (!files || files.length == 0) return null
    const fileName = files[0].name
    const content = await ReadFile(fileName)
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