import logging
from pymongo import MongoClient
from datetime import datetime

class AnalyticsEngine:
    def __init__(self, mongo_uri, db_name, db_manager):
        self.client = MongoClient(mongo_uri)
        self.mdb = self.client[db_name]
        self.collection = self.mdb['topics']
        self.db = db_manager
        self.logger = logging.getLogger(__name__)

    def process_batch(self, size=1000):
        docs = list(self.collection.find({"processed": False}).limit(size))
        if not docs:
            return 0
        self.logger.info(f"Обрабатываем {len(docs)} репозиториев.")

        processed_count = 0
        for doc in docs:
            try:
                lang_id = self.db.get_lookup_id('languages', doc.get('language'))
                source_id = self.db.get_lookup_id('data_sources', doc.get('source', 'github'))
                repo_id = self.db.upsert_repository(doc)
                lib_ids = [self.db.get_library_id(dep, lang_id, source_id) for dep in doc.get('deps', [])]
                self.db.link_libraries(repo_id, lib_ids)
                topic_ids = [self.db.get_topic_id(top) for top in doc.get('topics', [])]
                self.db.link_topics(repo_id, topic_ids)


                self.collection.update_one({"_id": doc["_id"]}, {"$set": {"processed": True}})
                self.db.commit()
                processed_count += 1
            except Exception as e:
                self.logger.error(f"Ошибка в репозитории {doc.get('repo_full_name')}: {e}")
                self.db.rollback()
        
        return processed_count

    def run_scoring(self):
        self.db.update_final_scores()
        self.db.commit()