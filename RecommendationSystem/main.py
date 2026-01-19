import os
import logging
from typing import List, Dict, Tuple
from pymongo import MongoClient
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from functools import lru_cache

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

class AnalyticsEngine:
    def __init__(self):
        self.pg_conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            port=os.getenv("PG_PORT"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            dbname=os.getenv("PG_DB")
        )
        self.mongo_client = MongoClient(os.getenv("MONGO_URI"))
        self.mongo_db = self.mongo_client[os.getenv("MONGO_DB_NAME")]
        self.topics_collection = self.mongo_db["topics"]
        
        # Кэш для ID типов метрик (их мало, можно хранить вечно)
        self.metric_types = {}

    def init_schema(self):
        """Инициализация структуры БД с индексами для ускорения поиска"""
        with self.pg_conn.cursor() as cursor:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS entities (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                UNIQUE(type, name)
            );
            CREATE INDEX IF NOT EXISTS idx_entities_lookup ON entities(name, type);

            CREATE TABLE IF NOT EXISTS metric_types (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS entity_metrics (
                entity_a_id INT REFERENCES entities(id),
                entity_b_id INT REFERENCES entities(id),
                metric_type_id INT REFERENCES metric_types(id),
                value NUMERIC,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (entity_a_id, entity_b_id, metric_type_id)
            );

            INSERT INTO metric_types (name) VALUES ('stars'), ('repo_count')
            ON CONFLICT (name) DO NOTHING;
            """)
            self.pg_conn.commit()
            
            # Загружаем ID метрик в память
            cursor.execute("SELECT name, id FROM metric_types")
            self.metric_types = dict(cursor.fetchall())

    @lru_cache(maxsize=10000)
    def get_or_create_entity(self, name: str, entity_type: str) -> int:
        """Получение ID сущности с использованием LRU-кэша"""
        with self.pg_conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM entities WHERE type = %s AND name = %s",
                (entity_type, name)
            )
            row = cursor.fetchone()
            if row:
                return row[0]
            
            cursor.execute(
                "INSERT INTO entities (type, name) VALUES (%s, %s) ON CONFLICT (type, name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
                (entity_type, name)
            )
            return cursor.fetchone()[0]

    def process_batch(self, batch_size: int = 100):
        """Основной цикл обработки документов"""
        docs = list(self.topics_collection.find({"processed": {"$ne": True}}).limit(batch_size))
        
        if not docs:
            logger.info("Нет новых записей для обработки")
            return

        # Накапливаем метрики в памяти: {(a_id, b_id, m_id): aggregate_value}
        aggregated_metrics: Dict[Tuple[int, int, int], float] = {}
        processed_ids = []

        for doc in docs:
            topic_name = doc.get("topic")
            deps = doc.get("deps")
            
            if not topic_name or not deps:
                processed_ids.append(doc["_id"])
                continue

            try:
                topic_id = self.get_or_create_entity(topic_name, "topic")
                stars = float(doc.get("stars", 0))
                
                # set() убирает дубли зависимостей внутри одного репозитория
                for dep_name in set(deps):
                    dep_id = self.get_or_create_entity(dep_name, "dependency")
                    
                    # Метрика Stars
                    key_stars = (topic_id, dep_id, self.metric_types['stars'])
                    aggregated_metrics[key_stars] = aggregated_metrics.get(key_stars, 0) + stars
                    
                    # Метрика Repo Count
                    key_count = (topic_id, dep_id, self.metric_types['repo_count'])
                    aggregated_metrics[key_count] = aggregated_metrics.get(key_count, 0) + 1
                
                processed_ids.append(doc["_id"])
            except Exception as e:
                logger.error(f"Ошибка при подготовке документа {doc['_id']}: {e}")

        if aggregated_metrics:
            self.save_to_postgres(aggregated_metrics)
            
        # Массовое обновление статуса в Mongo
        if processed_ids:
            self.topics_collection.update_many(
                {"_id": {"$in": processed_ids}},
                {"$set": {"processed": True}}
            )
            logger.info(f"Успешно обработано документов: {len(processed_ids)}")

    def save_to_postgres(self, metrics: Dict[Tuple[int, int, int], float]):
        """Массовое сохранение данных в Postgres"""
        values = [
            (a_id, b_id, m_id, val) 
            for (a_id, b_id, m_id), val in metrics.items()
        ]
        
        query = """
        INSERT INTO entity_metrics (entity_a_id, entity_b_id, metric_type_id, value)
        VALUES %s
        ON CONFLICT (entity_a_id, entity_b_id, metric_type_id)
        DO UPDATE SET 
            value = entity_metrics.value + EXCLUDED.value,
            updated_at = NOW();
        """
        
        with self.pg_conn.cursor() as cursor:
            try:
                execute_values(cursor, query, values)
                self.pg_conn.commit()
            except Exception as e:
                self.pg_conn.rollback()
                logger.error(f"Ошибка при записи в Postgres: {e}")
                raise

    def close(self):
        self.pg_conn.close()
        self.mongo_client.close()

if __name__ == "__main__":
    engine = AnalyticsEngine()
    try:
        engine.init_schema()
        # Можно запустить в цикле или по расписанию
        engine.process_batch(batch_size=500)
    finally:
        engine.close()