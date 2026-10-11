#!/usr/bin/env python3
"""Builds the RoachNet theme packs in packs/themes into downloads/packs/*.zip
and writes their entries into collections/packs.json.

Zips are deterministic (sorted entries, fixed timestamps and modes), so the
same sources always give the same SHA-256. Each pack folder holds pack.json
(id, version, name, summary) and themes/*.roachtheme.json (and optionally
snippets/*.roachsnippet.json). RoachNet 1.1 installs them from
Settings > Packs; its theme store picks up themes from enabled packs.
"""
import hashlib, io, json, os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'packs', 'themes')
OUT = os.path.join(ROOT, 'downloads', 'packs')
CATALOG = os.path.join(ROOT, 'collections', 'packs.json')
BASE_URL = 'https://apps.roachnet.org/downloads/packs/'
check = '--check' in sys.argv
UPDATED_AT = '2026-10-11T18:00:00Z'
DESCRIPTION = (
    'Optional packs RoachWares publishes for RoachNet. Capability packs ship inside the app; '
    'everything here is a resource or theme pack the Pack Manager (Settings \u203a Packs) can install on demand. '
    'Resource pack URLs point at the signed descriptors on apps.roachnet.org, which name the public mirrors '
    'and the SHA-256 the runtime verifies before anything is unpacked. Theme pack URLs point straight at '
    'their zips on apps.roachnet.org. The digests below are those of the published archives, not of a local rebuild.'
)


def build_zip(folder):
    entries = []
    for sub in ('themes', 'snippets'):
        directory = os.path.join(folder, sub)
        if not os.path.isdir(directory):
            continue
        for name in sorted(os.listdir(directory)):
            if name.endswith('.roachtheme.json') or name.endswith('.roachsnippet.json'):
                with open(os.path.join(directory, name), 'rb') as handle:
                    data = handle.read()
                document = json.loads(data)
                schema = 'org.roachnet.theme.v1' if name.endswith('.roachtheme.json') else 'org.roachnet.theme-snippet.v1'
                if document.get('schema') != schema:
                    sys.exit(f'{name}: schema must be {schema}')
                entries.append((f'{sub}/{name}', data, document))
    if not entries:
        sys.exit(f'{folder}: no themes or snippets')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, data, _ in entries:
            info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    return buffer.getvalue(), entries


def main():
    catalog = json.load(open(CATALOG))
    built = []
    for pack_id in sorted(os.listdir(SOURCE)):
        folder = os.path.join(SOURCE, pack_id)
        if not os.path.isdir(folder):
            continue
        meta = json.load(open(os.path.join(folder, 'pack.json')))
        if meta['id'] != pack_id:
            sys.exit(f'{pack_id}: pack.json id is {meta["id"]}')
        data, entries = build_zip(folder)
        filename = f'{pack_id}-{meta["version"]}.zip'
        target = os.path.join(OUT, filename)
        if check:
            if not os.path.exists(target) or open(target, 'rb').read() != data:
                sys.exit(f'{filename} is out of date; run python3 scripts/build-theme-packs.py')
        else:
            os.makedirs(OUT, exist_ok=True)
            with open(target, 'wb') as handle:
                handle.write(data)
        digest = hashlib.sha256(data).hexdigest()
        names = [document['name'] for path, _, document in entries if path.startswith('themes/')]
        built.append({
            'schema': 'org.roachnet.pack.v1',
            'id': pack_id,
            'version': meta['version'],
            'kind': 'theme',
            'name': meta['name'],
            'summary': meta['summary'],
            'publisher': 'RoachWares LLC',
            'requires': {'roachnet': '1.1.0', 'platforms': ['macos']},
            'dependencies': [],
            'capabilities': [],
            'resources': [{
                'path': filename,
                'url': BASE_URL + filename,
                'sha256': digest,
                'bytes': len(data),
                'archive': 'zip',
            }],
            'dataRoots': [],
            'themes': names,
        })
        print(f'{filename}: {len(data)} bytes, sha256 {digest}, {len(names)} themes')
    others = [pack for pack in catalog['packs'] if pack.get('kind') != 'theme']
    if [pack for pack in catalog['packs'] if pack.get('kind') == 'theme'] != built:
        catalog['updatedAt'] = UPDATED_AT
    catalog['description'] = DESCRIPTION
    catalog['packs'] = others + built
    rendered = json.dumps(catalog, indent=2, ensure_ascii=False) + '\n'
    if check:
        if open(CATALOG).read() != rendered:
            sys.exit('collections/packs.json theme entries are out of date; run python3 scripts/build-theme-packs.py')
        print('theme packs are current')
    else:
        with open(CATALOG, 'w') as handle:
            handle.write(rendered)


main()
