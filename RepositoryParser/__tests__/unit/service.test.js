import { createRepositoryService } from '../../service.js'
import { jest } from '@jest/globals'

describe('createRepositoryService', () => {
  function makeBase() {
    const db = {
      insertBatch: jest.fn(),
      updateData: jest.fn().mockResolvedValue({ acknowledged: true }),
      findFirst: jest.fn(),
      insertData: jest.fn().mockResolvedValue({ acknowledged: true }),
    }

    const gen = {
      TimeToStringQueryFormat: jest.fn().mockReturnValue('2026-03-20'),
    }

    const repoModule = {
      FetchRepos: jest.fn(),
    }

    const langModule = {
      GetSupportedLanguages: jest.fn().mockReturnValue(['javascript']),
      FindDependencies: jest.fn(),
    }

    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    }

    return { db, gen, repoModule, langModule, logger }
  }

  test('getBatch filters repositories and maps id to repository_id', async () => {
    const { db, gen, repoModule, langModule, logger } = makeBase()
    repoModule.FetchRepos.mockResolvedValue([
      { id: 1, language: 'javascript', owner: { login: 'a' }, name: 'repo-no-topics', topics: [] },
      { id: 2, language: 'javascript', owner: { login: 'a' }, name: 'repo-no-deps', topics: ['x'] },
      { id: 3, language: 'javascript', owner: { login: 'a' }, name: 'repo-ok', topics: ['x'], full_name: 'a/repo-ok' },
    ])
    langModule.FindDependencies.mockImplementation(async (_lang, _repoModule, _owner, name) => {
      if (name === 'repo-ok') return ['lodash']
      return []
    })

    const service = createRepositoryService({ db, gen, repoModule, langModule, logger })

    const result = await service.getBatch(new Date('2026-03-20T00:00:00.000Z'))

    expect(repoModule.FetchRepos).toHaveBeenCalledWith('2026-03-20', 1, 100, 50, ['javascript'])
    expect(result).toHaveLength(1)
    expect(result[0].data.repository_id).toBe(3)
    expect(result[0].data.id).toBeUndefined()
    expect(result[0].dependencies).toEqual(['lodash'])
    expect(result[0].usedData).toBe(false)
  })

  test('getDateState returns persisted date when present', async () => {
    const { db, gen, repoModule, langModule, logger } = makeBase()
    db.findFirst.mockResolvedValue({ date: '2025-01-01T00:00:00.000Z' })

    const service = createRepositoryService({ db, gen, repoModule, langModule, logger })
    const result = await service.getDateState()

    expect(result.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    expect(db.insertData).not.toHaveBeenCalled()
  })

  test('getDateState initializes date when absent', async () => {
    const { db, gen, repoModule, langModule, logger } = makeBase()
    db.findFirst.mockResolvedValue(null)

    const service = createRepositoryService({ db, gen, repoModule, langModule, logger })
    const result = await service.getDateState()

    expect(result).toBeInstanceOf(Date)
    expect(db.insertData).toHaveBeenCalledWith('state', { date: result })
  })

  test('processDay saves next day on error path', async () => {
    const { db, gen, repoModule, langModule, logger } = makeBase()
    repoModule.FetchRepos.mockRejectedValue(new Error('network error'))
    const service = createRepositoryService({ db, gen, repoModule, langModule, logger })

    const firstDay = new Date('2026-03-20T00:00:00.000Z')
    const secondDay = new Date('2026-03-19T00:00:00.000Z')
    const generator = {
      Next: jest.fn().mockReturnValueOnce(firstDay).mockReturnValueOnce(secondDay),
    }

    await service.processDay(generator)

    expect(logger.error).toHaveBeenCalled()
    expect(db.updateData).toHaveBeenCalledWith('state', {}, { $set: { date: secondDay } })
  })
})
