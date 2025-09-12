# Overpass Query Builder

A user-friendly web interface for building Overpass QL queries to extract data from OpenStreetMap.

![Screenshot](screenshot.png)

## Features

- **Intuitive Query Builder**: Easily create complex Overpass QL queries without memorizing the syntax
- **Multiple Element Types**: Query nodes, ways, relations, or any combination
- **Flexible Conditions**: Support for various operators including =, !=, ~ (regex), and more
- **Bounding Box Support**: Set a geographic area for your query
- **Location Detection**: Automatically set the bounding box to your current location
- **Examples**: Load example queries to get started quickly
- **One-Click Testing**: Open your query directly in Overpass Turbo or Overpass Ultra

## How to Use

1. **Set a Bounding Box (Optional)**
   - Manually enter coordinates or click "Use My Location"
   - Or leave blank to search the entire world (not recommended for broad queries)

2. **Add Query Conditions**
   - Select an element type (Node, Way, Relation, or Any)
   - Enter a tag key (e.g., `amenity`, `shop`, `tourism`)
   - Choose an operator (equals, not equals, regex, etc.)
   - Enter the tag value (e.g., `restaurant`, `cafe`, `hotel`)
   - Click "Add Condition" to add more conditions

3. **Generate and Use Your Query**
   - Click "Generate Query" to create the Overpass QL
   - Copy the query to clipboard
   - Or open it directly in Overpass Turbo or Overpass Ultra

## Examples

### Find all restaurants in an area
- Element: Node/Way/Relation
- Key: `amenity`
- Operator: `=`
- Value: `restaurant`

### Find all hotels with 4 or more stars
- Element: Node/Way/Relation
- Key: `tourism`
- Operator: `=`
- Value: `hotel`
- Add another condition:
  - Key: `stars`
  - Operator: `>=`
  - Value: `4`

### Find all cafes with WiFi (using regex)
- Element: Node/Way/Relation
- Key: `amenity`
- Operator: `=`
- Value: `cafe`
- Add another condition:
  - Key: `internet_access`
  - Operator: `~`
  - Value: `wlan|wifi|yes`

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/overpass-query-builder.git
   cd overpass-query-builder
   ```

2. Open `index.html` in your web browser

## Dependencies

- [Bootstrap 5.3](https://getbootstrap.com/)
- [Bootstrap Icons](https://icons.getbootstrap.com/)

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Overpass Turbo](https://overpass-turbo.eu/)
- [Overpass Ultra](https://overpass-ultra.us/)
