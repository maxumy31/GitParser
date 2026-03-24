import NewNPMModule from '../../Modules/NPM.js'
import NewMavenModule from '../../Modules/Maven.js'
import NewGradleModule from '../../Modules/Gradle.js'
import NewPipModule from '../../Modules/PIP.js'
import NewCargoModule from '../../Modules/Cargo.js'
import { jest } from '@jest/globals'

describe('Parsers', () => {
  test('NPM parser extracts deps from package.json sections', async () => {
    const module = NewNPMModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { jest: '^30.0.0' },
        peerDependencies: { lodash: '^4.17.0' },
      })),
      jest.fn().mockResolvedValue({ path: 'package.json' }),
    )

    expect(result).toEqual(expect.arrayContaining(['react', 'jest', 'lodash']))
    expect(result).toHaveLength(3)
  })

  test('Maven parser skips placeholder coordinates', async () => {
    const module = NewMavenModule()
    const pom = `
      <project>
        <!-- comment -->
        <dependencies>
          <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
          </dependency>
          <dependency>
            <groupId>${'${project.groupId}'}</groupId>
            <artifactId>${'${artifact.id}'}</artifactId>
          </dependency>
        </dependencies>
      </project>
    `

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(pom),
      jest.fn().mockResolvedValue({ path: 'pom.xml' }),
    )

    expect(result).toEqual(['org.slf4j:slf4j-api'])
  })

  test('Gradle parser extracts implementation/api/testImplementation deps', async () => {
    const module = NewGradleModule()
    const gradle = `
      implementation "org.springframework:spring-core:6.0.0"
      api 'com.fasterxml.jackson.core:jackson-databind:2.17.0'
      testImplementation "junit:junit:4.13.2"
    `

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(gradle),
      jest.fn()
        .mockResolvedValueOnce({ path: 'build.gradle', name: 'build.gradle' })
        .mockResolvedValueOnce(null),
    )

    expect(result).toEqual(expect.arrayContaining([
      'org.springframework:spring-core',
      'com.fasterxml.jackson.core:jackson-databind',
      'junit:junit',
    ]))
  })

  test('PIP parser filters unsupported lines', async () => {
    const module = NewPipModule()
    const requirements = `
      # comment
      requests==2.32.0
      -r base.txt
      git+https://github.com/pallets/flask.git
      numpy>=1.26
    `

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(requirements),
      jest.fn().mockResolvedValue({ path: 'requirements.txt' }),
    )

    expect(result).toEqual(['requests', 'numpy'])
  })

  test('Cargo parser excludes git/path dependencies', async () => {
    const module = NewCargoModule()
    const cargoToml = `
      [dependencies]
      serde = "1.0"
      tokio = { version = "1.0", features = ["full"] }
      local_dep = { path = "../dep" }
      remote_dep = { git = "https://github.com/org/repo" }

      [dev-dependencies]
      insta = "1.40"
    `

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(cargoToml),
      jest.fn().mockResolvedValue({ path: 'Cargo.toml' }),
    )

    expect(result).toEqual(expect.arrayContaining(['serde', 'tokio', 'insta']))
    expect(result).not.toEqual(expect.arrayContaining(['local_dep', 'remote_dep']))
  })

  test('NPM parser returns null when package.json is missing', async () => {
    const module = NewNPMModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn(),
      jest.fn().mockResolvedValue(null),
    )

    expect(result).toBeNull()
  })

  test('NPM parser throws on invalid package.json content', async () => {
    const module = NewNPMModule()

    await expect(module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue('{invalid json'),
      jest.fn().mockResolvedValue({ path: 'package.json' }),
    )).rejects.toThrow()
  })

  test('Maven parser returns null when pom.xml is missing', async () => {
    const module = NewMavenModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn(),
      jest.fn().mockResolvedValue(null),
    )

    expect(result).toBeNull()
  })

  test('Gradle parser returns null when no gradle files are found', async () => {
    const module = NewGradleModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn(),
      jest.fn().mockResolvedValue(null),
    )

    expect(result).toBeNull()
  })

  test('PIP parser returns null when requirements.txt is missing', async () => {
    const module = NewPipModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn(),
      jest.fn().mockResolvedValue(null),
    )

    expect(result).toBeNull()
  })

  test('PIP parser returns empty list when all lines are ignored', async () => {
    const module = NewPipModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue('# comment\n-r base.txt\n--extra-index-url https://example.com\ngit+https://repo.git'),
      jest.fn().mockResolvedValue({ path: 'requirements.txt' }),
    )

    expect(result).toEqual([])
  })

  test('Cargo parser returns empty list for non-string content', async () => {
    const module = NewCargoModule()

    const result = await module.ProcessRepository(
      jest.fn(),
      jest.fn().mockResolvedValue(null),
      jest.fn().mockResolvedValue({ path: 'Cargo.toml' }),
    )

    expect(result).toEqual([])
  })
})
