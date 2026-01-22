
function NewGradleModule() {
    const SupportedLanguage = "java"
    const BuildSystem = "Gradle"

async function ParseItem(TakeTree, ReadFile,BFS) {
    const dependencies = new Set();
    const file = await BFS("build.gradle")
    const fileKTS = await BFS("build.gradle.kts")
    let found = []
    if(file) {found.push(file)}
    if(fileKTS) {found.push(fileKTS)}
    if(found.length == 0) {return null}

    const fileName = found[0].name
    const content = await ReadFile(found[0].path)

    return ParseGradleDependencies(content,fileName.endsWith(".kts"))
}

    return {
        ProcessRepository:ParseItem,
        SupportedLanguage:SupportedLanguage,
        BuildSystem:BuildSystem
    }
}


function ParseGradleDependencies(content) {
    const result = new Set();
    
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        
        // Только строки с implementation/api
        if (!trimmed.startsWith('implementation') && 
            !trimmed.startsWith('api') && 
            !trimmed.startsWith('testImplementation')) {
            return;
        }
        
        // Ищем 'group:artifact'
        const match = trimmed.match(/["']([a-zA-Z0-9.-]+):([a-zA-Z0-9.-]+)(?:_[^"':]+)?(?::[^"']+)?["']/);
        
        if (match) {
            const groupId = match[1];
            let artifactId = match[2];
            
            artifactId = artifactId.replace(/_[^_]*$/, '');
            
            if (groupId.length > 1 && artifactId.length > 1 &&
                groupId !== 'name' && artifactId !== 'version') {
                result.add(`${groupId}:${artifactId}`);
            }
        }
    });
    
    return Array.from(result);
}
export default NewGradleModule