"""Artillery Load Test output converter.

Usage: python artillery-convert.py [filename]

Expects a filename with .json extension, and will generate a file
with a CSV extension.
"""
import csv
import json
from collections import namedtuple
from sys import argv

basename = argv[1]

Row = namedtuple('Row', ['users', 'median', 'p95', 'p99'])

with open(f'{basename}.json', 'r') as f:
    data = json.loads(f.read())

rows = []

for x in data['intermediate']:
    if 'counters' not in x:
        continue
    if 'vusers.created' not in x['counters']:
        continue
    if 'vusers.session_length' not in x['summaries']:
        continue
    row = Row(x['counters']['vusers.created'], x['summaries']['vusers.session_length']['median'],
    x['summaries']['vusers.session_length']['p95'],
    x['summaries']['vusers.session_length']['p99'])
    rows.append(row)
with open(f'{basename}.csv', 'w') as csvfile:
    writer = csv.writer(csvfile)
    for r in rows:
        writer.writerow(r)