
import os
import mysql.connector
import requests
import fitz # PyMuPDF
import cv2
import numpy as np
import io
from dotenv import load_dotenv
from word2number import w2n

API_BASE_URL = "https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos"
PARTY_FLAGS_DIR = "D:\\Registro\\elecciones\\Partidos"
BASE_PDF_STORAGE_PATH = "D:\\Registro\\PDF"

def get_db_connection():
    """Establishes and returns a connection to the database."""
    load_dotenv()
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            port=os.getenv("DB_PORT")
        )
        print("Successfully connected to the database.")
        return conn
    except mysql.connector.Error as err:
        print(f"Error connecting to database: {err}")
        return None

def get_iteration_params(conn):
    """
    Fetches all combinations of department, municipality, zone, and polling station
    from the database, including their names, to build the API URLs and directory paths.
    """
    if not conn:
        print("No database connection available.")
        return []

    cursor = conn.cursor(dictionary=True)
    
    try:
        # Query joins tables to get names for the directory structure
        sql = """
            SELECT
                p.id_departamento,
                d.nombre_departamento,
                p.id_municipio,
                m.nombre_municipio,
                p.id_zona,
                p.id_puesto,
                p.nombre_puesto
            FROM
                elecciones_puestos p
            JOIN
                elecciones_departamentos d ON p.id_departamento = d.id_departamento
            JOIN
                elecciones_municipios m ON p.id_municipio = m.id_municipio AND p.id_departamento = m.dpto
        """
        cursor.execute(sql)
        puestos_data = cursor.fetchall()
        print(f"Found {len(puestos_data)} unique polling station combinations.")
        return puestos_data

    except mysql.connector.Error as err:
        print(f"Database query error: {err}")
        return []
    finally:
        cursor.close()

def build_api_url(depto_id, muni_id, zona_id, puesto_id):
    """Builds the specific API URL for a given combination of IDs."""
    return f"{API_BASE_URL}/01/{depto_id}/{muni_id}/{zona_id}/{puesto_id}/mesas"

def fetch_pdf_data_from_api(url):
    """Calls the API and returns a list of dictionaries with PDF info."""
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from API URL {url}: {e}")
        return None

def download_pdf(pdf_url):
    """Downloads a PDF from a given URL and returns its content as bytes."""
    try:
        response = requests.get(pdf_url, stream=True)
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        print(f"Error downloading PDF from {pdf_url}: {e}")
        return None

def load_party_flags(flags_dir):
    """Loads all party flag images from the specified directory."""
    party_flags = {}
    if not os.path.isdir(flags_dir):
        print(f"Party flags directory not found: {flags_dir}")
        return party_flags

    for filename in os.listdir(flags_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            filepath = os.path.join(flags_dir, filename)
            flag_img = cv2.imread(filepath, cv2.IMREAD_COLOR)
            if flag_img is not None:
                flag_name = os.path.splitext(filename)[0]
                party_flags[flag_name] = flag_img
    print(f"Loaded {len(party_flags)} party flags.")
    return party_flags

def process_pdf_and_extract_votes(pdf_content, party_flags, iteration_params, mesa_data):
    """
    Processes a single PDF by finding party flags via image matching, then extracts vote counts.
    """
    if not pdf_content:
        return []

    results = []
    try:
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        page = doc.load_page(0)
        
        zoom = 2
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        img_bytes = pix.tobytes("png")
        nparr = np.frombuffer(img_bytes, np.uint8)
        page_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        page_gray = cv2.cvtColor(page_img, cv2.COLOR_BGR2GRAY)

        # Adjusted ROI definitions
        HUNDREDS_ROI = {'x': 120, 'y': 0, 'w': 25, 'h': 25}
        TENS_ROI     = {'x': 138, 'y': 0, 'w': 25, 'h': 25}
        UNITS_ROI    = {'x': 155, 'y': 0, 'w': 25, 'h': 25}
        LETRAS_ROI   = {'x': 175, 'y': 0, 'w': 120, 'h': 25}

        for flag_name, flag_template in party_flags.items():
            template_gray = cv2.cvtColor(flag_template, cv2.COLOR_BGR2GRAY)
            
            res = cv2.matchTemplate(page_gray, template_gray, cv2.TM_CCOEFF_NORMED)
            threshold = 0.7 # Lowered threshold
            loc = np.where(res >= threshold)

            for pt in zip(*loc[::-1]):
                print(f"    DEBUG: Found potential match for '{flag_name}' at image coordinates {pt}")
                pdf_x = pt[0] / zoom
                pdf_y = pt[1] / zoom

                roi_h = fitz.Rect(pdf_x + HUNDREDS_ROI['x'], pdf_y + HUNDREDS_ROI['y'], pdf_x + HUNDREDS_ROI['x'] + HUNDREDS_ROI['w'], pdf_y + HUNDREDS_ROI['y'] + HUNDREDS_ROI['h'])
                roi_t = fitz.Rect(pdf_x + TENS_ROI['x'], pdf_y + TENS_ROI['y'], pdf_x + TENS_ROI['x'] + TENS_ROI['w'], pdf_y + TENS_ROI['y'] + TENS_ROI['h'])
                roi_u = fitz.Rect(pdf_x + UNITS_ROI['x'], pdf_y + UNITS_ROI['y'], pdf_x + UNITS_ROI['x'] + UNITS_ROI['w'], pdf_y + UNITS_ROI['y'] + UNITS_ROI['h'])
                roi_l = fitz.Rect(pdf_x + LETRAS_ROI['x'], pdf_y + LETRAS_ROI['y'], pdf_x + LETRAS_ROI['x'] + LETRAS_ROI['w'], pdf_y + LETRAS_ROI['y'] + LETRAS_ROI['h'])
                
                # --- Visual Debugging: Save ROI images ---
                try:
                    for i, r in enumerate([roi_h, roi_t, roi_u, roi_l]):
                        clip_pix = page.get_pixmap(clip=r, matrix=fitz.Matrix(5,5))
                        clip_pix.save(f"C:\\Users\\Julio\\.gemini\\tmp\\37de5d9c47a2664c8692bf00b9370dc4abd8448c50c2dac1ea9fdf710a2a4f1f\\roi_{flag_name}_{i}.png")
                except Exception as e:
                    print(f"    DEBUG: Failed to save ROI image: {e}")
                # --- End Visual Debugging ---

                digit_h = page.get_text("text", clip=roi_h).strip()
                digit_t = page.get_text("text", clip=roi_t).strip()
                digit_u = page.get_text("text", clip=roi_u).strip()
                
                print(f"    DEBUG: Extracted raw text for '{flag_name}': H='{digit_h}', T='{digit_t}', U='{digit_u}'")

                if digit_h.isdigit() and digit_t.isdigit() and digit_u.isdigit():
                    votos_numero = int(f"{digit_h}{digit_t}{digit_u}")
                    
                    votos_letras = " ".join(page.get_text("text", clip=roi_l).strip().lower().split())

                    inconsistencia = False
                    try:
                        votos_from_letras = w2n.word_to_num(votos_letras)
                        if votos_numero != votos_from_letras:
                            inconsistencia = True
                    except ValueError:
                        inconsistencia = True

                    print(f"    -> Extracted for '{flag_name}': {votos_numero} (Text: '{votos_letras}')")
                    results.append({
                        "id_departamento": iteration_params['id_departamento'], "id_municipio": iteration_params['id_municipio'],
                        "id_zona": iteration_params['id_zona'], "id_puesto": iteration_params['id_puesto'],
                        "numero_mesa": mesa_data.get('numero'), "url_acta_pdf": mesa_data.get('nombre_archivo'),
                        "nombre_partido": flag_name, "votos_numero": votos_numero,
                        "votos_letras": votos_letras, "inconsistencia_letras_numeros": inconsistencia
                    })
                    break 
            if results and results[-1]['nombre_partido'] == flag_name:
                break

    except Exception as e:
        print(f"  Error processing PDF for Mesa {mesa_data.get('numero')}: {e}")
    return results

def save_results_to_db(conn, results):
    """Saves a list of extracted results to the database."""
    if not results or not conn:
        return

    cursor = conn.cursor()
    sql = """
        INSERT INTO elecciones_actas_pdf 
        (id_departamento, id_municipio, id_zona, id_puesto, numero_mesa, url_acta_pdf, 
         nombre_partido, votos_numero, votos_letras, inconsistencia_letras_numeros)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE 
        votos_numero = VALUES(votos_numero), 
        votos_letras = VALUES(votos_letras),
        inconsistencia_letras_numeros = VALUES(inconsistencia_letras_numeros),
        updatedAt = CURRENT_TIMESTAMP
    """
    
    data_to_insert = [
        (
            r['id_departamento'], r['id_municipio'], r['id_zona'], r['id_puesto'],
            r['numero_mesa'], r['url_acta_pdf'], r['nombre_partido'], r['votos_numero'],
            r['votos_letras'], r['inconsistencia_letras_numeros']
        ) for r in results
    ]

    try:
        cursor.executemany(sql, data_to_insert)
        conn.commit()
        print(f"  -> Successfully saved/updated {cursor.rowcount} records in the database.")
    except mysql.connector.Error as err:
        print(f"  -> Error saving to database: {err}")
        conn.rollback()
    finally:
        cursor.close()

if __name__ == "__main__":
    db_conn = get_db_connection()
    if db_conn:
        party_flags = load_party_flags(PARTY_FLAGS_DIR)
        if not party_flags:
            print("No party flags loaded. Exiting.")
            db_conn.close()
            exit()

        print("\n--- Running a single PDF test ---")

        # Hardcoded parameters for a known valid PDF from previous tests
        test_params = {
            'id_departamento': '01', 'nombre_departamento': 'ATLANTIDA',
            'id_municipio': '001', 'nombre_municipio': 'LA CEIBA',
            'id_zona': '01', 
            'id_puesto': '006', 'nombre_puesto': 'ESCUELA FRANCISCO MORAZAN' # Name is a guess
        }
        
        api_url = build_api_url(test_params['id_departamento'], test_params['id_municipio'], test_params['id_zona'], test_params['id_puesto'])
        print(f"Querying test URL: {api_url}")
        
        pdf_data_list = fetch_pdf_data_from_api(api_url)

        if pdf_data_list:
            # Find the first entry with a valid URL
            target_mesa_entry = None
            for entry in pdf_data_list:
                if entry.get('nombre_archivo'):
                    target_mesa_entry = entry
                    break
            
            if target_mesa_entry:
                pdf_url = target_mesa_entry.get('nombre_archivo')
                print(f"Found test PDF URL: {pdf_url}")
                
                pdf_content = download_pdf(pdf_url)
                if pdf_content:
                    # 1. Save locally
                    target_dir = os.path.join(BASE_PDF_STORAGE_PATH, test_params['nombre_departamento'], test_params['nombre_municipio'], test_params['id_zona'], test_params['nombre_puesto'])
                    os.makedirs(target_dir, exist_ok=True)
                    original_filename = pdf_url.split('?')[0].split('/')[-1]
                    local_pdf_path = os.path.join(target_dir, original_filename)
                    
                    with open(local_pdf_path, 'wb') as f:
                        f.write(pdf_content)
                    print(f"Saved test PDF to: {local_pdf_path}")

                    # 2. Process the content from the file as requested by the user
                    print("Processing the saved PDF...")
                    with open(local_pdf_path, 'rb') as f_in:
                        saved_pdf_content = f_in.read()

                    extracted_results = process_pdf_and_extract_votes(
                        saved_pdf_content, party_flags, test_params, target_mesa_entry
                    )

                    # 3. Insert into DB
                    if extracted_results:
                        print("Attempting to save results to database...")
                        save_results_to_db(db_conn, extracted_results)
                    else:
                        print("No results were extracted from the PDF.")
            else:
                print("No valid PDF URL found in the API response for the test case.")
        else:
            print("Could not fetch data for the test case.")

        db_conn.close()
        print("\nDatabase connection closed.")


