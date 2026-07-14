"""Test the exact flow the React UI uses: submit via Node server's /api/diagnose-with-files"""
import urllib.request, json

# This simulates a name-only submission (like React UI does)
boundary = '----TestUIBoundary'
data = b''
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="fullName"\r\n\r\ntest_user\r\n'
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="sleepDuration"\r\n\r\n7\r\n'
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="sleepQuality"\r\n\r\n3\r\n'
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="physicalActivity"\r\n\r\n3\r\n'
data += b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="lookaheadHorizon"\r\n\r\n5 days\r\n'
data += b'--' + boundary.encode() + b'--\r\n'

req = urllib.request.Request('http://127.0.0.1:3000/api/diagnose-with-files', data=data, 
    headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})

try:
    resp = urllib.request.urlopen(req, timeout=600)
    r = json.loads(resp.read().decode())
    
    det = r.get('pipelineDetectorScores', [])
    print(f'pipelineDetectorScores entries: {len(det)}')
    print(f'Keys in first entry: {list(det[0].keys()) if det else "NONE"}')
    
    if det:
        print(f'First entry: {json.dumps(det[0], indent=2)}')
        print(f'Last entry: {json.dumps(det[-1], indent=2)}')
        
        # Check all values for copula
        copula_vals = [d.get('copula', 0) for d in det]
        print(f'\nCopula: {len(set(round(v,4) for v in copula_vals))} unique values, range [{min(copula_vals):.4f}, {max(copula_vals):.4f}]')
        mahal_vals = [d.get('mahalanobis', 0) for d in det]
        print(f'Mahalanobis: {len(set(round(v,4) for v in mahal_vals))} unique values, range [{min(mahal_vals):.4f}, {max(mahal_vals):.4f}]')
        iso_vals = [d.get('isolation_forest', 0) for d in det]
        print(f'IsolationForest: {len(set(round(v,4) for v in iso_vals))} unique values, range [{min(iso_vals):.4f}, {max(iso_vals):.4f}]')
        knn_vals = [d.get('knn', 0) for d in det]
        print(f'KNN: {len(set(round(v,4) for v in knn_vals))} unique values, range [{min(knn_vals):.4f}, {max(knn_vals):.4f}]')
    
    timestamps = r.get('pipelineTimestamps', [])
    print(f'\npipelineTimestamps: {len(timestamps)} entries')
    print(f'First 3: {timestamps[:3] if timestamps else "NONE"}')
    
except Exception as e:
    print(f'ERROR: {e}')
    # Read error body if available
    try:
        body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f'Body: {body[:500]}')
    except:
        pass
