import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error


def evaluate(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    mask = actual != 0
    return {
        "MAE": float(mean_absolute_error(actual, predicted)),
        "RMSE": float(np.sqrt(mean_squared_error(actual, predicted))),
        "MAPE": float(
            np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        )
        if mask.any()
        else None,
        "count": len(actual),
    }
