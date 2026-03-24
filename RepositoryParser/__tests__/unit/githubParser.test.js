import { jest } from '@jest/globals'

describe('GithubParser negative scenarios', () => {
  let mockReposGetContent
  let mockSearchRepos
  let NewGithubParser

  beforeEach(async () => {
    jest.resetModules()

    mockReposGetContent = jest.fn()
    mockSearchRepos = jest.fn()

    jest.unstable_mockModule('octokit', () => ({
      Octokit: jest.fn().mockImplementation(() => ({
        rest: {
          search: {
            repos: mockSearchRepos,
          },
          repos: {
            getContent: mockReposGetContent,
          },
        },
      })),
    }))

    ;({ default: NewGithubParser } = await import('../../Modules/GithubParser.js'))
  })

  test('FetchRepos propagates API error', async () => {
    mockSearchRepos.mockRejectedValue(new Error('rate limit exceeded'))
    const parser = NewGithubParser()

    await expect(parser.FetchRepos('2026-03-20', 1, 20, 50, ['javascript'])).rejects.toThrow('rate limit exceeded')
  })

  test('GetRepositoryTree returns empty list when GitHub API fails', async () => {
    mockReposGetContent.mockRejectedValue(new Error('not found'))
    const parser = NewGithubParser()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await parser.GetRepositoryTree('owner', 'repo', '')

    expect(result).toEqual([])
    expect(mockReposGetContent).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  test('GetFileContent returns null when API fails', async () => {
    mockReposGetContent.mockRejectedValue(new Error('file not found'))
    const parser = NewGithubParser()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await parser.GetFileContent('owner', 'repo', 'package.json')

    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })

  test('GetFileContent returns null when response has no content field', async () => {
    mockReposGetContent.mockResolvedValue({ data: {} })
    const parser = NewGithubParser()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await parser.GetFileContent('owner', 'repo', 'package.json')

    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })
})
