import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI

const dbName = "db"
let client = null
await connectWithRetry();

const connection = await client.connect()

async function connectWithRetry() {
  let retries = 5;
  while (retries) {
    try {
      client = new MongoClient(uri);
      await client.connect();
      console.log('Connected to MongoDB');
      return;
    } catch (error) {
      retries--;
      console.log(`MongoDB connection failed, ${retries} retries left`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error('Could not connect to MongoDB');
}

const createInsertFunction = (dbName) => {
    async function insertData(dbName,collection,data) {
    const db = client.db(dbName)
    const col = db.collection(collection)
    const res = await col.insertOne(data)
    return res
    }

    return (collection,data) => insertData(dbName,collection,data)
};

const createUpdateFunction = (dbName) => {
    async function updatetData(dbName, collection, filter, updateData = {}) {
        const db = client.db(dbName);
        const col = db.collection(collection);
        const res = await col.updateOne(filter, updateData);
        return res;
    }

    return (collection, filter, updateData) => updatetData(dbName, collection, filter, updateData);
};

const createInsertBatchFunction = (dbName) => {
    async function insertBatchData(dbName,collection,data) {
    const db = client.db(dbName)
    const col = db.collection(collection)
    const res = await col.insertMany(data)
    return res
    }

    return (collection,data) => insertBatchData(dbName,collection,data)
};

const createReadFunction = (dbName) => {
    async function readData(dbName, collection, query = {}, options = {}) {
        const db = client.db(dbName);
        const col = db.collection(collection);
        const res = await col.find(query, options).toArray();
        return res;
    }

    return (collection, query = {}, options = {}) => readData(dbName, collection, query = {}, options);
};

const createFindOneFunction = (dbName) => {
    async function findOne(dbName,collection,query) {
        const db = client.db(dbName)
        const col = db.collection(collection)
        const res = await col.findOne(query)
        return res
    }
    return (collection,query) => findOne(dbName,collection,query)
}

const createDropCollectionFunction = (dbName) => {
    async function dropCollection(dbName,collection) {
        const db = client.db(dbName)
        const col = db.collection(collection)
        const res = await col.drop()
    }
    return (collection) => dropCollection(dbName,collection)
}

const insertData = createInsertFunction(dbName);
const readData = createReadFunction(dbName);
const findFirst = createFindOneFunction(dbName)
const dropCollection = createDropCollectionFunction(dbName)
const insertBatch = createInsertBatchFunction(dbName)
const updateData = createUpdateFunction(dbName)

export default {insertData, readData, findFirst, dropCollection, insertBatch, updateData}
