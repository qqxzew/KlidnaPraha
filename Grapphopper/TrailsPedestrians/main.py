import json
import os

# Проверяем пути к файлам
current_dir = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.join(current_dir, 'PedestriansRoads.geojson')
output_file = os.path.join(current_dir, 'pedestrian_trails.osm')

def convert():
    print(f"Загрузка файла: {input_file}")
    if not os.path.exists(input_file):
        print("Ошибка: Файл GeoJSON не найден!")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes_dict = {}  # Словарь для хранения координат и их ID
    ways = []
    next_node_id = 1
    way_id = 1

    print("Обработка геометрии и 'сварка' пересечений...")
    for feature in data.get('features', []):
        geom = feature.get('geometry')
        if not geom or geom.get('type') not in ['LineString', 'MultiLineString']:
            continue

        lines = geom['coordinates'] if geom['type'] == 'MultiLineString' else [geom['coordinates']]

        for line in lines:
            node_refs = []
            for lon, lat in line:
                # Округляем до 7 знаков (точность ~1 см), чтобы склеить точки
                r_lat = round(lat, 7)
                r_lon = round(lon, 7)
                coords = (r_lat, r_lon)
                
                # Если такой координаты еще не было, создаем новую точку
                if coords not in nodes_dict:
                    nodes_dict[coords] = next_node_id
                    next_node_id += 1
                    
                # Добавляем ID точки в текущую дорогу
                node_refs.append(nodes_dict[coords])
            
            # Дорога должна иметь хотя бы 2 точки (начало и конец)
            if len(node_refs) > 1:
                ways.append((way_id, node_refs))
                way_id += 1

    print(f"Найдено уникальных узлов: {len(nodes_dict)}")
    print(f"Сформировано дорог: {len(ways)}")
    print(f"Сохранение в файл: {output_file}...")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<osm version="0.6" generator="python-script">\n')
        
        # 1. Сначала записываем все уникальные узлы
        for (lat, lon), n_id in nodes_dict.items():
            f.write(f'  <node id="{n_id}" lat="{lat}" lon="{lon}" />\n')
        
        # 2. Затем записываем дороги, состоящие из этих узлов
        for w_id, refs in ways:
            f.write(f'  <way id="{w_id}">\n')
            for ref in refs:
                f.write(f'    <nd ref="{ref}" />\n')
            # Теги, чтобы движок понял, что тут можно ходить пешком
            f.write('    <tag k="highway" v="footway" />\n')
            f.write('    <tag k="foot" v="designated" />\n')
            f.write('    <tag k="surface" v="paved" />\n')
            f.write('  </way>\n')
        
        f.write('</osm>\n')
    print("Готово. Файл pedestrian_trails.osm обновлен.")

if __name__ == "__main__":
    convert()
    