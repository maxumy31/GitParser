import modules from '../../ModuleLoader.js'
import { jest } from '@jest/globals'

describe('ModuleLoader', () => {
  test('LoadRepositoryModule loads github parser', () => {
    const parser = modules.LoadRepositoryModule('github')

    expect(parser).toHaveProperty('FetchRepos')
    expect(parser).toHaveProperty('GetRepositoryTree')
    expect(parser).toHaveProperty('GetFileContent')
  })

  test('LoadRepositoryModule throws for unknown module', () => {
    expect(() => modules.LoadRepositoryModule('unknown')).toThrow('No repositoty module found for name unknown')
  })

  test('LoadLanguageModule returns supported languages', () => {
    const languageModule = modules.LoadLanguageModule()
    const supported = languageModule.GetSupportedLanguages()

    expect(supported).toEqual(expect.arrayContaining(['javascript', 'java', 'python', 'rust']))
  })

  test('FindDependencies throws on unsupported language', async () => {
    const languageModule = modules.LoadLanguageModule()

    await expect(languageModule.FindDependencies('haskell', {}, 'o', 'r')).rejects.toBe('language not implemented')
  })

  test('FindDependencies falls back to gradle for java when pom is absent', async () => {
    const languageModule = modules.LoadLanguageModule()

    const repositoryModule = {
      GetRepositoryTree: jest.fn().mockImplementation(async (_owner, _name, path = '') => {
        if (path === '' || path === '/') {
          return [
            { name: 'build.gradle', type: 'file', path: 'build.gradle' },
          ]
        }
        return []
      }),
      GetFileContent: jest.fn().mockResolvedValue('implementation "org.slf4j:slf4j-api:2.0.9"'),
    }

    const result = await languageModule.FindDependencies('java', repositoryModule, 'owner', 'repo')

    expect(result).toEqual(['org.slf4j:slf4j-api'])
    expect(repositoryModule.GetRepositoryTree).toHaveBeenCalled()
    expect(repositoryModule.GetFileContent).toHaveBeenCalledWith('owner', 'repo', 'build.gradle')
  })
})
