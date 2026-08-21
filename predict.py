import sys
import json
import joblib
import pandas as pd
import argparse
import os


def load_pipeline():
    """
    Load the trained ML model, scaler, label encoder,
    and feature column information.
    """

    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(script_dir, 'models')

    metrics_path = os.path.join(models_dir, 'metrics.json')

    if not os.path.exists(metrics_path):
        raise FileNotFoundError(
            f"Metrics file not found at {metrics_path}. "
            f"Run train_model.py first."
        )

    with open(metrics_path, 'r') as f:
        metrics = json.load(f)

    # Select the model with the highest F1 score
    best_model_name = max(
        metrics,
        key=lambda k: metrics[k]['f1_score']
    )

    best_model_filename = (
        best_model_name.replace(' ', '_').lower() + '.pkl'
    )

    model_path = os.path.join(
        models_dir,
        best_model_filename
    )

    scaler_path = os.path.join(
        models_dir,
        'scaler.pkl'
    )

    le_path = os.path.join(
        models_dir,
        'label_encoder.pkl'
    )

    features_path = os.path.join(
        models_dir,
        'feature_columns.json'
    )

    # Load trained objects
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    le = joblib.load(le_path)

    with open(features_path, 'r') as f:
        feature_cols = json.load(f)

    return model, scaler, le, feature_cols


def predict_single(
    data,
    model,
    scaler,
    le,
    feature_cols
):
    """
    Make prediction for one network traffic record.
    """

    try:

        # Convert input dictionary into DataFrame
        df = pd.DataFrame([data])

        # Check that all required features exist
        for col in feature_cols:
            if col not in df.columns:
                return {
                    "error": f"Missing feature: {col}"
                }

        # Keep features in the same order used during training
        X = df[feature_cols]

        # Apply the same scaler used during training
        X_scaled = scaler.transform(X)

        # Predict class
        pred_idx = model.predict(X_scaled)[0]

        # Convert numeric class back to attack name
        prediction = le.inverse_transform(
            [pred_idx]
        )[0]

        # Get probabilities
        probs = model.predict_proba(X_scaled)[0]

        classes = le.classes_

        prob_dict = {
            str(classes[i]): float(probs[i])
            for i in range(len(classes))
        }

        confidence = prob_dict[prediction]

        return {
            "prediction": prediction,
            "confidence": float(confidence),
            "probabilities": prob_dict
        }

    except Exception as e:

        return {
            "error": str(e)
        }


def predict_batch(
    data_list,
    model,
    scaler,
    le,
    feature_cols
):
    """
    Make predictions for multiple network traffic records.
    """

    results = []

    for data in data_list:

        result = predict_single(
            data,
            model,
            scaler,
            le,
            feature_cols
        )

        results.append(result)

    return results


def server_mode(
    model,
    scaler,
    le,
    feature_cols
):
    """
    Persistent server mode.

    Node.js sends one JSON object per line.
    Python predicts it and returns one JSON result per line.

    The model is loaded only ONCE.
    """

    print(
        "ML prediction server ready",
        file=sys.stderr,
        flush=True
    )

    for line in sys.stdin:

        line = line.strip()

        if not line:
            continue

        try:

            data = json.loads(line)

            result = predict_single(
                data,
                model,
                scaler,
                le,
                feature_cols
            )

            # Send only JSON to stdout
            print(
                json.dumps(result),
                flush=True
            )

        except json.JSONDecodeError as e:

            print(
                json.dumps({
                    "error": f"Invalid JSON format: {str(e)}"
                }),
                flush=True
            )

        except Exception as e:

            print(
                json.dumps({
                    "error": str(e)
                }),
                flush=True
            )


if __name__ == '__main__':

    parser = argparse.ArgumentParser(
        description="5G Network Traffic ML Predictor"
    )

    parser.add_argument(
        '--batch',
        action='store_true',
        help="Accept an array of JSON objects"
    )

    parser.add_argument(
        '--server',
        action='store_true',
        help="Run as a persistent ML prediction server"
    )

    args = parser.parse_args()

    try:

        # ------------------------------------------------
        # Load model ONCE
        # ------------------------------------------------

        model, scaler, le, feature_cols = load_pipeline()

        # ------------------------------------------------
        # Persistent server mode
        # ------------------------------------------------

        if args.server:

            server_mode(
                model,
                scaler,
                le,
                feature_cols
            )

        # ------------------------------------------------
        # Normal one-shot / batch mode
        # ------------------------------------------------

        else:

            input_str = sys.stdin.read().strip()

            if not input_str:
                raise ValueError(
                    "No input provided. Pipe JSON data to stdin."
                )

            input_data = json.loads(input_str)

            if args.batch:

                if not isinstance(input_data, list):

                    raise ValueError(
                        "--batch flag used but input is not "
                        "a JSON array."
                    )

                result = predict_batch(
                    input_data,
                    model,
                    scaler,
                    le,
                    feature_cols
                )

            else:

                if isinstance(input_data, list):

                    raise ValueError(
                        "Input is a JSON array but "
                        "--batch flag is not used."
                    )

                result = predict_single(
                    input_data,
                    model,
                    scaler,
                    le,
                    feature_cols
                )

            print(
                json.dumps(
                    result,
                    indent=2
                )
            )

    except json.JSONDecodeError as e:

        print(
            json.dumps({
                "error": f"Invalid JSON format: {str(e)}"
            })
        )

        sys.exit(1)

    except Exception as e:

        print(
            json.dumps({
                "error": str(e)
            })
        )

        sys.exit(1)
