import pandas as pd
import requests
import json
import math
import os
from io import StringIO
import datetime
import time

# ── Пути относительно этого файла ──────────────────────────────────────────
_HERE    = os.path.dirname(os.path.abspath(__file__))
SAVE_DIR = os.path.join(_HERE, 'Vzduch')          # сырая сетка сохраняется сюда
# Финальная обработка и запись в custom_areas — задача check_air.run()

MIN_LON, MAX_LON = 14.22, 14.71
MIN_LAT, MAX_LAT = 49.94, 50.17
GRID_STEPS_X = 60
GRID_STEPS_Y = 60

def get_aqi_level(value, component):
    if component in ['PM2_5', 'PM2.5']: 
        limits = [10, 20, 25, 50, 75]
    elif component == 'PM10': 
        limits = [20, 40, 50, 100, 150]
    elif component == 'NO2': 
        limits = [40, 90, 120, 230, 340]
    else: 
        return 1
        
    for i, m in enumerate(limits):
        if value <= m: 
            return i + 1
    return 6

def get_distance_km(lat1, lon1, lat2, lon2):
    dx = (lon1 - lon2) * 71.5
    dy = (lat1 - lat2) * 111.3
    return math.sqrt(dx**2 + dy**2)

def generate_live_grid():
    print(f"--- Сбор данных о воздухе: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
    
    try:
        csv_res = requests.get("https://opendata.chmi.cz/air_quality/now/data/airquality_1h_avg_CZ.csv")
        df = pd.read_csv(StringIO(csv_res.text))
        df.columns = df.columns.str.strip()
        
        meta = requests.get("https://opendata.chmi.cz/air_quality/now/metadata/metadata.json").json()
        
        latest_time = df['startTime'].max()
        current_data = df[df['startTime'] == latest_time]
        
        stations = []

        for loc in meta['data']['Localities']:
            if loc['BasicInfo']['Region'] in ['Praha', 'Hlavní město Praha']:
                name = loc['Name']
                lat, lon = loc['Localization']['LatAsNumber'], loc['Localization']['LonAsNumber']
                
                worst_index = 1
                data_found = False
                
                for program in loc.get('MeasuringPrograms', []):
                    for measurement in program.get('Measurements', []):
                        reg_id = int(measurement['IdRegistration'])
                        comp = measurement['ComponentCode']
                        
                        station_row = current_data[current_data['idRegistration'] == reg_id]
                        if not station_row.empty:
                            val = float(station_row['value'].values[0])
                            if val >= 0:
                                current_idx = get_aqi_level(val, comp)
                                if current_idx > worst_index:
                                    worst_index = current_idx
                                data_found = True
                
                if data_found:
                    stations.append({'name': name, 'lat': lat, 'lon': lon, 'aqi': worst_index})
                    print(f"Получено: {name:<30} | Индекс: {worst_index}")

        if not stations:
            print("Нет данных со станций.")
            return

        print("\nРасчет плавных облаков загрязнения...")
        lon_step = (MAX_LON - MIN_LON) / GRID_STEPS_X
        lat_step = (MAX_LAT - MIN_LAT) / GRID_STEPS_Y

        SIGMA = 1    
        BASE_AQI = 1.3 

 
        features_by_level = {1: [], 2: [], 3: [], 4: [], 5: [], 6: []}

        for x in range(GRID_STEPS_X):
            for y in range(GRID_STEPS_Y):
                lon1 = MIN_LON + x * lon_step
                lat1 = MIN_LAT + y * lat_step
                lon2 = lon1 + lon_step
                lat2 = lat1 + lat_step
                
                center_lon = lon1 + (lon_step / 2)
                center_lat = lat1 + (lat_step / 2)

                numerator = 0
                denominator = 0
                
                for st in stations:
                    dist_km = get_distance_km(center_lat, center_lon, st['lat'], st['lon'])
                    
                  
                    weight = math.exp(-0.5 * (dist_km / SIGMA)**2)
                    
                    numerator += weight * st['aqi']
                    denominator += weight
                
            
                if denominator < 0.001:
                    final_aqi = BASE_AQI
                else:
                    raw_aqi = numerator / denominator
                    mix_factor = min(1.0, denominator)
                    final_aqi = (raw_aqi * mix_factor) + (BASE_AQI * (1 - mix_factor))

                cell_aqi = round(final_aqi, 2)
                

                level = max(1, min(6, int(round(cell_aqi))))

                polygon = [
                    [lon1, lat1], [lon2, lat1], [lon2, lat2], [lon1, lat2], [lon1, lat1]
                ]

                feature = {
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [polygon]},
                    "properties": {"aqi": cell_aqi, "level": level}
                }
                
            
                features_by_level[level].append(feature)

   
        os.makedirs(SAVE_DIR, exist_ok=True)

        print("Saving...")
        for level_num, features in features_by_level.items():
            output_file = os.path.join(SAVE_DIR, f'air_level_{level_num}.geojson')

            if features:
                # Сохраняем сырые полигоны; check_air.run() смержит их в MultiPolygon
                geojson = {"type": "FeatureCollection", "features": features}
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(geojson, f)
                print(f"Уровень {level_num}: {len(features)} квадратов -> Vzduch/air_level_{level_num}.geojson")
            else:
                # Зон нет — удаляем старый файл, чтобы check_air не скопировал пустышку
                if os.path.exists(output_file):
                    os.remove(output_file)
                    print(f"Уровень {level_num}: зон нет, старый файл удалён.")

    except Exception as e:
        print(f"Ошибка при выполнении: {e}")

if __name__ == "__main__":
    import importlib.util, sys

    # ── Импорт check_air (та же папка Air/) ───────────────────────────────
    import check_air

    # ── Импорт fix_ids (Grapphopper/) ────────────────────────────────────
    _fix_ids_path = os.path.normpath(os.path.join(_HERE, '..', 'Grapphopper', 'fix_ids.py'))
    _spec = importlib.util.spec_from_file_location('fix_ids', _fix_ids_path)
    fix_ids = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(fix_ids)

    while True:
        # 1. Скачать данные → Air/Vzduch/
        generate_live_grid()

        # 2. Смержить в MultiPolygon → Grapphopper/custom_areas/
        print("\n[2/3] check_air: обработка зон воздуха...")
        check_air.run()

        # 3. Проверить/дополнить id у всех файлов в custom_areas
        print("\n[3/3] fix_ids: проверка идентификаторов...")
        fix_ids.run()

        print("\nОжидание 1 час до следующего обновления...")
        time.sleep(3600)