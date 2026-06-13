import subprocess, time, json, sys, re
import os

os.chdir('D:/Projects/vein')

proc = subprocess.Popen(
    ['node', 'server/index.js'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
time.sleep(3)

PREFIX = 'Authorization'
SCHEME = 'Bearer'

def do_api(method, path, data=None, tok=None):
    url = 'http://localhost:54321' + path
    args = ['curl', '-s', '-X', method, url]
    if tok:
        args.extend(['-H', PREFIX + ': ' + SCHEME + ' ' + tok])
    args.extend(['-H', 'Content-Type: application/json'])
    if data:
        args.extend(['-d', json.dumps(data)])
    r = subprocess.run(args, capture_output=True, text=True, timeout=10)
    return r.stdout

try:
    out = do_api('POST', '/api/auth/login', {'username': 'admin', 'password': 'admin123'})
    match = re.search(r'"token":"([^"]+)"', out)
    if not match:
        print('FAIL:', out[:300])
        sys.exit(1)
    token = match.group(1)
    print('1. Login OK')

    out = do_api('POST', '/api/inbounds', {'protocol': 'vmess', 'port': 10086, 'remark': 'test'}, token)
    print('2. Create inbound:', out)

    out = do_api('GET', '/api/inbounds', tok=token)
    items = json.loads(out)
    print('3. Inbounds: %d' % len(items))

    out = do_api('POST', '/api/inbounds/1/clients', {'email': 'user@vein.io'}, token)
    print('4. Add client:', out)

    out = do_api('GET', '/api/inbounds/1/clients', tok=token)
    clients = json.loads(out)
    print('5. Clients: %d' % len(clients))

    out = do_api('GET', '/api/system/stats', tok=token)
    s = json.loads(out)
    print('6. System: CPU=%s%% RAM=%s%%' % (s['cpu']['percent'], s['memory']['percent']))

    out = do_api('GET', '/api/xray/status', tok=token)
    print('7. Xray:', out)

    print('ALL PASSED')
finally:
    proc.terminate()
    proc.wait()
