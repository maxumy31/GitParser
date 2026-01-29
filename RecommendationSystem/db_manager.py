import psycopg2
from psycopg2.extras import execute_values
import logging

class DatabaseManager:
    def __init__(self, db_config):
        self.conn = psycopg2.connect(**db_config)
        self.conn.autocommit = False
        self.logger = logging.getLogger(__name__)

    def get_lookup_id(self, table, name):
        if not name: return None
        query = f"INSERT INTO {table} (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id"
        with self.conn.cursor() as cur:
            cur.execute(query, (name.lower().strip(),))
            return cur.fetchone()[0]

    def get_library_id(self, name, lang_id, source_id):
        query = """
            INSERT INTO libraries (name, language_id)
            VALUES (%s, %s)
            ON CONFLICT (name, language_id) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
        """
        with self.conn.cursor() as cur:
            cur.execute(query, (name.lower().strip(), lang_id))
            return cur.fetchone()[0]

    def get_topic_id(self, name):
        query = "INSERT INTO topics (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id"
        with self.conn.cursor() as cur:
            cur.execute(query, (name.lower().strip(),))
            return cur.fetchone()[0]

    def upsert_repository(self, doc):
        lang_id = self.get_lookup_id('languages', doc.get('language'))
        source_id = self.get_lookup_id('data_sources', doc.get('source', 'github'))
        stats = doc['stats']

        # Рассчитываем базовый вес репозитория сразу (Trust Score base)
        # Формула: log(stars) + log(forks * 5) с учетом свежести
        query = """
            INSERT INTO repositories 
            (full_name, stargazers_count, forks_count, open_issues_count, pushed_at, created_at, language_id, source_id, calculated_weight)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 
                (LN(GREATEST(%s, 1)) * 1 + LN(GREATEST(%s, 1)) * 5) * EXP(-0.05 * EXTRACT(DAY FROM (NOW() - %s::timestamptz)) / 30)
            )
            ON CONFLICT (full_name) DO UPDATE SET
                stargazers_count = EXCLUDED.stargazers_count,
                forks_count = EXCLUDED.forks_count,
                pushed_at = EXCLUDED.pushed_at,
                calculated_weight = EXCLUDED.calculated_weight,
                updated_at = NOW()
            RETURNING id
        """
        with self.conn.cursor() as cur:
            cur.execute(query, (
                doc['repo_full_name'], stats['stars'], stats['forks'], stats['open_issues'],
                stats['last_push'], stats['created_at'], lang_id, source_id,
                stats['stars'], stats['forks'], stats['last_push']
            ))
            return cur.fetchone()[0]

    def link_libraries(self, repo_id, lib_ids):
        if not lib_ids: return
        data = [(repo_id, lid) for lid in set(lib_ids)]
        query = "INSERT INTO repo_libraries (repo_id, library_id) VALUES %s ON CONFLICT DO NOTHING"
        with self.conn.cursor() as cur:
            execute_values(cur, query, data)

    def link_topics(self, repo_id, topic_ids):
        if not topic_ids: return
        data = [(repo_id, tid) for tid in set(topic_ids)]
        query = "INSERT INTO repo_topics (repo_id, topic_id) VALUES %s ON CONFLICT DO NOTHING"
        with self.conn.cursor() as cur:
            execute_values(cur, query, data)

    def update_final_scores(self):
        """Обновление глобального рейтинга библиотек на основе накопленного веса репозиториев"""
        query = """
            INSERT INTO library_scores (library_id, final_score, updated_at)
            SELECT rl.library_id, SUM(r.calculated_weight), NOW()
            FROM repo_libraries rl
            JOIN repositories r ON rl.repo_id = r.id
            GROUP BY rl.library_id
            ON CONFLICT (library_id) DO UPDATE SET 
                final_score = EXCLUDED.final_score, updated_at = NOW();
        """
        with self.conn.cursor() as cur:
            cur.execute(query)

    def commit(self): self.conn.commit()
    def rollback(self): self.conn.rollback()
    def close(self): self.conn.close()