import os
import sys
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon

def merge_polygons(input_geojson, output_geojson, buffer_distance=5):
    print(f"Загружаю {input_geojson}...")
    try:
        gdf = gpd.read_file(input_geojson)
    except Exception as e:
        print(f"Ошибка при загрузке файла: {e}")
        return

    original_crs = gdf.crs
    if original_crs is None:
        original_crs = "EPSG:4326"
        gdf.set_crs(original_crs, inplace=True)
        
    print("Перевожу в метрическую систему (EPSG:32633)...")
    gdf = gdf.to_crs("EPSG:32633")
    
    # АГРЕССИВНОЕ УПРОЩЕНИЕ СРАЗУ (помогает при сложных геометриях)
    print("Первичное упрощение исходных данных (5м)...")
    gdf['geometry'] = gdf.geometry.simplify(5.0)
    
    print(f"Склеиваю зоны с допуском {buffer_distance * 2} метров...")
    # Исправляем геометрию (legacy fix)
    gdf['geometry'] = gdf.geometry.buffer(0)
    
    # Расширяем полигоны
    buffered = gdf.geometry.buffer(buffer_distance)
    
    # Упрощаем КАЖДЫЙ кусок перед объединением
    print("Предварительное упрощение компонентов (1м)...")
    buffered = buffered.simplify(1.0)
    
    # Объединяем (union_all)
    print("Выполняю объединение (union_all)...")
    final_geom = None
    
    try:
        # Если геометрий слишком много, пробуем объединить
        if len(buffered) > 3000:
             print(f"Много полигонов ({len(buffered)}), пропускаем полное объединение для скорости. Используем список отдельных полигонов.")
             final_geom = buffered
        else:
            if hasattr(buffered, "union_all"):
                 final_geom = buffered.union_all()
            else:
                 final_geom = buffered.unary_union
    except Exception as e:
        print(f"Ошибка объединения: {e}. Используем набор полигонов без объединения.")
        final_geom = buffered

    # Убеждаемся, что у нас есть геометрия
    if final_geom is None:
        print("Ошибка: пустая геометрия!")
        return

    # Финальное упрощение (только если это одиночная сложная геометрия)
    print("Финальное упрощение (2м)...")
    if hasattr(final_geom, 'simplify'):
        final_geom = final_geom.simplify(tolerance=2.0)
    
    # Создаем итоговый GeoDataFrame
    # Если это GeoSeries (когда мы пропустили объединение или оно не удалось), то конструктор GeoDataFrame поймет
    # Если это Shapely Geometry (Polygon/MultiPolygon), то нужно обернуть в список
    if isinstance(final_geom, (gpd.GeoSeries, gpd.GeoDataFrame)):
        merged_gdf = gpd.GeoDataFrame(geometry=final_geom, crs="EPSG:32633")
    else:
        merged_gdf = gpd.GeoDataFrame(geometry=[final_geom], crs="EPSG:32633")
    
    print("Возвращаю исходные координаты...")
    merged_gdf = merged_gdf.to_crs(original_crs)

    # GraphHopper требует уникальные area id; без них получается `area null already exists`
    merged_gdf["id"] = [f"park_{index + 1}" for index in range(len(merged_gdf))]
    
    print(f"Сохраняю результат в {output_geojson}...")
    merged_gdf.to_file(output_geojson, driver='GeoJSON')
    print("Готово! Файл сохранен.")

if __name__ == "__main__":
    # Получаем абсолютный путь к папке, где лежит этот скрипт (GreenZone)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Поднимаемся на уровень выше, в корень проекта (Tichá Praha)
    project_root = os.path.dirname(script_dir)
    
    # Формируем пути относительно корня проекта
    input_file = os.path.join(script_dir, "Parks.geojson")
    output_dir = os.path.join(project_root, "Grapphopper", "custom_areas")
    
    # Создаем папку, если ее нет
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "merged_parks.geojson")
    
    print(f"Входной файл: {input_file}")
    print(f"Выходная папка: {output_dir}")
    
    buffer_dist = 5.0 
    
    merge_polygons(input_file, output_file, buffer_distance=buffer_dist)