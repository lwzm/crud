#!/usr/bin/env python3

import json
import re

import requests
import yaml


columnFormatMap = {
    "integer": "number",
    "smallint": "number",
    "bigint": "number",

    "jsonb": "json",
    "json": "json",

    "text": "text",
    "character varying": "text",
    "character": "text",

    "boolean": "boolean",

    "timestamp without time zone": "datetime-local",
    "timestamp with time zone": "datetime-local",
    "date": "date",

    "double precision": "number",
    "real": "number",
    "numeric": "number",
}


def main():
    data = requests.get("http://127.0.0.1:3000/").json()
    fkRegExp = re.compile(r"<fk table='([^']+)' column='([^']+)'/>")

    tables = {}

    definitions = data["definitions"]
    with open("postgrest-patch.yaml") as f:
        patch = yaml.load(f)

    for table in definitions:
        tablePatch = patch.get(table, {})
        properties = definitions[table].get("properties", [])
        fields = {}
        primary = []
        for column, attrs in properties.items():
            desc = attrs.get("description", "")
            info = {
                "type": columnFormatMap[attrs["format"]]
            }
            foreignKey = fkRegExp.search(desc)
            if foreignKey:
                t, c = foreignKey.groups()
                info["ref"] = f"{t}.{c}"
            if "<pk" in desc:
                primary.append(column)
            #info.update(tablePatch.pop(column, {}))
            fields[column] = info

        t = {
            "table": table,
            "primary": ",".join(primary) or None,
            "fields": fields,
            "follows": {},
        }
        #t.update(tablePatch)
        tables[table] = t

    def _reg(token, key):
        if not token:
            return
        table, column = token.split(".")
        tables[table]["follows"][key] = column

    for table, t in tables.items():
        for column, c in t["fields"].items():
            _reg(c.get("ref"), f"{table}.{column}")

    print(json.dumps(tables, indent=4, ensure_ascii=False))


if __name__ == "__main__":
    """
    usage:
        ./swagger.py >tables.json
    """
    main()
