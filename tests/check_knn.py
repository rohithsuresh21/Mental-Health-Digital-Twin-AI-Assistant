import sys, json
d = json.load(sys.stdin)
for i, (o, sc) in enumerate(zip(d['overall_anomaly_scores'], d['detector_scores'])):
    m = sc['mahalanobis']; c = sc['copula']; iv = sc['isolation_forest']; k = sc['knn']
    print(f'{i+1:2d}  m={m:.3f}  c={c:.3f}  i={iv:.3f}  k={k:.3f}  ov={o:.3f}')
knns = [s['knn'] for s in d['detector_scores']]
print(f'\nKNN range: {min(knns):.3f} - {max(knns):.3f}  mean: {sum(knns)/len(knns):.3f}')
