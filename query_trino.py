import os
from sqlalchemy.engine import create_engine
from sqlalchemy import text
import pandas as pd
import sys
import warnings
warnings.filterwarnings('ignore')

TRINO_HOST = os.environ.get('TRINO_HOST')
TRINO_PORT = os.environ.get('TRINO_PORT')
TRINO_USERNAME = os.environ.get('TRINO_USERNAME')
TRINO_PASSWORD = os.environ.get('TRINO_PASSWORD')
TRINO_DECRYPT_KEY = os.environ.get('TRINO_DECRYPT_KEY', '')

if not all([TRINO_HOST, TRINO_PORT, TRINO_USERNAME, TRINO_PASSWORD]):
    print("Error: TRINO credentials missing. Set TRINO_HOST, TRINO_PORT, TRINO_USERNAME, TRINO_PASSWORD as environment variables.")
    sys.exit(1)

def query_database(sql_file_path):
    try:
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_query = f.read().replace('{{token}}', TRINO_DECRYPT_KEY)

        print(f"Executing SQL from {sql_file_path}...")

        from trino.auth import BasicAuthentication
        engine = create_engine(
            f'trino://{TRINO_USERNAME}@{TRINO_HOST}:{TRINO_PORT}/',
            connect_args={
                'http_scheme': 'https',
                'source': 'lmwn-bi-pa',
                'verify': False,
                'auth': BasicAuthentication(TRINO_USERNAME, TRINO_PASSWORD),
            }
        )

        with engine.connect() as conn:
            df = pd.read_sql(text(sql_query), conn)

        csv_path = sql_file_path.replace('.sql', '.csv')
        df.to_csv(csv_path, index=False)

        print("\n=== Result Summary ===")
        print(f"Total Rows: {len(df)}")
        print(f"Columns: {', '.join(df.columns)}")
        print(f"Saved to: {csv_path}")
        print("\n=== Data ===")
        print(df.to_markdown())

        return df

    except Exception as e:
        print(f"Error executing query: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 query_trino.py <path_to_sql_file>")
        sys.exit(1)

    query_database(sys.argv[1])
