import db from "./db.js"
import { ObjectId } from 'mongodb'

const queryCollection = "query"
const visitedCollection = "visited"
const stateCollection = "state"


export async function handleGetKey(req,reply,logger) {
        const repository = await db.findFirst(queryCollection, {usedData : false});
        if (!repository) {
            logger.info(`Cannot find repository for request`)
            return {error: "Cannot find repository"}
        } else {
            logger.info(`Found repository id:${repository._id} full_name:${repository.data.full_name} for request`)
            return repository
        }
}

export async function markAsProcessed(req,reply,logger) {
    const id = req.params.id  
    const objId = new ObjectId(id)
    const res = await db.updateData(queryCollection,{_id:objId},{ $set: { usedData: true } })
    if (!res) {
        logger.log.info(`Cannot update value with id = ${id}`)
        return {error:"Cannot update value by id"}
    } else {
        logger.log.info(`Updated value with id = ${id}`)
        return {response:"Value was updated"}
    }
}