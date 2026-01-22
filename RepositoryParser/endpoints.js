import db from "./db.js"
import { ObjectId } from 'mongodb'

const queryCollection = "query"
const visitedCollection = "visited"
const stateCollection = "state"


export async function handleGetKey(req,reply,logger) {
        const repos = await db.findFirst(queryCollection, {used_in_request : false});
        if (!repos) {
            logger.info(`Cannot find repo for request`)
            return {error: "Cannot find repo"}
        } else {
            logger.info(`Found repo ${repos._id} for request`)
            const res = {repo : repos}
            logger.info(`Result : ${JSON.stringify(res)}`)
            return res
        }
}

export async function markAsProcessed(req,reply,logger) {
    const id = req.params.id  
    const objId = new ObjectId(id)
    const res = await db.updateData(queryCollection,{_id:objId},{ $set: { used_in_request: true } })
    if (!res) {
        logger.log.info(`Cannot update value with id = ${id}`)
        return {error:"Cannot update value by id"}
    } else {
        logger.log.info(`Updated value with id = ${id}`)
        return {response:"Value was updated"}
    }
}