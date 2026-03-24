import { jest } from '@jest/globals'

describe('endpoints exported wrappers', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('handleGetKey uses lazy-loaded default db adapter', async () => {
    const repository = { _id: 'id-1', data: { full_name: 'owner/repo' } }
    const dbMock = {
      findFirst: jest.fn().mockResolvedValue(repository),
      updateData: jest.fn(),
    }

    jest.unstable_mockModule('../../db.js', () => ({ default: dbMock }))
    const endpoints = await import('../../endpoints.js')
    const logger = { info: jest.fn() }

    const first = await endpoints.handleGetKey({}, {}, logger)
    const second = await endpoints.handleGetKey({}, {}, logger)

    expect(first).toBe(repository)
    expect(second).toBe(repository)
    expect(dbMock.findFirst).toHaveBeenNthCalledWith(1, 'query', { usedData: false })
    expect(dbMock.findFirst).toHaveBeenNthCalledWith(2, 'query', { usedData: false })
  })

  test('markAsProcessed wrapper uses default ObjectId converter', async () => {
    const dbMock = {
      findFirst: jest.fn(),
      updateData: jest.fn().mockResolvedValue({ acknowledged: true }),
    }

    jest.unstable_mockModule('../../db.js', () => ({ default: dbMock }))
    const endpoints = await import('../../endpoints.js')
    const logger = { info: jest.fn() }
    const id = '507f1f77bcf86cd799439011'

    const result = await endpoints.markAsProcessed({ params: { id } }, {}, logger)

    expect(result).toEqual({ response: 'Value was updated' })
    const filterArg = dbMock.updateData.mock.calls[0][1]
    expect(typeof filterArg._id.toHexString).toBe('function')
    expect(filterArg._id.toHexString()).toBe(id)
  })

  test('createEndpointHandlers supports custom collection name', async () => {
    const { createEndpointHandlers } = await import('../../endpoints.js')
    const dbAdapter = {
      findFirst: jest.fn().mockResolvedValue(null),
      updateData: jest.fn().mockResolvedValue({ acknowledged: true }),
    }
    const logger = { info: jest.fn() }

    const handlers = createEndpointHandlers({
      dbAdapter,
      queryCollectionName: 'custom_query',
      toObjectId: (value) => value,
    })

    await handlers.handleGetKey({}, {}, logger)
    await handlers.markAsProcessed({ params: { id: 'abc' } }, {}, logger)

    expect(dbAdapter.findFirst).toHaveBeenCalledWith('custom_query', { usedData: false })
    expect(dbAdapter.updateData).toHaveBeenCalledWith('custom_query', { _id: 'abc' }, { $set: { usedData: true } })
  })
})
