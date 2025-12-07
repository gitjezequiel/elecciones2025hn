import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def describe_table(table_name):
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            port=os.getenv("DB_PORT")
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"DESCRIBE {table_name}")
        schema = cursor.fetchall()
        print(f"\nSchema for {table_name}:")
        for col in schema:
            print(col)
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error describing table {table_name}: {err}")

if __name__ == "__main__":
    describe_table("elecciones_departamentos")
    describe_table("elecciones_municipios")
    describe_table("elecciones_zonas")
    describe_table("elecciones_puestos")