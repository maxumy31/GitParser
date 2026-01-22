import psycopg2
from psycopg2.extras import execute_values
from functools import lru_cache

class DatabaseManager:
    def __init__(self, config):
        self.conn = psycopg2.connect(**config)
        self.lookups = {} # Кэш для справочников

    def refresh_lookups(self):
        """Загружает ID всех справочников в память"""
        tables = ['languages', 'ecosystems', 'data_sources', 'metric_types']
        with self.conn.cursor() as cur:
            for table in tables:
                cur.execute(f"SELECT name, id FROM {table}")
                self.lookups[table] = dict(cur.fetchall())

    def get_lookup_id(self, table, name):
        """Возвращает ID из кэша или создает новую запись"""
        if name not in self.lookups.get(table, {}):
            with self.conn.cursor() as cur:
                cur.execute(f"INSERT INTO {table} (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id", (name,))
                new_id = cur.fetchone()[0]
                self.conn.commit()
                self.lookups.setdefault(table, {})[name] = new_id
        return self.lookups[table][name]

    @lru_cache(maxsize=50000)
    def get_entity_id(self, name, is_topic, lang, eco, source):
        """Получает или создает сущность с учетом контекста"""
        lang_id = self.get_lookup_id('languages', lang)
        eco_id = self.get_lookup_id('ecosystems', eco)
        src_id = self.get_lookup_id('data_sources', source)

        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO entities (name, is_topic, language_id, ecosystem_id, source_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT ON CONSTRAINT entities_context_unique DO UPDATE SET name=EXCLUDED.name
                RETURNING id
            """, (name, is_topic, lang_id, eco_id, src_id))
            return cur.fetchone()[0]

    def save_metrics(self, metrics_data):
        """Массовое сохранение агрегированных метрик"""
        query = """
            INSERT INTO entity_metrics (entity_a_id, entity_b_id, metric_type_id, value)
            VALUES %s
            ON CONFLICT (entity_a_id, entity_b_id, metric_type_id)
            DO UPDATE SET value = entity_metrics.value + EXCLUDED.value, updated_at = NOW()
        """
        with self.conn.cursor() as cur:
            execute_values(cur, query, metrics_data)
            self.conn.commit()