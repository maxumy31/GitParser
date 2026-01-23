import psycopg2
from psycopg2.extras import execute_values
import logging

class DatabaseManager:
    def __init__(self, db_config):
        """db_config: словарь с параметрами подключения к PostgreSQL"""
        self.conn = psycopg2.connect(**db_config)
        self.conn.autocommit = False # Работаем в транзакциях
        self.logger = logging.getLogger(__name__)

    def get_lookup_id(self, table, name):
        """Универсальный метод для получения ID из справочников (languages, sources и т.д.)"""
        if not name:
            return None
        
        query = f"INSERT INTO {table} (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id"
        with self.conn.cursor() as cur:
            cur.execute(query, (name.lower().strip(),))
            return cur.fetchone()[0]

    def get_entity_id(self, name, is_topic, language_name):
        """Получает или создает ID сущности (библиотеки или тега) в контексте языка"""
        lang_id = self.get_lookup_id('languages', language_name)
        
        query = """
            INSERT INTO entities (name, is_topic, language_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (name, is_topic, language_id) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
        """
        with self.conn.cursor() as cur:
            cur.execute(query, (name.lower().strip(), is_topic, lang_id))
            return cur.fetchone()[0]

    def upsert_repository(self, doc):
        """
        Сохраняет метаданные репозитория. 
        При конфликте (уже есть в базе) обновляет счетчики звезд, форков и дату пуша.
        """
        lang_id = self.get_lookup_id('languages', doc['language'])
        source_id = self.get_lookup_id('data_sources', doc['source'])

        query = """
            INSERT INTO repositories 
            (full_name, stargazers_count, forks_count, open_issues_count, pushed_at, created_at, language_id, source_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (full_name) DO UPDATE SET
                stargazers_count = EXCLUDED.stargazers_count,
                forks_count = EXCLUDED.forks_count,
                open_issues_count = EXCLUDED.open_issues_count,
                pushed_at = EXCLUDED.pushed_at,
                updated_at = NOW()
            RETURNING id
        """
        stats = doc['stats']
        with self.conn.cursor() as cur:
            cur.execute(query, (
                doc['repo_full_name'],
                stats['stars'],
                stats['forks'],
                stats['open_issues'],
                stats['last_push'],
                stats['created_at'],
                lang_id,
                source_id
            ))
            return cur.fetchone()[0]

    def link_entities(self, repo_id, entity_ids):
        """
        Создает связи между репозиторием и набором сущностей.
        Использует execute_values для максимально быстрой массовой вставки.
        """
        if not entity_ids:
            return

        # Исключаем дубликаты ID сущностей для одного репо
        unique_entities = set(entity_ids)
        data = [(repo_id, eid) for eid in unique_entities]

        query = "INSERT INTO repo_entities (repo_id, entity_id) VALUES %s ON CONFLICT DO NOTHING"
        
        with self.conn.cursor() as cur:
            execute_values(cur, query, data)

    def update_final_scores(self):
        """
        Реализация формулы Trust Score прямо в SQL.
        Считает рейтинг для каждой сущности на основе данных репозиториев, где она замечена.
        """
        query = """
            INSERT INTO entity_scores (entity_id, final_score, updated_at)
            SELECT 
                re.entity_id,
                -- Формула: (ln(stars)*1 + ln(forks)*5) * затухание по времени
                SUM(
                    (LN(GREATEST(r.stargazers_count, 1)) * 1 + LN(GREATEST(r.forks_count, 1)) * 5) *
                    EXP(-0.05 * EXTRACT(DAY FROM (NOW() - r.pushed_at)) / 30)
                ) as score,
                NOW()
            FROM repo_entities re
            JOIN repositories r ON re.repo_id = r.id
            GROUP BY re.entity_id
            ON CONFLICT (entity_id) DO UPDATE SET 
                final_score = EXCLUDED.final_score,
                updated_at = EXCLUDED.updated_at;
        """
        with self.conn.cursor() as cur:
            cur.execute(query)
            self.conn.commit()

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()