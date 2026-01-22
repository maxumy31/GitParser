from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

class AnalyticsEngine:
    def __init__(self, mongo_uri, db_name, db_manager):
        self.client = MongoClient(mongo_uri)
        self.collection = self.client[db_name]["topics"]
        self.db = db_manager

    def process_batch(self, size=500):
        docs = list(self.collection.find({"processed": {"$ne": True}}).limit(size))
        if not docs:
            return 0

        aggregated = {} # {(a, b, m_type): value}
        processed_ids = []

        for doc in docs:
            try:
                # Определяем контекст (с дефолтами для старых данных)
                ctx = {
                    "lang": doc.get("language", "unknown"),
                    "eco": doc.get("ecosystem", "unknown"),
                    "source": doc.get("source", "unknown")
                }
                
                # 1. Получаем ID топика (is_topic = True)
                topic_id = self.db.get_entity_id(doc["topic"], True, **ctx)
                stars = float(doc.get("stars", 0))
                
                # 2. Обрабатываем зависимости (is_topic = False)
                for dep_name in set(doc.get("deps", [])):
                    dep_id = self.db.get_entity_id(dep_name, False, **ctx)
                    
                    # Суммируем звезды
                    m_stars = self.db.get_lookup_id('metric_types', 'stars')
                    aggregated[(topic_id, dep_id, m_stars)] = aggregated.get((topic_id, dep_id, m_stars), 0) + stars
                    
                    # Считаем количество упоминаний
                    m_count = self.db.get_lookup_id('metric_types', 'repo_count')
                    aggregated[(topic_id, dep_id, m_count)] = aggregated.get((topic_id, dep_id, m_count), 0) + 1

                processed_ids.append(doc["_id"])
            except Exception as e:
                logger.error(f"Error processing doc {doc.get('_id')}: {e}")

        if aggregated:
            formatted_data = [(k[0], k[1], k[2], v) for k, v in aggregated.items()]
            self.db.save_metrics(formatted_data)

        self.collection.update_many({"_id": {"$in": processed_ids}}, {"$set": {"processed": True}})
        return len(processed_ids)