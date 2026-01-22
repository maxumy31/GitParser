function NewCargoModule() {
    const SupportedLanguage = "rust"
    const BuildSystem = "Cargo"

async function ParseItem(TakeTree, ReadFile,BFS) {
    const file = await BFS("Cargo.toml")
    if(!file) {return null}

    const content = await ReadFile(file.path)

    return ParseCargoToml(content)
}

    return {
        ProcessRepository:ParseItem,
        SupportedLanguage:SupportedLanguage,
        BuildSystem:BuildSystem
    }
}


function ParseCargoToml(content) {
    const dependencies = new Set();
    
    if (!content || typeof content !== 'string') {
        return [];
    }
    
    const lines = content.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        if (trimmed.startsWith('[')) {
            const sectionMatch = trimmed.match(/^\[(.*?)\]/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
            }
            continue;
        }
        if (currentSection && (
            currentSection === 'dependencies' ||
            currentSection === 'dev-dependencies' ||
            currentSection === 'build-dependencies' ||
            currentSection.startsWith('target.') && currentSection.endsWith('.dependencies')
        )) {
            const depName = extractCargoDependency(trimmed);
            if (depName) {
                dependencies.add(depName);
            }
        }
    }
    
    return Array.from(dependencies);
}

function extractCargoDependency(line) {
    // Форматы зависимостей в Cargo.toml:
    // 1. Простой: serde = "1.0"
    // 2. Расширенный: tokio = { version = "1.0", features = ["full"] }
    // 3. Git: tokio = { git = "https://github.com/tokio-rs/tokio" }
    // 4. Path: mylib = { path = "../mylib" }

    const cleanLine = line.split('#')[0].trim();
    if (!cleanLine) return null;

    const equalsIndex = cleanLine.indexOf('=');
    if (equalsIndex === -1) return null;
    
    let depName = cleanLine.substring(0, equalsIndex).trim();

    depName = depName.replace(/["']/g, '');

    if (!depName || depName.length < 2) {
        return null;
    }
    
    const afterEquals = cleanLine.substring(equalsIndex + 1).trim();
    if (afterEquals.includes('git =') || afterEquals.includes('path =')) {
        return null; // Не включаем локальные/git зависимости
    }
    
    return depName;
}

export default NewCargoModule