import urllib.request, json

boundary = '----DetCheck'
data = b''
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="fullName"\r\n\r\ntest_user\r\n'
with open('test_entries.txt', 'rb') as f:
    data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="docFile"; filename="test_entries.txt"\r\nContent-Type: text/plain\r\n\r\n' + f.read() + b'\r\n'
data += b'--' + boundary.encode() + b'--\r\n'
req = urllib.request.Request('http://127.0.0.1:3000/api/diagnose-with-files', data=data, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
resp = urllib.request.urlopen(req, timeout=600)
r = json.loads(resp.read().decode())
det = r.get('pipelineDetectorScores', [])
print(f'Total entries in detector_scores: {len(det)}')
if not det:
    print('NO DETECTOR DATA')
    exit()

# Print copula values across all entries
copula_vals = [s.get('copula', 0) for s in det]
print(f'Copula all values: min={min(copula_vals):.4f}, max={max(copula_vals):.4f}')
print(f'Copula unique values: {len(set(round(v,4) for v in copula_vals))}')
print(f'Copula sample (every 3rd): {[round(v,4) for v in copula_vals[::3]]}')

mahal_vals = [s.get('mahalanobis', 0) for s in det]
print(f'Mahalanobis: min={min(mahal_vals):.4f}, max={max(mahal_vals):.4f}')
print(f'Mahalanobis sample (every 3rd): {[round(v,4) for v in mahal_vals[::3]]}')

knn_vals = [s.get('knn', 0) for s in det]
print(f'KNN: min={min(knn_vals):.4f}, max={max(knn_vals):.4f}')
print(f'KNN sample (every 3rd): {[round(v,4) for v in knn_vals[::3]]}')

iso_vals = [s.get('isolation_forest', 0) for s in det]
print(f'IsolationForest: min={min(iso_vals):.4f}, max={max(iso_vals):.4f}')
print(f'IsolationForest sample (every 3rd): {[round(v,4) for v in iso_vals[::3]]}')
