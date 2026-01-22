import { xml2js, xml2json } from 'xml-js';

function NewMavenModule() {
    const SupportedLanguage = "java"
    const BuildSystem = "Maven"

async function ParseItem(TakeTree, ReadFile,BFS) {
    const dependencies = new Set();
    const root = await TakeTree()
    const configFiles = [
        "pom.xml",
    ]

    const fileName = await BFS("pom.xml")
    if(!fileName) {return null}
    const content = await ReadFile(fileName.path)
    return ParseMavenPomSimple(content)
}

    return {
        ProcessRepository:ParseItem,
        SupportedLanguage:SupportedLanguage,
        BuildSystem:BuildSystem
    }
}

//Используем regex изза того, что схемы maven конфигураций нестабильны
function ParseMavenPomSimple(content) {
    const deps = new Set();
    const clean = content.replace(/<!--.*?-->/gs, '');
    const depRegex = /<dependency>.*?<\/dependency>/gs;
    const matches = clean.match(depRegex) || [];
    matches.forEach(block => {
        const g = block.match(/<groupId>([^<]+)<\/groupId>/);
        const a = block.match(/<artifactId>([^<]+)<\/artifactId>/);
        
        if (g && a) {
            const groupId = g[1].trim();
            const artifactId = a[1].trim();
            if (!groupId.startsWith('${') && !artifactId.startsWith('${')) {
                deps.add(`${groupId}:${artifactId}`);
            }
        }
    });
    return Array.from(deps);
}


export default NewMavenModule