export function createRepositoryService({
    db,
    gen,
    repoModule,
    langModule,
    logger,
    queryCollection = "query",
    visitedCollection = "visited",
    stateCollection = "state",
}) {
    async function getBatch(date) {
        const formatedDate = gen.TimeToStringQueryFormat(date)
        logger.info(`Fetching repos from date ${formatedDate} started`)
        const per_page = 100
        const starThreshold = 50
        const fetched = await repoModule.FetchRepos(formatedDate, 1, per_page, starThreshold, langModule.GetSupportedLanguages())

        logger.info(`Fetching repos from date ${formatedDate} page 1`)
        let batch = []
        for (const repo of fetched) {
            const repoLanguage = repo.language
            const repoOwner = repo.owner.login
            const repoName = repo.name
            const topics = repo.topics
            if (!topics || topics.length == 0) continue
            logger.info(`Searching for dependencies for repository ${repoOwner}/${repoName}.Language = ${repoLanguage}`)
            const deps = await langModule.FindDependencies(repoLanguage, repoModule, repoOwner, repoName)
            if (!deps || deps.length == 0) continue
            repo.repository_id = repo.id
            delete repo.id
            const result = {
                data: repo,
                dependencies: deps,
                foundAt: new Date(),
                usedData: false,
            }
            batch.push(result)
        }
        return batch
    }

    function writeBatch(batch) {
        db.insertBatch(visitedCollection, batch.map(repo => { return { full_name: repo.data.full_name } }))
        db.insertBatch(queryCollection, batch)
        console.log(`Inserted ${batch.length} repositories`)
        for (const b of batch) {
            console.log(`Inserted : ${b.data.full_name}. Language : ${b.data.language}`)
        }
    }

    async function saveNewDateState(date) {
        logger.info(`Updated date. New date : ${date}`)
        await db.updateData(stateCollection, {}, { $set: { date: date } })
    }

    async function getDateState() {
        const res = await db.findFirst(stateCollection, {})
        if (res) {
            logger.info(`Loaded date from db: ${res.date}`)
            return new Date(res.date)
        } else {
            const date = new Date()
            logger.info(`Unable to find date from db, created new date : ${date}`)
            await db.insertData(stateCollection, { date: date })
            return date
        }
    }

    async function processDay(generator) {
        try {
            const day = generator.Next()
            logger.info(`Processing day ${day.toISOString()}`)
            const batch = await getBatch(day)
            if (batch.length > 0) {
                writeBatch(batch)
            }
            logger.info(`Day ${day.toISOString()} processed. Skipping to the next day.`)
            await saveNewDateState(day)
        } catch (error) {
            logger.error(`Error : ${error}. Skipping to the next day.`)
            const day = generator.Next()
            await saveNewDateState(day)
        }
    }

    return {
        getBatch,
        writeBatch,
        saveNewDateState,
        getDateState,
        processDay,
    }
}

export default { createRepositoryService }