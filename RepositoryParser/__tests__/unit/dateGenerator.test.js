import gen from '../../dateGenerator.js'

describe('dateGenerator', () => {
  test('NewDateGenerator.Next returns current date then decrements by one day', () => {
    const start = new Date('2026-01-15T00:00:00.000Z')
    const generator = gen.NewDateGenerator(new Date(start))

    const first = generator.Next()
    const second = generator.Next()

    expect(first.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(second.toISOString()).toBe('2026-01-14T00:00:00.000Z')
  })

  test('TimeToStringQueryFormat returns YYYY-MM-DD', () => {
    const value = gen.TimeToStringQueryFormat(new Date('2024-07-01T10:20:30.000Z'))
    expect(value).toBe('2024-07-01')
  })
})
