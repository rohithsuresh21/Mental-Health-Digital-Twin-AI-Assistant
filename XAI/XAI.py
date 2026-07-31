import numpy as np
from collections import defaultdict
from grouping import (
    get_feature_info, GROUP_ORDER, BASE_FEATURES, STAT_DESCRIPTIONS
)
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
class SHAPExplainer:
    def __init__(self, model, feature_names: list[str],
                 background_data: np.ndarray | None = None):

        if not SHAP_AVAILABLE:
            raise ImportError("pip install shap")
        self.model         = model
        self.feature_names = feature_names
        self.n_features    = len(feature_names)
        try:
            self.explainer = shap.TreeExplainer(model)
        except Exception:
            if background_data is not None:
                self.explainer = shap.Explainer(model, background_data)
            else:
                raise RuntimeError(
                    "Non-tree model requires background_data for SHAP Explainer"
                )
    def explain(self, X: np.ndarray) -> dict:

        if X.ndim == 1:
            X = X.reshape(1, -1)
        explanation = self.explainer(X)
        if isinstance(explanation, list):
            explanation = explanation[1]
        shap_values = explanation.values[0]
        base_value = float(explanation.base_values[0])
        named_features = []
        for i, (name, value) in enumerate(zip(self.feature_names, shap_values)):
            info = get_feature_info(name)
            if info is None:
                continue
            named_features.append({
                **info,
                "shap_value":    round(float(value), 5),
                "abs_impact":    round(abs(float(value)), 5),
                "direction":     "increases_risk" if value > 0 else "reduces_risk",
                "feature_value": round(float(X[0, i]), 4),
            })
        named_features.sort(key=lambda x: x["abs_impact"], reverse=True)
        group_impact = defaultdict(float)
        group_features = defaultdict(list)
        for f in named_features:
            group_impact[f["group"]]    += f["abs_impact"]
            group_features[f["group"]].append(f)
        groups_sorted = sorted(group_impact.items(),
                               key=lambda x: x[1], reverse=True)
        concept_impact = defaultdict(float)
        for f in named_features:
            concept_impact[f["concept"]]    += f["abs_impact"]
        concepts_sorted = sorted(concept_impact.items(),
                                 key=lambda x: x[1], reverse=True)
        top_concepts = concepts_sorted[:5]
        sentences = _generate_sentences(named_features[:10], top_concepts)
        return {
            "base_value": base_value,
            "top_features":      named_features[:15],
            "top_concepts":      [{"concept": c, "total_impact": round(v, 4)}
                                   for c, v in top_concepts],
            "group_impacts":     [{"group": g, "total_impact": round(v, 4)}
                                   for g, v in groups_sorted],
            "group_features":    {g: fs[:5] for g, fs in group_features.items()},
            "sentences":         sentences,
            "explanation_type":  "shap",
        }
def _generate_sentences(top_features: list, top_concepts: list) -> list[str]:

    sentences = []
    for concept, impact in top_concepts[:3]:
        matching = [f for f in top_features if f["concept"] == concept]
        if not matching:
            continue
        top_stat_feature = matching[0]
        direction        = top_stat_feature["direction"]
        stat             = top_stat_feature["stat"]
        stat_phrase = STAT_DESCRIPTIONS.get(stat,f"{stat} of { concept} ").format(concept=concept.lower())
        if direction == "increases_risk":
            sentences.append(
                f"{stat_phrase} contributed to increasing the model's predicted risk."
            )
        else:
            sentences.append(
                f"{stat_phrase} contributed to reducing the model's predicted risk."
            )
    return sentences