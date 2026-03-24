import { createEndpointHandlers } from '../../endpoints.js'
import { jest } from '@jest/globals'

describe('createEndpointHandlers', () => {
  test('handleGetKey returns repository when found', async () => {
    const repository = { _id: 'abc', data: { full_name: 'o/r' } }
    const dbAdapter = {
      findFirst: jest.fn().mockResolvedValue(repository),
      updateData: jest.fn(),
    }
    const logger = { info: jest.fn() }
    const handlers = createEndpointHandlers({ dbAdapter })

    const result = await handlers.handleGetKey({}, {}, logger)

    expect(dbAdapter.findFirst).toHaveBeenCalledWith('query', { usedData: false })
    expect(result).toBe(repository)
    expect(logger.info).toHaveBeenCalled()
  })

  test('handleGetKey returns error when repository not found', async () => {
    const dbAdapter = {
      findFirst: jest.fn().mockResolvedValue(null),
      updateData: jest.fn(),
    }
    const logger = { info: jest.fn() }
    const handlers = createEndpointHandlers({ dbAdapter })

    const result = await handlers.handleGetKey({}, {}, logger)

    expect(result).toEqual({ error: 'Cannot find repository' })
  })

  test('markAsProcessed updates by converted object id', async () => {
    const dbAdapter = {
      findFirst: jest.fn(),
      updateData: jest.fn().mockResolvedValue({ acknowledged: true }),
    }
    const logger = { info: jest.fn() }
    const toObjectId = jest.fn().mockReturnValue('oid-1')
    const handlers = createEndpointHandlers({ dbAdapter, toObjectId })

    const result = await handlers.markAsProcessed({ params: { id: '123' } }, {}, logger)

    expect(toObjectId).toHaveBeenCalledWith('123')
    expect(dbAdapter.updateData).toHaveBeenCalledWith('query', { _id: 'oid-1' }, { $set: { usedData: true } })
    expect(result).toEqual({ response: 'Value was updated' })
  })

  test('markAsProcessed returns error when update result is falsy', async () => {
    const dbAdapter = {
      findFirst: jest.fn(),
      updateData: jest.fn().mockResolvedValue(null),
    }
    const logger = { info: jest.fn() }
    const handlers = createEndpointHandlers({ dbAdapter, toObjectId: (id) => id })

    const result = await handlers.markAsProcessed({ params: { id: '123' } }, {}, logger)

    expect(result).toEqual({ error: 'Cannot update value by id' })
  })
})
