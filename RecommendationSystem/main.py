import os
import time
import logging
from db_manager import DatabaseManager
from engine import AnalyticsEngine
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)

def run():
    pg_config = {
        'host': os.getenv("PG_HOST"),
        'dbname': os.getenv("PG_DB"),
        'user': os.getenv("PG_USER"),
        'password': os.getenv("PG_PASSWORD")
    }
    
    db = DatabaseManager(pg_config)
    
    engine = AnalyticsEngine(
        os.getenv("MONGO_URI"), 
        os.getenv("MONGO_DB_NAME"), 
        db
    )

    while True:
        count = engine.process_batch(size=1000)
        
        if count == 0:
            logging.info("Новых данных нет. Запускаем пересчет Trust Score...")
            engine.run_scoring()
            
            logging.info("Все данные обработаны и рейтинги обновлены. Спим 60 секунд...")
            time.sleep(60)
        else:
            logging.info(f"Обработано {count} документов. Продолжаем цикл...")

if __name__ == "__main__":
    run()