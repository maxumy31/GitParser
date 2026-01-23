import logging
from pymongo import MongoClient
from datetime import datetime

class AnalyticsEngine:
    def __init__(self, mongo_uri, db_name, db_manager):
        """
        mongo_uri: строка подключения к MongoDB
        db_name: имя базы данных MongoDB
        db_manager: экземпляр DatabaseManager для работы с PostgreSQL
        """
        self.client = MongoClient(mongo_uri)
        self.mdb = self.client[db_name]
        self.collection = self.mdb['topics']
        self.db = db_manager
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def process_batch(self, size=100):
        """Обрабатывает пакет документов из MongoDB"""
        # Ищем документы, которые еще не были обработаны
        docs = list(self.collection.find({"processed": False}).limit(size))
        
        if not docs:
            self.logger.info("Нет новых документов для обработки.")
            return 0

        processed_count = 0
        
        for doc in docs:
            try:
                # 1. Извлекаем источник из документа (теперь явно указан)
                source_name = doc.get('source', 'github').lower()
                
                # 2. Сохраняем/Обновляем репозиторий в Postgres
                # Передаем source_name, чтобы корректно привязать к data_sources
                repo_id = self.db.upsert_repository(doc)
                
                # 3. Собираем ID всех сущностей (теги и библиотеки)
                entity_ids = []
                repo_lang = doc.get('language', 'javascript')

                # Обрабатываем топики (теги) -> is_topic = True
                for topic_name in doc.get('topics', []):
                    eid = self.db.get_entity_id(topic_name, True, repo_lang)
                    entity_ids.append(eid)

                # Обрабатываем зависимости (библиотеки) -> is_topic = False
                for dep_name in doc.get('deps', []):
                    eid = self.db.get_entity_id(dep_name, False, repo_lang)
                    entity_ids.append(eid)

                # 4. Создаем связи в реляционной таблице (repo_entities)
                # Используем set(), чтобы избежать дублей, если библиотека названа так же, как тег
                if entity_ids:
                    self.db.link_entities(repo_id, list(set(entity_ids)))

                # 5. Помечаем документ в MongoDB как успешно обработанный
                self.collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {
                        "processed": True,
                        "processed_at": datetime.utcnow()
                    }}
                )
                
                # Фиксируем транзакцию для каждого репозитория
                self.db.commit()
                processed_count += 1
                
            except Exception as e:
                self.logger.error(f"Ошибка при обработке репозитория {doc.get('repo_full_name')}: {e}")
                self.db.rollback() # Откатываем изменения в Postgres при ошибке
                continue

        self.logger.info(f"Успешно обработано репозиториев: {processed_count}")
        return processed_count

    def run_scoring(self):
        """Запускает пересчет глобальных рейтингов Trust Score"""
        self.logger.info("Запуск пересчета рейтингов Trust Score...")
        try:
            self.db.update_final_scores()
            self.logger.info("Рейтинги успешно обновлены.")
        except Exception as e:
            self.logger.error(f"Ошибка при обновлении рейтингов: {e}")

    def close(self):
        self.client.close()
        self.db.close()