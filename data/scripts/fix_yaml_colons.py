import re, glob

files = glob.glob('/home/k1/public/states_during_regime_change/data/raw/libya/**/*.yaml', recursive=True)

def fix_yaml_colons(content):
    lines = content.split('\n')
    fixed = []
    for line in lines:
        m = re.match(r'^(\s+)(assessment|notes): (.+)$', line)
        if m:
            indent = m.group(1)
            key = m.group(2)
            val = m.group(3)
            if ':' in val and not (val.startswith('"') or val.startswith("'")):
                val = val.replace('"', '\\"')
                line = f'{indent}{key}: "{val}"'
        fixed.append(line)
    return '\n'.join(fixed)

for fp in files:
    with open(fp, 'r') as f:
        content = f.read()
    new_content = fix_yaml_colons(content)
    if new_content != content:
        with open(fp, 'w') as f:
            f.write(new_content)
        print(f'Fixed: {fp.split("/")[-1]}')

print('Done')
