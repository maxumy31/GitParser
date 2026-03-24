import { ObjectId } from 'mongodb'

const queryCollection = "query"

export function createEndpointHandlers({
    dbAdapter,
    toObjectId = (id) => new ObjectId(id),
    queryCollectionName = queryCollection,
}) {
    async function handleGetKey(req, reply, logger) {
        const repository = await dbAdapter.findFirst(queryCollectionName, { usedData: false })
        if (!repository) {
            logger.info(`Cannot find repository for request`)
            return { error: "Cannot find repository" }
        } else {
            logger.info(`Found repository id:${repository._id} full_name:${repository.data.full_name} for request`)
            return repository
        }
    }

    async function markAsProcessed(req, reply, logger) {
        const id = req.params.id
        const objId = toObjectId(id)
        const res = await dbAdapter.updateData(queryCollectionName, { _id: objId }, { $set: { usedData: true } })
        if (!res) {
            logger.info(`Cannot update value with id = ${id}`)
            return { error: "Cannot update value by id" }
        } else {
            logger.info(`Updated value with id = ${id}`)
            return { response: "Value was updated" }
        }
    }

    return {
        handleGetKey,
        markAsProcessed,
    }
}

let defaultHandlersPromise = null

async function getDefaultHandlers() {
    if (!defaultHandlersPromise) {
        defaultHandlersPromise = import('./db.js').then(({ default: db }) => {
            return createEndpointHandlers({ dbAdapter: db })
        })
    }
    return defaultHandlersPromise
}

export async function handleGetKey(req, reply, logger) {
    const defaultHandlers = await getDefaultHandlers()
    return defaultHandlers.handleGetKey(req, reply, logger)
}

export async function markAsProcessed(req,reply,logger) {
    const defaultHandlers = await getDefaultHandlers()
    return defaultHandlers.markAsProcessed(req, reply, logger)
}