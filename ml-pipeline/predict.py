import sys
import json
import joblib
import pandas as pd
import argparse
import os
import numpy as np

from tensorflow.keras.models import load_model


def load_pipeline():

    """
    Load the best trained ML/DL model,
    scaler, label encoder and feature information.
    """

    script_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    models_dir = os.path.join(
        script_dir,
        'models'
    )

    # --------------------------------------------------
    # Metrics
    # --------------------------------------------------

    metrics_path = os.path.join(
        models_dir,
        'metrics.json'
    )

    if not os.path.exists(
        metrics_path
    ):

        raise FileNotFoundError(

            f"Metrics file not found at "
            f"{metrics_path}. "

            f"Run train_model.py first."
        )

    with open(
        metrics_path,
        'r'
    ) as f:

        metrics = json.load(f)

    # --------------------------------------------------
    # Select best model
    # --------------------------------------------------

    best_model_name = max(

        metrics,

        key=lambda name:
        metrics[name]['f1_score']
    )

    print(

        f"Best model selected: "
        f"{best_model_name}",

        file=sys.stderr,

        flush=True
    )

    # --------------------------------------------------
    # Common files
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Load scaler
    # --------------------------------------------------

    scaler = joblib.load(
        scaler_path
    )

    # --------------------------------------------------
    # Load label encoder
    # --------------------------------------------------

    le = joblib.load(
        le_path
    )

    # --------------------------------------------------
    # Load feature columns
    # --------------------------------------------------

    with open(
        features_path,
        'r'
    ) as f:

        feature_cols = json.load(f)

    # --------------------------------------------------
    # Load selected model
    # --------------------------------------------------

    if best_model_name == 'Deep Learning':

        model_path = os.path.join(

            models_dir,

            'deep_learning.keras'
        )

        model = load_model(
            model_path
        )

        model_type = 'deep_learning'

    else:

        model_filename = (

            best_model_name
            .replace(' ', '_')
            .lower()
            + '.pkl'
        )

        model_path = os.path.join(

            models_dir,

            model_filename
        )

        model = joblib.load(
            model_path
        )

        model_type = 'machine_learning'

    return (
        model,
        scaler,
        le,
        feature_cols,
        model_type,
        best_model_name
    )


def predict_single(
    data,
    model,
    scaler,
    le,
    feature_cols,
    model_type
):

    """
    Make prediction for one network
    traffic record.
    """

    try:

        # --------------------------------------------------
        # Convert input to DataFrame
        # --------------------------------------------------

        df = pd.DataFrame(
            [data]
        )

        # --------------------------------------------------
        # Check required features
        # --------------------------------------------------

        for col in feature_cols:

            if col not in df.columns:

                return {

                    "error":
                    f"Missing feature: {col}"
                }

        # --------------------------------------------------
        # Keep feature order
        # --------------------------------------------------

        X = df[
            feature_cols
        ]

        # --------------------------------------------------
        # Scale
        # --------------------------------------------------

        X_scaled = scaler.transform(
            X
        )

        # ==================================================
        # DEEP LEARNING PREDICTION
        # ==================================================

        if model_type == 'deep_learning':

            probabilities = model.predict(

                X_scaled,

                verbose=0
            )[0]

            pred_idx = int(
                np.argmax(
                    probabilities
                )
            )

            probs = probabilities

        # ==================================================
        # MACHINE LEARNING PREDICTION
        # ==================================================

        else:

            pred_idx = int(
                model.predict(
                    X_scaled
                )[0]
            )

            probs = model.predict_proba(
                X_scaled
            )[0]

        # --------------------------------------------------
        # Convert class index to label
        # --------------------------------------------------

        prediction = le.inverse_transform(

            [pred_idx]
        )[0]

        # --------------------------------------------------
        # Probability dictionary
        # --------------------------------------------------

        classes = le.classes_

        prob_dict = {

            str(classes[i]):
            float(probs[i])

            for i in range(
                len(classes)
            )
        }

        # --------------------------------------------------
        # Confidence
        # --------------------------------------------------

        confidence = prob_dict[
            prediction
        ]

        return {

            "prediction":
            prediction,

            "confidence":
            float(confidence),

            "probabilities":
            prob_dict
        }

    except Exception as e:

        return {

            "error":
            str(e)
        }


def predict_batch(
    data_list,
    model,
    scaler,
    le,
    feature_cols,
    model_type
):

    """
    Make predictions for multiple
    network traffic records.
    """

    results = []

    for data in data_list:

        result = predict_single(

            data,

            model,

            scaler,

            le,

            feature_cols,

            model_type
        )

        results.append(
            result
        )

    return results


def server_mode(
    model,
    scaler,
    le,
    feature_cols,
    model_type
):

    """
    Persistent prediction server.

    Node.js sends one JSON object per line.

    Python returns one JSON result
    per line.
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

            data = json.loads(
                line
            )

            result = predict_single(

                data,

                model,

                scaler,

                le,

                feature_cols,

                model_type
            )

            print(

                json.dumps(
                    result
                ),

                flush=True
            )

        except json.JSONDecodeError as e:

            print(

                json.dumps({

                    "error":
                    f"Invalid JSON format: {str(e)}"
                }),

                flush=True
            )

        except Exception as e:

            print(

                json.dumps({

                    "error":
                    str(e)
                }),

                flush=True
            )


if __name__ == '__main__':

    parser = argparse.ArgumentParser(

        description=
        "5G Network Traffic ML/DL Predictor"
    )

    parser.add_argument(

        '--batch',

        action='store_true',

        help=
        "Accept an array of JSON objects"
    )

    parser.add_argument(

        '--server',

        action='store_true',

        help=
        "Run as a persistent prediction server"
    )

    args = parser.parse_args()

    try:

        # ------------------------------------------------
        # Load model ONCE
        # ------------------------------------------------

        (
            model,
            scaler,
            le,
            feature_cols,
            model_type,
            best_model_name
        ) = load_pipeline()

        # ------------------------------------------------
        # Persistent server mode
        # ------------------------------------------------

        if args.server:

            server_mode(

                model,

                scaler,

                le,

                feature_cols,

                model_type
            )

        # ------------------------------------------------
        # Batch mode
        # ------------------------------------------------

        elif args.batch:

            input_data = json.load(
                sys.stdin
            )

            results = predict_batch(

                input_data,

                model,

                scaler,

                le,

                feature_cols,

                model_type
            )

            print(
                json.dumps(
                    results,
                    indent=2
                )
            )

        # ------------------------------------------------
        # Single prediction
        # ------------------------------------------------

        else:

            parser.print_help()

    except Exception as e:

        print(

            json.dumps({

                "error":
                str(e)
            }),

            file=sys.stderr
        )

        sys.exit(1)
